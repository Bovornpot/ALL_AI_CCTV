# api/deps.py
import os
from fastapi import Header, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app import database


EXPECTED_API_KEY = settings.API_KEY
async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != EXPECTED_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API Key")
    
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()