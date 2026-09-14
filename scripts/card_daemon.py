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
from PIL import Image, ImageDraw, ImageFont, ImageOps
import barcode
from barcode.writer import ImageWriter
import qrcode

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# ── Constants ────────────────────────────────────────────────────────────────
DARK = (27, 33, 37, 255)
RED  = (161, 44, 47, 255)

# ── Pre-load template & fonts at startup ─────────────────────────────────────
TEMPLATE_PATH = os.path.join(BASE_DIR, "assets", "templer.png")
TEMPLATE_PREVIEW_PATH = os.path.join(BASE_DIR, "assets", "templer_preview.png")

_template_base = Image.open(TEMPLATE_PATH).convert("RGBA")   # full 1792×2400
if os.path.exists(TEMPLATE_PREVIEW_PATH):
    _template_base_half = Image.open(TEMPLATE_PREVIEW_PATH).convert("RGBA")  # instant preview 50%
else:
    _template_base_half = _template_base.resize((896, 1200), Image.Resampling.BILINEAR)

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

# ── Signature coordinates (inner signature box below driver photo) ────────────
# Full-res inner box: x=81..499, y=931..1138. Center: cx=290, cy=1034.5
SIGN_BOX_CX, SIGN_BOX_CY = 290, 1034.5
SIGN_MAX_W, SIGN_MAX_H = 340, 150

# ── Helpers ───────────────────────────────────────────────────────────────────
def format_date(d_str):
    if not d_str:
        return ""
    d_str = str(d_str).strip()
    if len(d_str) == 10 and d_str[4] == '-' and d_str[7] == '-':
        p = d_str.split('-')
        return f"{p[2]}-{p[1]}-{p[0]}"
    return d_str

def _load_image_input(img_input):
    if not img_input or not str(img_input).strip():
        return None
    input_str = str(img_input).strip()
    if input_str.startswith("data:image"):
        try:
            _, encoded = input_str.split(",", 1)
            data_bytes = base64.b64decode(encoded)
            return Image.open(BytesIO(data_bytes))
        except Exception:
            pass

    clean_p = input_str.lstrip("/")
    candidates = [
        input_str,
        os.path.join(BASE_DIR, clean_p),
        os.path.join(BASE_DIR, "public", clean_p),
    ]

    if "uploads/" in input_str:
        fname = input_str.split("uploads/")[-1].split("?")[0].split("#")[0].strip().lstrip("/")
        candidates.extend([
            os.path.join(BASE_DIR, "public", "uploads", fname),
            os.path.join(BASE_DIR, "uploads", fname),
            os.path.join("/app", "public", "uploads", fname),
            fname,
        ])

    for pp in candidates:
        if os.path.exists(pp) and os.path.isfile(pp):
            try:
                return Image.open(pp)
            except Exception:
                pass

    if input_str.startswith("http://") or input_str.startswith("https://"):
        try:
            import urllib.request
            req = urllib.request.Request(input_str, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                return Image.open(BytesIO(resp.read()))
        except Exception:
            pass

    return None

def load_photo(photo_input):
    img = _load_image_input(photo_input)
    if img:
        return img.convert("RGBA")
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

def paste_signature(template, signature_input, scale=1.0):
    """Paste driver signature into template inside signature box."""
    sig_raw = _load_image_input(signature_input)
    if not sig_raw:
        return

    # Check if image already has transparent alpha channel
    has_alpha = False
    if sig_raw.mode == "RGBA":
        try:
            extrema = sig_raw.getchannel("A").getextrema()
            if extrema[0] < 245:
                has_alpha = True
        except Exception:
            pass

    if not has_alpha:
        # Convert light paper background to transparent
        gray = sig_raw.convert("L")
        # Fast C-level lookup table: brightness > 215 -> 0 (transparent), < 125 -> 255 (opaque)
        lut = [int(max(0, min(255, (215 - i) * (255.0 / (215 - 125))))) for i in range(256)]
        alpha_channel = gray.point(lut, mode="L")
        black = Image.new("L", sig_raw.size, 15)
        sig = Image.merge("RGBA", (black, black, black, alpha_channel))
    else:
        sig = sig_raw.convert("RGBA")

    # Crop transparent borders around the signature
    bbox = sig.getbbox()
    if bbox:
        sig = sig.crop(bbox)

    w, h = sig.size
    if w == 0 or h == 0:
        return

    # Scale preserving aspect ratio to fit inside signature box
    max_w = int(SIGN_MAX_W * scale)
    max_h = int(SIGN_MAX_H * scale)
    ratio = min(max_w / w, max_h / h)
    new_w = max(1, int(w * ratio))
    new_h = max(1, int(h * ratio))
    sig_scaled = sig.resize((new_w, new_h), Image.Resampling.LANCZOS)

    box_cx = int(SIGN_BOX_CX * scale)
    box_cy = int(SIGN_BOX_CY * scale)
    paste_x = int(box_cx - new_w / 2)
    paste_y = int(box_cy - new_h / 2)
    template.paste(sig_scaled, (paste_x, paste_y), sig_scaled)

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

    # Extract fields (NO dummy defaults)
    english_name   = str(data.get("name") or "").strip()
    urdu_name      = str(data.get("urduName") or data.get("urdu_name") or "").strip()
    address        = str(data.get("address") or "").strip()
    license_number = str(data.get("licenseNumber") or data.get("license_number") or data.get("license_no") or "").strip()
    dob            = format_date(data.get("dob") or "")
    cnic_raw       = str(data.get("cnic") or "").strip()
    clean_cnic     = cnic_raw.replace("-", "").strip()
    issue_date     = format_date(data.get("issueDate") or data.get("issue_date") or "")
    expiry_date    = format_date(data.get("expiryDate") or data.get("expiry_date") or "")
    blood_group    = str(data.get("bloodGroup") or data.get("blood_group") or "").strip()
    vehicles       = str(data.get("allowedVehicles") or data.get("allowed_vehicles") or "").strip()
    domain         = str(data.get("domain") or "https://d6z0wwoe1kg3g9yfttqbu7nb.163.227.239.97.sslip.io").rstrip("/")
    qr_url         = str(data.get("qrUrl") or (f"{domain}/?verify={license_number}" if license_number else domain)).strip()
    website        = str(data.get("website") or "www.dlimsvitpk.com").strip()
    barcode_value  = str(data.get("barcodeText") or data.get("barcode_text") or "dlimsvitpk.com").strip()
    photo_input    = data.get("photoUrl") or data.get("photo_url") or data.get("photoPath") or data.get("photo_path")
    signature_input = data.get("signatureUrl") or data.get("signature_url") or data.get("signaturePath") or data.get("signature_path")

    # 1. Driver photo (exact frame coords)
    paste_photo(template, photo_input, scale)

    # 1b. Driver signature (exact sign box below photo)
    paste_signature(template, signature_input, scale)

    # 2. Urdu name (x=1440, y=378)
    if urdu_name and fonts["urdu"]:
        try:
            draw.text((s(1440), s(378)), urdu_name, font=fonts["urdu"], fill=DARK, direction="rtl", language="urd", anchor="ra")
        except Exception:
            try:
                draw.text((s(1440), s(378)), urdu_name, font=fonts["urdu"], fill=DARK, anchor="ra")
            except Exception:
                draw.text((s(1440), s(378)), urdu_name, font=fonts["urdu"], fill=DARK)

    # 3. English name
    if fonts["name"] and english_name:
        draw.text((s(832), s(494)), english_name, font=fonts["name"], fill=DARK)

    # 4. Address
    if fonts["addr"] and address:
        addr_lines = address.split("\n")
        if len(addr_lines) == 1 and len(address) > 40:
            words = address.split(" ")
            mid = len(words) // 2
            addr_lines = [" ".join(words[:mid]), " ".join(words[mid:])]
        if addr_lines and addr_lines[0]:
            draw.text((s(834), s(592)), addr_lines[0], font=fonts["addr"], fill=DARK)
        if len(addr_lines) > 1 and addr_lines[1]:
            draw.text((s(834), s(646)), addr_lines[1], font=fonts["addr"], fill=DARK)

    # 5. Front table fields
    if fonts["fields"]:
        if license_number:
            draw.text((s(1015), s(747)),  license_number, font=fonts["fields"], fill=RED)
        if dob:
            draw.text((s(1012), s(831)),  dob,            font=fonts["fields"], fill=DARK)
        if clean_cnic:
            draw.text((s(1012), s(915)),  clean_cnic,     font=fonts["fields"], fill=DARK)
        if issue_date:
            draw.text((s(1015), s(995)),  issue_date,     font=fonts["fields"], fill=DARK)
        if expiry_date:
            draw.text((s(1015), s(1067)), expiry_date,    font=fonts["fields"], fill=RED)

    # 6. Barcode
    try:
        CODE128 = barcode.get_barcode_class("code128")
        rv = BytesIO()
        bc = CODE128(barcode_value, writer=ImageWriter())
        bc.write(rv, options={"write_text": False, "quiet_zone": 0.1, "module_height": 15.0})
        rv.seek(0)
        bc_img = Image.open(rv).convert("RGBA")
        datas = bc_img.getdata()
        new_data = [
            (255, 255, 255, 0) if (item[0] > 180 and item[1] > 180 and item[2] > 180) else DARK
            for item in datas
        ]
        bc_img.putdata(new_data)
        bc_img = bc_img.resize((s(800), s(96)), Image.Resampling.NEAREST)
        template.paste(bc_img, (s(85), s(1323)), bc_img)
    except Exception as e:
        sys.stderr.write(f"Barcode error: {e}\n")

    # 7-10. Back fields
    if fonts["fields"]:
        if clean_cnic:
            draw.text((s(1275), s(1303)), clean_cnic,     font=fonts["fields"], fill=DARK)
        if license_number and FONT_ARIMO_PATH:
            current_size = 62
            lic_font = ImageFont.truetype(FONT_ARIMO_PATH, max(1, int(current_size * scale)))
            bbox = lic_font.getbbox(license_number)
            text_w = bbox[2] - bbox[0]
            lic_x = s(515)
            max_right = s(940)
            while (lic_x + text_w) > max_right and current_size > 36:
                current_size -= 2
                lic_font = ImageFont.truetype(FONT_ARIMO_PATH, max(1, int(current_size * scale)))
                bbox = lic_font.getbbox(license_number)
                text_w = bbox[2] - bbox[0]
            draw.text((lic_x, s(1448)), license_number, font=lic_font, fill=DARK)
        if blood_group:
            draw.text((s(1371), s(1530)), blood_group,    font=fonts["fields"], fill=DARK)
        if vehicles:
            draw.text((s(1000), s(1640)), vehicles,       font=fonts["fields"], fill=DARK)

    # 11. QR code (transparent background)
    try:
        qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
        qr.add_data(qr_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="transparent").convert("RGBA")
        datas = qr_img.getdata()
        new_data = []
        for item in datas:
            if item[3] == 0 or (item[0] > 200 and item[1] > 200 and item[2] > 200):
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(DARK)
        qr_img.putdata(new_data)
        qr_img = qr_img.resize((s(243), s(243)), Image.Resampling.NEAREST)
        template.paste(qr_img, (s(1488), s(1816)), qr_img)
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
    elif preview or fmt in ("jpeg", "jpg"):
        template.convert("RGB").save(out, "JPEG", quality=85, optimize=False)
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
            if fmt == "pdf":
                mime = "application/pdf"
            elif is_preview or fmt in ("jpeg", "jpg"):
                mime = "image/jpeg"
            else:
                mime = "image/png"
            sys.stdout.write(json.dumps({"ok": True, "data": b64, "mime": mime}) + "\n")
        except Exception as e:
            sys.stdout.write(json.dumps({"ok": False, "error": str(e)}) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
