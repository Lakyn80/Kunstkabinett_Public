# app/core/image_service.py
"""
Image processing a storage v PostgreSQL jako BYTEA.
Resize, center, compress při uploadu.
"""
from io import BytesIO
from PIL import Image
import logging

log = logging.getLogger("app.image_service")


def process_and_compress_image(
    file_bytes: bytes,
    max_width: int = 1200,
    max_height: int = 900,
    quality: int = 80,
) -> tuple[bytes, str]:
    """
    Zpracuj obrázek: resize, center, komprimuj.
    
    Vrátí: (processed_bytes, mime_type)
    """
    try:
        img = Image.open(BytesIO(file_bytes))
        
        # Konvertuj RGBA → RGB (pro JPEG)
        if img.mode in ("RGBA", "LA", "P"):
            rgb_img = Image.new("RGB", img.size, (255, 255, 255))
            rgb_img.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
            img = rgb_img
        
        # Resize s aspect ratio zachováním
        img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        
        # Center-pad na přesné rozměry
        new_img = Image.new("RGB", (max_width, max_height), (255, 255, 255))
        offset = (
            (max_width - img.width) // 2,
            (max_height - img.height) // 2,
        )
        new_img.paste(img, offset)
        
        # Komprimuj
        buf = BytesIO()
        new_img.save(buf, format="JPEG", quality=quality, optimize=True)
        buf.seek(0)
        
        log.info(f"Image processed: {len(buf.getvalue())} bytes")
        return buf.getvalue(), "image/jpeg"
        
    except Exception as e:
        log.error(f"Image processing error: {e}")
        raise


def get_image_base64(image_bytes: bytes) -> str:
    """
    Konvertuj bytes na base64 pro inline <img src="data:image/jpeg;base64,...">
    """
    import base64
    return base64.b64encode(image_bytes).decode("utf-8")