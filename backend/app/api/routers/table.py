from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional, List
from app import database, schemas
from app.api.deps import get_db

router = APIRouter(prefix="/table_occupancy", tags=["Table Occupancy"])

@router.get("/", response_model= list[schemas.TableOccupancyData],)
def get_table_occupancy(
    skip: int=0,
    limit: int =100,
    branch_id: Optional[str] = None,
    db: Session= Depends(get_db)
    ):
    query = db.query(database.DBTableOccupancy)
    if branch_id:
            query= query.filter(database.DBTableOccupancy.branch_id == branch_id)       
    return query.offset(skip).limit(limit).all()
