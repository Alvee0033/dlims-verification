import { NextRequest, NextResponse } from 'next/server';
import { findLicenseById } from '@/lib/db';
import { generateCardBuffer } from '@/lib/card-generator';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const license = await findLicenseById(params.id);
    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format')?.toLowerCase() === 'pdf' ? 'pdf' : 'png';
    const isDownload = searchParams.get('download') === '1' || searchParams.get('download') === 'true';

    // Domain for verification QR code
    const host = req.headers.get('host') || 'd6z0wwoe1kg3g9yfttqbu7nb.163.227.239.97.sslip.io';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const domain = `${protocol}://${host}`;

    const buffer = await generateCardBuffer(
      {
        name: license.name,
        urduName: license.urdu_name,
        fatherName: license.father_name,
        address: license.address,
        licenseNumber: license.license_number,
        dob: license.dob,
        cnic: license.cnic,
        issueDate: license.issue_date,
        expiryDate: license.expiry_date,
        bloodGroup: license.blood_group,
        allowedVehicles: license.allowed_vehicles,
        photoUrl: license.photo_url,
        signatureUrl: license.signature_url,
        domain,
      },
      format
    );

    const contentType = format === 'pdf' ? 'application/pdf' : 'image/png';
    const disposition = isDownload
      ? `attachment; filename="License_${license.license_number}.${format}"`
      : `inline; filename="License_${license.license_number}.${format}"`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('Card generation error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate card' }, { status: 500 });
  }
}
