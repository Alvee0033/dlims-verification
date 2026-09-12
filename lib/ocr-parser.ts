/**
 * Intelligent OCR Text Parser - Calibrated for Islamabad Traffic Police (ITP) Driving License Cards
 *
 * Card format reference:
 *   Name            Ghulam Murtaza
 *   Address         dakh khana khas teh & distt Dera ghazi Khan pakistan
 *   ITPLicenseNo.   1280012281
 *   Date of Birth   22-04-1998
 *   CNICNo.         3240284232731
 *   Issue Date      14-07-2018
 *   Expires Date    14-07-2028
 *   Blood Group     A+
 *   TYPE OF VEHICLES AUTHORIZED: M/Cycle, M/Car
 */

export interface ParsedLicenseData {
  licenseNumber: string;
  cnic: string;
  name: string;
  fatherName: string;
  address: string;
  allowedVehicles: string;
  issueDate: string;
  expiryDate: string;
  bloodGroup: string;
  district: string;
  confidence: number;
  extractedFields: Record<string, string>;
  rawText: string;
}

export function parseOcrText(rawText: string): ParsedLicenseData {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Normalise noise from Tesseract (pipes, backslashes, Urdu diacritics)
  const cleanText = rawText
    .replace(/[|\\]/g, ' ')
    .replace(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ');

  const extracted: Record<string, string> = {};

  // ────────────────────────────────────────────────
  // 1. CNIC  (13 digits, with or without dashes)
  //    The card prints it twice (front + barcode section).
  //    We collect ALL matches and prefer the LAST one (barcode = more reliable OCR).
  // ────────────────────────────────────────────────
  const cnicMatches: string[] = [];

  // Pattern A: with dashes  XXXXX-XXXXXXX-X
  const cnicDashRe = /\b(\d{5})[-.\s]?(\d{7})[-.\s]?(\d{1})\b/g;
  let m: RegExpExecArray | null;
  while ((m = cnicDashRe.exec(cleanText)) !== null) {
    cnicMatches.push(`${m[1]}-${m[2]}-${m[3]}`);
  }

  // Pattern B: 13 consecutive digits (no dash)
  const cnicRawRe = /\b(\d{13})\b/g;
  while ((m = cnicRawRe.exec(cleanText)) !== null) {
    const c = m[1];
    cnicMatches.push(`${c.slice(0, 5)}-${c.slice(5, 12)}-${c.slice(12)}`);
  }

  if (cnicMatches.length > 0) {
    extracted.cnic = cnicMatches[cnicMatches.length - 1];
  }

  // ────────────────────────────────────────────────
  // 2. License Number
  //    ITP format: "ITPLicenseNo. 1280012281" (no space between ITP+License)
  //    Also handles: "ITP LICENSE NO. 1280012281", "License No.", city-prefix codes
  // ────────────────────────────────────────────────
  const licPatterns = [
    /ITP\s*Licen[cs]e\s*No\.?\s*([A-Z0-9\-]{5,15})/i,
    /(?:Licen[cs]e\s*N[o0]|Lic\s*N[o0]|DL\s*N[o0]|ITP\s*LICEN[CS]E\s*N[o0])\.?\s*[:\s#-]*([A-Z0-9\-]{5,15})/i,
    /\b([A-Z]{2,4}[-\s]\d{5,8})\b/i,
  ];

  for (const pat of licPatterns) {
    const lm = cleanText.match(pat);
    if (lm) {
      const candidate = lm[1].replace(/[^A-Za-z0-9\-]/g, '').trim();
      if (!extracted.cnic || extracted.cnic.replace(/\D/g, '') !== candidate.replace(/\D/g, '')) {
        extracted.licenseNumber = candidate;
        break;
      }
    }
  }

  // Fallback: first 8–10 digit number that isn't CNIC
  if (!extracted.licenseNumber) {
    const nums = cleanText.match(/\b\d{8,12}\b/g) || [];
    for (const num of nums) {
      if (extracted.cnic && extracted.cnic.replace(/\D/g, '') === num) continue;
      extracted.licenseNumber = num;
      break;
    }
  }

  // ────────────────────────────────────────────────
  // 3. Dates  (Issue Date, Expiry/Expires Date)
  //    ITP card uses DD-MM-YYYY: "14-07-2018"
  // ────────────────────────────────────────────────
  const dateRegex = /\b(\d{1,2}[-./]\d{1,2}[-./]\d{4}|\d{4}[-./]\d{1,2}[-./]\d{1,2})\b/g;
  const foundDates: string[] = [];
  while ((m = dateRegex.exec(cleanText)) !== null) {
    foundDates.push(normalizeDate(m[1]));
  }

  const issueKw = cleanText.match(
    /(?:Issue\s*Date|Date\s*of\s*Issue|Valid\s*From|Issued)[:\s]*(\d{1,2}[-./]\d{1,2}[-./]\d{4}|\d{4}[-./]\d{1,2}[-./]\d{1,2})/i
  );
  if (issueKw) extracted.issueDate = normalizeDate(issueKw[1]);

  // "Expires Date" is the ITP wording (not "Expiry Date")
  const expiryKw = cleanText.match(
    /(?:Expires?\s*Date|Date\s*of\s*Expiry|Valid\s*Upto?|Valid\s*To)[:\s]*(\d{1,2}[-./]\d{1,2}[-./]\d{4}|\d{4}[-./]\d{1,2}[-./]\d{1,2})/i
  );
  if (expiryKw) extracted.expiryDate = normalizeDate(expiryKw[1]);

  // Positional fallback: dates sorted ascending; first=issue, last=expiry
  if (!extracted.issueDate && foundDates.length >= 1) extracted.issueDate = foundDates[0];
  if (!extracted.expiryDate && foundDates.length >= 2) extracted.expiryDate = foundDates[foundDates.length - 1];

  // ────────────────────────────────────────────────
  // 4. Name
  //    ITP card: "Name   Ghulam Murtaza"
  //    OCR may produce "[Name" or "'Name" due to photo overlap noise.
  // ────────────────────────────────────────────────
  const nameKw = cleanText.match(
    /(?:\[?'?\s*Name|Driver\s*Name|Name\s*of\s*Driver)[:\s]+([A-Za-z\s.'\-]{3,40})(?=\s*(?:Address|Father|CNIC|ITP|Date|$))/im
  );
  if (nameKw) {
    const candidate = nameKw[1].trim();
    if (candidate.length > 2 && !candidate.match(/^(Islamabad|Pakistan|Traffic|Police|License|Division)/i)) {
      extracted.name = toTitleCase(candidate.replace(/['"\u2018\u2019\s]+$/, '').trim());
    }
  }

  // Fallback: scan lines for Name label
  if (!extracted.name) {
    for (const line of lines) {
      const lc = line.toLowerCase();
      if (lc.includes('name') && !lc.includes('father') && !lc.includes('license') && !lc.includes('licence')) {
        const afterName = line.replace(/.*\bname\b[:\s]*/i, '').trim();
        if (afterName.length > 2 && /^[A-Za-z\s.'\-]+$/.test(afterName)) {
          extracted.name = toTitleCase(afterName);
          break;
        }
      }
    }
  }

  // ────────────────────────────────────────────────
  // 5. Father's Name
  //    Not on ITP front face, but may appear on other license types.
  // ────────────────────────────────────────────────
  const fatherKw = cleanText.match(
    /(?:Father(?:'?s?)?\s*Name|S\/O|D\/O|W\/O)[:\s]+([A-Za-z\s.'\-]{3,40})(?=\s*(?:Address|CNIC|Date|Mother|$))/im
  );
  if (fatherKw) {
    extracted.fatherName = toTitleCase(fatherKw[1].trim());
  }

  // ────────────────────────────────────────────────
  // 6. Allowed Vehicles
  //    ITP card: "M/Cycle, M/Car"
  //    Tesseract variants: "Micycle, MiGar" / "M|Cycle" / "MCycle"
  // ────────────────────────────────────────────────
  const vehicleClasses: string[] = [];
  if (/M[\/|il1]?[Cc]ycle|Motorcycle|Bike/i.test(cleanText)) vehicleClasses.push('M/Cycle');
  if (/M[\/|il1]?[CGcg]ar|M[\/|il1]?Jeep|Motorcar|Car[\/]Jeep|Jeep/i.test(cleanText)) vehicleClasses.push('M/Car');
  if (/\bLTV\b|Light\s*Transport/i.test(cleanText)) vehicleClasses.push('LTV');
  if (/\bHTV\b|Heavy\s*Transport/i.test(cleanText)) vehicleClasses.push('HTV');
  if (/\bPSV\b/i.test(cleanText)) vehicleClasses.push('PSV');
  if (/\bTractor\b/i.test(cleanText)) vehicleClasses.push('Tractor');

  extracted.allowedVehicles = vehicleClasses.length > 0 ? vehicleClasses.join(', ') : 'M/Cycle, M/Car';

  // ────────────────────────────────────────────────
  // 7. Blood Group
  //    ITP card: "Blood Group A+"
  //    Tesseract mistakes: "+" → "t"/"T"/"l"/"I"/"1"
  //    e.g. "At" should be "A+", "Bt" → "B+", "ABt" → "AB+"
  // ────────────────────────────────────────────────
  // Match blood group as single word token (max 3 chars like 'A+', 'AB+', 'O-') after the keyword
  const bgKw = cleanText.match(/Blood\s*Group[:\s]+([A-Za-z0-9+\-]{1,3})(?=\s|$)/i);
  if (bgKw) {
    extracted.bloodGroup = parseBloodGroup(bgKw[1].trim());
  } else {
    const bgFallback = cleanText.match(/\b(AB|A|B|O)\s*([+\-tTlI1]|POS|NEG)\b/i);
    if (bgFallback) {
      extracted.bloodGroup = parseBloodGroup(`${bgFallback[1]}${bgFallback[2]}`);
    }
  }

  // ────────────────────────────────────────────────
  // 8. District
  //    Extended list for Pakistan districts including "Dera Ghazi Khan"
  //    which appears on the ITP reference card.
  // ────────────────────────────────────────────────
  const districts = [
    'Islamabad', 'Rawalpindi', 'Lahore', 'Faisalabad', 'Multan', 'Gujranwala',
    'Peshawar', 'Karachi', 'Quetta', 'Sialkot', 'Bahawalpur', 'Sargodha',
    'Sahiwal', 'Jhelum', 'Gujrat', 'Kasur', 'Sheikhupura', 'Nankana Sahib',
    'Attock', 'Chakwal', 'Khushab', 'Mianwali', 'Bhakkar',
    'Dera Ghazi Khan', 'DG Khan', 'Dera Ismail Khan', 'DI Khan',
    'Muzaffargarh', 'Layyah', 'Rajanpur',
    'Hyderabad', 'Sukkur', 'Larkana', 'Mirpur Khas', 'Jacobabad',
    'Abbottabad', 'Mansehra', 'Mardan', 'Swat', 'Nowshera',
    'Kohat', 'Bannu', 'Karak', 'Haripur',
    'Okara', 'Pakpattan', 'Vehari', 'Khanewal', 'Lodhran',
    'Chiniot', 'Hafizabad', 'Mandi Bahauddin', 'Narowal', 'Toba Tek Singh',
    'Rahim Yar Khan', 'Bahawalnagar', 'Khanewal', 'Nankana',
  ];

  for (const dist of districts) {
    const distRe = new RegExp(`\\b${dist.replace(/[.]/g, '\\.')}\\b`, 'i');
    if (distRe.test(cleanText)) {
      // 'Islamabad Traffic Police' header should not count as district unless address also says Islamabad
      if (dist === 'Islamabad' && /Islamabad\s+Traffic\s+Police/i.test(cleanText)) {
        if (!/(?:Address|distt?)[^\n]*Islamabad/i.test(cleanText)) continue;
      }
      extracted.district = dist;
      break;
    }
  }

  // Heuristic: "distt <Word>" or merged "disttDeraGhazi" (OCR sometimes merges distt+name)
  if (!extracted.district) {
    // Try merged form: "disttWord" with no space
    const mergedDistt = cleanText.match(/distt([A-Za-z][A-Za-z\s]{1,20}?)(?=[^A-Za-z]|$)/i);
    if (mergedDistt) {
      extracted.district = toTitleCase(mergedDistt[1].trim());
    } else {
      // Try spaced form: "distt Word"
      const spacedDistt = cleanText.match(/distt\s+([A-Za-z][A-Za-z\s]{2,24}?)(?=\s*(?:pakistan|$|\n))/i);
      if (spacedDistt) {
        extracted.district = toTitleCase(spacedDistt[1].replace(/[^A-Za-z\s]/g, '').trim());
      }
    }
  }

  // ────────────────────────────────────────────────
  // 9. Address
  //    ITP card: "Address dakh khana khas teh & distt Dera ghazi Khan pakistan"
  //    May span 2 lines in OCR output.
  // ────────────────────────────────────────────────
  const addrKw = cleanText.match(
    /(?:Address|Present\s*Address|Permanent\s*Address)[:\s'']+([A-Za-z0-9\s&,.'\-/]{10,200}?)(?=\s*(?:ITPLicen|ITP\s*Licen|License\s*No|Date\s*of\s*Birth|CNICNo|CNIC\s*No|Issue\s*Date|$))/i
  );
  if (addrKw) {
    extracted.address = addrKw[1].replace(/\s+/g, ' ').replace(/^[\s\u2014\u2013\-\>"'\u2018\u2019]+/, '').trim();
  }

  // Fallback: scan lines for address geo-keywords
  if (!extracted.address) {
    const addrLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (/teh|distt?|street|st\.|road|post|khas|house|mohallah|sector|block|bazaar/i.test(lines[i])) {
        addrLines.push(lines[i]);
        // Grab next line if it looks like a continuation (no field-label at start)
        if (i + 1 < lines.length && !/^(Name|CNIC|Issue|Expiry|Expires|License|Licence|Blood|ITP|Date)/i.test(lines[i + 1])) {
          addrLines.push(lines[i + 1]);
        }
        break;
      }
    }
    if (addrLines.length > 0) {
      extracted.address = addrLines.join(' ').replace(/\s+/g, ' ').trim();
    }
  }

  // ────────────────────────────────────────────────
  // Confidence: % of core fields found
  // ────────────────────────────────────────────────
  const coreFields = ['licenseNumber', 'cnic', 'name', 'issueDate', 'expiryDate'];
  const score = coreFields.filter((f) => !!extracted[f]).length / coreFields.length;

  return {
    licenseNumber: extracted.licenseNumber || '',
    cnic: extracted.cnic || '',
    name: extracted.name || '',
    fatherName: extracted.fatherName || '',
    address: extracted.address || '',
    allowedVehicles: extracted.allowedVehicles || 'M/Cycle, M/Car',
    issueDate: extracted.issueDate || '',
    expiryDate: extracted.expiryDate || '',
    bloodGroup: extracted.bloodGroup || '',
    district: extracted.district || '',
    confidence: Math.round(score * 100),
    extractedFields: extracted,
    rawText,
  };
}

// ────────────────────────────────────────────────
// Helper: normalise date to YYYY-MM-DD
// ────────────────────────────────────────────────
function normalizeDate(raw: string): string {
  const parts = raw.split(/[-./]/);
  if (parts.length !== 3) return raw;

  if (parts[0].length === 4) {
    // YYYY-MM-DD
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  } else if (parts[2].length === 4) {
    // DD-MM-YYYY  (ITP card format)
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return raw;
}

// ────────────────────────────────────────────────
// Helper: parse OCR-mangled blood group strings
//   Tesseract mistakes "+" as "t"/"T"/"l"/"I"/"1"
//   e.g. "At" → "A+", "ABt" → "AB+", "Bt" → "B+"
// ────────────────────────────────────────────────
function parseBloodGroup(raw: string): string {
  const s = raw.replace(/\s/g, '').toUpperCase();

  // Replace trailing noise character with "+"
  const fixed = s
    .replace(/^(AB|A|B|O)([TLJIFtlji1])$/, '$1+')
    .replace(/^(AB|A|B|O)\+$/, '$1+')
    .replace(/^(AB|A|B|O)\-$/, '$1-');

  const valid = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  if (valid.includes(fixed)) return fixed;

  if (/POS/i.test(s)) return `${s.replace(/POS/i, '')}+`;
  if (/NEG/i.test(s)) return `${s.replace(/NEG/i, '')}-`;
  if (/^(AB|A|B|O)$/.test(s)) return `${s}+`;

  return raw.toUpperCase();
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

