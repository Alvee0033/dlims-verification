import { NextRequest, NextResponse } from 'next/server';
import { getUploadedFile } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const pathSegments = resolvedParams.path || [];
    const filename = pathSegments.join('/');

    // Security check against directory traversal
    if (!filename || filename.includes('..') || path.isAbsolute(filename)) {
      return new NextResponse('Invalid file path', { status: 400 });
    }

    const localDiskPath = path.join(process.cwd(), 'public', 'uploads', filename);

    // 1. Try reading from disk first
    try {
      const diskData = await fs.readFile(localDiskPath);
      const ext = path.extname(filename).toLowerCase();
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.webp'
          ? 'image/webp'
          : 'application/octet-stream';

      return new NextResponse(new Uint8Array(diskData), {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      // Not on disk or read error, proceed to database fallback
    }

    // 2. Fallback to PostgreSQL uploaded_files table
    const dbFile = await getUploadedFile(filename);
    if (dbFile && dbFile.data) {
      // Re-hydrate local disk cache asynchronously
      try {
        await fs.mkdir(path.dirname(localDiskPath), { recursive: true });
        await fs.writeFile(localDiskPath, dbFile.data);
      } catch (writeErr) {
        console.warn('Could not cache upload to local disk:', writeErr);
      }

      return new NextResponse(new Uint8Array(dbFile.data), {
        headers: {
          'Content-Type': dbFile.mime_type || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return new NextResponse('File not found', { status: 404 });
  } catch (error: any) {
    console.error('Error serving upload:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
