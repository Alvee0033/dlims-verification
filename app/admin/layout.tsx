'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface AdminInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    // Fast session check on initial layout mount only
    fetch('/api/admin/auth')
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then((data) => {
        if (data.authenticated && data.admin) {
          setAdmin(data.admin);
        } else {
          router.replace('/admin/login');
        }
      })
      .catch(() => {
        router.replace('/admin/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []); // Run once on mount for instant tab switching

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      window.location.href = '/admin/login';
    } catch {
      window.location.href = '/admin/login';
    }
  };

  if (isLoginPage) {
    return <div className="admin-body">{children}</div>;
  }

  if (loading) {
    return (
      <div className="admin-body d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-success" role="status" style={{ width: '2.5rem', height: '2.5rem' }} />
      </div>
    );
  }

  const navLinks = [
    { href: '/admin', label: 'Dashboard', icon: 'fa-chart-pie' },
    { href: '/admin/licenses', label: 'Directory', icon: 'fa-address-card' },
    { href: '/admin/licenses/new', label: 'Add', desktopLabel: 'Add License', icon: 'fa-circle-plus', isAdd: true },
    { href: '/admin/settings', label: 'Settings', icon: 'fa-gear' },
  ];

  return (
    <div className="admin-body">
      {/* Desktop Left Sidebar (>= 992px) */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <div className="admin-logo-badge">
            <i className="fas fa-shield-halved"></i>
          </div>
          <div>
            <div className="admin-brand-title">DLIMS Portal</div>
            <div className="admin-brand-subtitle">Govt of Pakistan</div>
          </div>
        </div>

        <div className="admin-nav-links">
          {navLinks.map((link) => {
            const isActive = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
              >
                <i className={`fas ${link.icon}`}></i>
                <span>{link.desktopLabel || link.label}</span>
              </Link>
            );
          })}

          <div className="my-3 border-top border-secondary border-opacity-25" />

          <Link href="/" target="_blank" className="admin-nav-item text-info">
            <i className="fas fa-arrow-up-right-from-square"></i>
            <span>Public Portal</span>
          </Link>
        </div>

        <div className="admin-sidebar-footer d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2 overflow-hidden">
            <div
              className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
              style={{ width: 32, height: 32, fontSize: '0.8rem' }}
            >
              {admin?.name?.charAt(0) || 'A'}
            </div>
            <div className="text-truncate">
              <div className="text-white text-truncate fw-semibold" style={{ fontSize: '0.8rem' }}>
                {admin?.name || 'Administrator'}
              </div>
              <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>
                {admin?.role || 'Authority'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-sm btn-outline-danger border-0 p-1 text-danger"
            title="Sign Out"
          >
            <i className="fas fa-arrow-right-from-bracket"></i>
          </button>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="admin-main-wrapper">
        {/* Top Header */}
        <header className="admin-topbar">
          <div className="d-flex align-items-center gap-2">
            <div className="d-lg-none d-flex align-items-center gap-2">
              <div
                className="d-flex align-items-center justify-content-center rounded-2 bg-success text-white shadow-sm"
                style={{ width: 28, height: 28, fontSize: '0.85rem' }}
              >
                <i className="fas fa-shield-halved"></i>
              </div>
              <span className="fw-bold fs-6 text-dark">DLIMS</span>
            </div>
            <span className="status-pill online">Central Authority</span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 py-1 px-2"
              style={{ fontSize: '0.78rem' }}
            >
              <i className="fas fa-arrow-up-right-from-square"></i>
              <span className="d-none d-sm-inline">Public Site</span>
            </Link>

            <button
              onClick={handleLogout}
              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1 py-1 px-2"
              style={{ fontSize: '0.78rem' }}
            >
              <i className="fas fa-arrow-right-from-bracket"></i>
              <span className="d-none d-sm-inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="admin-content">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar (4 clean thumb tabs) */}
      <nav className="admin-mobile-nav">
        {navLinks.map((link) => {
          const isActive = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={true}
              className={`mobile-nav-link ${isActive ? 'active' : ''} ${link.isAdd ? 'mobile-nav-add' : ''}`}
            >
              <i className={`fas ${link.icon}`}></i>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
