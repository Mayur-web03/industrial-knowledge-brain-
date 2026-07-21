from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from auth.models import User, Industry
from auth.auth_utils import hash_password, verify_password, create_token, get_current_user
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    industry_name: str
    industry_code: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    industry_code: str
    new_password: str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    industry = db.query(Industry).filter_by(industry_code=req.industry_code).first()
    if not industry:
        industry = Industry(name=req.industry_name, industry_code=req.industry_code)
        db.add(industry)
        db.commit()
        db.refresh(industry)

    if db.query(User).filter_by(email=req.email).first():
        raise HTTPException(400, "Email already registered")

    user = User(email=req.email, hashed_password=hash_password(req.password), industry_id=industry.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(user.id, industry.id, industry.industry_code, user.email)
    return {
        "token": token,
        "industry_code": industry.industry_code,
        "industry_name": industry.name,
        "email": user.email,
        "user_id": user.id,
    }


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")

    industry = db.query(Industry).filter_by(id=user.industry_id).first()
    token = create_token(user.id, user.industry_id, industry.industry_code, user.email)
    return {
        "token": token,
        "industry_code": industry.industry_code,
        "industry_name": industry.name,
        "email": user.email,
        "user_id": user.id,
    }


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    industry = db.query(Industry).filter_by(industry_code=req.industry_code).first()
    if not industry:
        raise HTTPException(404, "Industry code not found")

    user = db.query(User).filter_by(email=req.email, industry_id=industry.id).first()
    if not user:
        raise HTTPException(404, "No account found with this email under this industry code")

    user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password reset successful. You can now sign in."}