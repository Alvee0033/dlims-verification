'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-50 py-5">
      <div className="spinner-border text-success" role="status" />
    </div>
  );
}
