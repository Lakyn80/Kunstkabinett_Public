from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, unique=True)
    
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    phone = Column(String(64), nullable=True)
    
    # Fakturační adresa
    billing_street = Column(String(255), nullable=True)
    billing_city = Column(String(255), nullable=True)
    billing_postal_code = Column(String(20), nullable=True)
    billing_country = Column(String(255), nullable=True)
    
    # Doručovací adresa
    shipping_street = Column(String(255), nullable=True)
    shipping_city = Column(String(255), nullable=True)
    shipping_postal_code = Column(String(20), nullable=True)
    shipping_country = Column(String(255), nullable=True)
    
    same_as_billing = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)