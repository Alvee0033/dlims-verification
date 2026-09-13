#!/usr/bin/env python3
import os
import sys
import json
import argparse
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont, ImageOps
import numpy as np
import barcode
from barcode.writer import ImageWriter
import qrcode

# Photo coordinates (full resolution 1792x2400)
PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H = 89, 427, 404, 480

# Signature coordinates (inner signature box below driver photo)
SIGN_BOX_CX, SIGN_BOX_CY = 290, 1034.5
SIGN_MAX_W, SIGN_MAX_H = 340, 150

def _load_image_input(img_input, base_dir):
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
        os.path.join(base_dir, clean_p),
        os.path.join(base_dir, "public", clean_p),
    ]
    for pp in candidates:
        if os.path.exists(pp) and os.path.isfile(pp):
            try:
                return Image.open(pp)
            except Exception:
                pass
    return None

def paste_signature(template, signature_input, base_dir):
    """Paste driver signature into template inside signature box."""
    sig_raw = _load_image_input(signature_input, base_dir)
    if not sig_raw:
        return

    has_alpha = False
    if sig_raw.mode == "RGBA":
        alpha = np.array(sig_raw)[:, :, 3]
        if np.any(alpha < 245):
            has_alpha = True

    if not has_alpha:
        sig_rgb = sig_raw.convert("RGB")
        arr = np.array(sig_rgb)
        gray = np.mean(arr, axis=2)
        h, w = gray.shape
        rgba = np.zeros((h, w, 4), dtype=np.uint8)
        alpha_arr = np.clip((215 - gray) * (255.0 / (215 - 125)), 0, 255).astype(np.uint8)
        rgba[:, :, :3] = 15
        rgba[:, :, 3] = alpha_arr
        sig = Image.fromarray(rgba, "RGBA")
    else:
        sig = sig_raw.convert("RGBA")

    bbox = sig.getbbox()
    if bbox:
        sig = sig.crop(bbox)

    w, h = sig.size
    if w == 0 or h == 0:
        return

    ratio = min(SIGN_MAX_W / w, SIGN_MAX_H / h)
    new_w = max(1, int(w * ratio))
    new_h = max(1, int(h * ratio))
    sig_scaled = sig.resize((new_w, new_h), Image.Resampling.LANCZOS)

    paste_x = int(SIGN_BOX_CX - new_w / 2)
    paste_y = int(SIGN_BOX_CY - new_h / 2)
    template.paste(sig_scaled, (paste_x, paste_y), sig_scaled)

def format_date(d_str):
    if not d_str:
        return ""
    d_str = str(d_str).strip()
    # If YYYY-MM-DD
    if len(d_str) == 10 and d_str[4] == '-' and d_str[7] == '-':
        parts = d_str.split('-')
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    return d_str

def get_font_paths(base_dir):
    arimo_candidates = [
        os.path.join(base_dir, "assets", "fonts", "Arimo-Bold.ttf"),
        "/usr/share/fonts/truetype/croscore/Arimo-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    urdu_candidates = [
        os.path.join(base_dir, "assets", "fonts", "NotoNastaliqUrdu-Regular.ttf"),
        "/usr/share/fonts/truetype/noto/NotoNastaliqUrdu-Regular.ttf",
    ]

    arimo = next((p for p in arimo_candidates if os.path.exists(p)), None)
    urdu = next((p for p in urdu_candidates if os.path.exists(p)), None)
    return arimo, urdu

def generate_card(data, base_dir=None, output_path=None, output_format="png"):
    if not base_dir:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    template_path = os.path.join(base_dir, "assets", "templer.png")
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found at {template_path}")

    template = Image.open(template_path).convert("RGBA")
    draw = ImageDraw.Draw(template)

    font_arimo_path, font_urdu_path = get_font_paths(base_dir)

    DARK = (27, 33, 37, 255)
    RED = (161, 44, 47, 255)

    # Extract & sanitize fields (NO dummy defaults)
    english_name = str(data.get("name") or "").strip()
    urdu_name = str(data.get("urduName") or data.get("urdu_name") or "").strip()
    address = str(data.get("address") or "").strip()
    license_number = str(data.get("licenseNumber") or data.get("license_number") or "").strip()
    dob = format_date(data.get("dob") or "")
    cnic_raw = str(data.get("cnic") or "").strip()
    clean_cnic = cnic_raw.replace("-", "").strip()
    issue_date = format_date(data.get("issueDate") or data.get("issue_date") or "")
    expiry_date = format_date(data.get("expiryDate") or data.get("expiry_date") or "")
    blood_group = str(data.get("bloodGroup") or data.get("blood_group") or "").strip()
    vehicles = str(data.get("allowedVehicles") or data.get("allowed_vehicles") or "").strip()
    domain = str(data.get("domain") or "https://d6z0wwoe1kg3g9yfttqbu7nb.163.227.239.97.sslip.io").rstrip("/")
    qr_url = str(data.get("qrUrl") or (f"{domain}/?verify={license_number}" if license_number else domain)).strip()
    website = str(data.get("website") or "www.dlimsvitpk.com").strip()
    barcode_value = str(data.get("barcodeText") or data.get("barcode_text") or "dlimsvitpk.com").strip()
    photo_input = data.get("photoUrl") or data.get("photo_url") or data.get("photoPath") or data.get("photo_path")
    signature_input = data.get("signatureUrl") or data.get("signature_url") or data.get("signaturePath") or data.get("signature_path")

    # 1. Driver Photo (only if user provided/uploaded photo, NO demo fallback)
    photo_raw = _load_image_input(photo_input, base_dir)
    if photo_raw:
        photo_img = ImageOps.fit(photo_raw.convert("RGBA"), (PHOTO_W, PHOTO_H), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        template.paste(photo_img, (PHOTO_X, PHOTO_Y), photo_img)

    # 1b. Driver Signature (only if user provided/uploaded signature)
    paste_signature(template, signature_input, base_dir)

    # 2. Urdu Name (x=1440, y=378, size=46)
    if urdu_name and font_urdu_path:
        try:
            f_urdu = ImageFont.truetype(font_urdu_path, 46)
            try:
                draw.text((1440, 378), urdu_name, font=f_urdu, fill=DARK, direction="rtl", language="urd", anchor="ra")
            except Exception:
                try:
                    import arabic_reshaper
                    from bidi.algorithm import get_display
                    reshaped_text = arabic_reshaper.reshape(urdu_name)
                    bidi_text = get_display(reshaped_text)
                    draw.text((1440, 378), bidi_text, font=f_urdu, fill=DARK, anchor="ra")
                except Exception:
                    draw.text((1440, 378), urdu_name, font=f_urdu, fill=DARK)
        except Exception as e:
            sys.stderr.write(f"Urdu text rendering error: {e}\n")

    # 3. English Name (x=832, y=494)
    if english_name and font_arimo_path:
        f_name = ImageFont.truetype(font_arimo_path, 68)
        draw.text((832, 494), english_name, font=f_name, fill=DARK)

    # 4. Address (x=834, y=592 and y=646)
    if address and font_arimo_path:
        f_addr = ImageFont.truetype(font_arimo_path, 42)
        addr_lines = address.split("\n")
        if len(addr_lines) == 1 and len(address) > 40:
            words = address.split(" ")
            mid = len(words) // 2
            addr_lines = [" ".join(words[:mid]), " ".join(words[mid:])]
        if len(addr_lines) > 0 and addr_lines[0]:
            draw.text((834, 592), addr_lines[0], font=f_addr, fill=DARK)
        if len(addr_lines) > 1 and addr_lines[1]:
            draw.text((834, 646), addr_lines[1], font=f_addr, fill=DARK)

    # 5. Front Table Fields (x=1012-1015, font size 62)
    if font_arimo_path:
        f_fields = ImageFont.truetype(font_arimo_path, 62)
        if license_number:
            draw.text((1015, 747), license_number, font=f_fields, fill=RED)
        if dob:
            draw.text((1012, 831), dob, font=f_fields, fill=DARK)
        if clean_cnic:
            draw.text((1012, 915), clean_cnic, font=f_fields, fill=DARK)
        if issue_date:
            draw.text((1015, 995), issue_date, font=f_fields, fill=DARK)
        if expiry_date:
            draw.text((1015, 1067), expiry_date, font=f_fields, fill=RED)

    # --- BACK CARD ---
    # 6. Barcode (x=94, y=1322, w=833, h=99)
    try:
        CODE128 = barcode.get_barcode_class("code128")
        rv = BytesIO()
        bc = CODE128(barcode_value, writer=ImageWriter())
        bc.write(rv, options={"write_text": False, "quiet_zone": 0.1, "module_height": 15.0})
        rv.seek(0)
        bc_img = Image.open(rv).convert("RGBA")
        
        # Transparent background
        datas = bc_img.getdata()
        new_data = []
        for item in datas:
            if item[0] > 180 and item[1] > 180 and item[2] > 180:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(DARK)
        bc_img.putdata(new_data)
        
        bc_resized = bc_img.resize((833, 99), Image.Resampling.NEAREST)
        template.paste(bc_resized, (94, 1322), bc_resized)
    except Exception as e:
        sys.stderr.write(f"Barcode error: {e}\n")

    # 7. Back CNIC (x=1275, y=1303)
    if clean_cnic and font_arimo_path:
        draw.text((1275, 1303), clean_cnic, font=f_fields, fill=DARK)

    # 8. Back License No (x=587, y=1440)
    if license_number and font_arimo_path:
        draw.text((587, 1440), license_number, font=f_fields, fill=DARK)

    # 9. Back Blood Group (x=1371, y=1530)
    if blood_group and font_arimo_path:
        draw.text((1371, 1530), blood_group, font=f_fields, fill=DARK)

    # 10. Back Vehicles (x=1000, y=1640)
    if font_arimo_path:
        draw.text((1000, 1640), vehicles, font=f_fields, fill=DARK)

    # 11. Back QR Code (x=1488, y=1816, w=243, h=243)
    try:
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(qr_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
        qr_resized = qr_img.resize((243, 243), Image.Resampling.NEAREST)
        template.paste(qr_resized, (1488, 1816))
    except Exception as e:
        sys.stderr.write(f"QR error: {e}\n")

    # 12. Footer Website (x=89, y=2302, size 26)
    if font_arimo_path:
        f_footer = ImageFont.truetype(font_arimo_path, 26)
        draw.text((89, 2302), website, font=f_footer, fill=DARK)

    # Save or return format
    fmt = output_format.lower()
    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        if fmt == "pdf" or output_path.lower().endswith(".pdf"):
            template.convert("RGB").save(output_path, "PDF", resolution=300.0)
        else:
            template.save(output_path, "PNG")
        return output_path
    else:
        out_bytes = BytesIO()
        if fmt == "pdf":
            template.convert("RGB").save(out_bytes, "PDF", resolution=300.0)
        else:
            template.save(out_bytes, "PNG")
        return out_bytes.getvalue()

def main():
    parser = argparse.ArgumentParser(description="Generate Driving License Card PNG or PDF matching demo card")
    parser.add_argument("--json", help="JSON string or file containing license data")
    parser.add_argument("--output", help="Output file path (PNG or PDF)")
    parser.add_argument("--format", default="png", choices=["png", "pdf"], help="Output format (png or pdf)")
    args = parser.parse_args()

    data = {}
    if args.json:
        if os.path.exists(args.json):
            with open(args.json, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = json.loads(args.json)
    elif not sys.stdin.isatty():
        stdin_content = sys.stdin.read().strip()
        if stdin_content:
            data = json.loads(stdin_content)

    if not data:
        data = {
            "name": "Morsalin Alvee",
            "urduName": "مرسلین علوی",
            "address": "dakh khana khas teh & distt Dera ghazi\nKhan pakistan",
            "licenseNumber": "1280012281",
            "dob": "22-04-1998",
            "cnic": "3240284232731",
            "issueDate": "14-07-2018",
            "expiryDate": "14-07-2028",
            "bloodGroup": "A+",
            "allowedVehicles": "M/Cycle, M/Car",
            "photoUrl": "assets/demo_driver_photo.png"
        }

    fmt = args.format
    if args.output and args.output.lower().endswith(".pdf"):
        fmt = "pdf"

    if args.output:
        res = generate_card(data, output_path=args.output, output_format=fmt)
        print(f"Generated card saved to: {res}")
    else:
        raw_bytes = generate_card(data, output_format=fmt)
        sys.stdout.buffer.write(raw_bytes)

if __name__ == "__main__":
    main()
