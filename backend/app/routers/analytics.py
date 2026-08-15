from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import pandas as pd

from backend.app import models, schemas
from backend.app.database import get_db
from backend.app.deps import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/summary", response_model=schemas.AnalyticsSummaryResponse)
def get_analytics_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    user_id_val = int(getattr(current_user, "id"))
    user_keys = db.query(models.APIKey.id).filter(models.APIKey.user_id == user_id_val).all()
    key_ids = [k.id for k in user_keys]

    if not key_ids:
        return {"total_requests": 0, "avg_latency_ms": 0.0, "max_latency_ms": 0.0, "status_breakdown": {}}

    logs = db.query(models.RequestLog).filter(models.RequestLog.key_id.in_(key_ids)).all()
    
    if not logs:
        return {"total_requests": 0, "avg_latency_ms": 0.0, "max_latency_ms": 0.0, "status_breakdown": {}}

    df = pd.DataFrame([{
        "endpoint": log.endpoint,
        "status_code": log.status_code,
        "response_time_ms": log.response_time_ms
    } for log in logs])

    return {
        "total_requests": int(len(df)),
        "avg_latency_ms": float(round(df["response_time_ms"].mean(), 2)),
        "max_latency_ms": float(round(df["response_time_ms"].max(), 2)),
        "status_breakdown": df["status_code"].value_counts().to_dict()
    }