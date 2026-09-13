'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ImageCropperModal from '@/components/ImageCropperModal';

export default function EditLicensePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    license_number: '',
    cnic: '',
    name: '',
    urdu_name: '',
    father_name: '',
    dob: '',
    address: '',
    allowed_vehicles: 'M/Cycle, M/Car',
    issue_date: '',
    expiry_date: '',
    status: 'VALID',
    blood_group: 'B+',
    district: '',
    photo_url: '/assets/driver-photo.jpg',
    signature_url: '',
  });

  // Interactive Cropper Modal state
  const [cropperConfig, setCropperConfig] = useState<{
    isOpen: boolean;
    imageSrc: string | null;
    title: string;
    aspectRatio: number;
    targetWidth: number;
    targetHeight: number;
    isSignature: boolean;
    type: 'photo' | 'signature';
  }>({
    isOpen: false,
    imageSrc: null,
    title: '',
    aspectRatio: 404 / 480,
    targetWidth: 404,
    targetHeight: 480,
    isSignature: false,
    type: 'photo',
  });

  // Card Preview & Generator state
  const [cardPreviewUri, setCardPreviewUri] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<'pdf' | 'png' | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  // Manual card preview — only called when user clicks "Preview Card"
  const refreshCardPreview = async (dataToRender = formData) => {
    if (!dataToRender.name && !dataToRender.license_number) return;
    setGeneratingPreview(true);
    try {
      const res = await fetch('/api/admin/card-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: dataToRender.name,
          urdu_name: dataToRender.urdu_name,
          father_name: dataToRender.father_name,
          address: dataToRender.address,
          license_number: dataToRender.license_number,
          dob: dataToRender.dob,
          cnic: dataToRender.cnic,
          issue_date: dataToRender.issue_date,
          expiry_date: dataToRender.expiry_date,
          blood_group: dataToRender.blood_group,
          allowed_vehicles: dataToRender.allowed_vehicles,
          photo_url: dataToRender.photo_url,
          signature_url: dataToRender.signature_url,
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

  useEffect(() => {
    fetch(`/api/admin/licenses/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('License not found');
        return res.json();
      })
      .then((data) => {
        if (data.license) {
          const loaded = {
            license_number: data.license.license_number || '',
            cnic: data.license.cnic || '',
            name: data.license.name || '',
            urdu_name: data.license.urdu_name || '',
            father_name: data.license.father_name || '',
            dob: data.license.dob || '',
            address: data.license.address || '',
            allowed_vehicles: data.license.allowed_vehicles || 'M/Cycle, M/Car',
            issue_date: data.license.issue_date || '',
            expiry_date: data.license.expiry_date || '',
            status: data.license.status || 'VALID',
            blood_group: data.license.blood_group || 'B+',
            district: data.license.district || '',
            photo_url: data.license.photo_url || '/assets/driver-photo.jpg',
            signature_url: data.license.signature_url || '',
          };
          setFormData(loaded);
          refreshCardPreview(loaded);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  // Real-time debounced preview (250ms debounce, smooth background sync)
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      if (formData.name || formData.license_number) {
        refreshCardPreview(formData);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [
    formData.name,
    formData.urdu_name,
    formData.father_name,
    formData.dob,
    formData.cnic,
    formData.license_number,
    formData.issue_date,
    formData.expiry_date,
    formData.address,
    formData.blood_group,
    formData.allowed_vehicles,
    formData.photo_url,
    formData.signature_url,
    loading,
  ]);

  // Download PDF or PNG
  const handleDownloadCard = async (format: 'pdf' | 'png') => {
    try {
      setDownloading(format);
      const res = await fetch('/api/admin/card-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          urdu_name: formData.urdu_name,
          father_name: formData.father_name,
          address: formData.address,
          license_number: formData.license_number,
          dob: formData.dob,
          cnic: formData.cnic,
          issue_date: formData.issue_date,
          expiry_date: formData.expiry_date,
          blood_group: formData.blood_group,
          allowed_vehicles: formData.allowed_vehicles,
          photo_url: formData.photo_url,
          signature_url: formData.signature_url,
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
      a.download = `License_${formData.license_number || 'card'}.${format}`;
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

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setCropperConfig({
          isOpen: true,
          imageSrc: reader.result as string,
          title: 'Adjust & Crop Driver Photo (404 x 480)',
          aspectRatio: 404 / 480,
          targetWidth: 404,
          targetHeight: 480,
          isSignature: false,
          type: 'photo',
        });
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setCropperConfig({
          isOpen: true,
          imageSrc: reader.result as string,
          title: 'Adjust & Crop Driver Signature',
          aspectRatio: 340 / 150,
          targetWidth: 680,
          targetHeight: 300,
          isSignature: true,
          type: 'signature',
        });
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleCropComplete = async (blob: Blob, _previewUrl: string) => {
    const isSig = cropperConfig.type === 'signature';
    if (isSig) {
      setUploadingSignature(true);
    } else {
      setUploadingPhoto(true);
    }

    setCropperConfig((prev) => ({ ...prev, isOpen: false, imageSrc: null }));

    try {
      const data = new FormData();
      if (isSig) {
        data.append('signature', blob, 'signature.png');
      } else {
        data.append('photo', blob, 'driver_photo.jpg');
      }

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: data,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to upload image');
      }

      const newUrl = json.url;
      if (isSig) {
        setFormData((prev) => ({ ...prev, signature_url: newUrl }));
        refreshCardPreview({ ...formData, signature_url: newUrl });
      } else {
        setFormData((prev) => ({ ...prev, photo_url: newUrl }));
        refreshCardPreview({ ...formData, photo_url: newUrl });
      }
    } catch (err: any) {
      alert(err.message || 'Error uploading cropped image');
    } finally {
      setUploadingPhoto(false);
      setUploadingSignature(false);
    }
  };

  const handleCropCancel = () => {
    setCropperConfig((prev) => ({ ...prev, isOpen: false, imageSrc: null }));
  };

  const handleVehicleToggle = (vehicleClass: string) => {
    const current = formData.allowed_vehicles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let updated: string[];
    if (current.includes(vehicleClass)) {
      updated = current.filter((v) => v !== vehicleClass);
    } else {
      updated = [...current, vehicleClass];
    }
    setFormData({ ...formData, allowed_vehicles: updated.join(', ') });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/licenses/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update license');

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/licenses');
      }, 900);
    } catch (err: any) {
      setError(err.message || 'Error updating license');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status" />
        <div className="text-muted small mt-2">Loading license details...</div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-0">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <Link href="/admin/licenses" className="text-secondary text-decoration-none small">
          <i className="fas fa-arrow-left me-1"></i> Back to Directory
        </Link>
        <span
          className={`badge ${
            formData.status === 'VALID'
              ? 'badge-status-valid'
              : formData.status === 'EXPIRED'
              ? 'badge-status-expired'
              : 'badge-status-suspended'
          }`}
        >
          {formData.status}
        </span>
      </div>

      <div className="row g-3">
        {/* Left Column: Edit Form */}
        <div className="col-12 col-xl-7">
          <div className="admin-card p-4">
            <div className="border-bottom pb-3 mb-4">
              <h3 className="admin-card-title mb-1">Edit License: {formData.license_number}</h3>
              <div className="text-muted small">Update driver credentials or modify license validity status</div>
            </div>

            {success && (
              <div className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <i className="fas fa-check-circle text-success"></i>
                <span>Changes saved successfully! Redirecting...</span>
              </div>
            )}

            {error && (
              <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <i className="fas fa-circle-exclamation text-danger"></i>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-12">
                  <span className="fw-bold small text-secondary text-uppercase">1. Driver Personal Information</span>
                  <hr className="my-1" />
                </div>

                {/* Driver Full Name */}
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">Driver Full Name (English) *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                {/* Arabic / Urdu Name */}
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold d-flex justify-content-between align-items-center">
                    <span>Arabic / Urdu Name (عربی / اردو نام)</span>
                    <span className="text-muted fw-normal" style={{ fontSize: '0.7rem' }}>Top right of card</span>
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    className="form-control"
                    placeholder="مثال: صقلین اشفاق"
                    value={formData.urdu_name}
                    onChange={(e) => setFormData({ ...formData, urdu_name: e.target.value })}
                  />
                </div>

                {/* Father's Name */}
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">Father&apos;s Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.father_name}
                    onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                  />
                </div>

                {/* Date of Birth */}
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">Date of Birth (DOB) *</label>
                  <input
                    type="date"
                    className="form-control font-monospace"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  />
                </div>

                {/* License Number */}
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">ITP License Number *</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    required
                  />
                  <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                    Auto-generates Code 128 barcode on rear
                  </div>
                </div>

                {/* CNIC */}
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">CNIC Number *</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                    required
                  />
                  <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                    Auto-generates verification QR code link on rear
                  </div>
                </div>

                {/* Section 2: Authority & Dates */}
                <div className="col-12 mt-3">
                  <span className="fw-bold small text-secondary text-uppercase">2. Authority Details &amp; Dates</span>
                  <hr className="my-1" />
                </div>

                {/* Issue Date */}
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold">Issue Date</label>
                  <input
                    type="date"
                    className="form-control font-monospace"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    required
                  />
                </div>

                {/* Expiry Date */}
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold">Expiry Date</label>
                  <input
                    type="date"
                    className="form-control font-monospace"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    required
                  />
                </div>

                {/* Status */}
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold">License Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="VALID">VALID (Active)</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>

                {/* Blood Group */}
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold">Blood Group</label>
                  <select
                    className="form-select"
                    value={formData.blood_group}
                    onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                {/* District */}
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold">District</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  />
                </div>

                {/* Driver Photo */}
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold">Driver Photograph</label>
                  <div className="d-flex align-items-center gap-3 p-2 border rounded bg-light">
                    <div
                      className="position-relative rounded overflow-hidden border border-2 border-success flex-shrink-0 bg-white shadow-sm"
                      style={{ width: 50, height: 50 }}
                    >
                      <img
                        src={formData.photo_url || '/assets/driver-photo.jpg'}
                        alt="Driver"
                        className="w-100 h-100 object-fit-cover"
                      />
                    </div>
                    <div className="flex-grow-1">
                      <input
                        type="file"
                        id="editDriverPhotoInput"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="d-none"
                      />
                      <label
                        htmlFor="editDriverPhotoInput"
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
                    </div>
                  </div>
                </div>

                {/* Driver Signature */}
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold">Driver Signature</label>
                  <div className="d-flex align-items-center gap-3 p-2 border rounded bg-light">
                    <div
                      className="position-relative rounded overflow-hidden border border-2 border-primary flex-shrink-0 bg-white shadow-sm d-flex align-items-center justify-content-center"
                      style={{ width: 70, height: 50 }}
                    >
                      {formData.signature_url ? (
                        <img
                          src={formData.signature_url}
                          alt="Signature"
                          className="w-100 h-100 object-fit-contain p-1"
                        />
                      ) : (
                        <i className="fas fa-file-signature text-muted opacity-50" style={{ fontSize: '1.2rem' }}></i>
                      )}
                    </div>
                    <div className="flex-grow-1">
                      <input
                        type="file"
                        id="editDriverSignatureInput"
                        accept="image/*"
                        onChange={handleSignatureUpload}
                        className="d-none"
                      />
                      <div className="d-flex align-items-center gap-2">
                        <label
                          htmlFor="editDriverSignatureInput"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-2 py-1 px-3 fw-semibold"
                          style={{ cursor: 'pointer' }}
                        >
                          {uploadingSignature ? (
                            <>
                              <span className="spinner-border spinner-border-sm" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <i className="fas fa-signature"></i>
                              <span>{formData.signature_url ? 'Change Sign' : 'Upload Sign'}</span>
                            </>
                          )}
                        </label>
                        {formData.signature_url && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, signature_url: '' }));
                              refreshCardPreview({ ...formData, signature_url: '' });
                            }}
                            className="btn btn-sm btn-outline-danger py-1 px-2"
                            title="Remove signature"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="col-12">
                  <label className="form-label small fw-semibold">Address *</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>

                {/* Vehicles */}
                <div className="col-12">
                  <label className="form-label small fw-semibold mb-2">Allowed Vehicle Classes</label>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { key: 'M/Cycle', label: 'Motor Cycle (M/Cycle)' },
                      { key: 'M/Car', label: 'Motor Car / Jeep (M/Car)' },
                      { key: 'LTV', label: 'LTV (Light Transport)' },
                      { key: 'HTV', label: 'HTV (Heavy Transport)' },
                      { key: 'PSV', label: 'PSV (Public Service)' },
                      { key: 'Tractor', label: 'Tractor (Agri/Comm)' },
                    ].map((cls) => {
                      const isChecked = formData.allowed_vehicles.includes(cls.key);
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

              <div className="border-top pt-3 mt-4 d-flex justify-content-between align-items-center">
                <Link href="/admin/licenses" className="btn btn-outline-secondary">
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-success px-4 fw-semibold shadow-sm"
                  style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a', minHeight: '42px' }}
                >
                  {saving ? 'Updating...' : 'Save Changes'}
                </button>
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
                {generatingPreview ? (
                  <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1 small">
                    <i className="fas fa-spinner fa-spin me-1"></i>Syncing...
                  </span>
                ) : (
                  <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1 small">
                    <i className="fas fa-check-circle me-1"></i>Live Preview
                  </span>
                )}
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
                  className="position-absolute top-0 end-0 m-2 badge bg-dark bg-opacity-75 text-white px-2 py-1 shadow-sm"
                  style={{ zIndex: 10, fontSize: '0.72rem' }}
                >
                  <span className="spinner-border spinner-border-sm me-1" style={{ width: '10px', height: '10px' }} />
                  Syncing...
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
                    Loading preview...
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

      {/* Interactive Image Cropping Modal */}
      <ImageCropperModal
        isOpen={cropperConfig.isOpen}
        imageSrc={cropperConfig.imageSrc}
        title={cropperConfig.title}
        aspectRatio={cropperConfig.aspectRatio}
        targetWidth={cropperConfig.targetWidth}
        targetHeight={cropperConfig.targetHeight}
        isSignature={cropperConfig.isSignature}
        onCrop={handleCropComplete}
        onCancel={handleCropCancel}
      />
    </div>
  );
}
