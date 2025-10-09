# app/api/routers/analytics.py
import boto3
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.orm import Session
import logging
from typing import Optional
from app import database, schemas
from app.api.deps import get_db, verify_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["Analytics"],dependencies=[Depends(verify_api_key)])

# --- 🔽 2. ตั้งค่าการเชื่อมต่อ S3 🔽 ---
# *** จะย้ายค่าเหล่านี้ไปเก็บในไฟล์ config หรือ .env ในอนาคต ***
S3_BUCKET_NAME = "carparkinglopayahc" # ⬅️⬅️⬅️ **เปลี่ยนเป็นชื่อ BUCKET ของคุณ**
S3_REGION = "ap-southeast-2" # ⬅️ **เปลี่ยนเป็น REGION ของคุณ (ถ้าไม่ใช่สิงคโปร์)**
# สร้าง S3 client แค่ครั้งเดียวตอนเริ่มต้น
s3_client = boto3.client("s3", region_name=S3_REGION)

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schemas.InferenceResultResponse)
async def create_inference_result(
    # เปลี่ยนจากการรับ JSON body (data: ...) มาเป็นการรับ Form data
    data: str = Form(..., description="A JSON string representing the analytics data."),
    image: Optional[UploadFile] = File(None, description="An optional image file for parking violations."),
    db: Session = Depends(get_db)
):
    logger.info("Received analytics data via multipart/form-data")
    image_url = None # เตรียมตัวแปรสำหรับเก็บ URL ของรูปภาพ

    try:
        # แปลง JSON string ที่ได้รับจาก Form กลับมาเป็น Pydantic object
        payload = schemas.AnalyticsDataIn.model_validate_json(data)
        
        db_item, message = None, "No valid analytics data provided"

        # --- ส่วนของ Parking Violation จะถูกแก้ไขเป็นพิเศษ ---
        if payload.parking_violation:
            logger.info("Processing parking violation...")
            
            # 4. ตรวจสอบว่ามีไฟล์รูปภาพส่งมาพร้อมกับ violation หรือไม่
            if image:
                try:
                    # สร้างชื่อไฟล์ใหม่ที่ไม่ซ้ำกัน
                    unique_filename = f"violations/{uuid.uuid4()}.jpg"

                    # อัปโหลดไฟล์ไปยัง S3
                    s3_client.upload_fileobj(
                        image.file,
                        S3_BUCKET_NAME,
                        unique_filename,
                        ExtraArgs={'ContentType': image.content_type}
                    )
                    
                    # สร้าง URL ของรูปภาพที่เข้าถึงได้แบบสาธารณะ
                    image_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{unique_filename}"
                    logger.info(f"Image uploaded to S3. URL: {image_url}")

                except Exception as s3_error:
                    logger.error(f"Failed to upload image to S3: {s3_error}")
                    # อาจจะแจ้งเตือน แต่ยังคงบันทึกข้อมูลต่อไปโดยไม่มี URL รูป
                    # หรือจะให้ล้มเหลวไปเลยก็ได้
                    # raise HTTPException(status_code=500, detail="Image upload failed.")

            # 5. สร้าง DB Object และ **บันทึก image_url แทน image_base64**
            # **สำคัญ:** ต้องแน่ใจว่า database.py และ schemas.py ของคุณ
            # เปลี่ยนจาก image_base64 เป็น image_url (ชนิด String/Text) แล้ว
            violation_dict = payload.parking_violation.model_dump()
            violation_dict['image_url'] = image_url # เพิ่ม URL เข้าไปใน dictionary
            
            db_item = database.DBParkingViolation(**violation_dict)
            db.add(db_item)
            message = "Parking violation data received."

        # --- ส่วนอื่นๆ ยังคงทำงานเหมือนเดิม ---
        elif payload.table_occupancy:
            db_item = database.DBTableOccupancy(**payload.table_occupancy.model_dump())
            db.add(db_item)
            message = "Table occupancy data received."
        elif payload.chilled_basket_alert:
            db_item = database.DBChilledBasketAlert(**payload.chilled_basket_alert.model_dump())
            db.add(db_item)
            message = "Chilled basket alert data received."
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid analytics data provided.")

        db.commit()
        db.refresh(db_item)
        return {"message": message, "id": db_item.id}

    except Exception as e:
        db.rollback()
        logging.exception(f"Error processing analytics data:")
        logger.info(f"\n--- DEBUG ERROR START ---")
        logger.info(f"Type of error: {type(e)}")
        logger.info(f"Error details: {e}")
        import traceback
        traceback.print_exc()
        logger.info(f"--- DEBUG ERROR END ---\n")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail=f"Failed to process inference result: {e}")
    
@router.patch("/{record_id}", status_code=status.HTTP_200_OK, summary="Update Parking Violation Exit Time")
async def update_violation_exit_time(
    record_id: int,
    data: schemas.ParkingViolationUpdate, # <-- ใช้ Schema ใหม่จาก schemas.py
    db: Session = Depends(get_db)
):
    """
    Endpoint สำหรับ "อัปเดต" record ของรถที่เคยทำผิดกฎไปแล้ว
    โดยจะรับข้อมูลเวลาออกและระยะเวลาจอดสุดท้ายมาอัปเดต
    """
    logger.info(f"Received request to update record ID: {record_id}")
    
    # 1. ค้นหา record เดิมจาก ID
    db_item = db.query(database.DBParkingViolation).filter(database.DBParkingViolation.id == record_id).first()
    
    # 2. ตรวจสอบว่าเจอ record หรือไม่
    if not db_item:
        logger.warning(f"Record with ID {record_id} not found for update.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Record with id {record_id} not found")

    # 3. อัปเดตข้อมูล
    db_item.exit_time = data.exit_time
    db_item.duration_minutes = data.duration_minutes
    db.commit()
    
    logger.info(f"Record {record_id} updated successfully.")
    return {"message": f"Record {record_id} updated successfully."}  