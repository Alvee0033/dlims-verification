'use client';

import React, { useState, useEffect } from 'react';

interface VerificationResult {
  name: string;
  address: string;
  licenseNumber: string;
  cnic: string;
  allowedVehicles: string;
  issueDate: string;
  expiryDate: string;
  photoUrl: string;
}

const bannerImages = [
  '/assets/banner-1.webp',
  '/assets/banner-2.webp',
  '/assets/banner-3.webp',
  '/assets/banner-4.webp',
];

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchBy, setSearchBy] = useState('license_number');
  const [searchValue, setSearchValue] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + bannerImages.length) % bannerImages.length);
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % bannerImages.length);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) {
      alert('Please enter verification details');
      return;
    }
    setIsVerifying(true);
    setVerifyError(null);

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchBy, searchValue: searchValue.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setVerifyError(
          data.message || 'No driving licence record found matching the provided details.'
        );
        return;
      }

      setResult(data.result);
    } catch {
      setVerifyError('An error occurred while connecting to the verification server.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <>
      {/* Modern Navbar */}
      <nav className="navbar navbar-expand-lg navbar-light">
        <div className="container d-flex justify-content-between align-items-center">
          <a className="navbar-brand" href="/">
            <div className="logo-icon">
              <i className="fas fa-id-card"></i>
            </div>
            <span>DLIMS Verification</span>
          </a>
          <div className="d-flex align-items-center gap-2">
            <a
              href="/admin"
              className="btn btn-sm btn-outline-success border-0 px-2 py-1 small fw-semibold text-decoration-none"
              style={{ fontSize: '0.82rem', color: '#0f4c3a' }}
              title="Official DLIMS Admin Panel"
            >
              <i className="fas fa-lock me-1"></i>
              <span className="d-none d-sm-inline">Admin Portal</span>
            </a>
            {result && (
              <a
                href="#"
                className="back-button text-dark"
                onClick={(e) => {
                  e.preventDefault();
                  setResult(null);
                  setVerifyError(null);
                }}
              >
                <i className="fas fa-arrow-left"></i>
                Back
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Enhanced Carousel */}
      <div id="bannerSlider" className="carousel slide carousel-fade">
        <div className="carousel-inner">
          {bannerImages.map((src, idx) => (
            <div
              key={src}
              className={`carousel-item ${idx === currentSlide ? 'active' : ''}`}
            >
              <img
                src={src}
                className="d-block w-100"
                alt={`Slide ${idx + 1}`}
              />
            </div>
          ))}
        </div>
        <button
          className="carousel-control-prev"
          type="button"
          onClick={handlePrev}
          aria-label="Previous"
        >
          <span className="carousel-control-prev-icon" aria-hidden="true"></span>
          <span className="visually-hidden">Previous</span>
        </button>
        <button
          className="carousel-control-next"
          type="button"
          onClick={handleNext}
          aria-label="Next"
        >
          <span className="carousel-control-next-icon" aria-hidden="true"></span>
          <span className="visually-hidden">Next</span>
        </button>
      </div>

      {/* Main Content: Form or Sleek Verification Results Panel */}
      {!result ? (
        <>
          {/* Verification Panel */}
          <div className="container px-4">
            <div className="row justify-content-center">
              <div className="col-12 col-lg-7 verification-card-col">
                <div className="verification-card animate-fade-in animate-delay-2">
                  <div className="card-header">
                    <h3>
                      <i className="fas fa-search"></i>
                      License Verification
                    </h3>
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleVerify}>
                      {verifyError && (
                        <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3 d-flex align-items-center gap-2">
                          <i className="fas fa-circle-exclamation text-danger flex-shrink-0"></i>
                          <div>{verifyError}</div>
                        </div>
                      )}
                      <div className="mb-4">
                        <label htmlFor="search_by" className="form-label">
                          Verification Method
                        </label>
                        <select
                          id="search_by"
                          name="search_by"
                          className="form-select"
                          value={searchBy}
                          onChange={(e) => setSearchBy(e.target.value)}
                        >
                          <option value="license_number">License Number</option>
                          <option value="cnic">CNIC Number</option>
                        </select>
                      </div>
                      <div className="mb-4">
                        <label htmlFor="search_value" className="form-label">
                          Enter Details
                        </label>
                        <div className="input-group">
                          <input
                            type="text"
                            id="search_value"
                            name="search_value"
                            className="form-control search-input"
                            placeholder="Enter license number or CNIC"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                          />
                          <div className="input-icon">
                            <i className="fas fa-fingerprint"></i>
                          </div>
                        </div>
                      </div>
                      <div className="text-center text-md-start">
                        <button type="submit" className="verify-btn" disabled={isVerifying}>
                          <i className="fas fa-shield-alt"></i>
                          {isVerifying ? 'Verifying...' : 'Verify License'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <section className="features-section">
            <div className="container">
              {/* Safe Driving Header */}
              <div className="row mb-4 mt-2">
                <div className="col-12 text-center">
                  <h2 className="fw-bold">The Importance of Licensed &amp; Safe Driving</h2>
                  <p className="text-muted">
                    Promoting road safety and responsible driving in our community
                  </p>
                </div>
              </div>

              {/* Safe Driving Row */}
              <div className="row g-4">
                <div className="col-md-3">
                  <div className="feature-card card-animation animate-fade-in">
                    <div className="feature-icon">
                      <i className="fas fa-shield-alt"></i>
                    </div>
                    <h3 className="feature-title">Road Safety</h3>
                    <p>
                      Licensed drivers are trained to follow traffic rules and regulations,
                      significantly reducing the risk of accidents and making roads safer for
                      everyone.
                    </p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="feature-card card-animation animate-fade-in">
                    <div className="feature-icon">
                      <i className="fas fa-car-crash"></i>
                    </div>
                    <h3 className="feature-title">Accident Prevention</h3>
                    <p>
                      Proper licensing ensures drivers understand defensive driving techniques
                      that help prevent accidents and save lives on our roads.
                    </p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="feature-card card-animation animate-fade-in">
                    <div className="feature-icon">
                      <i className="fas fa-gavel"></i>
                    </div>
                    <h3 className="feature-title">Legal Protection</h3>
                    <p>
                      A valid license provides legal protection and ensures you&apos;re covered by
                      insurance in case of accidents or traffic incidents.
                    </p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="feature-card card-animation animate-fade-in">
                    <div className="feature-icon">
                      <i className="fas fa-user-graduate"></i>
                    </div>
                    <h3 className="feature-title">Skill Certification</h3>
                    <p>
                      Your license certifies that you possess the necessary skills and knowledge to
                      operate a vehicle safely on public roads.
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="row mt-5 text-center">
                <div className="col-12">
                  <div className="p-4 bg-primary rounded-3 text-white">
                    <h3 className="mb-4">Road Safety Statistics</h3>
                    <div className="row">
                      <div className="col-md-4 mb-3 mb-md-0">
                        <h2 className="fw-bold">70%</h2>
                        <p>Reduction in accidents with licensed drivers compared to unlicensed drivers</p>
                      </div>
                      <div className="col-md-4 mb-3 mb-md-0">
                        <h2 className="fw-bold">35%</h2>
                        <p>Lower insurance premiums for drivers with clean driving records</p>
                      </div>
                      <div className="col-md-4">
                        <h2 className="fw-bold">90%</h2>
                        <p>Of road accidents can be prevented by following proper driving practices</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* EXACT SLEEK VERIFICATION RESULTS PANEL FROM LIVE SOURCE */
        <div className="container px-4">
          <div className="verification-result">
            <div className="panel-header">
              <h3 className="text-white mb-0">
                <i className="fas fa-id-card me-2"></i>
                License Details
              </h3>
            </div>
            
            <div className="card-body p-0">
              <div className="profile-image-container">
                <img
                  className="profile-image"
                  src={result.photoUrl}
                  alt="License Photo"
                />
              </div>
              <ul className="list-group list-group-flush info-section">
                <li className="section-title">
                  <i className="fas fa-user me-2"></i>
                  Personal Information
                </li>
                <li className="info-item">
                  <strong>License Number:</strong> <span>{result.licenseNumber}</span>
                </li>
                <li className="info-item">
                  <strong>CNIC:</strong> <span>{result.cnic}</span>
                </li>
                <li className="info-item">
                  <strong>Name:</strong> <span>{result.name}</span>
                </li>
                <li className="info-item">
                  <strong>Address:</strong> <span>{result.address}</span>
                </li>
                <li className="info-item">
                  <strong>Vehicles:</strong> <span>{result.allowedVehicles}</span>
                </li>
                <li className="section-title">
                  <i className="fas fa-calendar me-2"></i>
                  License Duration
                </li>
                <li className="info-item">
                  <strong>Issue Date:</strong> <span>{result.issueDate}</span>
                </li>
                <li className="info-item">
                  <strong>Expiry Date:</strong> <span>{result.expiryDate}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-dark text-white text-center py-3">
        <div className="container">
          <p className="mb-0">© 2026 dlimsvitp.com All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
