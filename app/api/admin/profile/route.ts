import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest, comparePassword, hashPassword, signToken } from '@/lib/auth';
import { findAdminById, findAdminByEmail, updateAdminEmail, updateAdminPassword } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentAdmin = await findAdminById(admin.id);
    if (!currentAdmin) {
      return NextResponse.json({ error: 'Admin account not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, currentPassword, newEmail, newPassword } = body;

    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required to authorize changes' }, { status: 400 });
    }

    // Verify current password
    const passwordValid = await comparePassword(currentPassword, currentAdmin.password_hash);
    if (!passwordValid) {
      return NextResponse.json({ error: 'Current password does not match' }, { status: 400 });
    }

    // Action: Change Email
    if (action === 'change_email') {
      if (!newEmail || typeof newEmail !== 'string' || !newEmail.includes('@')) {
        return NextResponse.json({ error: 'Please provide a valid email address' }, { status: 400 });
      }

      const normalizedEmail = newEmail.toLowerCase().trim();
      if (normalizedEmail === currentAdmin.email.toLowerCase()) {
        return NextResponse.json({ error: 'New email is identical to current email' }, { status: 400 });
      }

      const existing = await findAdminByEmail(normalizedEmail);
      if (existing && existing.id !== admin.id) {
        return NextResponse.json({ error: 'Email address is already registered to another account' }, { status: 400 });
      }

      const updated = await updateAdminEmail(admin.id, normalizedEmail);
      if (!updated) {
        return NextResponse.json({ error: 'Failed to update email in database' }, { status: 500 });
      }

      // Generate updated JWT token with new email
      const newToken = signToken({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
      });

      const response = NextResponse.json({
        success: true,
        message: 'Official email address updated successfully.',
        email: updated.email,
      });

      response.cookies.set('dlims_admin_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    // Action: Change Password
    if (action === 'change_password') {
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
      }

      const newPasswordHash = await hashPassword(newPassword);
      const updated = await updateAdminPassword(admin.id, newPasswordHash);
      if (!updated) {
        return NextResponse.json({ error: 'Failed to update password in database' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully.',
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (err: any) {
    console.error('Admin profile error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
