import { Pool } from 'pg';
import crypto from 'crypto';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://alvee@127.0.0.1:5433/dlims_db';

// Singleton Pool instance
const globalForPool = globalThis as unknown as {
  dbPool: Pool | undefined;
};

export const pool =
  globalForPool.dbPool ??
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPool.dbPool = pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}

// -------------------------------------------------------------
// Database Interfaces
// -------------------------------------------------------------
export interface AdminUserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface LicenseRecord {
  id: string;
  license_number: string;
  cnic: string;
  name: string;
  father_name: string | null;
  address: string;
  allowed_vehicles: string;
  issue_date: string;
  expiry_date: string;
  status: string; // 'VALID', 'EXPIRED', 'SUSPENDED'
  blood_group: string | null;
  district: string | null;
  photo_url: string;
  id_card_front_url: string | null;
  raw_ocr_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationLogRecord {
  id: string;
  search_type: string;
  search_value: string;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  matched_license_id: string | null;
  created_at: string;
  license_number?: string;
  name?: string;
  cnic?: string;
}

export interface ActivityLogRecord {
  id: string;
  admin_email: string | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

// -------------------------------------------------------------
// Model Helper Functions
// -------------------------------------------------------------

export async function findAdminByEmail(email: string): Promise<AdminUserRecord | null> {
  const rows = await query<AdminUserRecord>(
    'SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email.trim()]
  );
  return rows[0] || null;
}

export async function findAdminById(id: string): Promise<AdminUserRecord | null> {
  const rows = await query<AdminUserRecord>('SELECT * FROM admin_users WHERE id = $1 LIMIT 1', [
    id,
  ]);
  return rows[0] || null;
}

export async function upsertAdminUser(
  email: string,
  name: string,
  passwordHash: string,
  role = 'ADMIN'
): Promise<AdminUserRecord> {
  const existing = await findAdminByEmail(email);
  if (existing) {
    const rows = await query<AdminUserRecord>(
      `UPDATE admin_users 
       SET name = $1, password_hash = $2, role = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, passwordHash, role, existing.id]
    );
    return rows[0];
  }

  const id = generateId();
  const rows = await query<AdminUserRecord>(
    `INSERT INTO admin_users (id, email, password_hash, name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, email.toLowerCase().trim(), passwordHash, name, role]
  );
  return rows[0];
}

export async function updateAdminEmail(
  id: string,
  newEmail: string
): Promise<AdminUserRecord | null> {
  const rows = await query<AdminUserRecord>(
    `UPDATE admin_users
     SET email = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [newEmail.toLowerCase().trim(), id]
  );
  return rows[0] || null;
}

export async function updateAdminPassword(
  id: string,
  newPasswordHash: string
): Promise<AdminUserRecord | null> {
  const rows = await query<AdminUserRecord>(
    `UPDATE admin_users
     SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [newPasswordHash, id]
  );
  return rows[0] || null;
}

export async function findLicenseById(id: string): Promise<LicenseRecord | null> {
  const rows = await query<LicenseRecord>('SELECT * FROM licenses WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

export async function findLicenseByNumber(licenseNumber: string): Promise<LicenseRecord | null> {
  const rows = await query<LicenseRecord>(
    'SELECT * FROM licenses WHERE LOWER(license_number) = LOWER($1) LIMIT 1',
    [licenseNumber.trim()]
  );
  return rows[0] || null;
}

export async function findLicenseByCnic(cnic: string): Promise<LicenseRecord | null> {
  const trimmed = cnic.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  let formatted = trimmed;
  if (digitsOnly.length === 13) {
    formatted = `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5, 12)}-${digitsOnly.slice(12)}`;
  }

  const rows = await query<LicenseRecord>(
    `SELECT * FROM licenses 
     WHERE LOWER(cnic) = LOWER($1) 
        OR LOWER(cnic) = LOWER($2) 
        OR REPLACE(cnic, '-', '') = $3
     LIMIT 1`,
    [trimmed, formatted, digitsOnly]
  );
  return rows[0] || null;
}

export async function listLicenses(options: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ licenses: LicenseRecord[]; total: number }> {
  const { search = '', status = '', page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (status && status !== 'ALL') {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    const pIdx = params.length;
    conditions.push(
      `(license_number ILIKE $${pIdx} OR cnic ILIKE $${pIdx} OR name ILIKE $${pIdx} OR district ILIKE $${pIdx})`
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM licenses ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count || '0', 10);

  const queryParams = [...params, limit, offset];
  const listRows = await query<LicenseRecord>(
    `SELECT * FROM licenses ${whereClause} 
     ORDER BY created_at DESC 
     LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
    queryParams
  );

  return { licenses: listRows, total };
}

export async function createLicense(data: Omit<LicenseRecord, 'id' | 'created_at' | 'updated_at'>): Promise<LicenseRecord> {
  const id = generateId();
  const rows = await query<LicenseRecord>(
    `INSERT INTO licenses (
      id, license_number, cnic, name, father_name, address, allowed_vehicles,
      issue_date, expiry_date, status, blood_group, district, photo_url,
      id_card_front_url, raw_ocr_text
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    ) RETURNING *`,
    [
      id,
      data.license_number.trim(),
      data.cnic.trim(),
      data.name.trim(),
      data.father_name?.trim() || null,
      data.address.trim(),
      data.allowed_vehicles || 'M/Cycle, M/Car',
      data.issue_date,
      data.expiry_date,
      data.status || 'VALID',
      data.blood_group || null,
      data.district || null,
      data.photo_url || '/assets/driver-photo.jpg',
      data.id_card_front_url || null,
      data.raw_ocr_text || null,
    ]
  );
  return rows[0];
}

export async function updateLicense(
  id: string,
  data: Partial<LicenseRecord>
): Promise<LicenseRecord | null> {
  const existing = await findLicenseById(id);
  if (!existing) return null;

  const updated: LicenseRecord = {
    ...existing,
    ...data,
  };

  const rows = await query<LicenseRecord>(
    `UPDATE licenses SET
      license_number = $1,
      cnic = $2,
      name = $3,
      father_name = $4,
      address = $5,
      allowed_vehicles = $6,
      issue_date = $7,
      expiry_date = $8,
      status = $9,
      blood_group = $10,
      district = $11,
      photo_url = $12,
      id_card_front_url = $13,
      raw_ocr_text = $14,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $15
    RETURNING *`,
    [
      updated.license_number,
      updated.cnic,
      updated.name,
      updated.father_name,
      updated.address,
      updated.allowed_vehicles,
      updated.issue_date,
      updated.expiry_date,
      updated.status,
      updated.blood_group,
      updated.district,
      updated.photo_url,
      updated.id_card_front_url,
      updated.raw_ocr_text,
      id,
    ]
  );
  return rows[0];
}

export async function deleteLicense(id: string): Promise<boolean> {
  const rows = await query('DELETE FROM licenses WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

export async function createVerificationLog(data: {
  search_type: string;
  search_value: string;
  status: string;
  ip_address?: string | null;
  user_agent?: string | null;
  matched_license_id?: string | null;
}): Promise<void> {
  const id = generateId();
  await query(
    `INSERT INTO verification_logs (id, search_type, search_value, status, ip_address, user_agent, matched_license_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      data.search_type,
      data.search_value,
      data.status,
      data.ip_address || null,
      data.user_agent || null,
      data.matched_license_id || null,
    ]
  );
}

export async function createActivityLog(data: {
  admin_email?: string | null;
  action: string;
  details?: string | null;
  ip_address?: string | null;
}): Promise<void> {
  const id = generateId();
  await query(
    `INSERT INTO activity_logs (id, admin_email, action, details, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, data.admin_email || null, data.action, data.details || null, data.ip_address || null]
  );
}

export async function getDashboardStats() {
  const [
    totalRows,
    validRows,
    expiredRows,
    suspendedRows,
    verificationsCount,
    recentVerifs,
    recentLics,
    vehicleRows,
  ] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*) as count FROM licenses'),
    query<{ count: string }>("SELECT COUNT(*) as count FROM licenses WHERE status = 'VALID'"),
    query<{ count: string }>("SELECT COUNT(*) as count FROM licenses WHERE status = 'EXPIRED'"),
    query<{ count: string }>("SELECT COUNT(*) as count FROM licenses WHERE status = 'SUSPENDED'"),
    query<{ count: string }>('SELECT COUNT(*) as count FROM verification_logs'),
    query<VerificationLogRecord>(
      `SELECT v.*, l.name, l.license_number, l.cnic 
       FROM verification_logs v
       LEFT JOIN licenses l ON v.matched_license_id = l.id
       ORDER BY v.created_at DESC
       LIMIT 8`
    ),
    query<LicenseRecord>(
      `SELECT id, license_number, cnic, name, allowed_vehicles, status, created_at
       FROM licenses
       ORDER BY created_at DESC
       LIMIT 6`
    ),
    query<{ allowed_vehicles: string }>('SELECT allowed_vehicles FROM licenses'),
  ]);

  let motorCycleCount = 0;
  let motorCarCount = 0;
  let ltvCount = 0;
  let htvCount = 0;

  for (const r of vehicleRows) {
    const v = r.allowed_vehicles || '';
    if (/cycle|bike/i.test(v)) motorCycleCount++;
    if (/car|jeep/i.test(v)) motorCarCount++;
    if (/ltv/i.test(v)) ltvCount++;
    if (/htv|psv/i.test(v)) htvCount++;
  }

  return {
    metrics: {
      totalLicenses: parseInt(totalRows[0]?.count || '0', 10),
      validLicenses: parseInt(validRows[0]?.count || '0', 10),
      expiredLicenses: parseInt(expiredRows[0]?.count || '0', 10),
      suspendedLicenses: parseInt(suspendedRows[0]?.count || '0', 10),
      totalVerifications: parseInt(verificationsCount[0]?.count || '0', 10),
    },
    categories: {
      motorCycleCount,
      motorCarCount,
      ltvCount,
      htvCount,
    },
    recentVerifications: recentVerifs,
    recentLicenses: recentLics,
  };
}
