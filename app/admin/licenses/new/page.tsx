'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ParsedOcrResult {
  licenseNumber: string;
  cnic: string;
  name: string;
  urduName?: string;
  fatherName: string;
  dob?: string;
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

  // Form state - All driver fields
  const [formData, setFormData] = useState({
    licenseNumber: '',
    cnic: '',
    name: '',
    urduName: '',
    fatherName: '',
    dob: '',
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

  // Live Card Preview & Auto-generation state
  const [cardPreviewUri, setCardPreviewUri] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<'pdf' | 'png' | null>(null);

  // Manual card preview — only called when user clicks "Preview Card"
  const refreshCardPreview = async (dataToRender = formData) => {
    setGeneratingPreview(true);
    try {
      const res = await fetch('/api/admin/card-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dataToRender,
          preview: true,
        }),
      });
      const json = await res.json();
      if (json.success && json.imageBase64) {
        setCardPreviewUri(json.imageBase64);
      }
    } catch (err) {
      console.error('Failed to generate card preview:', err);
    } finally {
      setGeneratingPreview(false);
    }
  };

  // Download PDF or PNG
  const handleDownloadCard = async (format: 'pdf' | 'png') => {
    try {
      setDownloading(format);
      const res = await fetch('/api/admin/card-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          format,
          download: true,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to generate ${format.toUpperCase()}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `License_${formData.licenseNumber || 'card'}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Error downloading card file');
    } finally {
      setDownloading(null);
    }
  };

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

        const newPhotoUrl = json.url;
        setFormData((prev) => ({ ...prev, photoUrl: newPhotoUrl }));
        refreshCardPreview({ ...formData, photoUrl: newPhotoUrl });
      } catch (err: any) {
        alert(err.message || 'Error uploading photo');
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  // Instant compressed file processing for OCR
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const rawFile = e.target.files[0];
      setScanStep('Compressing image for instant upload...');
      setIsScanning(true);
      setOcrError(null);
      setOcrAutoFilledNotice(false);

      try {
        const compressedFile = await compressImage(rawFile);
        setSelectedFile(compressedFile);
        setImagePreview(URL.createObjectURL(compressedFile));

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
      const updated = {
        ...formData,
        licenseNumber: parsed.licenseNumber || formData.licenseNumber,
        cnic: parsed.cnic || formData.cnic,
        name: parsed.name || formData.name,
        urduName: parsed.urduName || formData.urduName,
        fatherName: parsed.fatherName || formData.fatherName,
        dob: parsed.dob || formData.dob,
        address: parsed.address || formData.address,
        allowedVehicles: parsed.allowedVehicles || formData.allowedVehicles,
        issueDate: parsed.issueDate || formData.issueDate,
        expiryDate: parsed.expiryDate || formData.expiryDate,
        bloodGroup: parsed.bloodGroup || formData.bloodGroup,
        district: parsed.district || formData.district,
      };
      setFormData(updated);
      setOcrAutoFilledNotice(true);
      refreshCardPreview(updated);
    } catch (err: any) {
      setOcrError(err.message || 'Document scanning failed. Please check image clarity.');
    } finally {
      setIsScanning(false);
      setScanStep('');
    }
  };

  const applyOcrToForm = () => {
    if (!ocrResult) return;
    const updated = {
      ...formData,
      licenseNumber: ocrResult.licenseNumber || formData.licenseNumber,
      cnic: ocrResult.cnic || formData.cnic,
      name: ocrResult.name || formData.name,
      urduName: ocrResult.urduName || formData.urduName,
      fatherName: ocrResult.fatherName || formData.fatherName,
      dob: ocrResult.dob || formData.dob,
      address: ocrResult.address || formData.address,
      allowedVehicles: ocrResult.allowedVehicles || formData.allowedVehicles,
      issueDate: ocrResult.issueDate || formData.issueDate,
      expiryDate: ocrResult.expiryDate || formData.expiryDate,
      bloodGroup: ocrResult.bloodGroup || formData.bloodGroup,
      district: ocrResult.district || formData.district,
    };
    setFormData(updated);
    setActiveTab('form');
    refreshCardPreview(updated);
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
      }, 700);
    } catch (err: any) {
      setSaveError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid p-0">
      {/* Header & Tab Selector */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h2 className="admin-page-title mb-0">Register Driving License</h2>
          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
            Enter Driver Details &amp; Auto-Generate ID Card, 300 DPI Print PDF, Barcode &amp; QR
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="btn-group p-1 bg-light border rounded-pill shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold ${
              activeTab === 'form' ? 'btn-success text-white shadow-sm' : 'btn-light text-muted'
            }`}
            style={{ fontSize: '0.8rem' }}
          >
            <i className="fas fa-file-pen me-1"></i> Form &amp; Live Generator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ocr')}
            className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold ${
              activeTab === 'ocr' ? 'btn-success text-white shadow-sm' : 'btn-light text-muted'
            }`}
            style={{ fontSize: '0.8rem' }}
          >
            <i className="fas fa-camera me-1"></i> Scan ID Card
          </button>
        </div>
      </div>

      {/* OPTION 1: REGISTRATION FORM & LIVE CARD GENERATOR */}
      {activeTab === 'form' && (
        <div className="row g-3">
          {/* Left Column: Complete Driver Data Form */}
          <div className="col-12 col-xl-7">
            <div className="admin-card p-3 p-md-4">
              {saveSuccess && (
                <div className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3">
                  <i className="fas fa-check-circle text-success"></i>
                  <span className="fw-semibold">License registered successfully! Redirecting to directory...</span>
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
                    <div className="fw-bold text-dark small">Auto-Fill from ID Scan</div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      Upload or photograph card to instantly fill all fields below.
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
                    <span>Document processed! Form fields and live card preview have been updated.</span>
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
                    <span className="fw-bold small text-secondary text-uppercase">1. Driver Personal Information</span>
                    <hr className="my-1" />
                  </div>

                  {/* Driver Name (English) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold text-secondary" htmlFor="driverNameInput">
                      Driver Name (English) *
                    </label>
                    <input
                      id="driverNameInput"
                      type="text"
                      className="form-control"
                      placeholder="e.g. SAQLAIN ISHFAQ"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  {/* Arabic / Urdu Name */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold text-secondary d-flex justify-content-between align-items-center" htmlFor="urduNameInput">
                      <span>Arabic / Urdu Name (عربی / اردو نام)</span>
                      <span className="text-muted fw-normal" style={{ fontSize: '0.7rem' }}>Top right of card</span>
                    </label>
                    <input
                      id="urduNameInput"
                      type="text"
                      dir="rtl"
                      className="form-control"
                      placeholder="مثال: صقلین اشفاق"
                      value={formData.urduName}
                      onChange={(e) => setFormData({ ...formData, urduName: e.target.value })}
                    />
                  </div>

                  {/* Father's Name */}
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

                  {/* Date of Birth (DOB) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold text-secondary" htmlFor="dobInput">
                      Date of Birth (DOB) *
                    </label>
                    <input
                      id="dobInput"
                      type="date"
                      className="form-control font-monospace"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      required
                    />
                  </div>

                  {/* CNIC */}
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
                    <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                      Auto-generates verification QR code link on rear of card
                    </div>
                  </div>

                  {/* Blood Group */}
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

                  {/* District */}
                  <div className="col-6 col-md-3">
                    <label className="form-label small fw-semibold text-secondary" htmlFor="districtInput">
                      District
                    </label>
                    <input
                      id="districtInput"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Islamabad"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    />
                  </div>

                  {/* Address */}
                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary" htmlFor="addressInput">
                      Residential Address *
                    </label>
                    <textarea
                      id="addressInput"
                      className="form-control"
                      rows={2}
                      placeholder="dakh khana khas teh & distt Dera ghazi Khan pakistan"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                    />
                  </div>

                  {/* Section 2: License Details */}
                  <div className="col-12 mt-3">
                    <span className="fw-bold small text-secondary text-uppercase">2. License Authority &amp; Barcode Details</span>
                    <hr className="my-1" />
                  </div>

                  {/* License Number */}
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-semibold text-secondary" htmlFor="licNumInput">
                      ITP License Number *
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
                    <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                      Auto-generates Code 128 barcode on rear
                    </div>
                  </div>

                  {/* Issue Date */}
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

                  {/* Expiry Date */}
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

                  {/* Status */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold text-secondary" htmlFor="statusSelect">
                      License Status
                    </label>
                    <select
                      id="statusSelect"
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="VALID">VALID (Active)</option>
                      <option value="EXPIRED">EXPIRED</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>

                  {/* Driver Photograph */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold text-secondary d-block">
                      Driver Photograph
                    </label>
                    <div className="d-flex align-items-center gap-3 p-2 border rounded bg-light">
                      <div
                        className="position-relative rounded overflow-hidden border border-2 border-success flex-shrink-0 bg-white shadow-sm"
                        style={{ width: 54, height: 60 }}
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
                          Auto-framed into card template (436x454)
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
                        { key: 'M/Cycle', label: 'Motorcycle (M/Cycle)' },
                        { key: 'M/Car', label: 'Car / Jeep (M/Car)' },
                        { key: 'LTV', label: 'LTV (Light Transport)' },
                        { key: 'HTV', label: 'HTV (Heavy Transport)' },
                        { key: 'PSV', label: 'PSV (Public Service)' },
                        { key: 'Tractor', label: 'Tractor' },
                      ].map((cls) => {
                        const isChecked = formData.allowedVehicles.includes(cls.key);
                        return (
                          <button
                            key={cls.key}
                            type="button"
                            onClick={() => handleVehicleToggle(cls.key)}
                            className={`btn btn-sm ${
                              isChecked ? 'btn-success text-white shadow-sm' : 'btn-outline-secondary'
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

                {/* Form Action Buttons */}
                <div className="d-flex justify-content-between align-items-center pt-3 border-top gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ocr')}
                    className="btn btn-outline-secondary btn-sm"
                  >
                    <i className="fas fa-camera me-1"></i> Switch to Scanner
                  </button>

                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      disabled={saving || saveSuccess}
                      className="btn btn-success px-4 py-2 fw-semibold d-flex align-items-center gap-2 shadow-sm"
                      style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a', minHeight: '44px' }}
                    >
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm" />
                          <span>Saving Record...</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-shield-check"></i>
                          <span>Register License</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Live Card Preview & Auto PDF Generator */}
          <div className="col-12 col-xl-5">
            <div className="admin-card p-3 p-md-4 position-sticky" style={{ top: '20px' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <span className="fw-bold text-dark small d-block">
                    <i className="fas fa-id-card text-success me-1"></i> Live Card &amp; Print PDF
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                    Code 128 Barcode &amp; QR auto-generated
                  </span>
                </div>
                <div className="d-flex align-items-center gap-1">
                  <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1 small">
                    300 DPI High-Res
                  </span>
                  <button
                    type="button"
                    onClick={() => refreshCardPreview(formData)}
                    disabled={generatingPreview}
                    className="btn btn-sm btn-light border p-1 px-2 text-secondary"
                    title="Refresh Card Preview"
                  >
                    <i className={`fas fa-rotate ${generatingPreview ? 'fa-spin text-success' : ''}`}></i>
                  </button>
                </div>
              </div>

              {/* Card Image Display */}
              <div
                className="position-relative bg-dark bg-opacity-10 rounded-3 p-2 border text-center mb-3 overflow-hidden"
                style={{ minHeight: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {generatingPreview && (
                  <div
                    className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white bg-opacity-75"
                    style={{ zIndex: 10 }}
                  >
                    <span className="spinner-border spinner-border-sm text-success mb-1" role="status" />
                    <span className="text-muted small" style={{ fontSize: '0.75rem' }}>Rendering Card &amp; Barcode...</span>
                  </div>
                )}

                {cardPreviewUri ? (
                  <img
                    src={cardPreviewUri}
                    alt="Auto-Generated License Card"
                    className="img-fluid rounded shadow-sm"
                    style={{ maxHeight: '540px', width: 'auto', objectFit: 'contain' }}
                  />
                ) : (
                  <div className="text-center p-4 text-muted">
                    <i className="fas fa-id-card fa-3x mb-2 text-secondary opacity-50"></i>
                    <div className="small fw-semibold">License Card Preview</div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      Click &quot;Preview Card&quot; below to generate.
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Card Button */}
              <button
                type="button"
                onClick={() => refreshCardPreview(formData)}
                disabled={generatingPreview}
                className="btn btn-success fw-semibold w-100 d-flex align-items-center justify-content-center gap-2 py-2 shadow-sm mb-2"
                style={{ minHeight: '44px' }}
              >
                {generatingPreview ? (
                  <>
                    <span className="spinner-border spinner-border-sm" />
                    <span>Rendering Card &amp; Barcode...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-eye"></i>
                    <span>Preview Card</span>
                  </>
                )}
              </button>

              {/* Instant Download Action Buttons */}
              <div className="d-flex flex-column gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => handleDownloadCard('pdf')}
                  disabled={downloading === 'pdf'}
                  className="btn btn-danger fw-semibold d-flex align-items-center justify-content-center gap-2 py-2 shadow-sm"
                  style={{ minHeight: '44px' }}
                >
                  {downloading === 'pdf' ? (
                    <>
                      <span className="spinner-border spinner-border-sm" />
                      <span>Generating 300 DPI PDF...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-file-pdf"></i>
                      <span>Download Print PDF (300 DPI)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadCard('png')}
                  disabled={downloading === 'png'}
                  className="btn btn-outline-success fw-semibold d-flex align-items-center justify-content-center gap-2 py-2 shadow-sm"
                  style={{ minHeight: '44px' }}
                >
                  {downloading === 'png' ? (
                    <>
                      <span className="spinner-border spinner-border-sm" />
                      <span>Generating PNG...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-file-image"></i>
                      <span>Download High-Res PNG</span>
                    </>
                  )}
                </button>
              </div>

              {/* Automatic Features Info */}
              <div className="p-3 rounded bg-light border text-muted" style={{ fontSize: '0.75rem' }}>
                <div className="fw-bold text-dark mb-1">
                  <i className="fas fa-magic text-success me-1"></i> Auto-Generated Output Features:
                </div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="fas fa-barcode text-primary"></i>
                  <span><strong>Code 128 Barcode:</strong> Rendered automatically from License Number.</span>
                </div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="fas fa-qrcode text-primary"></i>
                  <span><strong>Dynamic QR Code:</strong> Scannable directly to DLIMS online verification.</span>
                </div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="fas fa-language text-primary"></i>
                  <span><strong>Nastaliq Urdu:</strong> Arabic/Urdu name placed in authentic calligraphy font.</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <i className="fas fa-print text-primary"></i>
                  <span><strong>Print PDF:</strong> Exact 300 DPI resolution, ready for PVC card printers.</span>
                </div>
              </div>
            </div>
          </div>
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
                    {ocrResult.urduName && (
                      <div className="col-12">
                        <div className="border rounded p-2 bg-light">
                          <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Arabic/Urdu Name:</span>
                          <strong className="text-dark fs-6 font-monospace" dir="rtl">{ocrResult.urduName}</strong>
                        </div>
                      </div>
                    )}
                    {ocrResult.fatherName && (
                      <div className="col-12">
                        <div className="border rounded p-2 bg-light">
                          <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Father Name:</span>
                          <strong className="text-dark">{ocrResult.fatherName}</strong>
                        </div>
                      </div>
                    )}
                    {ocrResult.dob && (
                      <div className="col-6">
                        <div className="border rounded p-2 bg-light">
                          <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Date of Birth:</span>
                          <span className="font-monospace text-dark">{ocrResult.dob}</span>
                        </div>
                      </div>
                    )}
                    <div className="col-6">
                      <div className="border rounded p-2 bg-light">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Blood Group:</span>
                        <span className="font-monospace text-danger fw-bold">{ocrResult.bloodGroup || '—'}</span>
                      </div>
                    </div>
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
