import { NextRequest, NextResponse } from 'next/server';
import { generateCardBuffer } from '@/lib/card-generator';

export const dynamic = 'force-dynamic';

const previewCache = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const format = body.format?.toLowerCase() === 'pdf' ? 'pdf' : 'png';
    const isPreview = Boolean(body.preview);
    const isDownload = Boolean(body.download);

    // Check preview cache for ultra-fast instant load
    let cacheKey = '';
    if (isPreview) {
      cacheKey = JSON.stringify({
        n: body.name || '',
        u: body.urduName || body.urdu_name || '',
        f: body.fatherName || body.father_name || '',
        a: body.address || '',
        l: body.licenseNumber || body.license_number || body.license_no || '',
        d: body.dob || '',
        c: body.cnic || '',
        i: body.issueDate || body.issue_date || '',
        e: body.expiryDate || body.expiry_date || '',
        b: body.bloodGroup || body.blood_group || '',
        v: body.allowedVehicles || body.allowed_vehicles || '',
        p: body.photoUrl || body.photo_url || '',
        s: body.signatureUrl || body.signature_url || '',
        bc: body.barcodeText || body.barcode_text || '',
      });

      if (previewCache.has(cacheKey)) {
        return NextResponse.json({ success: true, imageBase64: previewCache.get(cacheKey) });
      }
    }

    const host = req.headers.get('host') || 'd6z0wwoe1kg3g9yfttqbu7nb.163.227.239.97.sslip.io';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const domain = `${protocol}://${host}`;

    const buffer = await generateCardBuffer(
      {
        name: body.name || '',
        urduName: body.urduName || body.urdu_name || '',
        fatherName: body.fatherName || body.father_name || '',
        address: body.address || '',
        licenseNumber: body.licenseNumber || body.license_number || body.license_no || '',
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
      if (previewCache.size > 200) {
        const first = previewCache.keys().next().value;
        if (first) previewCache.delete(first);
      }
      previewCache.set(cacheKey, dataUri);
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
