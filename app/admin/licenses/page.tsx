'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface License {
  id: string;
  license_number: string;
  cnic: string;
  name: string;
  father_name: string | null;
  address: string;
  allowed_vehicles: string;
  issue_date: string;
  expiry_date: string;
  status: string;
  blood_group: string | null;
  district: string | null;
  photo_url: string;
  created_at: string;
}

export default function LicenseDirectoryPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      params.append('limit', '100');

      const res = await fetch(`/api/admin/licenses?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLicenses(json.licenses || []);
        setTotal(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load licenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(fetchLicenses, 150);
    return () => clearTimeout(delay);
  }, [search, statusFilter]);

  const handleDelete = async (id: string, name: string, licNo: string) => {
    if (!confirm(`Permanently delete license ${licNo} (${name})?`)) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/licenses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLicenses((prev) => prev.filter((l) => l.id !== id));
        setTotal((prev) => prev - 1);
        if (selectedLicense?.id === id) setSelectedLicense(null);
      }
    } catch {
      alert('Error deleting record');
    } finally {
      setDeletingId(null);
    }
  };

  const exportCSV = () => {
    if (licenses.length === 0) return;
    const headers = ['License No', 'CNIC', 'Name', 'Father Name', 'Allowed Vehicles', 'Issue Date', 'Expiry Date', 'Status', 'District', 'Address'];
    const rows = licenses.map((l) => [
      `"${l.license_number}"`,
      `"${l.cnic}"`,
      `"${l.name}"`,
      `"${l.father_name || ''}"`,
      `"${l.allowed_vehicles}"`,
      `"${l.issue_date}"`,
      `"${l.expiry_date}"`,
      `"${l.status}"`,
      `"${l.district || ''}"`,
      `"${l.address.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dlims_licenses_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container-fluid p-0">
      {/* Mobile-First Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="admin-page-title mb-0">License Directory</h2>
          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
            {total} Active Driving Records
          </div>
        </div>
        <div className="d-flex gap-2">
          <button onClick={exportCSV} className="btn btn-sm btn-outline-secondary d-none d-sm-inline-flex align-items-center gap-1">
            <i className="fas fa-file-csv"></i>
            <span>Export</span>
          </button>
          <Link href="/admin/licenses/new" className="btn btn-sm btn-success d-flex align-items-center gap-1 py-1 px-3 fw-semibold rounded-pill">
            <i className="fas fa-plus"></i>
            <span>Add New</span>
          </Link>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="admin-card p-2 p-md-3 mb-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-6">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="fas fa-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search License #, CNIC, Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="btn btn-outline-secondary border-start-0" onClick={() => setSearch('')}>
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </div>

          <div className="col-12 col-md-6 d-flex gap-1 overflow-x-auto justify-content-md-end pb-1 pb-md-0">
            {['ALL', 'VALID', 'EXPIRED', 'SUSPENDED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`btn btn-sm ${
                  statusFilter === st ? 'btn-dark' : 'btn-outline-secondary'
                } rounded-pill px-3 py-1 flex-shrink-0`}
                style={{ fontSize: '0.75rem' }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Card List (< 768px) */}
      <div className="d-md-none">
        {loading ? (
          <div className="text-center py-4 text-muted small">Loading records...</div>
        ) : licenses.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="fas fa-id-card fa-2x mb-2 text-secondary opacity-50"></i>
            <div className="small">No records found.</div>
          </div>
        ) : (
          licenses.map((lic) => (
            <div key={lic.id} className="mobile-license-card">
              <div className="d-flex align-items-center gap-2 mb-2">
                <img
                  src={lic.photo_url || '/assets/driver-photo.jpg'}
                  alt={lic.name}
                  className="rounded-circle object-fit-cover border"
                  style={{ width: 40, height: 40 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/driver-photo.jpg';
                  }}
                />
                <div className="flex-grow-1 overflow-hidden">
                  <div className="fw-bold text-dark text-truncate">{lic.name}</div>
                  <div className="text-muted font-monospace small" style={{ fontSize: '0.72rem' }}>
                    {lic.cnic}
                  </div>
                </div>
                <span
                  className={
                    lic.status === 'VALID'
                      ? 'badge-status-valid'
                      : lic.status === 'EXPIRED'
                      ? 'badge-status-expired'
                      : 'badge-status-suspended'
                  }
                >
                  {lic.status}
                </span>
              </div>

              <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                <span className="badge bg-light text-dark border font-monospace">
                  {lic.license_number}
                </span>
                <div className="btn-group btn-group-sm">
                  <button onClick={() => setSelectedLicense(lic)} className="btn btn-outline-primary py-1 px-2" title="View Card">
                    <i className="fas fa-eye"></i>
                  </button>
                  <Link href={`/admin/licenses/${lic.id}/edit`} className="btn btn-outline-secondary py-1 px-2" title="Edit">
                    <i className="fas fa-edit"></i>
                  </Link>
                  <button onClick={() => handleDelete(lic.id, lic.name, lic.license_number)} className="btn btn-outline-danger py-1 px-2" title="Delete">
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table (>= 768px) */}
      <div className="admin-card d-none d-md-block">
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>License #</th>
                <th>CNIC</th>
                <th>Allowed</th>
                <th>Expiry</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2" />
                    Loading records...
                  </td>
                </tr>
              ) : licenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-muted">
                    No driving licenses found.
                  </td>
                </tr>
              ) : (
                licenses.map((lic) => (
                  <tr key={lic.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <img
                          src={lic.photo_url || '/assets/driver-photo.jpg'}
                          alt={lic.name}
                          className="rounded-circle object-fit-cover border shadow-sm"
                          style={{ width: 36, height: 36 }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/assets/driver-photo.jpg';
                          }}
                        />
                        <div>
                          <div className="fw-bold text-dark">{lic.name}</div>
                          {lic.father_name && (
                            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                              S/O {lic.father_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-secondary bg-opacity-10 text-dark font-monospace">
                        {lic.license_number}
                      </span>
                    </td>
                    <td>
                      <span className="text-muted font-monospace small">{lic.cnic}</span>
                    </td>
                    <td className="small">{lic.allowed_vehicles}</td>
                    <td className="small font-monospace">{lic.expiry_date}</td>
                    <td>
                      <span
                        className={
                          lic.status === 'VALID'
                            ? 'badge-status-valid'
                            : lic.status === 'EXPIRED'
                            ? 'badge-status-expired'
                            : 'badge-status-suspended'
                        }
                      >
                        {lic.status}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          onClick={() => setSelectedLicense(lic)}
                          className="btn btn-outline-primary"
                          title="View Digital ID"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <Link
                          href={`/admin/licenses/${lic.id}/edit`}
                          className="btn btn-outline-secondary"
                          title="Edit Details"
                        >
                          <i className="fas fa-edit"></i>
                        </Link>
                        <button
                          onClick={() => handleDelete(lic.id, lic.name, lic.license_number)}
                          disabled={deletingId === lic.id}
                          className="btn btn-outline-danger"
                          title="Delete License"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ID Card Detail Sheet/Modal */}
      {selectedLicense && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedLicense(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg">
              <div
                className="modal-header text-white py-2 px-3"
                style={{ background: '#0b1928' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <i className="fas fa-id-card text-warning"></i>
                  <h6 className="modal-title fw-bold mb-0">Driving License</h6>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedLicense(null)}
                ></button>
              </div>

              <div className="modal-body p-3 bg-light text-center">
                {/* Auto-Generated Card Display */}
                <div className="mb-3 text-center position-relative bg-dark bg-opacity-10 rounded-3 p-2 border">
                  <img
                    src={`/api/admin/licenses/${selectedLicense.id}/card`}
                    alt={`License Card - ${selectedLicense.name}`}
                    className="img-fluid rounded shadow-sm"
                    style={{ maxHeight: '65vh', width: 'auto', objectFit: 'contain' }}
                  />
                </div>

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-2 border-top">
                  <div className="d-flex gap-2">
                    <a
                      href={`/api/admin/licenses/${selectedLicense.id}/card?format=pdf&download=1`}
                      className="btn btn-sm btn-danger fw-semibold d-flex align-items-center gap-1 shadow-sm px-3"
                    >
                      <i className="fas fa-file-pdf"></i>
                      <span>Download PDF</span>
                    </a>
                    <a
                      href={`/api/admin/licenses/${selectedLicense.id}/card?format=png&download=1`}
                      className="btn btn-sm btn-success fw-semibold d-flex align-items-center gap-1 shadow-sm px-3"
                      style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a' }}
                    >
                      <i className="fas fa-file-image"></i>
                      <span>Download PNG</span>
                    </a>
                  </div>

                  <div className="d-flex gap-2">
                    <Link
                      href={`/admin/licenses/${selectedLicense.id}/edit`}
                      className="btn btn-sm btn-outline-primary"
                    >
                      <i className="fas fa-edit me-1"></i> Edit
                    </Link>
                    <button onClick={() => setSelectedLicense(null)} className="btn btn-sm btn-secondary">
                      Close
                    </button>
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
