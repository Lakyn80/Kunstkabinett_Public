# app/services/payments.py
import random
import string

def ensure_vs(order) -> str:
    """
    Zajistí, že objednávka má VS v order.vs_code (max 9 číslic).
    Pokud chybí, vygeneruje se a vrátí.
    """
    vs = getattr(order, "vs_code", None)
    if vs and str(vs).strip():
        return str(vs).strip()

    vs = "".join(random.choices(string.digits, k=9))
    order.vs_code = vs
    return vs
