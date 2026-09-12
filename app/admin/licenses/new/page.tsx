'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ParsedOcrResult {
  licenseNumber: string;
  cnic: string;
  name: string;
  fatherName: string;
  address: string;
  allowedVehicles: string;
  issueDate: string;
  expiryDate: string;
  bloodGroup: string;
  district: string;
  confidence: number;
  rawText: string;
}

// Client-side image compression for instant upload & faster OCR
async function compressImage(file: File, maxDim = 1200, quality = 0.8): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressed = new File([blob], cleanName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export default function NewLicensePage() {
  const router = useRouter();
  // Form option first as requested
  const [activeTab, setActiveTab] = useState<'form' | 'ocr'>('form');

  // OCR state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<ParsedOcrResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrAutoFilledNotice, setOcrAutoFilledNotice] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    licenseNumber: '',
    cnic: '',
    name: '',
    fatherName: '',
    address: '',
    allowedVehicles: 'M/Cycle, M/Car',
    issueDate: '',
    expiryDate: '',
    status: 'VALID',
    bloodGroup: 'B+',
    district: '',
    photoUrl: '/assets/driver-photo.jpg',
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingPhoto(true);
      try {
        const compressed = await compressImage(file, 600, 0.85);
        const data = new FormData();
        data.append('photo', compressed);

        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: data,
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to upload photo');
        }

        setFormData((prev) => ({ ...prev, photoUrl: json.url }));
      } catch (err: any) {
        alert(err.message || 'Error uploading photo');
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  // Instant compressed file processing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const rawFile = e.target.files[0];
      setScanStep('Compressing image for instant upload...');
      setIsScanning(true);
      setOcrError(null);
      setOcrAutoFilledNotice(false);

      try {
        // Fast client-side resize & compression
        const compressedFile = await compressImage(rawFile);
        setSelectedFile(compressedFile);
        setImagePreview(URL.createObjectURL(compressedFile));

        // Trigger OCR upload
        await performOcr(compressedFile);
      } catch {
        setOcrError('Failed to prepare document image.');
        setIsScanning(false);
      }
    }
  };

  const performOcr = async (fileToScan: File) => {
    setIsScanning(true);
    setScanStep('Analyzing document text...');

    try {
      const body = new FormData();
      body.append('image', fileToScan);

      const res = await fetch('/api/admin/ocr', {
        method: 'POST',
        body,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Could not recognize document text');
      }

      setOcrResult(json.data);

      if (json.imageUrl) {
        setImagePreview(json.imageUrl);
      }

      // Auto-fill form directly with extracted values
      const parsed = json.data;
      setFormData((prev) => ({
        ...prev,
        licenseNumber: parsed.licenseNumber || prev.licenseNumber,
        cnic: parsed.cnic || prev.cnic,
        name: parsed.name || prev.name,
        fatherName: parsed.fatherName || prev.fatherName,
        address: parsed.address || prev.address,
        allowedVehicles: parsed.allowedVehicles || prev.allowedVehicles,
        issueDate: parsed.issueDate || prev.issueDate,
        expiryDate: parsed.expiryDate || prev.expiryDate,
        bloodGroup: parsed.bloodGroup || prev.bloodGroup,
        district: parsed.district || prev.district,
      }));

      setOcrAutoFilledNotice(true);
    } catch (err: any) {
      setOcrError(err.message || 'Document scanning failed. Please check image clarity.');
    } finally {
      setIsScanning(false);
      setScanStep('');
    }
  };

  const applyOcrToForm = () => {
    if (!ocrResult) return;
    setFormData((prev) => ({
      ...prev,
      licenseNumber: ocrResult.licenseNumber || prev.licenseNumber,
      cnic: ocrResult.cnic || prev.cnic,
      name: ocrResult.name || prev.name,
      fatherName: ocrResult.fatherName || prev.fatherName,
      address: ocrResult.address || prev.address,
      allowedVehicles: ocrResult.allowedVehicles || prev.allowedVehicles,
      issueDate: ocrResult.issueDate || prev.issueDate,
      expiryDate: ocrResult.expiryDate || prev.expiryDate,
      bloodGroup: ocrResult.bloodGroup || prev.bloodGroup,
      district: ocrResult.district || prev.district,
    }));
    setActiveTab('form');
  };

  const handleVehicleToggle = (vehicleClass: string) => {
    const current = formData.allowedVehicles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let updated: string[];
    if (current.includes(vehicleClass)) {
      updated = current.filter((v) => v !== vehicleClass);
    } else {
      updated = [...current, vehicleClass];
    }
    setFormData({ ...formData, allowedVehicles: updated.join(', ') });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          rawOcrText: ocrResult?.rawText || null,
          idCardFrontUrl: imagePreview || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save license record');
      }

      setSaveSuccess(true);
      setTimeout(() => {
        router.push('/admin/licenses');
      }, 400);
    } catch (err: any) {
      setSaveError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid p-0">
      {/* Header & Tab Selector - Form option first */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="admin-page-title mb-0">Register Driving License</h2>
          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
            Official Driver Registry &amp; Document Capture
          </div>
        </div>

        {/* Tab Switcher: Form First, Scan Second */}
        <div className="btn-group p-1 bg-light border rounded-pill shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold ${
              activeTab === 'form' ? 'btn-success text-white shadow-sm' : 'btn-light text-muted'
            }`}
            style={{ fontSize: '0.8rem' }}
          >
            <i className="fas fa-file-pen me-1"></i> Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ocr')}
            className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold ${
              activeTab === 'ocr' ? 'btn-success text-white shadow-sm' : 'btn-light text-muted'
            }`}
            style={{ fontSize: '0.8rem' }}
          >
            <i className="fas fa-camera me-1"></i> Scan ID
          </button>
        </div>
      </div>

      {/* OPTION 1: REGISTRATION FORM (DEFAULT) */}
      {activeTab === 'form' && (
        <div className="admin-card p-3 p-md-4">
          {saveSuccess && (
            <div className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3">
              <i className="fas fa-check-circle text-success"></i>
              <span className="fw-semibold">License registered successfully! Navigating to directory...</span>
            </div>
          )}

          {saveError && (
            <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3">
              <i className="fas fa-circle-exclamation text-danger"></i>
              <span>{saveError}</span>
            </div>
          )}

          {/* Instant Auto-Fill Banner Inside Form */}
          <div className="p-3 mb-4 rounded-3 border bg-light d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 shadow-sm">
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-circle bg-success bg-opacity-10 text-success d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 38, height: 38 }}
              >
                <i className="fas fa-wand-magic-sparkles"></i>
              </div>
              <div>
                <div className="fw-bold text-dark small">Auto-Fill with ID Card</div>
                <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                  Upload or photograph document — auto-compressed for instant load.
                </div>
              </div>
            </div>

            <div>
              <input
                type="file"
                id="formQuickScanInput"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="d-none"
              />
              <label
                htmlFor="formQuickScanInput"
                className="btn btn-sm btn-success d-flex align-items-center justify-content-center gap-2 py-2 px-3 fw-semibold shadow-sm w-100"
                style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a', cursor: 'pointer' }}
              >
                <i className="fas fa-camera"></i>
                <span>Upload &amp; Auto-Fill</span>
              </label>
            </div>
          </div>

          {/* Scanning In Progress Alert */}
          {isScanning && (
            <div className="alert alert-info py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3">
              <span className="spinner-border spinner-border-sm text-primary" role="status" />
              <span className="fw-semibold">{scanStep || 'Processing document...'}</span>
            </div>
          )}

          {/* Auto-fill notification */}
          {ocrAutoFilledNotice && (
            <div className="alert alert-success py-2 px-3 small d-flex align-items-center justify-content-between mb-3 rounded-3">
              <div className="d-flex align-items-center gap-2">
                <i className="fas fa-check-circle text-success"></i>
                <span>Document processed! Form fields have been auto-filled below.</span>
              </div>
              <button
                type="button"
                className="btn-close btn-close-sm"
                onClick={() => setOcrAutoFilledNotice(false)}
              />
            </div>
          )}

          {ocrError && (
            <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3">
              <i className="fas fa-circle-exclamation text-danger"></i>
              <span>{ocrError}</span>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmit}>
            <div className="row g-2 g-md-3 mb-3">
              <div className="col-12">
                <span className="fw-bold small text-secondary text-uppercase">Driver Information</span>
                <hr className="my-1" />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold text-secondary" htmlFor="driverNameInput">
                  Driver Name *
                </label>
                <input
                  id="driverNameInput"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Saqlain Ishfaq"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold text-secondary" htmlFor="fatherNameInput">
                  Father&apos;s Name
                </label>
                <input
                  id="fatherNameInput"
                  type="text"
                  className="form-control"
                  placeholder="Father's full name"
                  value={formData.fatherName}
                  onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold text-secondary" htmlFor="cnicInput">
                  CNIC Number *
                </label>
                <input
                  id="cnicInput"
                  type="text"
                  className="form-control font-monospace"
                  placeholder="33105-8011903-7"
                  value={formData.cnic}
                  onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  required
                />
              </div>

              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold text-secondary" htmlFor="bloodGroupSelect">
                  Blood Group
                </label>
                <select
                  id="bloodGroupSelect"
                  className="form-select"
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold text-secondary" htmlFor="districtInput">
                  District
                </label>
                <input
                  id="districtInput"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Lahore"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                />
              </div>

              <div className="col-12">
                <label className="form-label small fw-semibold text-secondary" htmlFor="addressInput">
                  Residential Address *
                </label>
                <textarea
                  id="addressInput"
                  className="form-control"
                  rows={2}
                  placeholder="Complete residential address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div className="col-12 mt-3">
                <span className="fw-bold small text-secondary text-uppercase">License Authority Details</span>
                <hr className="my-1" />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label small fw-semibold text-secondary" htmlFor="licNumInput">
                  License Number *
                </label>
                <input
                  id="licNumInput"
                  type="text"
                  className="form-control font-monospace"
                  placeholder="e.g. 1280011963"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  required
                />
              </div>

              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold text-secondary" htmlFor="issueDateInput">
                  Issue Date *
                </label>
                <input
                  id="issueDateInput"
                  type="date"
                  className="form-control font-monospace"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  required
                />
              </div>

              <div className="col-6 col-md-4">
                <label className="form-label small fw-semibold text-secondary" htmlFor="expiryDateInput">
                  Expiry Date *
                </label>
                <input
                  id="expiryDateInput"
                  type="date"
                  className="form-control font-monospace"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  required
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold text-secondary" htmlFor="statusSelect">
                  Status
                </label>
                <select
                  id="statusSelect"
                  className="form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="VALID">VALID</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold text-secondary d-block">
                  Driver Photograph
                </label>
                <div className="d-flex align-items-center gap-3 p-2 border rounded bg-light">
                  <div
                    className="position-relative rounded-circle overflow-hidden border border-2 border-success flex-shrink-0 bg-white shadow-sm"
                    style={{ width: 60, height: 60 }}
                  >
                    <img
                      src={formData.photoUrl || '/assets/driver-photo.jpg'}
                      alt="Driver"
                      className="w-100 h-100 object-fit-cover"
                    />
                  </div>

                  <div className="flex-grow-1">
                    <input
                      type="file"
                      id="driverPhotoFileInput"
                      accept="image/*"
                      capture="user"
                      onChange={handlePhotoUpload}
                      className="d-none"
                    />
                    <label
                      htmlFor="driverPhotoFileInput"
                      className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-2 py-1 px-3 fw-semibold"
                      style={{ cursor: 'pointer' }}
                    >
                      {uploadingPhoto ? (
                        <>
                          <span className="spinner-border spinner-border-sm" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-camera"></i>
                          <span>Upload Photo</span>
                        </>
                      )}
                    </label>
                    <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                      PNG, JPG or Camera snapshot (auto-compressed)
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle Classes */}
              <div className="col-12">
                <label className="form-label small fw-semibold text-secondary mb-1 d-block">
                  Authorized Vehicle Categories
                </label>
                <div className="d-flex flex-wrap gap-2">
                  {[
                    { key: 'M/Cycle', label: 'Motorcycle' },
                    { key: 'M/Car', label: 'Car / Jeep' },
                    { key: 'LTV', label: 'LTV' },
                    { key: 'HTV', label: 'HTV' },
                    { key: 'PSV', label: 'PSV' },
                  ].map((cls) => {
                    const isChecked = formData.allowedVehicles.includes(cls.key);
                    return (
                      <button
                        key={cls.key}
                        type="button"
                        onClick={() => handleVehicleToggle(cls.key)}
                        className={`btn btn-sm ${
                          isChecked ? 'btn-success text-white' : 'btn-outline-secondary'
                        } rounded-pill px-3 py-1`}
                        style={{ fontSize: '0.78rem' }}
                      >
                        {isChecked && <i className="fas fa-check me-1"></i>}
                        {cls.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center pt-3 border-top">
              <button
                type="button"
                onClick={() => setActiveTab('ocr')}
                className="btn btn-outline-secondary btn-sm"
              >
                <i className="fas fa-camera me-1"></i> Switch to Scanner View
              </button>

              <button
                type="submit"
                disabled={saving || saveSuccess}
                className="btn btn-success px-4 py-2 fw-semibold d-flex align-items-center gap-2 shadow-sm"
                style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a', minHeight: '44px' }}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-shield-check"></i>
                    <span>Register License</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* OPTION 2: SCANNER VIEWPORT */}
      {activeTab === 'ocr' && (
        <div className="row g-3">
          {/* Scanner Viewport */}
          <div className="col-12 col-lg-6">
            <div className="admin-card p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-bold text-dark small">
                  <i className="fas fa-id-card text-success me-1"></i> ID Document Scanner
                </span>
                {ocrResult && (
                  <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1 small">
                    {ocrResult.confidence}% Extracted
                  </span>
                )}
              </div>

              {/* Viewport */}
              <div className="scanner-viewport mb-3">
                <div className="scanner-corner scanner-corner-tl" />
                <div className="scanner-corner scanner-corner-tr" />
                <div className="scanner-corner scanner-corner-bl" />
                <div className="scanner-corner scanner-corner-br" />
                <div className="scanner-overlay-grid" />

                {isScanning && <div className="scanner-laser" />}

                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="License Document"
                    className="w-100 h-100 object-fit-contain"
                  />
                ) : (
                  <div className="text-center text-secondary p-3">
                    <i className="fas fa-camera-retro fa-2x mb-2 text-secondary opacity-50"></i>
                    <div className="fw-semibold text-light small">Capture ID Card or Driving License</div>
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>Images auto-compressed on upload</div>
                  </div>
                )}
              </div>

              {/* Status indicator */}
              {isScanning && (
                <div className="alert alert-info py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                  <div className="spinner-border spinner-border-sm text-primary" role="status" />
                  <span className="fw-semibold">{scanStep}</span>
                </div>
              )}

              {/* Error */}
              {ocrError && (
                <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                  <i className="fas fa-circle-exclamation text-danger"></i>
                  <span>{ocrError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="d-flex gap-2">
                <input
                  type="file"
                  id="idCardCameraInput"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="d-none"
                />
                <label
                  htmlFor="idCardCameraInput"
                  className="btn btn-success flex-fill d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold shadow-sm"
                  style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a', minHeight: '44px' }}
                >
                  <i className="fas fa-camera"></i>
                  <span>Capture / Upload ID</span>
                </label>

                {selectedFile && !isScanning && (
                  <button
                    type="button"
                    onClick={() => performOcr(selectedFile)}
                    className="btn btn-outline-primary px-3"
                    title="Rescan"
                  >
                    <i className="fas fa-rotate"></i>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Extracted Details Breakdown */}
          <div className="col-12 col-lg-6">
            <div className="admin-card p-3">
              <div className="fw-bold text-dark small mb-2">
                <i className="fas fa-list-check text-primary me-1"></i> Extracted Attributes
              </div>

              {!ocrResult ? (
                <div className="text-center py-4 text-muted border rounded bg-light">
                  <i className="fas fa-id-card-clip fa-2x mb-2 text-secondary opacity-50"></i>
                  <div className="small fw-semibold">No Document Scanned</div>
                  <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                    Upload or snap a license photo to automatically recognize details.
                  </div>
                </div>
              ) : (
                <div>
                  <div className="row g-2 mb-3 small">
                    <div className="col-6">
                      <div className="border rounded p-2 bg-light">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>License No:</span>
                        <strong className="font-monospace text-primary">{ocrResult.licenseNumber || '—'}</strong>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="border rounded p-2 bg-light">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>CNIC:</span>
                        <strong className="font-monospace text-dark">{ocrResult.cnic || '—'}</strong>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="border rounded p-2 bg-light">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Driver Name:</span>
                        <strong className="text-dark fs-6">{ocrResult.name || '—'}</strong>
                      </div>
                    </div>
                    {ocrResult.fatherName && (
                      <div className="col-12">
                        <div className="border rounded p-2 bg-light">
                          <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Father Name:</span>
                          <strong className="text-dark">{ocrResult.fatherName}</strong>
                        </div>
                      </div>
                    )}
                    <div className="col-12">
                      <div className="border rounded p-2 bg-light">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Allowed Vehicles:</span>
                        <strong className="text-success">{ocrResult.allowedVehicles}</strong>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="border rounded p-2 bg-light">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Issue Date:</span>
                        <span className="font-monospace">{ocrResult.issueDate || '—'}</span>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="border rounded p-2 bg-light">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Expiry Date:</span>
                        <span className="font-monospace text-danger fw-bold">{ocrResult.expiryDate || '—'}</span>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="border rounded p-2 bg-light">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Address:</span>
                        <span className="text-secondary" style={{ fontSize: '0.75rem' }}>{ocrResult.address || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={applyOcrToForm}
                    className="btn btn-success w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                    style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a', minHeight: '44px' }}
                  >
                    <i className="fas fa-file-pen"></i>
                    <span>Apply to Form &amp; Review &rarr;</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
