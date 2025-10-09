# backend/app/schemas.py
# --- Schemas for Internal Data & Ingestion ---

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime

# --- Base Schema for all Analytics Events ---
class BaseAnalyticsEvents(BaseModel):
    timestamp: datetime = Field(..., examples="2024-07-01T10:30:00Z")
    branch: str = Field(..., examples="แผ่นดินทอง")
    branch_id: str = Field(..., examples="15517")
    camera_id: str =Field(..., examples="cam_01")
    event_type: str = Field(...,description= "Type of event (e.g., 'parking_violation', 'table_occupancy', 'chilled_basket_alert', 'beverage_stock_update')")

class ParkingViolationData(BaseAnalyticsEvents):
    event_type: str
    car_id: Optional[int] = Field(None, examples=101, description="Unique tracking ID for the vehicle.")
    current_park: int = Field(...,examples=5)
    entry_time: datetime= Field(...,examples="2024-07-01T10:00:00Z")
    exit_time: Optional[datetime]= Field(None,examples="2024-07-01T10:00:00Z")
    duration_minutes: float= Field(...,examples=20.5)
    is_violation: bool= Field(...,examples=True)
    total_parking_sessions: int = Field(..., examples=15, description="Accumulated total parking sessions for this camera since start or last reset.")
    image_url: Optional[str] = Field(None, description="URL of the snapshot of the violation.")

class ParkingViolationUpdate(BaseModel):
    """
    Schema สำหรับรับข้อมูลเพื่ออัปเดต Violation record ที่มีอยู่แล้ว
    """
    exit_time: datetime = Field(..., description="เวลาที่รถขับออกจากที่จอด (UTC)")
    duration_minutes: float = Field(..., description="ระยะเวลาที่จอดทั้งหมด (นาที)")

class TableOccupancyData(BaseAnalyticsEvents):
    event_type: Literal["table_occupancy"] = "table_occupancy"
    table_id: str = Field(...,examples="T03")
    is_occupied: bool =Field(...,examples=True)
    occupancy_start_time: Optional[datetime] =Field(None,examples="2024-07-01T10:00:00Z")
    occupancy_end_time: Optional[datetime]= Field(None,examples="2024-07-01T10:00:00Z")
    duration_minutes: Optional[float]= Field(None,examples="45.0")
    current_occupant_count: Optional[int]= Field(None, examples=2)

class ChilledBasketAlertData(BaseAnalyticsEvents):
    event_type: Literal["chilled_basket_alert"] = "chilled_basket_alert"
    basket_id: str= Field(...,examples="B01")
    zone_id: str = Field(...,examples="Section_A")
    entry_time: datetime= Field(...,examples="2024-07-01T10:00:00Z")
    exit_time: Optional[datetime]= Field(None,examples="2024-07-01T10:00:00Z")
    duration_minutes: float= Field(...,examples="22.0")
    is_alert_triggered: bool = Field(..., example=True)
    alert_reason: Optional[str] = Field(None, example="time_limit_exceeded")

# --- Unified Schema for incoming POST data ---
class AnalyticsDataIn(BaseModel):
    parking_violation: Optional[ParkingViolationData]= None
    table_occupancy: Optional[TableOccupancyData]= None
    chilled_basket_alert: Optional[ChilledBasketAlertData]= None

class InferenceResultResponse(BaseModel):
    message: str = Field(..., examples="Parking violation data received.")
    id: int = Field(..., examples=123)
