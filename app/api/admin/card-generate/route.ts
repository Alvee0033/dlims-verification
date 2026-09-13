import { NextRequest, NextResponse } from 'next/server';
import { generateCardBuffer } from '@/lib/card-generator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const format = body.format?.toLowerCase() === 'pdf' ? 'pdf' : 'png';
    const isPreview = Boolean(body.preview);
    const isDownload = Boolean(body.download);

    const host = req.headers.get('host') || 'd6z0wwoe1kg3g9yfttqbu7nb.163.227.239.97.sslip.io';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const domain = `${protocol}://${host}`;

    const buffer = await generateCardBuffer(
      {
        name: body.name || '',
        urduName: body.urduName || body.urdu_name || '',
        fatherName: body.fatherName || body.father_name || '',
        address: body.address || '',
        licenseNumber: body.licenseNumber || body.license_number || '',
        dob: body.dob || '',
        cnic: body.cnic || '',
        issueDate: body.issueDate || body.issue_date || '',
        expiryDate: body.expiryDate || body.expiry_date || '',
        bloodGroup: body.bloodGroup || body.blood_group || '',
        allowedVehicles: body.allowedVehicles || body.allowed_vehicles || '',
        photoUrl: body.photoUrl || body.photo_url || '',
        signatureUrl: body.signatureUrl || body.signature_url || '',
        domain,
        website: body.website || 'www.dlimsvitpk.com',
        barcodeText: body.barcodeText || body.barcode_text || 'dlimsvitpk.com',
      },
      format,
      isPreview
    );

    if (isPreview) {
      const base64 = buffer.toString('base64');
      const dataUri = `data:image/png;base64,${base64}`;
      return NextResponse.json({ success: true, imageBase64: dataUri });
    }

    const contentType = format === 'pdf' ? 'application/pdf' : 'image/png';
    const filename = `License_${body.licenseNumber || 'card'}.${format}`;
    const disposition = isDownload
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
      },
    });
  } catch (err: any) {
    console.error('Card generate error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate card' }, { status: 500 });
  }
}
