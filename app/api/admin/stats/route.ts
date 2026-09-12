import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/db';
import { getAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (err: any) {
    console.error('Stats error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
