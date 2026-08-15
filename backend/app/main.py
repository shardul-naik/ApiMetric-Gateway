import os
import secrets
import time
from datetime import datetime, timedelta
from typing import List, Optional, Any

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from passlib.context import CryptContext
from jose import JWTError, jwt
import pandas as pd

from backend.app.database import engine, Base, SessionLocal, get_db
from backend.app import schemas

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey1234567890")
ADMIN_REGISTER_KEY = os.getenv("ADMIN_REGISTER_KEY", "adminsecret123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password[:72])

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="user")
    created_at = Column(DateTime, default=datetime.utcnow)

class APIKey(Base):
    __tablename__ = "api_keys"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class RequestLog(Base):
    __tablename__ = "request_logs"
    id = Column(Integer, primary_key=True, index=True)
    key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=False)
    endpoint = Column(String(255), nullable=False)
    status_code = Column(Integer, nullable=False)
    response_time_ms = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if getattr(current_user, "role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

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
                log_entry = RequestLog(
                    key_id=int(getattr(key_obj, "id")),
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

app = FastAPI(title="APIMetric API", version="1.0.0")

app.add_middleware(TelemetryMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/auth/register", status_code=201, tags=["Auth"])
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email is already registered")
    
    new_user = User(
        email=user_data.email, 
        hashed_password=get_password_hash(user_data.password),
        role="user"
    )
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully", "email": new_user.email, "role": "user"}

@app.post("/auth/register-admin", status_code=201, tags=["Auth"])
def register_admin(user_data: schemas.UserCreate, admin_key: str = Header(...), db: Session = Depends(get_db)):
    if admin_key != ADMIN_REGISTER_KEY:
        raise HTTPException(status_code=403, detail="Invalid Admin Registration Key")
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email is already registered")
    
    admin_user = User(
        email=user_data.email, 
        hashed_password=get_password_hash(user_data.password),
        role="admin"
    )
    db.add(admin_user)
    db.commit()
    return {"message": "Admin account created", "email": admin_user.email, "role": "admin"}

@app.post("/auth/login", tags=["Auth"])
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if user is None or not verify_password(form_data.password, str(user.hashed_password)):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": str(user.email), "role": str(user.role)})
    return {"access_token": access_token, "token_type": "bearer", "role": str(user.role), "email": str(user.email)}

@app.post("/keys/generate", response_model=schemas.APIKeyResponse, status_code=201, tags=["API Keys"])
def create_key(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_id_val = int(getattr(current_user, "id"))
    api_key = APIKey(key=f"apm_{secrets.token_urlsafe(32)}", user_id=user_id_val)
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return api_key

@app.get("/keys/", response_model=List[schemas.APIKeyResponse], tags=["API Keys"])
def list_keys(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_id_val = int(getattr(current_user, "id"))
    return db.query(APIKey).filter(APIKey.user_id == user_id_val).all()

# UPDATE/DELETE: ADMIN KEY REVOCATION ENDPOINT
@app.put("/keys/revoke/{key_id}", tags=["Admin Keys"])
def revoke_key(key_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    key_obj = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not key_obj:
        raise HTTPException(status_code=404, detail="API Key not found")
    
    setattr(key_obj, "is_active", False)
    db.commit()
    return {"message": f"API Key #{key_id} has been revoked successfully.", "is_active": False}

@app.get("/analytics/admin-summary", tags=["Admin"])
def get_admin_summary(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    total_users = db.query(User).filter(User.role == "user").count()
    total_keys = db.query(APIKey).count()
    logs = db.query(RequestLog).all()

    if not logs:
        # Include keys list even without logs
        user_activity = []
        users = db.query(User).filter(User.role == "user").all()
        for u in users:
            u_id = int(getattr(u, "id"))
            u_keys = db.query(APIKey).filter(APIKey.user_id == u_id).all()
            user_activity.append({
                "user_id": u_id,
                "email": str(u.email),
                "keys": [{"id": k.id, "key": k.key, "is_active": k.is_active} for k in u_keys],
                "total_requests": 0,
                "avg_latency_ms": 0.0
            })
        return {
            "total_system_users": total_users,
            "total_keys_issued": total_keys,
            "total_system_requests": 0,
            "global_avg_latency_ms": 0.0,
            "user_activity": user_activity,
            "status_breakdown": {}
        }

    df = pd.DataFrame([{"key_id": l.key_id, "endpoint": l.endpoint, "status_code": l.status_code, "latency": l.response_time_ms} for l in logs])
    
    user_activity = []
    users = db.query(User).filter(User.role == "user").all()
    for u in users:
        u_id = int(getattr(u, "id"))
        u_keys = db.query(APIKey).filter(APIKey.user_id == u_id).all()
        u_key_ids = [k.id for k in u_keys]
        
        user_df = df[df["key_id"].isin(u_key_ids)] if not df.empty else pd.DataFrame()
        req_count = len(user_df) if not user_df.empty else 0
        avg_lat = float(round(user_df["latency"].mean(), 2)) if req_count > 0 else 0.0

        user_activity.append({
            "user_id": u_id,
            "email": str(u.email),
            "keys": [{"id": k.id, "key": k.key, "is_active": k.is_active} for k in u_keys],
            "total_requests": req_count,
            "avg_latency_ms": avg_lat
        })

    status_counts = df["status_code"].value_counts().to_dict() if not df.empty else {}

    return {
        "total_system_users": total_users,
        "total_keys_issued": total_keys,
        "total_system_requests": len(df),
        "global_avg_latency_ms": float(round(df["latency"].mean(), 2)),
        "user_activity": user_activity,
        "status_breakdown": {str(k): int(v) for k, v in status_counts.items()}
    }

mock_router = APIRouter(prefix="/api/v1", tags=["Mock Services"])

@mock_router.get("/weather")
def get_weather(location: str = "Mumbai", x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header required")
    key_obj = SessionLocal().query(APIKey).filter(APIKey.key == x_api_key, APIKey.is_active == True).first()
    if not key_obj:
        raise HTTPException(status_code=401, detail="Invalid or Revoked API Key")
    return {"service": "Weather API", "location": location, "temperature": "28°C", "condition": "Partly Cloudy", "humidity": "78%"}

@mock_router.get("/stock")
def get_stock(symbol: str = "RELIANCE", x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header required")
    key_obj = SessionLocal().query(APIKey).filter(APIKey.key == x_api_key, APIKey.is_active == True).first()
    if not key_obj:
        raise HTTPException(status_code=401, detail="Invalid or Revoked API Key")
    return {"service": "Stock API", "symbol": symbol.upper(), "price_inr": 2940.50, "change": "+1.25%", "market_status": "OPEN"}

@mock_router.get("/currency")
def get_currency(from_curr: str = "INR", to_curr: str = "USD", x_api_key: Optional[str] = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header required")
    key_obj = SessionLocal().query(APIKey).filter(APIKey.key == x_api_key, APIKey.is_active == True).first()
    if not key_obj:
        raise HTTPException(status_code=401, detail="Invalid or Revoked API Key")
    return {"service": "Currency API", "pair": f"{from_curr.upper()}/{to_curr.upper()}", "rate": 0.012, "converted_amount": "1000 INR = 12.00 USD"}

app.include_router(mock_router)

@app.get("/", tags=["Health"])
def read_root():
    return {"status": "online", "message": "APIMetric Gateway Active"}