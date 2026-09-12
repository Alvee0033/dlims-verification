'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

interface LicenseItem {
  id: string;
  license_number: string;
  name: string;
  cnic: string;
  district?: string;
  status: string;
}

export default function BarcodeQrPage() {
  const [domainName, setDomainName] = useState('');
  const [licenses, setLicenses] = useState<LicenseItem[]>([]);
  const [loadingLicenses, setLoadingLicenses] = useState(false);
  const [selectedLicenseId, setSelectedLicenseId] = useState<string>('custom');
  const [barcodeText, setBarcodeText] = useState('');
  const [showBarcodeText, setShowBarcodeText] = useState(false); // Default: false to match slim demo card
  const [qrUrl, setQrUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const [activeLicenseObj, setActiveLicenseObj] = useState<LicenseItem | null>(null);

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    // Detect the actual current domain and origin dynamically
    const host = typeof window !== 'undefined' ? window.location.host : 'dlimsvitp.com';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dlimsvitp.com';
    setDomainName(host);
    setBarcodeText(host);
    setQrUrl(`${origin}/?verify=1280012281`);

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
          setBarcodeText(host);
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

    const host = domainName || (typeof window !== 'undefined' ? window.location.host : 'dlimsvitp.com');
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dlimsvitp.com';

    if (id === 'custom') {
      setActiveLicenseObj(null);
      setBarcodeText(host);
      return;
    }

    const lic = licenses.find((l) => l.id === id);
    if (lic) {
      setActiveLicenseObj(lic);
      setBarcodeText(host);
      setQrUrl(`${origin}/?verify=${encodeURIComponent(lic.license_number)}`);
    }
  };

  // Re-generate Barcode & QR whenever values change
  useEffect(() => {
    // 1. Generate 1D Code 128 Barcode with transparent background & slim card ratio
    if (barcodeSvgRef.current && barcodeText) {
      try {
        setBarcodeError('');
        JsBarcode(barcodeSvgRef.current, barcodeText, {
          format: 'CODE128',
          displayValue: showBarcodeText,
          fontSize: 13,
          textMargin: 3,
          margin: 6,
          background: 'rgba(0,0,0,0)',
          lineColor: '#000000',
          height: 38,
          width: 2.2,
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
  }, [barcodeText, showBarcodeText, qrUrl]);

  // Download Barcode as PNG matching demo card slim proportions
  const downloadBarcodePng = (transparent = true) => {
    if (!barcodeSvgRef.current) return;
    const svgElement = barcodeSvgRef.current;
    const xml = new XMLSerializer().serializeToString(svgElement);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const b64Start = 'data:image/svg+xml;base64,';
    const image64 = b64Start + svg64;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Exact physical card demo length (645 x 96)
      canvas.width = 645;
      canvas.height = showBarcodeText ? 120 : 96;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (!transparent) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const a = document.createElement('a');
      a.download = `barcode_${activeLicenseObj?.license_number || 'code128'}_${transparent ? 'transparent' : 'white'}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = image64;
  };

  // Download QR Code as PNG with optional transparency
  const downloadQrCodePng = (transparent = true) => {
    if (!qrUrl) return;
    QRCode.toDataURL(qrUrl, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: transparent ? '#00000000' : '#ffffff',
      },
    }).then((url) => {
      const a = document.createElement('a');
      a.download = `qr_${activeLicenseObj?.license_number || 'verify'}_${transparent ? 'transparent' : 'white'}.png`;
      a.href = url;
      a.click();
    });
  };

  return (
    <div className="container-fluid p-0">
      {/* Page Header */}
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="fas fa-qrcode text-success"></i>
            <span>Barcode &amp; QR Generator</span>
          </h1>
          <p className="text-muted small mb-0">
            Generate and export official Code 128 linear barcodes and 2D verification QR codes.
          </p>
        </div>
      </div>

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
                  Choose any registered record or type custom values
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

            {/* 1D Barcode with Actual Domain & Controls */}
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label small fw-semibold text-secondary mb-0">
                  1D Barcode Value (Code 128):
                </label>
                <div className="d-flex gap-1">
                  <button
                    type="button"
                    onClick={() => setBarcodeText(domainName)}
                    className="btn btn-sm btn-outline-success py-0 px-2"
                    style={{ fontSize: '0.7rem' }}
                    title="Fill with actual website domain"
                  >
                    Actual Domain
                  </button>
                  {activeLicenseObj && (
                    <button
                      type="button"
                      onClick={() => setBarcodeText(activeLicenseObj.license_number)}
                      className="btn btn-sm btn-outline-secondary py-0 px-2"
                      style={{ fontSize: '0.7rem' }}
                      title="Fill with license number"
                    >
                      License No
                    </button>
                  )}
                </div>
              </div>
              <input
                type="text"
                className="form-control"
                value={barcodeText}
                onChange={(e) => setBarcodeText(e.target.value)}
                placeholder={domainName || 'dlimsvitp.com'}
              />
              <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                * Physical Card standard: Encodes portal verification domain <code>{domainName || 'dlimsvitp.com'}</code>
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
                placeholder="https://.../?verify=..."
              />
              <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                * Points directly to the live auto-verification certificate
              </span>
            </div>
          </div>

          {/* Quick Spec Card */}
          <div className="admin-card p-3 bg-light border-0">
            <div className="fw-semibold text-dark small mb-2">
              <i className="fas fa-circle-info text-success me-1"></i> Card Physical Encoding Specs
            </div>
            <ul className="text-muted small ps-3 mb-0" style={{ fontSize: '0.75rem', lineHeight: '1.5' }}>
              <li><strong>1D Barcode:</strong> Symbology is <code>Code 128</code>, slender strip on card reverse top-left.</li>
              <li><strong>Proportions:</strong> Scaled to the exact <code>645 &times; 96</code> physical card aspect ratio.</li>
              <li><strong>2D QR Code:</strong> High-density matrix on card reverse bottom-right.</li>
            </ul>
          </div>
        </div>

        {/* Generated Previews */}
        <div className="col-12 col-xl-7">
          <div className="admin-card p-3 p-md-4 h-100">
            <h5 className="fw-bold text-dark mb-3 fs-6 d-flex align-items-center gap-2">
              <i className="fas fa-sliders text-success"></i>
              <span>Live Generated Codes</span>
            </h5>

            <div className="row g-3">
              {/* 1D Barcode Box */}
              <div className="col-12">
                <div className="border rounded-3 p-3 bg-white text-center shadow-sm">
                  <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom flex-wrap gap-2">
                    <span className="badge bg-dark bg-opacity-10 text-dark fw-bold">
                      1D Barcode (Card Slim Ratio)
                    </span>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowBarcodeText(!showBarcodeText)}
                        className={`btn btn-sm py-1 px-2 border ${showBarcodeText ? 'btn-dark text-white' : 'btn-light text-secondary'}`}
                        style={{ fontSize: '0.72rem' }}
                        title="Toggle text below barcode"
                      >
                        {showBarcodeText ? 'Hide Text' : 'Show Text'}
                      </button>
                      <button
                        onClick={() => downloadBarcodePng(true)}
                        className="btn btn-sm btn-outline-dark py-1 px-2 d-flex align-items-center gap-1"
                        style={{ fontSize: '0.72rem' }}
                        title="Download with transparent background (645x96 demo size)"
                      >
                        <i className="fas fa-download"></i>
                        <span>Transparent PNG</span>
                      </button>
                      <button
                        onClick={() => downloadBarcodePng(false)}
                        className="btn btn-sm btn-light border py-1 px-2 text-muted"
                        style={{ fontSize: '0.72rem' }}
                        title="Download with white background"
                      >
                        <span>White</span>
                      </button>
                    </div>
                  </div>

                  <div className="d-flex justify-content-center align-items-center overflow-auto p-2" style={{ minHeight: '60px' }}>
                    {barcodeError ? (
                      <div className="text-danger small">{barcodeError}</div>
                    ) : (
                      <svg ref={barcodeSvgRef} id="barcode-svg" style={{ maxWidth: '100%', height: 'auto' }}></svg>
                    )}
                  </div>
                </div>
              </div>

              {/* 2D QR Code Box */}
              <div className="col-12 col-md-6">
                <div className="border rounded-3 p-3 bg-white text-center h-100 shadow-sm d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom flex-wrap gap-2">
                      <span className="badge bg-success bg-opacity-10 text-success fw-bold">
                        2D QR Code
                      </span>
                      <div className="d-flex gap-1">
                        <button
                          onClick={() => downloadQrCodePng(true)}
                          className="btn btn-sm btn-outline-success py-1 px-2 d-flex align-items-center gap-1"
                          style={{ fontSize: '0.72rem' }}
                          title="Download transparent QR PNG"
                        >
                          <i className="fas fa-download"></i>
                          <span>Transparent</span>
                        </button>
                        <button
                          onClick={() => downloadQrCodePng(false)}
                          className="btn btn-sm btn-light border py-1 px-2 text-muted"
                          style={{ fontSize: '0.72rem' }}
                          title="Download white QR PNG"
                        >
                          <span>White</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-2 d-flex justify-content-center">
                      {qrDataUrl ? (
                        <img
                          id="qr-code-img"
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
                      Card Reverse Placement
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
                        Islamabad Traffic Police<br />{domainName || 'dlimsvitp.com'}
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
    </div>
  );
}
