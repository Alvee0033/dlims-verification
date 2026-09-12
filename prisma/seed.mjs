import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding DLIMS Database...');

  // 1. Create or update Default Admin
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@dlims.gov.pk' },
    update: {
      passwordHash: adminPasswordHash,
      name: 'Director General DLIMS',
      role: 'SUPERADMIN',
    },
    create: {
      email: 'admin@dlims.gov.pk',
      name: 'Director General DLIMS',
      passwordHash: adminPasswordHash,
      role: 'SUPERADMIN',
    },
  });
  console.log('Admin account created:', admin.email);

  // 2. Sample Licenses
  const licenses = [
    {
      licenseNumber: '1280011963',
      cnic: '33105-8011903-7',
      name: 'Saqlain Ishfaq',
      fatherName: 'Ishfaq Ahmad',
      address: 'dakh khana khas teh & distt Faisalabad pakistan',
      allowedVehicles: 'M/Cycle, M/Car',
      issueDate: '2019-12-28',
      expiryDate: '2029-12-28',
      status: 'VALID',
      bloodGroup: 'B+',
      district: 'Faisalabad',
      photoUrl: '/assets/driver-photo.jpg',
    },
    {
      licenseNumber: 'ISB-8839210',
      cnic: '61101-9238412-1',
      name: 'Muhammad Usman',
      fatherName: 'Abdul Rehman',
      address: 'House 42-B, Sector F-7/2, Islamabad',
      allowedVehicles: 'M/Cycle, M/Car, LTV',
      issueDate: '2021-03-15',
      expiryDate: '2026-03-15',
      status: 'VALID',
      bloodGroup: 'O+',
      district: 'Islamabad',
      photoUrl: '/assets/driver-photo.jpg',
    },
    {
      licenseNumber: 'FSD-4491028',
      cnic: '33102-1490283-9',
      name: 'Tariq Mehmood',
      fatherName: 'Chaudhry Ghulam Rasool',
      address: 'Chak 204 RB, Tehsil Sadar, Faisalabad',
      allowedVehicles: 'LTV, HTV, PSV',
      issueDate: '2015-08-10',
      expiryDate: '2025-08-10',
      status: 'EXPIRED',
      bloodGroup: 'A+',
      district: 'Faisalabad',
      photoUrl: '/assets/driver-photo.jpg',
    },
    {
      licenseNumber: 'RWP-5510294',
      cnic: '37405-7281934-5',
      name: 'Zeeshan Ali',
      fatherName: 'Liaquat Ali',
      address: 'Street 9, Muslim Town, Rawalpindi',
      allowedVehicles: 'M/Cycle',
      issueDate: '2023-01-20',
      expiryDate: '2028-01-20',
      status: 'VALID',
      bloodGroup: 'AB+',
      district: 'Rawalpindi',
      photoUrl: '/assets/driver-photo.jpg',
    },
  ];

  for (const lic of licenses) {
    const record = await prisma.license.upsert({
      where: { licenseNumber: lic.licenseNumber },
      update: lic,
      create: lic,
    });
    console.log(`License seeded: ${record.licenseNumber} (${record.name})`);
  }

  // Seed sample initial logs
  await prisma.activityLog.create({
    data: {
      adminEmail: admin.email,
      action: 'SYSTEM_INIT',
      details: 'Initial database seeding completed successfully with 4 license records.',
      ipAddress: '127.0.0.1',
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
