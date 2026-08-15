import time
from typing import Any
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from backend.app.database import SessionLocal
from backend.app.models import APIKey, RequestLog

class TelemetryMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any):
        path = request.url.path
        
        if path.startswith(("/docs", "/openapi.json", "/auth", "/keys", "/analytics")):
            return await call_next(request)

        api_key_header = request.headers.get("X-API-Key")
        if not api_key_header:
            return await call_next(request)

        start_time = time.perf_counter()
        response = await call_next(request)
        process_time = (time.perf_counter() - start_time) * 1000

        db = SessionLocal()
        try:
            key_obj = db.query(APIKey).filter(APIKey.key == api_key_header, APIKey.is_active == True).first()
            if key_obj is not None:
                key_id_val = int(getattr(key_obj, "id"))
                log_entry = RequestLog(
                    key_id=key_id_val,
                    endpoint=path,
                    status_code=response.status_code,
                    response_time_ms=round(process_time, 2)
                )
                db.add(log_entry)
                db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

        return response