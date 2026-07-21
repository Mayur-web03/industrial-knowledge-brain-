from sqlalchemy import Column, Integer, String, ForeignKey
from database import Base

class Industry(Base):
    __tablename__ = "industries"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    industry_code = Column(String, unique=True, nullable=False)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    industry_id = Column(Integer, ForeignKey("industries.id"))
    role = Column(String, default="member")