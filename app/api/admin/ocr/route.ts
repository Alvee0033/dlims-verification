import { NextRequest, NextResponse } from 'next/server';
import { parseOcrText } from '@/lib/ocr-parser';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate safe filename
    const ext = path.extname(file.name) || '.jpg';
    const timestamp = Date.now();
    const filename = `id_scan_${timestamp}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // Save image to public/uploads/
    await fs.writeFile(filePath, buffer);
    const imageUrl = `/uploads/${filename}`;

    // Prepare temp output base for tesseract
    const outputBase = path.join('/tmp', `tess_${timestamp}`);

    let rawText = '';
    try {
      // Execute native system Tesseract
      await execFileAsync('/usr/bin/tesseract', [
        filePath,
        outputBase,
        '-l',
        'eng',
        '--psm',
        '3', // Fully automatic page segmentation, but no OSD
      ]);

      const ocrOutputFile = `${outputBase}.txt`;
      rawText = await fs.readFile(ocrOutputFile, 'utf-8');
      // Clean up temp text file
      await fs.unlink(ocrOutputFile).catch(() => {});
    } catch (err: any) {
      console.error('Tesseract CLI error:', err);
      // If psm 3 had issues, try psm 6 (assume a single uniform block of text)
      try {
        await execFileAsync('/usr/bin/tesseract', [
          filePath,
          outputBase,
          '-l',
          'eng',
          '--psm',
          '6',
        ]);
        const ocrOutputFile = `${outputBase}.txt`;
        rawText = await fs.readFile(ocrOutputFile, 'utf-8');
        await fs.unlink(ocrOutputFile).catch(() => {});
      } catch (retryErr) {
        console.error('Tesseract retry failed:', retryErr);
        return NextResponse.json(
          { error: 'OCR processing failed to extract text from the provided image.' },
          { status: 500 }
        );
      }
    }

    // Parse structured data from OCR text
    const parsedData = parseOcrText(rawText);

    return NextResponse.json({
      success: true,
      data: parsedData,
      imageUrl,
      rawText,
    });
  } catch (error: any) {
    console.error('OCR Route error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
