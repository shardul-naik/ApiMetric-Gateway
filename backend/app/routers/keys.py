import secrets
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app import models, schemas
from backend.app.database import get_db
from backend.app.deps import get_current_user

router = APIRouter(prefix="/keys", tags=["API Keys"])

def generate_api_key_string() -> str:
    return f"apm_{secrets.token_urlsafe(32)}"

@router.post("/generate", response_model=schemas.APIKeyResponse, status_code=status.HTTP_201_CREATED)
def create_key(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    user_id_val = int(getattr(current_user, "id"))
    new_key_str = generate_api_key_string()
    api_key = models.APIKey(key=new_key_str, user_id=user_id_val)
    
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return api_key

@router.get("/", response_model=List[schemas.APIKeyResponse])
def list_keys(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    user_id_val = int(getattr(current_user, "id"))
    return db.query(models.APIKey).filter(models.APIKey.user_id == user_id_val).all()