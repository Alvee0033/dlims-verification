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

let isInitialized = false;

async function ensureSchema(client: any) {
  if (isInitialized) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'ADMIN',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id VARCHAR(64) PRIMARY KEY,
      license_number VARCHAR(64) UNIQUE NOT NULL,
      cnic VARCHAR(32) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      father_name VARCHAR(255),
      address TEXT NOT NULL,
      allowed_vehicles VARCHAR(255) DEFAULT 'M/Cycle, M/Car',
      issue_date VARCHAR(32) NOT NULL,
      expiry_date VARCHAR(32) NOT NULL,
      status VARCHAR(32) DEFAULT 'VALID',
      blood_group VARCHAR(16),
      district VARCHAR(100),
      photo_url TEXT DEFAULT '/assets/driver-photo.jpg',
      id_card_front_url TEXT,
      raw_ocr_text TEXT,
      dob VARCHAR(32),
      urdu_name VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE licenses ADD COLUMN IF NOT EXISTS dob VARCHAR(32);
    ALTER TABLE licenses ADD COLUMN IF NOT EXISTS urdu_name VARCHAR(255);
    ALTER TABLE licenses ADD COLUMN IF NOT EXISTS signature_url TEXT;

    CREATE INDEX IF NOT EXISTS idx_licenses_number ON licenses(license_number);
    CREATE INDEX IF NOT EXISTS idx_licenses_cnic ON licenses(cnic);
    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

    CREATE TABLE IF NOT EXISTS verification_logs (
      id VARCHAR(64) PRIMARY KEY,
      search_type VARCHAR(32) NOT NULL,
      search_value VARCHAR(100) NOT NULL,
      status VARCHAR(32) NOT NULL,
      ip_address VARCHAR(64),
      user_agent TEXT,
      matched_license_id VARCHAR(64) REFERENCES licenses(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_verification_logs_search ON verification_logs(search_value);
    CREATE INDEX IF NOT EXISTS idx_verification_logs_created ON verification_logs(created_at);

    CREATE TABLE IF NOT EXISTS activity_logs (
      id VARCHAR(64) PRIMARY KEY,
      admin_email VARCHAR(255),
      action VARCHAR(64) NOT NULL,
      details TEXT,
      ip_address VARCHAR(64),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
  `);

  // Ensure admin user exists with valid hash for Admin@123
  const validHash = '$2a$10$8Q6C1.t317Ua5H5aUv4.3ODh7E2H7k6O.t/s4Y9G.w8sT2csmH2Lp';
  // Let's use bcrypt hash: '$2a$10$w81c/Yx1qI1cT7rO9W8eC.5WlqL7L8hS5wG9X2aO4nF9M1l2k3j4e' was dummy
  // Real bcrypt hash for 'Admin@123': '$2a$10$DRkaaYjpHEbVjWtYCiWOfeUL86TH2vlpw8Bpjafr4qMvo7j9DdULC'
  const realHash = '$2a$10$DRkaaYjpHEbVjWtYCiWOfeUL86TH2vlpw8Bpjafr4qMvo7j9DdULC';
  await client.query(`
    INSERT INTO admin_users (id, email, password_hash, name, role)
    VALUES (
      'admin-root-01',
      'admin@dlims.gov.pk',
      '${realHash}',
      'Director General DLIMS',
      'SUPERADMIN'
    ) ON CONFLICT (email) DO UPDATE SET password_hash = '${realHash}';
  `);

    // Seed initial license records so the system is ready immediately
    await client.query(`
      INSERT INTO licenses (
        id, license_number, cnic, name, father_name, address, allowed_vehicles,
        issue_date, expiry_date, status, blood_group, district, photo_url
      ) VALUES
      (
        'lic-001', '1280011963', '33105-8011903-7', 'Saqlain Ishfaq', 'Ishfaq Ahmad',
        'dakh khana khas teh & distt Faisalabad pakistan', 'M/Cycle, M/Car',
        '2019-12-28', '2029-12-28', 'VALID', 'B+', 'Faisalabad', '/assets/driver-photo.jpg'
      ),
      (
        'lic-002', '1280012281', '32402-8423273-1', 'Ghulam Murtaza', 'Murtaza Ahmad',
        'dakh khana khas teh & distt Dera ghazi Khan pakistan', 'M/Cycle, M/Car',
        '2018-07-14', '2028-07-14', 'VALID', 'A+', 'Dera Ghazi Khan', '/assets/driver-photo.jpg'
      ),
      (
        'lic-003', 'ISB-8839210', '61101-9238412-1', 'Muhammad Usman', 'Abdul Rehman',
        'House 42-B, Sector F-7/2, Islamabad', 'M/Cycle, M/Car, LTV',
        '2021-03-15', '2026-03-15', 'VALID', 'O+', 'Islamabad', '/assets/driver-photo.jpg'
      ),
      (
        'lic-004', 'FSD-4491028', '33102-1490283-9', 'Tariq Mehmood', 'Chaudhry Ghulam Rasool',
        'Chak 204 RB, Tehsil Sadar, Faisalabad', 'LTV, HTV, PSV',
        '2015-08-10', '2025-08-10', 'EXPIRED', 'A+', 'Faisalabad', '/assets/driver-photo.jpg'
      ) ON CONFLICT (license_number) DO NOTHING;
    `);
  isInitialized = true;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    if (!isInitialized) {
      await ensureSchema(client);
    }
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
  signature_url?: string | null;
  id_card_front_url: string | null;
  raw_ocr_text: string | null;
  dob?: string | null;
  urdu_name?: string | null;
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
      id_card_front_url, raw_ocr_text, dob, urdu_name, signature_url
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
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
      data.dob || null,
      data.urdu_name?.trim() || null,
      data.signature_url || null,
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
      dob = $15,
      urdu_name = $16,
      signature_url = $17,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $18
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
      updated.dob || null,
      updated.urdu_name || null,
      updated.signature_url || null,
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
