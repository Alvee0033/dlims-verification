'use client';

import React, { useState, useEffect } from 'react';

export default function AdminSettingsPage() {
  const [currentEmail, setCurrentEmail] = useState('');

  // Email Form State
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPass, setEmailCurrentPass] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Password Form State
  const [passCurrentPass, setPassCurrentPass] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    // Load current admin email
    fetch('/api/admin/auth')
      .then((res) => res.json())
      .then((data) => {
        if (data.admin?.email) {
          setCurrentEmail(data.admin.email);
        }
      })
      .catch(() => {});
  }, []);

  // Update Email Handler
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);

    if (!newEmail || !emailCurrentPass) {
      setEmailMsg({ type: 'danger', text: 'Please provide both new email and current password.' });
      return;
    }

    setEmailLoading(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_email',
          email: newEmail.trim(),
          currentPassword: emailCurrentPass,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setEmailMsg({ type: 'danger', text: data.message || 'Failed to update email.' });
        return;
      }

      setEmailMsg({ type: 'success', text: 'Email updated successfully!' });
      setCurrentEmail(newEmail.trim());
      setNewEmail('');
      setEmailCurrentPass('');
    } catch {
      setEmailMsg({ type: 'danger', text: 'An unexpected network error occurred.' });
    } finally {
      setEmailLoading(false);
    }
  };

  // Update Password Handler
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (!passCurrentPass || !newPassword || !confirmPassword) {
      setPassMsg({ type: 'danger', text: 'Please fill in all password fields.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'danger', text: 'New passwords do not match.' });
      return;
    }

    if (newPassword.length < 6) {
      setPassMsg({ type: 'danger', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setPassLoading(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_password',
          currentPassword: passCurrentPass,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPassMsg({ type: 'danger', text: data.message || 'Failed to update password.' });
        return;
      }

      setPassMsg({ type: 'success', text: 'Password updated successfully!' });
      setPassCurrentPass('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPassMsg({ type: 'danger', text: 'An unexpected network error occurred.' });
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="container-fluid p-0">
      {/* Page Header */}
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="fas fa-gear text-success"></i>
            <span>System Settings</span>
          </h1>
          <p className="text-muted small mb-0">
            Manage your official administrator login credentials and account security.
          </p>
        </div>
      </div>

      <div className="row g-4">
        {/* Change Email Card */}
        <div className="col-12 col-lg-6">
          <div className="admin-card p-3 p-md-4 h-100">
            <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-3">
              <div className="p-2 rounded bg-success bg-opacity-10 text-success fs-5">
                <i className="fas fa-envelope"></i>
              </div>
              <div>
                <h5 className="fw-bold text-dark mb-0 fs-6">Change Administrator Email</h5>
                <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                  Update your primary administrative login address
                </span>
              </div>
            </div>

            {emailMsg && (
              <div className={`alert alert-${emailMsg.type} py-2 px-3 small rounded-3 mb-3`}>
                {emailMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdateEmail}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">
                  Current Registered Email
                </label>
                <input
                  type="email"
                  className="form-control bg-light"
                  value={currentEmail || 'Loading...'}
                  disabled
                  readOnly
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">
                  New Admin Email
                </label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="admin@dlims.gov.pk"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold text-secondary">
                  Current Password (to confirm)
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={emailCurrentPass}
                  onChange={(e) => setEmailCurrentPass(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-success px-4 py-2 w-100 fw-semibold"
                disabled={emailLoading}
                style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a' }}
              >
                {emailLoading ? 'Updating Email...' : 'Update Email Address'}
              </button>
            </form>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="col-12 col-lg-6">
          <div className="admin-card p-3 p-md-4 h-100">
            <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-3">
              <div className="p-2 rounded bg-success bg-opacity-10 text-success fs-5">
                <i className="fas fa-lock"></i>
              </div>
              <div>
                <h5 className="fw-bold text-dark mb-0 fs-6">Change Security Password</h5>
                <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                  Ensure your account has a strong, secure passphrase
                </span>
              </div>
            </div>

            {passMsg && (
              <div className={`alert alert-${passMsg.type} py-2 px-3 small rounded-3 mb-3`}>
                {passMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdatePassword}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">
                  Current Password
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={passCurrentPass}
                  onChange={(e) => setPassCurrentPass(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">
                  New Password
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold text-secondary">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                className="btn btn-success px-4 py-2 w-100 fw-semibold"
                disabled={passLoading}
                style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a' }}
              >
                {passLoading ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
