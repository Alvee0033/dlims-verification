'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

interface LicenseItem {
  id: string;
  license_number: string;
  cnic: string;
  name: string;
  district: string | null;
  status: string;
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'security' | 'barcode'>('security');
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

  // Barcode & QR Generator State
  const [licenses, setLicenses] = useState<LicenseItem[]>([]);
  const [loadingLicenses, setLoadingLicenses] = useState(false);
  const [selectedLicenseId, setSelectedLicenseId] = useState<string>('custom');
  const [barcodeText, setBarcodeText] = useState('dlimsvitp.com');
  const [qrUrl, setQrUrl] = useState('https://dlimsvitp.com/verify.php?search_by=license_number&search_value=1280012281');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const [activeLicenseObj, setActiveLicenseObj] = useState<LicenseItem | null>(null);

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

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

    // Fetch licenses for barcode generator
    setLoadingLicenses(true);
    fetch('/api/admin/licenses?limit=100')
      .then((res) => res.json())
      .then((data) => {
        if (data.licenses && data.licenses.length > 0) {
          setLicenses(data.licenses);
          // Default to first license
          const first = data.licenses[0];
          setSelectedLicenseId(first.id);
          setActiveLicenseObj(first);
          setBarcodeText('dlimsvitp.com');
          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dlimsvitp.com';
          setQrUrl(`${origin}/?verify=${encodeURIComponent(first.license_number)}`);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingLicenses(false));
  }, []);

  // When selected license changes
  const handleLicenseSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedLicenseId(id);

    if (id === 'custom') {
      setActiveLicenseObj(null);
      return;
    }

    const lic = licenses.find((l) => l.id === id);
    if (lic) {
      setActiveLicenseObj(lic);
      setBarcodeText('dlimsvitp.com');
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dlimsvitp.com';
      setQrUrl(`${origin}/?verify=${encodeURIComponent(lic.license_number)}`);
    }
  };

  // Re-generate Barcode & QR whenever values change
  useEffect(() => {
    // 1. Generate 1D Code 128 Barcode
    if (barcodeSvgRef.current && barcodeText) {
      try {
        setBarcodeError('');
        JsBarcode(barcodeSvgRef.current, barcodeText, {
          format: 'CODE128',
          displayValue: true,
          fontSize: 14,
          margin: 10,
          lineColor: '#000000',
          height: 55,
          width: 2,
        });
      } catch (err: any) {
        setBarcodeError(err.message || 'Invalid barcode value');
      }
    }

    // 2. Generate 2D QR Code
    if (qrUrl) {
      QRCode.toDataURL(qrUrl, {
        width: 260,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => {
          setQrDataUrl(url);
        })
        .catch(() => {});
    }
  }, [barcodeText, qrUrl, activeTab]);

  // Download Barcode as PNG
  const downloadBarcodePng = () => {
    if (!barcodeSvgRef.current) return;
    const svgElement = barcodeSvgRef.current;
    const xml = new XMLSerializer().serializeToString(svgElement);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const b64Start = 'data:image/svg+xml;base64,';
    const image64 = b64Start + svg64;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgElement.clientWidth * 2 || 600;
      canvas.height = svgElement.clientHeight * 2 || 200;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const a = document.createElement('a');
      a.download = `barcode_${activeLicenseObj?.license_number || 'code128'}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = image64;
  };

  // Download QR Code
  const downloadQrCodePng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.download = `qrcode_${activeLicenseObj?.license_number || 'verify'}.png`;
    a.href = qrDataUrl;
    a.click();
  };

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
      {/* Top Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="admin-page-title mb-1">System Settings</h2>
          <p className="text-muted small mb-0">
            Configure security, official access, and card Barcode &amp; QR Code generation.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="btn-group bg-white p-1 rounded-3 border shadow-sm" role="group">
          <button
            type="button"
            className={`btn btn-sm px-3 fw-semibold ${activeTab === 'security' ? 'btn-success text-white' : 'btn-light text-secondary'}`}
            style={activeTab === 'security' ? { backgroundColor: '#0f4c3a', borderColor: '#0f4c3a' } : {}}
            onClick={() => setActiveTab('security')}
          >
            <i className="fas fa-shield-halved me-1"></i>
            Account Security
          </button>
          <button
            type="button"
            className={`btn btn-sm px-3 fw-semibold ${activeTab === 'barcode' ? 'btn-success text-white' : 'btn-light text-secondary'}`}
            style={activeTab === 'barcode' ? { backgroundColor: '#0f4c3a', borderColor: '#0f4c3a' } : {}}
            onClick={() => setActiveTab('barcode')}
          >
            <i className="fas fa-barcode me-1"></i>
            Barcode &amp; QR Generator
          </button>
        </div>
      </div>

      {/* TAB 1: Account & Security */}
      {activeTab === 'security' && (
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
      )}

      {/* TAB 2: Barcode & QR Code Generator */}
      {activeTab === 'barcode' && (
        <div className="row g-4">
          {/* Controls / Select License */}
          <div className="col-12 col-xl-5">
            <div className="admin-card p-3 p-md-4 mb-4">
              <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-3">
                <div className="p-2 rounded bg-success bg-opacity-10 text-success fs-5">
                  <i className="fas fa-id-card"></i>
                </div>
                <div>
                  <h5 className="fw-bold text-dark mb-0 fs-6">Select Registered License / NID</h5>
                  <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                    Generate authentic card barcode &amp; verification QR code
                  </span>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">
                  Choose Existing License:
                </label>
                <select
                  className="form-select"
                  value={selectedLicenseId}
                  onChange={handleLicenseSelect}
                  disabled={loadingLicenses}
                >
                  <option value="custom">-- Custom Input (Manual) --</option>
                  {licenses.map((lic) => (
                    <option key={lic.id} value={lic.id}>
                      {lic.license_number} — {lic.name} ({lic.cnic})
                    </option>
                  ))}
                </select>
              </div>

              {activeLicenseObj && (
                <div className="p-3 bg-light rounded-3 border mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-bold text-dark">{activeLicenseObj.name}</span>
                    <span className="badge bg-success">{activeLicenseObj.status}</span>
                  </div>
                  <div className="text-muted small">
                    <div><strong>License No:</strong> {activeLicenseObj.license_number}</div>
                    <div><strong>CNIC:</strong> {activeLicenseObj.cnic}</div>
                    <div><strong>District:</strong> {activeLicenseObj.district || 'Islamabad'}</div>
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">
                  1D Barcode Value (Code 128):
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={barcodeText}
                  onChange={(e) => setBarcodeText(e.target.value)}
                  placeholder="e.g. dlimsvitp.com or 1280012281"
                />
                <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                  * Card specification: Prints official verification portal domain <code>dlimsvitp.com</code>
                </span>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary">
                  2D QR Code Verification URL:
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={qrUrl}
                  onChange={(e) => setQrUrl(e.target.value)}
                  placeholder="https://.../verify.php?search_by=license_number&search_value=..."
                />
                <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                  * Card specification: Points to direct verification query link
                </span>
              </div>
            </div>

            {/* Quick Spec Card */}
            <div className="admin-card p-3 bg-light border-0">
              <div className="fw-semibold text-dark small mb-2">
                <i className="fas fa-circle-info text-success me-1"></i> ITP Card Physical Encoding Specs
              </div>
              <ul className="text-muted small ps-3 mb-0" style={{ fontSize: '0.75rem', lineHeight: '1.5' }}>
                <li><strong>1D Barcode:</strong> Format is <code>Code 128</code>, located at the top-left on the reverse side.</li>
                <li><strong>2D QR Code:</strong> High-density QR matrix positioned at the bottom-right of the card.</li>
                <li><strong>Public Scanner:</strong> Any phone camera scanning the QR code immediately loads the verified driver card.</li>
              </ul>
            </div>
          </div>

          {/* Generated Previews */}
          <div className="col-12 col-xl-7">
            <div className="admin-card p-3 p-md-4 h-100">
              <h5 className="fw-bold text-dark mb-3 fs-6 d-flex align-items-center gap-2">
                <i className="fas fa-qrcode text-success"></i>
                <span>Generated Card Codes</span>
              </h5>

              <div className="row g-3">
                {/* 1D Barcode Box */}
                <div className="col-12">
                  <div className="border rounded-3 p-3 bg-white text-center shadow-sm">
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <span className="badge bg-dark bg-opacity-10 text-dark fw-bold">
                        1D Linear Barcode (Code 128)
                      </span>
                      <button
                        onClick={downloadBarcodePng}
                        className="btn btn-sm btn-outline-dark py-1 px-2 d-flex align-items-center gap-1"
                        style={{ fontSize: '0.75rem' }}
                      >
                        <i className="fas fa-download"></i>
                        <span>Download PNG</span>
                      </button>
                    </div>

                    <div className="d-flex justify-content-center align-items-center overflow-auto p-2" style={{ minHeight: '90px' }}>
                      {barcodeError ? (
                        <div className="text-danger small">{barcodeError}</div>
                      ) : (
                        <svg ref={barcodeSvgRef} style={{ maxWidth: '100%' }}></svg>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2D QR Code Box */}
                <div className="col-12 col-md-6">
                  <div className="border rounded-3 p-3 bg-white text-center h-100 shadow-sm d-flex flex-column justify-content-between">
                    <div>
                      <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                        <span className="badge bg-success bg-opacity-10 text-success fw-bold">
                          2D QR Code (Verification)
                        </span>
                        <button
                          onClick={downloadQrCodePng}
                          className="btn btn-sm btn-outline-success py-1 px-2 d-flex align-items-center gap-1"
                          style={{ fontSize: '0.75rem' }}
                        >
                          <i className="fas fa-download"></i>
                          <span>PNG</span>
                        </button>
                      </div>

                      <div className="p-2 d-flex justify-content-center">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="Verification QR Code"
                            className="img-fluid rounded border p-1"
                            style={{ width: '170px', height: '170px' }}
                          />
                        ) : (
                          <div className="spinner-border text-success" />
                        )}
                      </div>
                    </div>

                    <div className="text-muted small text-truncate px-2" style={{ fontSize: '0.7rem' }}>
                      {qrUrl}
                    </div>
                  </div>
                </div>

                {/* Card Back Placement Mockup */}
                <div className="col-12 col-md-6">
                  <div className="border rounded-3 p-3 bg-white h-100 shadow-sm d-flex flex-column">
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <span className="badge bg-primary bg-opacity-10 text-primary fw-bold">
                        Card Back Placement Mockup
                      </span>
                      <span className="text-muted small" style={{ fontSize: '0.7rem' }}>ISO/IEC 7810</span>
                    </div>

                    <div
                      className="rounded-3 p-2 text-dark position-relative flex-grow-1 d-flex flex-column justify-content-between border"
                      style={{
                        backgroundColor: '#f8fafc',
                        minHeight: '180px',
                        background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                      }}
                    >
                      {/* Top left Barcode representation */}
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="bg-white p-1 rounded border shadow-xs" style={{ maxWidth: '65%' }}>
                          <div style={{ fontSize: '0.55rem', fontWeight: 'bold' }}>CODE 128</div>
                          <div className="text-nowrap overflow-hidden" style={{ letterSpacing: '-1px', fontSize: '10px' }}>
                            ||| | |||| | |||||| || |
                          </div>
                        </div>
                        <div className="text-end">
                          <span className="badge bg-dark" style={{ fontSize: '0.6rem' }}>ITP BACK</span>
                        </div>
                      </div>

                      {/* Card Details Mock */}
                      <div className="small my-2" style={{ fontSize: '0.65rem' }}>
                        <div><strong>ITP License:</strong> {activeLicenseObj?.license_number || '1280012281'}</div>
                        <div><strong>Blood:</strong> A+ | <strong>Vehicles:</strong> M/Cycle, M/Car</div>
                      </div>

                      {/* Bottom Right QR representation */}
                      <div className="d-flex justify-content-between align-items-end">
                        <div className="text-muted" style={{ fontSize: '0.55rem' }}>
                          Islamabad Traffic Police<br />dlimsvitp.com
                        </div>
                        {qrDataUrl && (
                          <img
                            src={qrDataUrl}
                            alt="Mock QR"
                            className="bg-white p-1 rounded border shadow-xs"
                            style={{ width: '46px', height: '46px' }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

