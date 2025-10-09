# backend/app/api_schemas.py
# --- Schemas for API Responses to Frontend ---
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime

# --- Schemas for Parking Violation Page ---
class BranchInfo(BaseModel):
    """branch: { id: '...', name: '...' }"""
    id: str
    name: str

class CameraInfo(BaseModel):
    """camera: { id: '...' }"""
    id: str

class ParkingViolationEvent(BaseModel):
    """ตรงกับโครงสร้างข้อมูลในตาราง (mockParkingData)"""
    id: int
    status: Literal['Violate', 'Normal']
    timestamp: datetime
    branch: BranchInfo
    camera: CameraInfo
    vehicleId: str
    entryTime: datetime
    exitTime: Optional[datetime] = None
    durationMinutes: float
    isViolation: bool
    total_parking_sessions: int
    imageUrl: Optional[str] = None

    class Config:
        orm_mode = True

class PaginatedViolationEventsResponse(BaseModel):
    total_items: int
    total_pages: int
    current_page: int
    events: List[ParkingViolationEvent]

class ParkingKpiData(BaseModel):
    """ตรงกับ mockKpiData"""
    totalViolations: int
    total_parking_sessions: int
    ongoingViolations: int
    avgViolationDuration: float
    avgNormalParkingTime: float
    onlineBranches: int

class ViolationChartDataPoint(BaseModel):
    """ตรงกับ ChartPoint { label: '...', value: ... }"""
    label: str
    value: int  # รถจอดเกิน
    total: int  # รถทั้งหมด

class TopBranchData(BaseModel):
    """ตรงกับ mockTopBranches"""
    name: str
    code: str
    count: int

class PaginatedTopBranchResponse(BaseModel):
    total_items: int
    total_pages: int
    current_page: int
    branches: List[TopBranchData]

class ViolationSummaryResponse(BaseModel):
    """Schema สำหรับรวบรวมข้อมูลส่วนบนทั้งหมดส่งไปในครั้งเดียว"""
    kpi: ParkingKpiData
    chart_data: List[ViolationChartDataPoint]
    top_branches: List[TopBranchData]
