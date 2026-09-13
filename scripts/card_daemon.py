#!/usr/bin/env python3
"""
Card generation daemon — stays alive, handles requests in a loop.
Reads one JSON line from stdin per request, writes one JSON line to stdout.
Template image and fonts are loaded ONCE at startup.
Preview mode renders at 50% scale for ~4x speed boost.
"""
import os
import sys
import json
import base64
from io import BytesIO

# ── Imports (loaded once) ────────────────────────────────────────────────────
from PIL import Image, ImageDraw, ImageFont
import barcode
from barcode.writer import ImageWriter
import qrcode

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# ── Constants ────────────────────────────────────────────────────────────────
DARK = (27, 33, 37, 255)
RED  = (161, 44, 47, 255)

# ── Pre-load template & fonts at startup ─────────────────────────────────────
TEMPLATE_PATH = os.path.join(BASE_DIR, "assets", "templer.png")
_template_base      = Image.open(TEMPLATE_PATH).convert("RGBA")   # full 1792×2400
_template_base_half = _template_base.resize((896, 1200), Image.Resampling.LANCZOS)  # preview 50%

def _find_font(candidates):
    return next((p for p in candidates if os.path.exists(p)), None)

FONT_ARIMO_PATH = _find_font([
    os.path.join(BASE_DIR, "assets", "fonts", "Arimo-Bold.ttf"),
    "/usr/share/fonts/truetype/croscore/Arimo-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
])
FONT_URDU_PATH = _find_font([
    os.path.join(BASE_DIR, "assets", "fonts", "NotoNastaliqUrdu-Regular.ttf"),
    "/usr/share/fonts/truetype/noto/NotoNastaliqUrdu-Regular.ttf",
])

def _load_fonts(scale=1.0):
    """Load font objects at a given scale."""
    def f(path, size):
        return ImageFont.truetype(path, max(1, int(size * scale))) if path else None
    return {
        "urdu":   f(FONT_URDU_PATH,   46),
        "name":   f(FONT_ARIMO_PATH,  68),
        "addr":   f(FONT_ARIMO_PATH,  42),
        "fields": f(FONT_ARIMO_PATH,  62),
        "footer": f(FONT_ARIMO_PATH,  26),
    }

# Full-res fonts (for PDF/PNG download)
FONTS_FULL = _load_fonts(1.0)
# Half-res fonts (for fast preview)
FONTS_HALF = _load_fonts(0.5)

# ── Photo coordinates (matching demo card exact bounding box) ─────────────────
# Full-res: x=89, y=427, w=404, h=480
PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H = 89, 427, 404, 480

# ── Helpers ───────────────────────────────────────────────────────────────────
def format_date(d_str):
    if not d_str:
        return ""
    d_str = str(d_str).strip()
    if len(d_str) == 10 and d_str[4] == '-' and d_str[7] == '-':
        p = d_str.split('-')
        return f"{p[2]}-{p[1]}-{p[0]}"
    return d_str

def load_photo(photo_input):
    if not photo_input:
        return None
    clean_p = str(photo_input).lstrip("/")
    candidates = [
        photo_input,
        os.path.join(BASE_DIR, clean_p),
        os.path.join(BASE_DIR, "public", clean_p),
        os.path.join(BASE_DIR, "assets", "demo_driver_photo.png"),
    ]
    for pp in candidates:
        if os.path.exists(pp) and os.path.isfile(pp):
            try:
                return Image.open(pp).convert("RGBA")
            except Exception:
                pass
    fallback = os.path.join(BASE_DIR, "assets", "demo_driver_photo.png")
    if os.path.exists(fallback):
        try:
            return Image.open(fallback).convert("RGBA")
        except Exception:
            pass
    return None

def paste_photo(template, photo_input, scale=1.0):
    """Paste driver photo into template at exact position."""
    photo_img = load_photo(photo_input)
    if not photo_img:
        return
    from PIL import ImageOps
    px = int(PHOTO_X * scale)
    py = int(PHOTO_Y * scale)
    pw = int(PHOTO_W * scale)
    ph = int(PHOTO_H * scale)
    photo_img = ImageOps.fit(photo_img, (pw, ph), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    template.paste(photo_img, (px, py), photo_img)

# ── Core generator ────────────────────────────────────────────────────────────
def generate_card(data, output_format="png", preview=False):
    scale = 0.5 if preview else 1.0
    fonts = FONTS_HALF if preview else FONTS_FULL

    # Clone template
    if preview:
        template = _template_base_half.copy()
    else:
        template = _template_base.copy()
    draw = ImageDraw.Draw(template)

    def s(v):
        """Scale a coordinate."""
        return int(v * scale)

    # Extract fields
    english_name   = str(data.get("name") or "DRIVING LICENSE").strip()
    urdu_name      = str(data.get("urduName") or data.get("urdu_name") or "").strip()
    address        = str(data.get("address") or "").strip()
    license_number = str(data.get("licenseNumber") or data.get("license_number") or "0000000000").strip()
    dob            = format_date(data.get("dob") or "01-01-1995")
    cnic_raw       = str(data.get("cnic") or "").strip()
    clean_cnic     = cnic_raw.replace("-", "").strip()
    issue_date     = format_date(data.get("issueDate") or data.get("issue_date") or "01-01-2024")
    expiry_date    = format_date(data.get("expiryDate") or data.get("expiry_date") or "01-01-2029")
    blood_group    = str(data.get("bloodGroup") or data.get("blood_group") or "B+").strip()
    vehicles       = str(data.get("allowedVehicles") or data.get("allowed_vehicles") or "M/Cycle, M/Car").strip()
    domain         = str(data.get("domain") or "https://d6z0wwoe1kg3g9yfttqbu7nb.163.227.239.97.sslip.io").rstrip("/")
    qr_url         = str(data.get("qrUrl") or f"{domain}/?verify={license_number}").strip()
    website        = str(data.get("website") or "dlims.punjab.gov.pk").strip()
    photo_input    = data.get("photoUrl") or data.get("photo_url") or data.get("photoPath") or data.get("photo_path")

    # 1. Driver photo (exact frame coords)
    paste_photo(template, photo_input, scale)

    # 2. Urdu name
    if urdu_name and fonts["urdu"]:
        try:
            draw.text((s(1440), s(378)), urdu_name, font=fonts["urdu"], fill=DARK, direction="rtl", language="urd", anchor="ra")
        except Exception:
            try:
                import arabic_reshaper
                from bidi.algorithm import get_display
                bidi_text = get_display(arabic_reshaper.reshape(urdu_name))
                draw.text((s(1440), s(378)), bidi_text, font=fonts["urdu"], fill=DARK, anchor="ra")
            except Exception:
                draw.text((s(1440), s(378)), urdu_name, font=fonts["urdu"], fill=DARK)

    # 3. English name
    if fonts["name"]:
        draw.text((s(832), s(494)), english_name, font=fonts["name"], fill=DARK)

    # 4. Address
    if fonts["addr"]:
        addr_lines = address.split("\n")
        if len(addr_lines) == 1 and len(address) > 40:
            words = address.split(" ")
            mid = len(words) // 2
            addr_lines = [" ".join(words[:mid]), " ".join(words[mid:])]
        if addr_lines:
            draw.text((s(834), s(592)), addr_lines[0], font=fonts["addr"], fill=DARK)
        if len(addr_lines) > 1:
            draw.text((s(834), s(646)), addr_lines[1], font=fonts["addr"], fill=DARK)

    # 5. Front table fields
    if fonts["fields"]:
        draw.text((s(1015), s(747)),  license_number, font=fonts["fields"], fill=RED)
        draw.text((s(1012), s(831)),  dob,            font=fonts["fields"], fill=DARK)
        draw.text((s(1012), s(915)),  clean_cnic,     font=fonts["fields"], fill=DARK)
        draw.text((s(1015), s(995)),  issue_date,     font=fonts["fields"], fill=DARK)
        draw.text((s(1015), s(1067)), expiry_date,    font=fonts["fields"], fill=RED)

    # 6. Barcode
    try:
        CODE128 = barcode.get_barcode_class("code128")
        rv = BytesIO()
        bc = CODE128(license_number, writer=ImageWriter())
        bc.write(rv, options={"write_text": False, "quiet_zone": 0.1, "module_height": 15.0})
        rv.seek(0)
        bc_img = Image.open(rv).convert("RGBA")
        datas = bc_img.getdata()
        new_data = [
            (255, 255, 255, 0) if (item[0] > 180 and item[1] > 180 and item[2] > 180) else DARK
            for item in datas
        ]
        bc_img.putdata(new_data)
        bc_img = bc_img.resize((s(833), s(99)), Image.Resampling.NEAREST)
        template.paste(bc_img, (s(94), s(1322)), bc_img)
    except Exception as e:
        sys.stderr.write(f"Barcode error: {e}\n")

    # 7-10. Back fields
    if fonts["fields"]:
        draw.text((s(1275), s(1303)), clean_cnic,     font=fonts["fields"], fill=DARK)
        draw.text((s(587),  s(1440)), license_number, font=fonts["fields"], fill=DARK)
        draw.text((s(1371), s(1530)), blood_group,    font=fonts["fields"], fill=DARK)
        draw.text((s(1000), s(1640)), vehicles,       font=fonts["fields"], fill=DARK)

    # 11. QR code
    try:
        qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
        qr.add_data(qr_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
        qr_img = qr_img.resize((s(243), s(243)), Image.Resampling.NEAREST)
        template.paste(qr_img, (s(1488), s(1816)))
    except Exception as e:
        sys.stderr.write(f"QR error: {e}\n")

    # 12. Footer
    if fonts["footer"]:
        draw.text((s(89), s(2302)), website, font=fonts["footer"], fill=DARK)

    # Output
    out = BytesIO()
    fmt = output_format.lower()
    if fmt == "pdf":
        # PDF must be full-res regardless
        if preview:
            # Upscale back to full res for PDF
            template = template.resize((1792, 2400), Image.Resampling.LANCZOS)
        template.convert("RGB").save(out, "PDF", resolution=300.0)
    else:
        template.save(out, "PNG", optimize=False, compress_level=1)  # fast save
    return out.getvalue()

# ── Daemon loop ───────────────────────────────────────────────────────────────
def main():
    sys.stdout.write(json.dumps({"ready": True}) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            fmt = req.get("format", "png").lower()
            is_preview = bool(req.get("preview", False))
            raw = generate_card(req, output_format=fmt, preview=is_preview)
            b64 = base64.b64encode(raw).decode("utf-8")
            mime = "application/pdf" if fmt == "pdf" else "image/png"
            sys.stdout.write(json.dumps({"ok": True, "data": b64, "mime": mime}) + "\n")
        except Exception as e:
            sys.stdout.write(json.dumps({"ok": False, "error": str(e)}) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
