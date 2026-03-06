from __future__ import annotations

from typing import List, Optional
from decimal import Decimal
from datetime import datetime

from sqlalchemy import (
    LargeBinary, String, Text, Numeric, DateTime, ForeignKey, Boolean, Integer, Enum, func, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# ---------- USERS ----------
class User(Base):
    __tablename__: str = "user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="customer", nullable=False)

    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_corporate: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    orders: Mapped[List["Order"]] = relationship(
        back_populates="user", cascade="all,delete-orphan"
    )


# ---------- CATEGORIES / PRODUCTS ----------
class Category(Base):
    __tablename__: str = "category"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    products: Mapped[List["Product"]] = relationship(
        back_populates="category", cascade="all,delete-orphan"
    )


# ---------- ARTISTS ----------
class Artist(Base):
    __tablename__: str = "artist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)

    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    portrait_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    instagram: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    facebook: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    products: Mapped[List["Product"]] = relationship(back_populates="artist")


# ---------- PRODUCTS ----------
class Product(Base):
    __tablename__: str = "product"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    price_eur: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("category.id"), nullable=True)
    category: Mapped[Optional["Category"]] = relationship(back_populates="products")

    artist_id: Mapped[Optional[int]] = mapped_column(ForeignKey("artist.id"), nullable=True)
    artist: Mapped[Optional["Artist"]] = relationship(back_populates="products")

    # Obrázek v DB jako BYTEA
    image_data: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    image_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    image_mime_type: Mapped[str] = mapped_column(String(64), nullable=False, default="image/jpeg")

    order_items: Mapped[List["OrderItem"]] = relationship(
        back_populates="product", cascade="all,delete-orphan"
    )


class ProductMedia(Base):
    __tablename__: str = "product_media"
    __table_args__ = (
        UniqueConstraint("product_id", "filename", name="uq_product_media_product_id_filename"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, server_default=func.now())


class ProductMediaAI(Base):
    __tablename__: str = "product_media_ai"
    __table_args__ = (
        UniqueConstraint("media_id", "image_hash", "model", name="uq_product_media_ai_media_id_image_hash_model"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    media_id: Mapped[int] = mapped_column(ForeignKey("product_media.id", ondelete="CASCADE"), nullable=False, index=True)
    image_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vision_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


# ---------- ORDERS ----------
class Order(Base):
    __tablename__: str = "order"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_number: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    shipping_method: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    payment_trans_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    payment_ref_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    is_test: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    coupon_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    discount_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))

    currency: Mapped[str] = mapped_column(
        Enum("CZK", "EUR", name="currency_code", native_enum=True, create_type=False),
        nullable=False,
        default="CZK",
    )

    vs_code: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(5), nullable=True, default="cs")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped[Optional["User"]] = relationship(back_populates="orders")
    items: Mapped[List["OrderItem"]] = relationship(
        back_populates="order", cascade="all,delete-orphan"
    )

    audits: Mapped[List["OrderStatusAudit"]] = relationship(
        back_populates="order", cascade="all,delete-orphan"
    )


class OrderItem(Base):
    __tablename__: str = "order_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("order.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id"), nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship(back_populates="order_items")


# ---------- AUDIT: order status changes ----------
class OrderStatusAudit(Base):
    __tablename__: str = "order_status_audit"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("order.id"), nullable=False, index=True)
    from_status: Mapped[str] = mapped_column(String(32), nullable=False)
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    changed_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"), nullable=True, index=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, default=datetime.utcnow)

    order: Mapped["Order"] = relationship(back_populates="audits")


# ---------- BLOG ----------
class BlogPost(Base):
    __tablename__: str = "blog_post"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cover_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)


# ---------- TRANSLATIONS ----------
class CategoryTranslation(Base):
    __tablename__: str = "category_translation"

    category_id: Mapped[int] = mapped_column(ForeignKey("category.id", ondelete="CASCADE"), primary_key=True)
    language_code: Mapped[str] = mapped_column(String(5), primary_key=True)  # cs, en, fr, de, ru, zh, ja, it, pl
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    category: Mapped["Category"] = relationship()


class ArtistTranslation(Base):
    __tablename__: str = "artist_translation"

    artist_id: Mapped[int] = mapped_column(ForeignKey("artist.id", ondelete="CASCADE"), primary_key=True)
    language_code: Mapped[str] = mapped_column(String(5), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    artist: Mapped["Artist"] = relationship()


class ProductTranslation(Base):
    __tablename__: str = "product_translation"

    product_id: Mapped[int] = mapped_column(ForeignKey("product.id", ondelete="CASCADE"), primary_key=True)
    language_code: Mapped[str] = mapped_column(String(5), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    product: Mapped["Product"] = relationship()


class BlogPostTranslation(Base):
    __tablename__: str = "blog_post_translation"

    blog_post_id: Mapped[int] = mapped_column(ForeignKey("blog_post.id", ondelete="CASCADE"), primary_key=True)
    language_code: Mapped[str] = mapped_column(String(5), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    blog_post: Mapped["BlogPost"] = relationship()


# Importuj Profile model aby Alembic ho vidět
from app.db.models_profile import Profile  # noqa: E402, F401
