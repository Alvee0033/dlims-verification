import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/auth';
import { saveUploadedFile } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = (formData.get('signature') || formData.get('photo') || formData.get('file')) as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure uploads folder exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate safe filename
    const isSignature = formData.has('signature');
    const ext = path.extname(file.name) || (isSignature ? '.png' : '.jpg');
    const prefix = isSignature ? 'signature_' : 'driver_';
    const filename = `${prefix}${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // Save to disk
    await fs.writeFile(filePath, buffer);

    // Save to PostgreSQL database for container persistence
    const mimeType = file.type || (ext.toLowerCase() === '.png' ? 'image/png' : 'image/jpeg');
    try {
      await saveUploadedFile(filename, mimeType, buffer);
    } catch (dbErr) {
      console.error('Failed to persist upload in database:', dbErr);
    }

    const fileUrl = `/uploads/${filename}`;
    return NextResponse.json({ success: true, url: fileUrl });
  } catch (err: any) {
    console.error('Photo upload error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
