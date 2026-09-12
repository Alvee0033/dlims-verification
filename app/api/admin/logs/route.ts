import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'verification';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (type === 'activity') {
      const logs = await query(
        'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
      return NextResponse.json({ logs });
    }

    const logs = await query(
      `SELECT v.*, l.name, l.license_number, l.cnic 
       FROM verification_logs v
       LEFT JOIN licenses l ON v.matched_license_id = l.id
       ORDER BY v.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
