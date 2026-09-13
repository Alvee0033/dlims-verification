import { NextRequest, NextResponse } from 'next/server';
import {
  findLicenseById,
  updateLicense,
  deleteLicense,
  findLicenseByNumber,
  findLicenseByCnic,
  createActivityLog,
  query,
} from '@/lib/db';
import { getAdminFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const license = await findLicenseById(params.id);
    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    const logs = await query(
      'SELECT * FROM verification_logs WHERE matched_license_id = $1 ORDER BY created_at DESC LIMIT 10',
      [params.id]
    );

    return NextResponse.json({ license, verificationLogs: logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const existing = await findLicenseById(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    // Check if new licenseNumber collides
    if (body.license_number && body.license_number !== existing.license_number) {
      const duplicate = await findLicenseByNumber(body.license_number);
      if (duplicate && duplicate.id !== params.id) {
        return NextResponse.json(
          { error: `License number ${body.license_number} is already assigned to another driver.` },
          { status: 409 }
        );
      }
    }

    // Check if new cnic collides
    if (body.cnic && body.cnic !== existing.cnic) {
      const duplicate = await findLicenseByCnic(body.cnic);
      if (duplicate && duplicate.id !== params.id) {
        return NextResponse.json(
          { error: `CNIC ${body.cnic} is already registered with another driver.` },
          { status: 409 }
        );
      }
    }

    const updated = await updateLicense(params.id, {
      name: body.name ?? existing.name,
      father_name: body.father_name !== undefined ? body.father_name : existing.father_name,
      cnic: body.cnic ?? existing.cnic,
      license_number: body.license_number ?? existing.license_number,
      address: body.address ?? existing.address,
      allowed_vehicles: body.allowed_vehicles ?? existing.allowed_vehicles,
      issue_date: body.issue_date ?? existing.issue_date,
      expiry_date: body.expiry_date ?? existing.expiry_date,
      status: body.status ?? existing.status,
      blood_group: body.blood_group !== undefined ? body.blood_group : existing.blood_group,
      district: body.district !== undefined ? body.district : existing.district,
      photo_url: body.photo_url ?? existing.photo_url,
      signature_url: body.signature_url !== undefined ? body.signature_url : (body.signatureUrl !== undefined ? body.signatureUrl : existing.signature_url),
      id_card_front_url: body.id_card_front_url !== undefined ? body.id_card_front_url : existing.id_card_front_url,
      dob: body.dob !== undefined ? body.dob : existing.dob,
      urdu_name: (body.urdu_name !== undefined ? body.urdu_name : (body.urduName !== undefined ? body.urduName : existing.urdu_name)),
    });

    await createActivityLog({
      admin_email: admin.email,
      action: 'UPDATE_LICENSE',
      details: `Updated license ${updated?.license_number} (${updated?.name})`,
    });

    return NextResponse.json({ success: true, license: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await findLicenseById(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    await deleteLicense(params.id);

    await createActivityLog({
      admin_email: admin.email,
      action: 'DELETE_LICENSE',
      details: `Deleted license ${existing.license_number} belonging to ${existing.name}`,
    });

    return NextResponse.json({ success: true, message: 'License deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
