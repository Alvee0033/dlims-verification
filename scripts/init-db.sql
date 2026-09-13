-- DLIMS Database Initialization Script

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
    signature_url TEXT,
    id_card_front_url TEXT,
    raw_ocr_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE licenses ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS dob VARCHAR(32);
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS urdu_name VARCHAR(255);

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

CREATE TABLE IF NOT EXISTS uploaded_files (
    filename VARCHAR(255) PRIMARY KEY,
    mime_type VARCHAR(64) NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
