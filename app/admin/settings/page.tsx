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

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);
    setEmailLoading(true);

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_email',
          newEmail,
          currentPassword: emailCurrentPass,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update email address');
      }

      setEmailMsg({ type: 'success', text: data.message || 'Email updated successfully!' });
      setCurrentEmail(newEmail);
      setNewEmail('');
      setEmailCurrentPass('');
    } catch (err: any) {
      setEmailMsg({ type: 'danger', text: err.message || 'Error updating email' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'danger', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setPassMsg({ type: 'danger', text: 'Password must be at least 6 characters' });
      return;
    }

    setPassLoading(true);

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          currentPassword: passCurrentPass,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setPassMsg({ type: 'success', text: data.message || 'Password updated successfully!' });
      setPassCurrentPass('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassMsg({ type: 'danger', text: err.message || 'Error updating password' });
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="container-fluid p-0">
      <div className="mb-4">
        <h2 className="admin-page-title mb-1">Account &amp; Security Settings</h2>
        <p className="text-muted small mb-0">
          Manage your official administrator login email and account password.
        </p>
      </div>

      <div className="row g-4">
        {/* Change Email Form */}
        <div className="col-12 col-lg-6">
          <div className="admin-card p-3 p-md-4 h-100">
            <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-3">
              <div className="p-2 rounded bg-success bg-opacity-10 text-success fs-5">
                <i className="fas fa-envelope"></i>
              </div>
              <div>
                <h5 className="fw-bold text-dark mb-0 fs-6">Change Official Email</h5>
                <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                  Current: <strong className="text-dark">{currentEmail || 'admin@dlims.gov.pk'}</strong>
                </span>
              </div>
            </div>

            {emailMsg && (
              <div className={`alert alert-${emailMsg.type} py-2 px-3 small rounded-3 mb-3 d-flex align-items-center gap-2`}>
                <i className={`fas ${emailMsg.type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}`}></i>
                <span>{emailMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangeEmail}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary" htmlFor="newEmailInput">
                  New Email Address
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0 text-muted">
                    <i className="fas fa-at"></i>
                  </span>
                  <input
                    id="newEmailInput"
                    type="email"
                    className="form-control border-start-0 ps-0"
                    placeholder="new.admin@dlims.gov.pk"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold text-secondary" htmlFor="emailCurrentPassInput">
                  Current Password (to confirm)
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0 text-muted">
                    <i className="fas fa-lock"></i>
                  </span>
                  <input
                    id="emailCurrentPassInput"
                    type="password"
                    className="form-control border-start-0 ps-0"
                    placeholder="Enter current password"
                    value={emailCurrentPass}
                    onChange={(e) => setEmailCurrentPass(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={emailLoading}
                className="btn btn-success w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a', minHeight: '44px' }}
              >
                {emailLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" />
                    <span>Updating Email...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-save"></i>
                    <span>Update Email Address</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="col-12 col-lg-6">
          <div className="admin-card p-3 p-md-4 h-100">
            <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-3">
              <div className="p-2 rounded bg-primary bg-opacity-10 text-primary fs-5">
                <i className="fas fa-key"></i>
              </div>
              <div>
                <h5 className="fw-bold text-dark mb-0 fs-6">Change Account Password</h5>
                <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                  Secure password update
                </span>
              </div>
            </div>

            {passMsg && (
              <div className={`alert alert-${passMsg.type} py-2 px-3 small rounded-3 mb-3 d-flex align-items-center gap-2`}>
                <i className={`fas ${passMsg.type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}`}></i>
                <span>{passMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary" htmlFor="passCurrentPassInput">
                  Current Password
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0 text-muted">
                    <i className="fas fa-lock"></i>
                  </span>
                  <input
                    id="passCurrentPassInput"
                    type="password"
                    className="form-control border-start-0 ps-0"
                    placeholder="Enter current password"
                    value={passCurrentPass}
                    onChange={(e) => setPassCurrentPass(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary" htmlFor="newPasswordInput">
                  New Password
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0 text-muted">
                    <i className="fas fa-shield-halved"></i>
                  </span>
                  <input
                    id="newPasswordInput"
                    type="password"
                    className="form-control border-start-0 ps-0"
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold text-secondary" htmlFor="confirmPasswordInput">
                  Confirm New Password
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0 text-muted">
                    <i className="fas fa-check-double"></i>
                  </span>
                  <input
                    id="confirmPasswordInput"
                    type="password"
                    className="form-control border-start-0 ps-0"
                    placeholder="Re-type new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passLoading}
                className="btn btn-primary w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                style={{ minHeight: '44px' }}
              >
                {passLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-lock"></i>
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
