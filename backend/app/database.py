# backend/app/database.py

from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, JSON , Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from app.core.config import settings

# DATABASE_URL = "sqlite:///./data/db.sqlite" #Path batabase data folder
DATABASE_URL = settings.DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal= sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DBParkingViolation(Base):
    __tablename__= "parking_violations"
    id= Column(Integer, primary_key=True, index=True)
    car_id = Column(Integer, index=True, nullable=True) 
    timestamp= Column(DateTime(timezone=True), index=True, default=datetime.utcnow)
    branch = Column(String, index=True)
    branch_id = Column(String, index=True) # เลขสาขา เซ้ทมั่วไว้ก่อน 
    camera_id= Column(String, index=True) #เลขสาขา เซ้ทมั่วไว้ก่อน
    event_type = Column(String)
    current_park = Column(Integer, nullable=True) 
    entry_time = Column(DateTime(timezone=True), nullable=True) # เปลี่ยนตรงนี้
    exit_time = Column(DateTime(timezone=True), nullable=True)
    duration_minutes= Column(Float)
    is_violation= Column(Boolean)
    total_parking_sessions = Column(Integer, nullable=True)
    image_url = Column(String, nullable=True)
    def __repr__(self):
        return (f"<ParkingViolation(id={self.id}, car_id={self.car_id}, "
                f"branch='{self.branch}', camera_id='{self.camera_id}', "
                f"event_type='{self.event_type}', timestamp='{self.timestamp}', "
                f"image_url='{self.image_url}')>")
    
class DBTableOccupancy(Base):
    __tablename__= "table_occupancy"
    id= Column(Integer, primary_key=True, index=True)
    timestamp= Column(DateTime, index=True, default=datetime.utcnow)
    branch_id = Column(String, index=True)
    camera_id= Column(String, index=True)
    event_type = Column(String)
    table_id = Column(String, index=True)
    is_occupied= Column(Boolean)
    occupancy_start_time= Column(DateTime, index=True)
    occupancy_end_time= Column(DateTime, nullable=True)
    duration_minutes= Column(Float, nullable=True)
    current_occupant_count= Column(Integer, nullable=True)

class DBChilledBasketAlert(Base):
    __tablename__= "chilled_basket_alerts"
    id= Column(Integer, primary_key=True, index=True)
    timestamp= Column(DateTime, index=True, default=datetime.utcnow)
    branch_id = Column(String, index=True)
    camera_id= Column(String, index=True)
    event_type = Column(String)
    basket_id= Column(String, index=True)
    zone_id= Column(String)
    entry_time= Column(DateTime, index=True)
    exit_time= Column(DateTime, nullable=True)
    duration_minutes= Column(Float, nullable=True)
    is_alert_triggered= Column(Boolean)
    alert_reason= Column(String, nullable=True)

# Function to create tables (call this once when the app starts)
def create_db_tables():
    Base.metadata.create_all(bind=engine)
    print("Database tables created/updated.")

# Dependency for FastAPI to get DB session
def get_db():
    db= SessionLocal()
    try: 
        yield db
    finally:
        db.close() 
 