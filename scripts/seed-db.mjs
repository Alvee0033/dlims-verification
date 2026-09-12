import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL || 'postgresql://alvee@127.0.0.1:5433/dlims_db';

const pool = new Pool({ connectionString });

async function seed() {
  console.log('Connecting to PostgreSQL database at:', connectionString);
  const client = await pool.connect();

  try {
    console.log('Seeding Admin User...');
    const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
    const adminEmail = 'admin@dlims.gov.pk';

    // Upsert Admin
    const checkAdmin = await client.query(
      'SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)',
      [adminEmail]
    );

    if (checkAdmin.rows.length === 0) {
      await client.query(
        `INSERT INTO admin_users (id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          crypto.randomUUID(),
          adminEmail,
          adminPasswordHash,
          'Director General DLIMS',
          'SUPERADMIN',
        ]
      );
      console.log('Created Admin User: admin@dlims.gov.pk');
    } else {
      await client.query(
        `UPDATE admin_users 
         SET password_hash = $1, name = $2, role = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [adminPasswordHash, 'Director General DLIMS', 'SUPERADMIN', checkAdmin.rows[0].id]
      );
      console.log('Updated Admin User: admin@dlims.gov.pk');
    }

    console.log('Seeding Driving Licenses...');
    const licenses = [
      {
        license_number: '1280011963',
        cnic: '33105-8011903-7',
        name: 'Saqlain Ishfaq',
        father_name: 'Ishfaq Ahmad',
        address: 'dakh khana khas teh & distt Faisalabad pakistan',
        allowed_vehicles: 'M/Cycle, M/Car',
        issue_date: '2019-12-28',
        expiry_date: '2029-12-28',
        status: 'VALID',
        blood_group: 'B+',
        district: 'Faisalabad',
        photo_url: '/assets/driver-photo.jpg',
      },
      {
        license_number: 'ISB-8839210',
        cnic: '61101-9238412-1',
        name: 'Muhammad Usman',
        father_name: 'Abdul Rehman',
        address: 'House 42-B, Sector F-7/2, Islamabad',
        allowed_vehicles: 'M/Cycle, M/Car, LTV',
        issue_date: '2021-03-15',
        expiry_date: '2026-03-15',
        status: 'VALID',
        blood_group: 'O+',
        district: 'Islamabad',
        photo_url: '/assets/driver-photo.jpg',
      },
      {
        license_number: 'FSD-4491028',
        cnic: '33102-1490283-9',
        name: 'Tariq Mehmood',
        father_name: 'Chaudhry Ghulam Rasool',
        address: 'Chak 204 RB, Tehsil Sadar, Faisalabad',
        allowed_vehicles: 'LTV, HTV, PSV',
        issue_date: '2015-08-10',
        expiry_date: '2025-08-10',
        status: 'EXPIRED',
        blood_group: 'A+',
        district: 'Faisalabad',
        photo_url: '/assets/driver-photo.jpg',
      },
      {
        license_number: 'RWP-5510294',
        cnic: '37405-7281934-5',
        name: 'Zeeshan Ali',
        father_name: 'Liaquat Ali',
        address: 'Street 9, Muslim Town, Rawalpindi',
        allowed_vehicles: 'M/Cycle',
        issue_date: '2023-01-20',
        expiry_date: '2028-01-20',
        status: 'VALID',
        blood_group: 'AB+',
        district: 'Rawalpindi',
        photo_url: '/assets/driver-photo.jpg',
      },
    ];

    for (const lic of licenses) {
      const exist = await client.query(
        'SELECT id FROM licenses WHERE license_number = $1',
        [lic.license_number]
      );

      if (exist.rows.length === 0) {
        await client.query(
          `INSERT INTO licenses (
            id, license_number, cnic, name, father_name, address, allowed_vehicles,
            issue_date, expiry_date, status, blood_group, district, photo_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            crypto.randomUUID(),
            lic.license_number,
            lic.cnic,
            lic.name,
            lic.father_name,
            lic.address,
            lic.allowed_vehicles,
            lic.issue_date,
            lic.expiry_date,
            lic.status,
            lic.blood_group,
            lic.district,
            lic.photo_url,
          ]
        );
        console.log(`Created License: ${lic.license_number} (${lic.name})`);
      } else {
        await client.query(
          `UPDATE licenses SET
            cnic = $1, name = $2, father_name = $3, address = $4, allowed_vehicles = $5,
            issue_date = $6, expiry_date = $7, status = $8, blood_group = $9,
            district = $10, photo_url = $11, updated_at = CURRENT_TIMESTAMP
           WHERE id = $12`,
          [
            lic.cnic,
            lic.name,
            lic.father_name,
            lic.address,
            lic.allowed_vehicles,
            lic.issue_date,
            lic.expiry_date,
            lic.status,
            lic.blood_group,
            lic.district,
            lic.photo_url,
            exist.rows[0].id,
          ]
        );
        console.log(`Updated License: ${lic.license_number} (${lic.name})`);
      }
    }

    console.log('Database seeded successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
