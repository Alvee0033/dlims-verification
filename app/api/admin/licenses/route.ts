import { NextRequest, NextResponse } from 'next/server';
import {
  listLicenses,
  createLicense,
  createActivityLog,
  findLicenseByNumber,
  findLicenseByCnic,
} from '@/lib/db';
import { getAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const { licenses, total } = await listLicenses({
      search,
      status,
      page,
      limit,
    });

    return NextResponse.json({
      licenses,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error('List licenses error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      licenseNumber,
      cnic,
      name,
      fatherName,
      address,
      allowedVehicles,
      issueDate,
      expiryDate,
      status = 'VALID',
      bloodGroup,
      district,
      photoUrl,
      signatureUrl,
      signature_url,
      idCardFrontUrl,
      rawOcrText,
      dob,
      urduName,
      urdu_name,
    } = body;

    if (!licenseNumber || !cnic || !name) {
      return NextResponse.json(
        { error: 'License Number, CNIC, and Full Name are required.' },
        { status: 400 }
      );
    }

    // Check duplicate license number
    const existingLic = await findLicenseByNumber(licenseNumber);
    if (existingLic) {
      return NextResponse.json(
        { error: `A license with number ${licenseNumber} already exists in the system.` },
        { status: 409 }
      );
    }

    // Check duplicate CNIC
    const existingCnic = await findLicenseByCnic(cnic);
    if (existingCnic) {
      return NextResponse.json(
        { error: `A license with CNIC ${cnic} already exists in the system.` },
        { status: 409 }
      );
    }

    const newLicense = await createLicense({
      license_number: licenseNumber.trim(),
      cnic: cnic.trim(),
      name: name.trim(),
      father_name: fatherName?.trim() || null,
      address: address?.trim() || 'Address not provided',
      allowed_vehicles: allowedVehicles?.trim() || 'M/Cycle, M/Car',
      issue_date: issueDate || new Date().toISOString().split('T')[0],
      expiry_date: expiryDate || '2030-01-01',
      status,
      blood_group: bloodGroup?.trim() || null,
      district: district?.trim() || null,
      photo_url: photoUrl || '/assets/driver-photo.jpg',
      signature_url: signatureUrl || signature_url || null,
      id_card_front_url: idCardFrontUrl || null,
      raw_ocr_text: rawOcrText || null,
      dob: dob || null,
      urdu_name: (urduName || urdu_name)?.trim() || null,
    });

    // Write activity log
    await createActivityLog({
      admin_email: admin.email,
      action: 'CREATE_LICENSE',
      details: `Created license ${newLicense.license_number} for ${newLicense.name}`,
    });

    return NextResponse.json({ success: true, license: newLicense }, { status: 201 });
  } catch (err: any) {
    console.error('Create license error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
