from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy.orm import Session
from typing import Optional
import re

from app.db.session import SessionLocal
from app.db.models_profile import Profile
from app.db import models
from app.core.deps import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ProfileIn(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    same_as_billing: Optional[bool] = None
    clear_profile: Optional[bool] = None

    @validator("full_name", "phone", "address", "billing_address", "shipping_address", pre=True, always=True)
    def _empty_or_cz_to_none(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            if s == "" or s.upper() == "CZ":
                return None
            return s
        return v

    @validator("email", pre=True, always=True)
    def _email_empty_to_none(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


def _build_full_name(profile: Optional[Profile], user: models.User) -> Optional[str]:
    first = profile.first_name if profile else None
    last = profile.last_name if profile else None
    name = " ".join([part for part in [first, last] if part])
    if name:
        return name
    for attr in ("name", "full_name"):
        val = getattr(user, attr, None)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


def _parse_address(raw: Optional[str]) -> dict:
    out = {"street": None, "city": None, "postal": None, "country": None}
    if not raw:
        return out
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) > 0:
        out["street"] = parts[0] or None
    if len(parts) > 1:
        city_zip = parts[1].strip()
        match = re.match(r"^(.+?)\s+(\d{3}\s?\d{2})$", city_zip)
        if match:
            out["city"] = match.group(1).strip() or None
            out["postal"] = match.group(2).replace(" ", "").strip() or None
        else:
            out["city"] = city_zip or None
    if len(parts) > 2:
        out["country"] = parts[2].strip() or None
    return out

def _build_address_obj(street: Optional[str], city: Optional[str], postal: Optional[str], country: Optional[str]) -> Optional[dict]:
    if not any([street, city, postal, country]):
        return None
    return {
        "street": street,
        "city": city,
        "postal_code": postal,
        "country": country,
    }

def _mask_keep_first(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    s = value.strip()
    if not s:
        return None
    if len(s) == 1:
        return s
    return s[0] + ("*" * (len(s) - 1))

def _mask_name(full_name: Optional[str]) -> Optional[str]:
    if not full_name:
        return None
    parts = [p for p in str(full_name).strip().split() if p]
    if not parts:
        return None
    masked = []
    for p in parts:
        masked.append(_mask_keep_first(p) or None)
    return " ".join([m for m in masked if m]) or None

def _mask_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    s = str(email).strip()
    if "@" not in s:
        return _mask_keep_first(s)
    local, domain = s.split("@", 1)
    masked_local = _mask_keep_first(local) or "*"
    domain = domain.strip()
    parts = [p for p in domain.split(".") if p]
    if not parts:
        return f"{masked_local}@*"
    first = parts[0]
    masked_first = _mask_keep_first(first) or "*"
    if len(parts) == 1:
        return f"{masked_local}@{masked_first}"
    tld = parts[-1]
    middle = parts[1:-1]
    masked_middle = ["*" * max(1, len(p)) for p in middle]
    masked_domain = ".".join([masked_first] + masked_middle + [tld])
    return f"{masked_local}@{masked_domain}"

def _mask_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    s = str(phone)
    digits = [c for c in s if c.isdigit()]
    if not digits:
        return None
    keep = 3
    out = []
    to_keep = keep
    for ch in reversed(s):
        if ch.isdigit():
            if to_keep > 0:
                out.append(ch)
                to_keep -= 1
            else:
                out.append("*")
        else:
            out.append(ch)
    return "".join(reversed(out))

def _mask_text(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    out = []
    kept = False
    for ch in s:
        if not kept and ch.strip():
            out.append(ch)
            kept = True
            continue
        if ch.isdigit() or ch.isspace() or ch in "-/.,":  # keep digits and separators
            out.append(ch)
        else:
            out.append("*")
    return "".join(out)

def _mask_postal(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    s = str(value)
    digits = [c for c in s if c.isdigit()]
    if not digits:
        return None
    keep = 2
    out = []
    to_keep = keep
    for ch in reversed(s):
        if ch.isdigit():
            if to_keep > 0:
                out.append(ch)
                to_keep -= 1
            else:
                out.append("*")
        else:
            out.append(ch)
    return "".join(reversed(out))

def _masked_address(street: Optional[str], city: Optional[str], postal: Optional[str], country: Optional[str]) -> Optional[dict]:
    if not any([street, city, postal, country]):
        return None
    return {
        "street": _mask_text(street),
        "city": _mask_text(city),
        "postal_code": _mask_postal(postal),
        "country": country,
    }

def _masked_profile_payload(prof: Optional[Profile], user: models.User) -> dict:
    billing = _masked_address(
        prof.billing_street if prof else None,
        prof.billing_city if prof else None,
        prof.billing_postal_code if prof else None,
        prof.billing_country if prof else None,
    )
    if prof and prof.same_as_billing:
        shipping = billing
    else:
        shipping = _masked_address(
            prof.shipping_street if prof else None,
            prof.shipping_city if prof else None,
            prof.shipping_postal_code if prof else None,
            prof.shipping_country if prof else None,
        )
    return {
        "full_name": _mask_name(_build_full_name(prof, user)),
        "email": _mask_email(getattr(user, "email", None)),
        "phone": _mask_phone(prof.phone if prof else None),
        "addresses": {
            "billing": billing,
            "shipping": shipping,
        },
    }


@router.get("", response_model=dict)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Do not return PII to the frontend; only flags and masked preview.
    user = db.get(models.User, current_user.id)
    if not user:
        user = current_user
    prof = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    has_billing = bool(
        prof
        and (
            prof.billing_street
            or prof.billing_city
            or prof.billing_postal_code
            or prof.billing_country
        )
    )
    has_shipping = bool(
        prof
        and (
            prof.shipping_street
            or prof.shipping_city
            or prof.shipping_postal_code
            or prof.shipping_country
        )
    )
    return {
        "has_profile": bool(prof),
        "has_name": bool(_build_full_name(prof, user)),
        "has_email": bool(getattr(user, "email", None)),
        "has_phone": bool(prof.phone) if prof else False,
        "has_billing": has_billing,
        "has_shipping": has_shipping,
        "same_as_billing": bool(prof.same_as_billing) if prof else True,
        "masked": _masked_profile_payload(prof, user),
    }

@router.get("/details", response_model=dict)
def get_my_profile_details(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user = db.get(models.User, current_user.id) or current_user
    prof = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    billing = _build_address_obj(
        prof.billing_street if prof else None,
        prof.billing_city if prof else None,
        prof.billing_postal_code if prof else None,
        prof.billing_country if prof else None,
    )
    if prof and prof.same_as_billing:
        shipping = billing
    else:
        shipping = _build_address_obj(
            prof.shipping_street if prof else None,
            prof.shipping_city if prof else None,
            prof.shipping_postal_code if prof else None,
            prof.shipping_country if prof else None,
        )
    return {
        "full_name": _build_full_name(prof, user),
        "email": getattr(user, "email", None),
        "phone": prof.phone if prof else None,
        "addresses": {
            "billing": billing,
            "shipping": shipping,
        },
        "same_as_billing": bool(prof.same_as_billing) if prof else True,
    }


@router.put("", response_model=dict)
def upsert_my_profile(
    payload: ProfileIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    prof = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not prof:
        prof = Profile(user_id=current_user.id)

    if payload.clear_profile:
        prof.first_name = None
        prof.last_name = None
        prof.phone = None
        prof.billing_street = None
        prof.billing_city = None
        prof.billing_postal_code = None
        prof.billing_country = None
        prof.shipping_street = None
        prof.shipping_city = None
        prof.shipping_postal_code = None
        prof.shipping_country = None
        prof.same_as_billing = True
    else:
        if payload.full_name is not None:
            if payload.full_name:
                parts = payload.full_name.strip().split(None, 1)
                prof.first_name = parts[0] if parts else None
                prof.last_name = parts[1] if len(parts) > 1 else None
            else:
                prof.first_name = None
                prof.last_name = None

        billing_updated = False
        billing_raw = payload.billing_address if payload.billing_address is not None else payload.address
        if billing_raw is not None:
            billing_updated = True
            if billing_raw:
                parsed = _parse_address(billing_raw)
                prof.billing_street = parsed["street"]
                prof.billing_city = parsed["city"]
                prof.billing_postal_code = parsed["postal"]
                prof.billing_country = parsed["country"]
            else:
                prof.billing_street = None
                prof.billing_city = None
                prof.billing_postal_code = None
                prof.billing_country = None

        if payload.phone is not None:
            prof.phone = payload.phone

        if payload.same_as_billing is not None:
            prof.same_as_billing = payload.same_as_billing
        elif prof.same_as_billing is None:
            prof.same_as_billing = True

        if bool(prof.same_as_billing):
            if billing_updated or payload.same_as_billing is not None:
                prof.shipping_street = prof.billing_street
                prof.shipping_city = prof.billing_city
                prof.shipping_postal_code = prof.billing_postal_code
                prof.shipping_country = prof.billing_country
        else:
            shipping_raw = payload.shipping_address
            if shipping_raw is not None:
                if shipping_raw:
                    parsed = _parse_address(shipping_raw)
                    prof.shipping_street = parsed["street"]
                    prof.shipping_city = parsed["city"]
                    prof.shipping_postal_code = parsed["postal"]
                    prof.shipping_country = parsed["country"]
                else:
                    prof.shipping_street = None
                    prof.shipping_city = None
                    prof.shipping_postal_code = None
                    prof.shipping_country = None

        if payload.email is not None:
            user = db.query(models.User).filter(models.User.id == current_user.id).first()
            if user and payload.email:
                user.email = payload.email
                db.add(user)

    db.add(prof)
    db.commit()
    db.refresh(prof)

    return {"ok": True}
