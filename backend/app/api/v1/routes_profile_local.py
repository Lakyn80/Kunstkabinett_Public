from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr
from pathlib import Path
from typing import Optional, Dict, Any
import json

router = APIRouter(prefix="/api/local/profile", tags=["profile-local"])

DATA_DIR = Path(__file__).resolve().parents[3] / "instance"
DATA_FILE = DATA_DIR / "saved_profiles.json"
DATA_DIR.mkdir(parents=True, exist_ok=True)
if not DATA_FILE.exists():
    DATA_FILE.write_text("{}", encoding="utf-8")

class Profile(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None

def _load() -> Dict[str, Any]:
    try:
        raw = DATA_FILE.read_text(encoding="utf-8") or "{}"
        return json.loads(raw)
    except Exception:
        return {}

def _save(obj: Dict[str, Any]) -> None:
    DATA_FILE.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")

@router.get("")
def get_profile(user_id: str = Query("local", description="ID účtu; pro lokální použití může zůstat 'local'")):
    store = _load()
    return store.get(user_id, {})

@router.post("")
def set_profile(payload: Profile, user_id: str = Query("local", description="ID účtu; pro lokální použití může zůstat 'local'")):
    if not any([payload.email, payload.phone, payload.address, payload.full_name]):
        raise HTTPException(status_code=400, detail="Chybí data k uložení.")
    store = _load()
    current = store.get(user_id, {})
    current.update(payload.model_dump(exclude_unset=True))
    store[user_id] = current
    _save(store)
    return {"ok": True, "user_id": user_id, "profile": current}
