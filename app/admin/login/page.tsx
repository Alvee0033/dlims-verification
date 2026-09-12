'use client';

import React, { useState } from 'react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials');
      }

      window.location.href = '/admin';
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center p-3"
      style={{
        background: 'linear-gradient(135deg, #0b1928 0%, #0f4c3a 50%, #064e3b 100%)',
      }}
    >
      <div
        className="card shadow-lg border-0 rounded-4 w-100"
        style={{ maxWidth: '420px', backgroundColor: '#ffffff' }}
      >
        <div className="card-body p-4 p-md-5">
          {/* Official Government Header */}
          <div className="text-center mb-4">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-3 mb-3 shadow-sm"
              style={{
                width: 60,
                height: 60,
                background: 'linear-gradient(135deg, #10b981, #047857)',
                color: '#fff',
                fontSize: '1.75rem',
              }}
            >
              <i className="fas fa-shield-halved"></i>
            </div>
            <h4 className="fw-bold text-dark mb-1">DLIMS Authority Login</h4>
            <p className="text-muted small mb-0">Government Driving License Management Portal</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 small rounded-3 mb-3">
              <i className="fas fa-circle-exclamation flex-shrink-0"></i>
              <div>{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">
                Official Email
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0 text-muted">
                  <i className="fas fa-envelope"></i>
                </span>
                <input
                  id="admin-email"
                  type="email"
                  className="form-control border-start-0 ps-0"
                  placeholder="name@dlims.gov.pk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-semibold text-secondary" htmlFor="admin-password">Password</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0 text-muted">
                  <i className="fas fa-lock"></i>
                </span>
                <input
                  id="admin-password"
                  type="password"
                  className="form-control border-start-0 ps-0"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-success w-100 py-2 fw-semibold rounded-3 shadow-sm"
              style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a', minHeight: '44px' }}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Authenticating...
                </>
              ) : (
                <>
                  <i className="fas fa-arrow-right-to-bracket me-2"></i>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-4">
            <a href="/" className="text-muted text-decoration-none small">
              &larr; Return to Public Verification Portal
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
