import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/auth';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scriptPath = path.join(process.cwd(), 'scripts', 'seed-db.mjs');
    await execFileAsync('node', [scriptPath]);

    return NextResponse.json({ success: true, message: 'Database re-seeded successfully' });
  } catch (err: any) {
    console.error('Reseed error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
