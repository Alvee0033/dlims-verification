'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
    father_name: '',
    address: '',
    allowed_vehicles: 'M/Cycle, M/Car',
    issue_date: '',
    expiry_date: '',
    status: 'VALID',
    blood_group: '',
    district: '',
    photo_url: '/assets/driver-photo.jpg',
  });

  useEffect(() => {
    fetch(`/api/admin/licenses/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('License not found');
        return res.json();
      })
      .then((data) => {
        if (data.license) {
          setFormData({
            license_number: data.license.license_number || '',
            cnic: data.license.cnic || '',
            name: data.license.name || '',
            father_name: data.license.father_name || '',
            address: data.license.address || '',
            allowed_vehicles: data.license.allowed_vehicles || 'M/Cycle, M/Car',
            issue_date: data.license.issue_date || '',
            expiry_date: data.license.expiry_date || '',
            status: data.license.status || 'VALID',
            blood_group: data.license.blood_group || 'B+',
            district: data.license.district || '',
            photo_url: data.license.photo_url || '/assets/driver-photo.jpg',
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingPhoto(true);
      try {
        const data = new FormData();
        data.append('photo', file);

        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: data,
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to upload photo');
        }

        setFormData((prev) => ({ ...prev, photo_url: json.url }));
      } catch (err: any) {
        alert(err.message || 'Error uploading photo');
      } finally {
        setUploadingPhoto(false);
      }
    }
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
      }, 1200);
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
      </div>
    );
  }

  return (
    <div className="container-fluid p-0">
      <div className="d-flex align-items-center gap-2 mb-3">
        <Link href="/admin/licenses" className="text-secondary text-decoration-none small">
          <i className="fas fa-arrow-left me-1"></i> Back to Directory
        </Link>
      </div>

      <div className="admin-card p-4">
        <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
          <div>
            <h3 className="admin-card-title mb-1">Edit License: {formData.license_number}</h3>
            <div className="text-muted small">Update driver credentials or modify license validity status</div>
          </div>
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
            <div className="col-12 col-md-6">
              <label className="form-label small fw-semibold">Driver Full Name *</label>
              <input
                type="text"
                className="form-control"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small fw-semibold">Father&apos;s Name</label>
              <input
                type="text"
                className="form-control"
                value={formData.father_name}
                onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small fw-semibold">License Number *</label>
              <input
                type="text"
                className="form-control font-monospace"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                required
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small fw-semibold">CNIC *</label>
              <input
                type="text"
                className="form-control font-monospace"
                value={formData.cnic}
                onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                required
              />
            </div>

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

            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold">Blood Group</label>
              <input
                type="text"
                className="form-control"
                value={formData.blood_group}
                onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
              />
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold">District</label>
              <input
                type="text"
                className="form-control"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              />
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold">Driver Photograph</label>
              <div className="d-flex align-items-center gap-3 p-2 border rounded bg-light">
                <div
                  className="position-relative rounded-circle overflow-hidden border border-2 border-success flex-shrink-0 bg-white shadow-sm"
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
                    capture="user"
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

            <div className="col-12">
              <label className="form-label small fw-semibold mb-2">Allowed Vehicle Classes</label>
              <div className="d-flex flex-wrap gap-3">
                {[
                  { key: 'M/Cycle', label: 'Motor Cycle' },
                  { key: 'M/Car', label: 'Motor Car / Jeep' },
                  { key: 'LTV', label: 'LTV (Light Transport)' },
                  { key: 'HTV', label: 'HTV (Heavy Transport)' },
                  { key: 'PSV', label: 'PSV (Public Service)' },
                  { key: 'Tractor', label: 'Tractor (Agri/Comm)' },
                ].map((cls) => {
                  const isChecked = formData.allowed_vehicles.includes(cls.key);
                  return (
                    <div key={cls.key} className="form-check form-check-inline">
                      <input
                        className="form-check-input cursor-pointer"
                        type="checkbox"
                        id={`edit-cls-${cls.key}`}
                        checked={isChecked}
                        onChange={() => handleVehicleToggle(cls.key)}
                      />
                      <label className="form-check-label cursor-pointer" htmlFor={`edit-cls-${cls.key}`}>
                        {cls.label}
                      </label>
                    </div>
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
              className="btn btn-success px-4 fw-semibold"
              style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a' }}
            >
              {saving ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
