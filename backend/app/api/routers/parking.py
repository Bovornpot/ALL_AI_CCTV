# backend/app/api/routers/parking.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import Optional, List
from datetime import date, timedelta, datetime
from fastapi import Query
import math

from app import database, schemas, api_schemas
from app.api.deps import get_db

router = APIRouter(prefix="/parking_violations", tags=["Parking Violations"])

@router.get("/", response_model=List[schemas.ParkingViolationData])
def get_parking_violations(
     skip: int=0, 
     limit: int=100, 
     branch_id: Optional[str]=None, 
     db: Session=Depends(get_db)
     ):
    query = db.query(database.DBParkingViolation)
    if branch_id:
        query = query.filter(database.DBParkingViolation.branch_id.ilike(f"{branch_id}%"))
    return query.offset(skip).limit(limit).all()

#--- ข้อมูลสรุป KPI Card, Chart, Top Branch---#
@router.get(
    "/summary",
    response_model=api_schemas.ViolationSummaryResponse,
    summary="Get Aggregated Summary of Parking Violations"
)
def get_violation_summary(
    db: Session = Depends(get_db),
    branch_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    group_by_unit: str = 'day'
):
    """
    Endpoint นี้จะคำนวณและรวบรวมข้อมูลสรุปทั้งหมดสำหรับหน้า Parking Violations:
    1.  คำนวณ KPI Cards
    2.  คำนวณข้อมูลสำหรับ Chart (จัดกลุ่มรายวัน)
    3.  คำนวณ Top 5 สาขาที่มีการละเมิดสูงสุด
    """
    # ถ้าไม่มีการส่งวันที่มา ให้ใช้ Default เป็น 7 วันล่าสุด
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=6)

    # สร้าง Base Query เพื่อเป็นตัวตั้งต้น    
    base_query = db.query(database.DBParkingViolation)

    # เงื่อนไข .filter() เข้าไปใน Base Query ถ้ามีการส่งค่ามา
    if branch_id:
        base_query = base_query.filter(database.DBParkingViolation.branch_id.startswith(branch_id))
    if start_date:
        base_query = base_query.filter(database.DBParkingViolation.timestamp >= start_date)
    if end_date:
        # บวกไป 1 วันเพื่อให้ครอบคลุมข้อมูลของ end_date ทั้งวัน
        base_query = base_query.filter(database.DBParkingViolation.timestamp < (end_date + timedelta(days=1)))

    # --- 1. คำนวณข้อมูลสำหรับ KPI Cards ---

    total_unique_branches = base_query.with_entities(func.count(func.distinct(database.DBParkingViolation.branch_id))).scalar() or 0
    
    # online_threshold = datetime.utcnow() - timedelta(minutes=15)
    # online_branches_count = db.query(func.count(database.DBParkingViolation.branch_id.distinct()))\
    #     .filter(database.DBParkingViolation.timestamp >= online_threshold)\
    #     .scalar() or 0
    
    total_violations = base_query.filter(database.DBParkingViolation.is_violation == True).count()
    ongoing_violations = base_query.filter(
        database.DBParkingViolation.is_violation == True,
        database.DBParkingViolation.exit_time.is_(None)
    ).count()

    avg_duration_violation = base_query.with_entities(func.avg(database.DBParkingViolation.duration_minutes)).filter(database.DBParkingViolation.is_violation == True).scalar() or 0
    avg_duration_normal = base_query.with_entities(func.avg(database.DBParkingViolation.duration_minutes)).filter(database.DBParkingViolation.is_violation == False).scalar() or 0
    total_sessions = base_query.count()

    kpi_data = api_schemas.ParkingKpiData(
        totalViolations=total_violations,
        ongoingViolations=ongoing_violations,
        total_parking_sessions=total_sessions,
        avgViolationDuration=round(avg_duration_violation, 1),
        avgNormalParkingTime=round(avg_duration_normal, 1),
        onlineBranches=total_unique_branches
    )

    # --- 2. คำนวณข้อมูลสำหรับ Violations Chart (เปรียบเทียบ รถจอดเกิน vs รถทั้งหมด) ---
    chart_data = []

    # total = base_query (รวมทุกคันในช่วงที่กรองแล้ว)
    total_query = base_query
    # violation = เฉพาะที่ is_violation == True
    violation_query = base_query.filter(database.DBParkingViolation.is_violation == True)

    # --- Hourly ---
    if group_by_unit == 'hour':
        total_results = total_query.with_entities(
            func.date_trunc('hour', database.DBParkingViolation.timestamp).label("label_dt"),
            func.count(database.DBParkingViolation.id).label("total")   # <- นับ rows (sessions), ไม่ใช่ distinct car_id
        ).group_by("label_dt").all()

        violation_results = violation_query.with_entities(
            func.date_trunc('hour', database.DBParkingViolation.timestamp).label("label_dt"),
            func.count(database.DBParkingViolation.id).label("violations")  # <- นับ rows ที่เป็น violation
        ).group_by("label_dt").all()

        # map datetime -> counts, format key as "HH:00"
        total_map = {
            (r.label_dt.strftime("%H:00") if hasattr(r.label_dt, "strftime") else str(r.label_dt)): r.total
            for r in total_results
        }
        violation_map = {
            (r.label_dt.strftime("%H:00") if hasattr(r.label_dt, "strftime") else str(r.label_dt)): r.violations
            for r in violation_results
        }

        for hour in range(24):
            hour_str = f"{hour:02d}:00"
            chart_data.append(
                api_schemas.ViolationChartDataPoint(
                    label=hour_str,
                    value=violation_map.get(hour_str, 0),
                    total=total_map.get(hour_str, 0)
                )
            )

    # --- Day / Week / Month ---
    elif group_by_unit in ['day', 'week', 'month']:
        total_results = total_query.with_entities(
            cast(database.DBParkingViolation.timestamp, Date).label("label_date"),
            func.count(database.DBParkingViolation.id).label("total")   # <- ใช้ id (rows)
        ).group_by("label_date").all()

        violation_results = violation_query.with_entities(
            cast(database.DBParkingViolation.timestamp, Date).label("label_date"),
            func.count(database.DBParkingViolation.id).label("violations")  # <- ใช้ id (rows)
        ).group_by("label_date").all()

        def date_key(d):
            if hasattr(d, "strftime"):
                # return d.strftime("%Y-%m-%d")
                return d.strftime("%d/%m/%Y")
            return str(d)

        total_map = {date_key(r.label_date): r.total for r in total_results}
        violation_map = {date_key(r.label_date): r.violations for r in violation_results}

        current_date = start_date
        while current_date <= end_date:
            # date_str = current_date.strftime("%Y-%m-%d")
            date_str = current_date.strftime("%d/%m/%Y")
            label_display = current_date.strftime("%d/%m") if group_by_unit == 'month' else date_str

            chart_data.append(
                api_schemas.ViolationChartDataPoint(
                    label=label_display,
                    value=violation_map.get(date_str, 0),
                    total=total_map.get(date_str, 0)
                )
            )
            current_date += timedelta(days=1)

    # --- Week Range, Month Range ---
    elif group_by_unit in ['week_range', 'month_range']:
        # Group ตามวันที่ก่อน แล้วค่อยแปลง label ภายหลัง
        total_results = total_query.with_entities(
            cast(database.DBParkingViolation.timestamp, Date).label("label_date"),
            func.count(database.DBParkingViolation.id).label("total")
        ).group_by("label_date").all()

        violation_results = violation_query.with_entities(
            cast(database.DBParkingViolation.timestamp, Date).label("label_date"),
            func.count(database.DBParkingViolation.id).label("violations")
        ).group_by("label_date").all()

        # สร้าง dict เพื่อ lookup
        def date_key(d):
            return d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)

        total_map = {date_key(r.label_date): r.total for r in total_results}
        violation_map = {date_key(r.label_date): r.violations for r in violation_results}
        
        # --- Week Range ---
        if group_by_unit == 'week_range':
            # รวมข้อมูลเป็นรายสัปดาห์
            weekly_summary = {}
            for date_str, total in total_map.items():
                d = datetime.strptime(date_str, "%Y-%m-%d").date()
                year, week, _ = d.isocalendar()
                key = (year, week)
                weekly_summary.setdefault(key, {"total": 0, "violations": 0})
                weekly_summary[key]["total"] += total
            for date_str, vio in violation_map.items():
                d = datetime.strptime(date_str, "%Y-%m-%d").date()
                year, week, _ = d.isocalendar()
                key = (year, week)
                weekly_summary.setdefault(key, {"total": 0, "violations": 0})
                weekly_summary[key]["violations"] += vio

            # วนสร้างสัปดาห์จากช่วง start_date → end_date
            start_year, start_week, _ = start_date.isocalendar()
            end_year, end_week, _ = end_date.isocalendar()

            # รองรับกรณีข้ามปี
            year = start_year
            week = start_week
            while (year < end_year) or (year == end_year and week <= end_week):
                key = (year, week)
                label = f"W {week}/{year}"
                summary = weekly_summary.get(key, {"total": 0, "violations": 0})
                chart_data.append(
                    api_schemas.ViolationChartDataPoint(
                        label=label,
                        value=summary["violations"],
                        total=summary["total"]
                    )
                )
                # เพิ่มสัปดาห์
                week += 1
                if week > 52:
                    week = 1
                    year += 1

        # --- Month Range ---
        elif group_by_unit == 'month_range':
            monthly_summary = {}
            for date_str, total in total_map.items():
                d = datetime.strptime(date_str, "%Y-%m-%d").date()
                key = (d.year, d.month)
                monthly_summary.setdefault(key, {"total": 0, "violations": 0})
                monthly_summary[key]["total"] += total
            for date_str, vio in violation_map.items():
                d = datetime.strptime(date_str, "%Y-%m-%d").date()
                key = (d.year, d.month)
                monthly_summary.setdefault(key, {"total": 0, "violations": 0})
                monthly_summary[key]["violations"] += vio

            # helper ชื่อเดือนย่อไทย
            thai_months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                            "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

            year, month = start_date.year, start_date.month
            while (year < end_date.year) or (year == end_date.year and month <= end_date.month):
                key = (year, month)
                label = thai_months[month - 1]
                summary = monthly_summary.get(key, {"total": 0, "violations": 0})
                chart_data.append(
                    api_schemas.ViolationChartDataPoint(
                        label=label,
                        value=summary["violations"],
                        total=summary["total"]
                    )
                )
                # เพิ่มเดือน
                if month == 12:
                    month = 1
                    year += 1
                else:
                    month += 1

    # Debug check (optional)
    try:
        sum_chart_total = sum([c.total for c in chart_data])
        print(f"[SUMMARY DEBUG] total_sessions KPI={total_sessions}, sum_chart_total={sum_chart_total}")
    except Exception:
        pass

    # --- 3. คำนวณ Top 5 Branches ---
    top_branches_query_base = db.query(database.DBParkingViolation)
    if branch_id:
        top_branches_query_base = top_branches_query_base.filter(database.DBParkingViolation.branch_id.startswith(branch_id))
    if start_date:
        top_branches_query_base = top_branches_query_base.filter(database.DBParkingViolation.timestamp >= start_date)
    if end_date:
        top_branches_query_base = top_branches_query_base.filter(database.DBParkingViolation.timestamp < (end_date + timedelta(days=1)))
 
    top_branches_query = top_branches_query_base.with_entities(
        database.DBParkingViolation.branch,
        database.DBParkingViolation.branch_id,
        func.count(database.DBParkingViolation.id).label("violation_count")
    ).filter(database.DBParkingViolation.is_violation == True,
             database.DBParkingViolation.branch.isnot(None))\
     .group_by(database.DBParkingViolation.branch, database.DBParkingViolation.branch_id)\
     .order_by(func.count(database.DBParkingViolation.id).desc())\
     .limit(5).all()

    top_branches_data = [api_schemas.TopBranchData(name=row.branch, code=row.branch_id, count=row.violation_count) for row in top_branches_query]

    # --- 4. รวบรวมข้อมูลทั้งหมดและส่งกลับในรูปแบบที่กำหนด ---
    return api_schemas.ViolationSummaryResponse(
        kpi=kpi_data,
        chart_data=chart_data,
        top_branches=top_branches_data
    )

#--- ดึงข้อมูลสาขาทั้งหมดแบบแบ่งหน้า---#
@router.get(
    "/all_branches",
    response_model=api_schemas.PaginatedTopBranchResponse,
    summary="Get a paginated list of all violating branches"
)

def get_all_violating_branches(
    db: Session = Depends(get_db),
    page: int = 1,
    limit: int = 10,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
):
    # --- 1. Base Query ---
    query_base = db.query(database.DBParkingViolation).filter(
        database.DBParkingViolation.is_violation == True,
        database.DBParkingViolation.branch.isnot(None)
    )

    if start_date:
        query_base = query_base.filter(database.DBParkingViolation.timestamp >= start_date)
    if end_date:
        query_base = query_base.filter(database.DBParkingViolation.timestamp < (end_date + timedelta(days=1)))

    # --- 2. Query สำหรับนับจำนวนทั้งหมดของกลุ่มสาขา ---
    total_items = query_base.with_entities(func.count(func.distinct(database.DBParkingViolation.branch_id))).scalar() or 0
    
    total_pages = math.ceil(total_items / limit) if total_items else 1

    # --- 3. Query สำหรับดึงข้อมูลในหน้านั้น ๆ ---
    branches_query = (
        query_base
        .with_entities(
            database.DBParkingViolation.branch.label("branch"),
            database.DBParkingViolation.branch_id.label("branch_id"),
            func.count(database.DBParkingViolation.id).label("violation_count")
        )
        .group_by(database.DBParkingViolation.branch, database.DBParkingViolation.branch_id)
        .order_by(func.count(database.DBParkingViolation.id).desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    # --- 4. แปลงผลลัพธ์ ---
    branches_data = [
        api_schemas.TopBranchData(name=row.branch, code=row.branch_id, count=row.violation_count)
        for row in branches_query
    ]

    return api_schemas.PaginatedTopBranchResponse(
        total_items=total_items,
        total_pages=total_pages,
        current_page=page,
        branches=branches_data
    )


#--- ข้อมูลตารางทั้งหมด---#
@router.get(
    "/events",
    response_model=api_schemas.PaginatedViolationEventsResponse,
    summary="Get Paginated and Transformed Parking Violation Events"
)
def get_violation_events(
    db: Session = Depends(get_db),
    page: int = 1,
    limit: int = 50,
    branch_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    is_violation_only: bool = False,
    in_progress_only: bool = False,


):
    """
    Endpoint นี้จะดึงข้อมูลเหตุการณ์แบบแบ่งหน้าสำหรับแสดงในตาราง
    และแปลงโครงสร้างข้อมูลให้ตรงตามที่ Frontend ต้องการ
    """
    query = db.query(database.DBParkingViolation)

    # เงื่อนไข branch
    if branch_id:
        query = query.filter(database.DBParkingViolation.branch_id.startswith(branch_id))

    # --- Logic ใหม่สำหรับ in-progress ---
    if in_progress_only:
        query = query.filter(
            database.DBParkingViolation.is_violation == True,
            database.DBParkingViolation.exit_time.is_(None)
        )
        # ❌ ไม่ใส่ start_date/end_date filter เพราะต้องการแสดงทั้งหมด
    else:
        # ใช้ filter เดิม
        if start_date:
            query = query.filter(cast(database.DBParkingViolation.timestamp, Date) >= start_date)
        if end_date:
            query = query.filter(database.DBParkingViolation.timestamp < (end_date + timedelta(days=1)))
        if is_violation_only:
            query = query.filter(database.DBParkingViolation.is_violation == True)

    # นับจำนวนรายการทั้งหมด (ก่อนที่จะแบ่งหน้า)
    total_items = query.count()

    # คำนวณจำนวนหน้าทั้งหมด
    total_pages = math.ceil(total_items / limit) if total_items else 1

    # 1. ดึงข้อมูลดิบจากฐานข้อมูล พร้อมการแบ่งหน้า
    #    - order_by: เรียงจากเหตุการณ์ล่าสุดไปเก่าสุด
    #    - offset: ข้ามข้อมูลของหน้าก่อนๆ
    #    - limit: จำกัดจำนวนข้อมูลต่อหน้า
    db_violations = query.order_by(database.DBParkingViolation.timestamp.desc())\
        .offset((page - 1) * limit)\
        .limit(limit)\
        .all()
    
    # 2. แปลงข้อมูล (Transformation) ทีละรายการ
    #    นี่คือส่วนที่แปลงข้อมูลจาก ORM Model (DBParkingViolation)
    #    ไปเป็น Pydantic Schema (ParkingViolationEvent) ที่ออกแบบไว้สำหรับ Frontend
    results = []
    for v in db_violations:
        event = api_schemas.ParkingViolationEvent(
            id=v.id,
            status="Violate" if v.is_violation else "Normal",
            timestamp=v.timestamp,
            branch=api_schemas.BranchInfo(id=v.branch_id, name=v.branch),
            camera=api_schemas.CameraInfo(id=v.camera_id),
            vehicleId=str(v.car_id),
            entryTime=v.entry_time,
            exitTime=v.exit_time,
            durationMinutes=v.duration_minutes,
            isViolation=v.is_violation,
            total_parking_sessions=v.total_parking_sessions or 0,
            imageUrl=v.image_url
        )
        results.append(event)
    
    # 3. ส่งข้อมูลที่แปลงร่างแล้วกลับไป
    return api_schemas.PaginatedViolationEventsResponse(
        total_items=total_items,
        total_pages=total_pages,
        current_page=page,
        events=results
    )