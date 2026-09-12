import { NextRequest, NextResponse } from 'next/server';
import { findLicenseByNumber, findLicenseByCnic, createVerificationLog } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { searchBy, searchValue } = body;

    if (!searchValue || typeof searchValue !== 'string' || !searchValue.trim()) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid License Number or CNIC.' },
        { status: 400 }
      );
    }

    const trimmedValue = searchValue.trim();
    const forwarded = req.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    let license = null;

    if (searchBy === 'cnic') {
      license = await findLicenseByCnic(trimmedValue);
      if (!license) {
        license = await findLicenseByNumber(trimmedValue);
      }
    } else {
      license = await findLicenseByNumber(trimmedValue);
      if (!license) {
        license = await findLicenseByCnic(trimmedValue);
      }
    }

    // Record verification attempt in PostgreSQL
    try {
      await createVerificationLog({
        search_type: searchBy || 'license_number',
        search_value: trimmedValue,
        status: license ? 'SUCCESS' : 'NOT_FOUND',
        ip_address: ipAddress,
        user_agent: userAgent,
        matched_license_id: license ? license.id : null,
      });
    } catch (logErr) {
      console.error('Failed to log verification:', logErr);
    }

    if (!license) {
      return NextResponse.json(
        {
          success: false,
          message: `No driving licence record found matching "${trimmedValue}". Please verify your details and try again.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      result: {
        name: license.name,
        address: license.address,
        licenseNumber: license.license_number,
        cnic: license.cnic,
        allowedVehicles: license.allowed_vehicles,
        issueDate: license.issue_date,
        expiryDate: license.expiry_date,
        photoUrl: license.photo_url || '/assets/driver-photo.jpg',
        status: license.status,
      },
    });
  } catch (err: any) {
    console.error('Verify API error:', err);
    return NextResponse.json(
      { success: false, message: 'An internal server error occurred while verifying the licence.' },
      { status: 500 }
    );
  }
}
