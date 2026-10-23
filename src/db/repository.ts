import crypto from 'crypto';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditLogs,
  companySettings,
  departments,
  letterAttachments,
  letterClassifications,
  letters,
  letterTypes,
  numberingCounters,
  numberingRules,
  permissions,
  roles,
  userRoles,
  users,
} from './schema.ts';

export const ROMAN_MONTHS = [
  'I', 'II', 'III', 'IV', 'V', 'VI',
  'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
];

export function hashPassword(password: string): string {
  const salt = 'olms_enterprise_salt_v1';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  if (!hash) return false;
  return hashPassword(password) === hash;
}

export function getRomanMonth(monthNumber1To12: number): string {
  return ROMAN_MONTHS[Math.max(0, Math.min(11, monthNumber1To12 - 1))] || 'I';
}

export function parseLetterDateParts(letterDateStr: string): { year: number; month: number } {
  // Always use Tanggal Surat (letter_date) as confirmed by user
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(letterDateStr);
  if (match) {
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
    };
  }
  const d = new Date(letterDateStr);
  if (!isNaN(d.getTime())) {
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    };
  }
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

export function buildScopeKey(
  scopeType: string,
  deptCode: string,
  typeCode: string
): string {
  switch (scopeType) {
    case 'GLOBAL':
      return 'GLOBAL';
    case 'DEPARTMENT':
      return `DEPT:${deptCode}`;
    case 'LETTER_TYPE':
      return `TYPE:${typeCode}`;
    case 'DEPT_AND_TYPE':
    default:
      return `DEPT_TYPE:${deptCode}_${typeCode}`;
  }
}

export function buildPeriodKeys(
  resetPeriod: string,
  year: number,
  month: number
): { periodYear: number; periodMonth: number } {
  if (resetPeriod === 'NEVER') {
    return { periodYear: 0, periodMonth: 0 };
  }
  if (resetPeriod === 'MONTHLY') {
    return { periodYear: year, periodMonth: month };
  }
  // Default: YEARLY
  return { periodYear: year, periodMonth: 0 };
}

export function formatLetterNumber(params: {
  template: string;
  separator: string;
  digitPadding: number;
  sequence: number;
  companyCode: string;
  deptCode: string;
  typeCode: string;
  classCode: string;
  year: number;
  month: number;
}): { formatted: string; components: Record<string, string | number> } {
  const seqStr = String(params.sequence).padStart(params.digitPadding || 3, '0');
  const monthStr = String(params.month).padStart(2, '0');
  const romanMonth = getRomanMonth(params.month);
  const yearStr = String(params.year);

  const normalizedTemplate = params.template.replace(/\//g, params.separator || '/');

  const formatted = normalizedTemplate
    .replace(/\{SEQ\}/g, seqStr)
    .replace(/\{COMP\}/g, params.companyCode)
    .replace(/\{DEPT\}/g, params.deptCode)
    .replace(/\{TYPE\}/g, params.typeCode)
    .replace(/\{CLASS\}/g, params.classCode)
    .replace(/\{ROMAN_MONTH\}/g, romanMonth)
    .replace(/\{MONTH\}/g, monthStr)
    .replace(/\{YEAR\}/g, yearStr);

  return {
    formatted,
    components: {
      sequence: params.sequence,
      sequenceFormatted: seqStr,
      companyCode: params.companyCode,
      departmentCode: params.deptCode,
      letterTypeCode: params.typeCode,
      classificationCode: params.classCode,
      month: monthStr,
      romanMonth,
      year: yearStr,
      separator: params.separator || '/',
      template: params.template,
      dateSource: 'LETTER_DATE',
    },
  };
}

let isSeeded = false;

export async function ensureSeeded() {
  if (isSeeded) return;
  try {
    const existingSettings = await db.select().from(companySettings);
    if (existingSettings.length > 0) {
      isSeeded = true;
      return;
    }

    // 1. Seed Company Settings
    await db.insert(companySettings).values({
      companyName: 'PT Nusantara Teknologi Mandiri',
      companyCode: 'NTM',
      logoUrl: '',
      address: 'Gedung Menara Korporat Lt. 18, Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan 12190',
      phone: '(021) 5150-8899',
      email: 'sekretariat@nusantaratek.co.id',
      website: 'https://www.nusantaratek.co.id',
      npwpOrRegNumber: '01.345.678.9-012.000',
    });

    // 2. Seed Roles
    const insertedRoles = await db
      .insert(roles)
      .values([
        {
          code: 'SUPER_ADMIN',
          name: 'Super Admin',
          description: 'Akses penuh ke seluruh konfigurasi sistem, pengguna, aturan penomoran, master data, surat, dan audit trail.',
        },
        {
          code: 'ADMIN_GA_HRD',
          name: 'Admin HRD / GA / Sekretariat',
          description: 'Mengelola registrasi surat, pembatalan surat, master data operasional, dan laporan administrasi.',
        },
        {
          code: 'STAFF',
          name: 'Staff Departemen',
          description: 'Membuat draft surat, menerbitkan nomor surat sesuai departemen, dan mengunggah lampiran dokumen.',
        },
        {
          code: 'AUDITOR',
          name: 'Viewer / Auditor',
          description: 'Akses baca seluruh arsip surat, laporan rekapitulasi, dan jejak audit tanpa hak modifikasi data.',
        },
      ])
      .onConflictDoNothing()
      .returning();

    // 3. Seed Permissions
    await db
      .insert(permissions)
      .values([
        {
          code: 'letter:view',
          name: 'Lihat Daftar & Detail Surat',
          module: 'Manajemen Surat',
          roleCodes: JSON.stringify(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'STAFF', 'AUDITOR']),
        },
        {
          code: 'letter:create',
          name: 'Buat Draft & Registrasi Surat',
          module: 'Manajemen Surat',
          roleCodes: JSON.stringify(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'STAFF']),
        },
        {
          code: 'letter:cancel',
          name: 'Batalkan Surat Terdaftar',
          module: 'Manajemen Surat',
          roleCodes: JSON.stringify(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
        },
        {
          code: 'master:manage',
          name: 'Kelola Master Data & Aturan Penomoran',
          module: 'Master Data',
          roleCodes: JSON.stringify(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
        },
        {
          code: 'report:export',
          name: 'Lihat & Ekspor Laporan Administrasi',
          module: 'Laporan',
          roleCodes: JSON.stringify(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'STAFF', 'AUDITOR']),
        },
        {
          code: 'audit:view',
          name: 'Lihat Jejak Audit (Audit Trail)',
          module: 'Audit Trail',
          roleCodes: JSON.stringify(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'AUDITOR']),
        },
        {
          code: 'user:manage',
          name: 'Kelola Pengguna & Konfigurasi Sistem',
          module: 'Manajemen Pengguna',
          roleCodes: JSON.stringify(['SUPER_ADMIN']),
        },
      ])
      .onConflictDoNothing();

    // 4. Seed Departments
    const insertedDepts = await db
      .insert(departments)
      .values([
        {
          code: 'HRD',
          name: 'Human Resources Development',
          description: 'Pengelolaan SDM, kepegawaian, rekrutmen, dan surat keputusan karyawan.',
          isActive: true,
        },
        {
          code: 'GA',
          name: 'General Affairs & Sekretariat',
          description: 'Pengelolaan fasilitas kantor, kesekretariatan, surat masuk eksternal, dan operasional umum.',
          isActive: true,
        },
        {
          code: 'FIN',
          name: 'Finance & Accounting',
          description: 'Pengelolaan keuangan, perpajakan, penagihan, dan administrasi perbankan.',
          isActive: true,
        },
        {
          code: 'IT',
          name: 'Information Technology',
          description: 'Pengelolaan infrastruktur teknologi informasi, sistem aplikasi, dan keamanan siber.',
          isActive: true,
        },
        {
          code: 'LEGAL',
          name: 'Legal & Corporate Compliance',
          description: 'Pengelolaan dokumen hukum, perjanjian kerja sama, perizinan, dan kepatuhan regulasi.',
          isActive: true,
        },
        {
          code: 'OPS',
          name: 'Operations & Project Management',
          description: 'Pelaksanaan operasional harian, pengiriman proyek, dan koordinasi teknis lapangan.',
          isActive: true,
        },
      ])
      .onConflictDoNothing()
      .returning();

    const deptMap = Object.fromEntries(insertedDepts.map((d) => [d.code, d.id]));

    // 5. Seed Letter Types
    const insertedTypes = await db
      .insert(letterTypes)
      .values([
        {
          code: 'SK',
          name: 'Surat Keputusan',
          allowedCategories: 'OUTGOING,INTERNAL',
          description: 'Penetapan kebijakan resmi, pengangkatan, atau mutasi jabatan.',
          isActive: true,
        },
        {
          code: 'ST',
          name: 'Surat Tugas',
          allowedCategories: 'OUTGOING,INTERNAL',
          description: 'Penugasan resmi karyawan untuk perjalanan dinas atau pekerjaan khusus.',
          isActive: true,
        },
        {
          code: 'UND',
          name: 'Surat Undangan',
          allowedCategories: 'OUTGOING,INCOMING,INTERNAL',
          description: 'Undangan rapat, sosialisasi, atau kegiatan resmi perusahaan.',
          isActive: true,
        },
        {
          code: 'SP',
          name: 'Surat Peringatan',
          allowedCategories: 'INTERNAL',
          description: 'Pembinaan kedisiplinan karyawan sesuai peraturan perusahaan.',
          isActive: true,
        },
        {
          code: 'SKET',
          name: 'Surat Keterangan',
          allowedCategories: 'OUTGOING,INTERNAL',
          description: 'Keterangan kerja, pengalaman, domisili perusahaan, atau referensi.',
          isActive: true,
        },
        {
          code: 'SPH',
          name: 'Surat Permohonan / Penawaran',
          allowedCategories: 'OUTGOING,INCOMING',
          description: 'Permohonan kerja sama, penawaran harga, atau permintaan informasi resmi.',
          isActive: true,
        },
        {
          code: 'SE',
          name: 'Surat Edaran',
          allowedCategories: 'OUTGOING,INTERNAL',
          description: 'Pemberitahuan kebijakan atau pengumuman resmi ke seluruh unit kerja.',
          isActive: true,
        },
        {
          code: 'MEMO',
          name: 'Memorandum Internal',
          allowedCategories: 'INTERNAL',
          description: 'Komunikasi koordinasi resmi antardepartemen di dalam perusahaan.',
          isActive: true,
        },
        {
          code: 'BA',
          name: 'Berita Acara',
          allowedCategories: 'OUTGOING,INCOMING,INTERNAL',
          description: 'Dokumentasi serah terima barang/pekerjaan atau kesepakatan resmi.',
          isActive: true,
        },
        {
          code: 'SM',
          name: 'Registrasi Surat Masuk Umum',
          allowedCategories: 'INCOMING',
          description: 'Pencatatan surat masuk resmi dari instansi, klien, atau mitra eksternal.',
          isActive: true,
        },
      ])
      .onConflictDoNothing()
      .returning();

    const typeMap = Object.fromEntries(insertedTypes.map((t) => [t.code, t.id]));

    // 6. Seed Letter Classifications
    const insertedClass = await db
      .insert(letterClassifications)
      .values([
        {
          code: 'BIASA',
          name: 'Biasa / Umum',
          confidentialityLevel: 'PUBLIC',
          description: 'Dokumen korespondensi reguler yang dapat diakses oleh unit kerja terkait.',
          isActive: true,
        },
        {
          code: 'INTERNAL',
          name: 'Internal Terbatas',
          confidentialityLevel: 'INTERNAL',
          description: 'Hanya untuk kalangan internal perusahaan, tidak untuk dipublikasikan.',
          isActive: true,
        },
        {
          code: 'RAHASIA',
          name: 'Rahasia (Confidential)',
          confidentialityLevel: 'CONFIDENTIAL',
          description: 'Dokumen sensitif SDM, keuangan, atau hukum yang hanya boleh diakses pihak berwenang.',
          isActive: true,
        },
        {
          code: 'SANGAT_RAHASIA',
          name: 'Sangat Rahasia (Strictly Confidential)',
          confidentialityLevel: 'STRICTLY_CONFIDENTIAL',
          description: 'Dokumen strategis direksi atau keputusan krusial dengan pembatasan ketat.',
          isActive: true,
        },
      ])
      .onConflictDoNothing()
      .returning();

    const classMap = Object.fromEntries(insertedClass.map((c) => [c.code, c.id]));

    // 7. Seed Numbering Rules
    const insertedRules = await db
      .insert(numberingRules)
      .values([
        {
          name: 'Standar Surat Keluar Korporat',
          category: 'OUTGOING',
          formatTemplate: '{SEQ}/{DEPT}/{TYPE}/{ROMAN_MONTH}/{YEAR}',
          scopeType: 'DEPT_AND_TYPE',
          resetPeriod: 'YEARLY',
          digitPadding: 3,
          separator: '/',
          dateSource: 'LETTER_DATE',
          isActive: true,
          effectiveDate: '2026-01-01',
        },
        {
          name: 'Standar Surat Internal & Memorandum',
          category: 'INTERNAL',
          formatTemplate: '{SEQ}/{DEPT}/{TYPE}/{ROMAN_MONTH}/{YEAR}',
          scopeType: 'DEPARTMENT',
          resetPeriod: 'YEARLY',
          digitPadding: 3,
          separator: '/',
          dateSource: 'LETTER_DATE',
          isActive: true,
          effectiveDate: '2026-01-01',
        },
        {
          name: 'Standar Registrasi Internal Surat Masuk',
          category: 'INCOMING',
          formatTemplate: 'IN/{SEQ}/{DEPT}/{ROMAN_MONTH}/{YEAR}',
          scopeType: 'GLOBAL',
          resetPeriod: 'MONTHLY',
          digitPadding: 3,
          separator: '/',
          dateSource: 'LETTER_DATE',
          isActive: true,
          effectiveDate: '2026-01-01',
        },
      ])
      .returning();

    const ruleMap = Object.fromEntries(insertedRules.map((r) => [r.category, r.id]));

    // 8. Seed Demo Users for each Role
    const defaultPwdHash = hashPassword('Demo123!');
    const demoUsers = await db
      .insert(users)
      .values([
        {
          uid: 'demo-super-admin',
          name: 'Budi Santoso (Super Admin)',
          email: 'superadmin@nusantaratek.co.id',
          passwordHash: defaultPwdHash,
          roleCode: 'SUPER_ADMIN',
          departmentId: deptMap['GA'],
          isActive: true,
          isDemo: true,
        },
        {
          uid: 'demo-admin-hrd',
          name: 'Ratna Dewi (Admin HRD & GA)',
          email: 'admin.hrd@nusantaratek.co.id',
          passwordHash: defaultPwdHash,
          roleCode: 'ADMIN_GA_HRD',
          departmentId: deptMap['HRD'],
          isActive: true,
          isDemo: true,
        },
        {
          uid: 'demo-staff-fin',
          name: 'Andi Pratama (Staff Finance)',
          email: 'staff.finance@nusantaratek.co.id',
          passwordHash: defaultPwdHash,
          roleCode: 'STAFF',
          departmentId: deptMap['FIN'],
          isActive: true,
          isDemo: true,
        },
        {
          uid: 'demo-auditor',
          name: 'Hendra Wijaya (Internal Auditor)',
          email: 'auditor@nusantaratek.co.id',
          passwordHash: defaultPwdHash,
          roleCode: 'AUDITOR',
          departmentId: deptMap['LEGAL'],
          isActive: true,
          isDemo: true,
        },
      ])
      .onConflictDoNothing()
      .returning();

    const roleMap = Object.fromEntries(insertedRoles.map((r) => [r.code, r.id]));
    for (const u of demoUsers) {
      if (roleMap[u.roleCode]) {
        await db.insert(userRoles).values({
          userId: u.id,
          roleId: roleMap[u.roleCode],
        });
      }
    }

    // 9. Seed Realistic Letters using the transactional numbering engine
    const sampleLetters = [
      {
        category: 'OUTGOING',
        status: 'REGISTERED',
        letterTypeId: typeMap['SK'],
        departmentId: deptMap['HRD'],
        classificationId: classMap['RAHASIA'],
        letterDate: '2026-10-02',
        registrationDate: '2026-10-02',
        subject: 'Pengangkatan Karyawan Tetap Divisi Engineering Semester II 2026',
        sender: 'Direktur SDM & Umum',
        recipient: 'Sdr. Dimas Aditya Pratama',
        destination: 'Internal - Divisi Information Technology',
        summary: 'Penetapan status karyawan tetap setelah evaluasi masa percobaan 6 bulan dengan predikat sangat baik.',
        adminNotes: 'Salinan asli diserahkan ke karyawan dan arsip personal file HRD.',
        createdByUid: 'demo-admin-hrd',
        createdByName: 'Ratna Dewi (Admin HRD & GA)',
      },
      {
        category: 'OUTGOING',
        status: 'REGISTERED',
        letterTypeId: typeMap['UND'],
        departmentId: deptMap['GA'],
        classificationId: classMap['BIASA'],
        letterDate: '2026-10-05',
        registrationDate: '2026-10-05',
        subject: 'Undangan Rapat Koordinasi Vendor Pengadaan Fasilitas Gedung 2027',
        sender: 'Kepala Divisi General Affairs',
        recipient: 'Direktur PT Graha Sarana Perkasa',
        destination: 'Jakarta Pusat',
        summary: 'Undangan menghadiri pemaparan teknis pemeliharaan gedung dan pembaruan kontrak tahunan.',
        adminNotes: 'Dikirim melalui kurir resmi dan email sekretariat.',
        createdByUid: 'demo-super-admin',
        createdByName: 'Budi Santoso (Super Admin)',
      },
      {
        category: 'INTERNAL',
        status: 'REGISTERED',
        letterTypeId: typeMap['MEMO'],
        departmentId: deptMap['FIN'],
        classificationId: classMap['INTERNAL'],
        letterDate: '2026-10-08',
        registrationDate: '2026-10-08',
        subject: 'Batas Akhir Pengajuan Klaim Operasional dan Tutup Buku Kuartal IV',
        sender: 'Kepala Departemen Finance & Accounting',
        recipient: 'Seluruh Kepala Departemen',
        destination: 'Seluruh Unit Kerja Kantor Pusat',
        summary: 'Penyampaian jadwal penutupan pengajuan reimbursement dan verifikasi faktur pajak sebelum tanggal 25 setiap bulan.',
        adminNotes: 'Distribusi ke seluruh departemen.',
        createdByUid: 'demo-staff-fin',
        createdByName: 'Andi Pratama (Staff Finance)',
      },
      {
        category: 'INCOMING',
        status: 'REGISTERED',
        externalOriginalNumber: '412/DIR-MSP/IX/2026',
        letterTypeId: typeMap['SPH'],
        departmentId: deptMap['IT'],
        classificationId: classMap['BIASA'],
        letterDate: '2026-09-24',
        registrationDate: '2026-09-25',
        subject: 'Penawaran Pembaruan Lisensi Cloud Infrastructure & Security Enterprise',
        sender: 'PT Mitra Solusi Prima',
        recipient: 'Kepala Departemen IT PT Nusantara Teknologi Mandiri',
        destination: 'Departemen IT',
        summary: 'Surat penawaran perpanjangan lisensi server dan layanan pemantauan keamanan tahun anggaran 2026/2027.',
        adminNotes: 'Diterima oleh resepsionis GA dan diteruskan ke Departemen IT.',
        createdByUid: 'demo-admin-hrd',
        createdByName: 'Ratna Dewi (Admin HRD & GA)',
      },
      {
        category: 'INCOMING',
        status: 'REGISTERED',
        externalOriginalNumber: 'B-889/KPP.0402/2026',
        letterTypeId: typeMap['SM'],
        departmentId: deptMap['FIN'],
        classificationId: classMap['RAHASIA'],
        letterDate: '2026-10-12',
        registrationDate: '2026-10-13',
        subject: 'Pemberitahuan Sosialisasi Regulasi Perpajakan Korporasi Elektronik',
        sender: 'Kantor Pelayanan Pajak Madya Jakarta Selatan',
        recipient: 'Direktur Keuangan PT Nusantara Teknologi Mandiri',
        destination: 'Departemen Finance & Accounting',
        summary: 'Undangan dan panduan pembaruan sistem pelaporan e-Faktur korporasi.',
        adminNotes: 'Dokumen fisik tersimpan pada lemari arsip pajak B-02.',
        createdByUid: 'demo-staff-fin',
        createdByName: 'Andi Pratama (Staff Finance)',
      },
      {
        category: 'INTERNAL',
        status: 'REGISTERED',
        letterTypeId: typeMap['SP'],
        departmentId: deptMap['HRD'],
        classificationId: classMap['SANGAT_RAHASIA'],
        letterDate: '2026-10-15',
        registrationDate: '2026-10-15',
        subject: 'Surat Peringatan Pertama (SP-1) Ketidakdisiplinan Jam Kerja',
        sender: 'Manager HRD',
        recipient: 'Sdr. Riko Kurniawan',
        destination: 'Divisi Operations',
        summary: 'Pemberian peringatan tertulis tahap pertama atas keterlambatan hadir tanpa keterangan.',
        adminNotes: 'Arsip tertutup HRD.',
        createdByUid: 'demo-admin-hrd',
        createdByName: 'Ratna Dewi (Admin HRD & GA)',
      },
      {
        category: 'OUTGOING',
        status: 'REGISTERED',
        letterTypeId: typeMap['BA'],
        departmentId: deptMap['OPS'],
        classificationId: classMap['BIASA'],
        letterDate: '2026-08-19',
        registrationDate: '2026-08-19',
        subject: 'Berita Acara Serah Terima Implementasi Jaringan Cabang Surabaya',
        sender: 'Kepala Departemen Operations',
        recipient: 'PT Telkom Akses Regional V',
        destination: 'Surabaya, Jawa Timur',
        summary: 'Penyelesaian instalasi dan uji fungsi perangkat jaringan kantor cabang Surabaya.',
        adminNotes: 'Lampiran ditandatangani kedua belah pihak.',
        createdByUid: 'demo-super-admin',
        createdByName: 'Budi Santoso (Super Admin)',
      },
      {
        category: 'OUTGOING',
        status: 'CANCELLED',
        letterTypeId: typeMap['ST'],
        departmentId: deptMap['LEGAL'],
        classificationId: classMap['INTERNAL'],
        letterDate: '2026-10-18',
        registrationDate: '2026-10-18',
        subject: 'Surat Tugas Verifikasi Dokumen Perizinan Cabang Bandung',
        sender: 'Corporate Legal Head',
        recipient: 'Tim Legal Officer',
        destination: 'Bandung, Jawa Barat',
        summary: 'Penugasan verifikasi lapangan dokumen OSS dan izin operasional.',
        adminNotes: 'Jadwal kunjungan resmi diundur oleh instansi terkait.',
        cancellationReason: 'Perjalanan dinas dibatalkan karena penjadwalan ulang dari pihak instansi pemerintah daerah ke bulan depan.',
        createdByUid: 'demo-super-admin',
        createdByName: 'Budi Santoso (Super Admin)',
      },
      {
        category: 'OUTGOING',
        status: 'DRAFT',
        letterTypeId: typeMap['SKET'],
        departmentId: deptMap['HRD'],
        classificationId: classMap['BIASA'],
        letterDate: '2026-10-21',
        registrationDate: '2026-10-21',
        subject: 'Surat Keterangan Kerja Aktif a.n. Nadia Putri Maharani',
        sender: 'Manager HRD',
        recipient: 'Bank Mandiri KCP Sudirman',
        destination: 'Jakarta Selatan',
        summary: 'Surat keterangan karyawan aktif untuk keperluan administrasi pengajuan KPR perbankan.',
        adminNotes: 'Menunggu kelengkapan lampiran slip gaji dari karyawan sebelum diterbitkan nomor.',
        createdByUid: 'demo-admin-hrd',
        createdByName: 'Ratna Dewi (Admin HRD & GA)',
      },
    ];

    for (const item of sampleLetters) {
      const created = await createOrRegisterLetter({
        category: item.category as 'OUTGOING' | 'INCOMING' | 'INTERNAL',
        mode: item.status === 'DRAFT' ? 'DRAFT' : 'REGISTER',
        externalOriginalNumber: item.externalOriginalNumber || '',
        letterTypeId: item.letterTypeId,
        departmentId: item.departmentId,
        classificationId: item.classificationId,
        letterDate: item.letterDate,
        registrationDate: item.registrationDate,
        subject: item.subject,
        sender: item.sender,
        recipient: item.recipient,
        destination: item.destination,
        summary: item.summary,
        adminNotes: item.adminNotes,
        numberingRuleId: ruleMap[item.category],
        userUid: item.createdByUid,
        userName: item.createdByName,
        userRole: 'SUPER_ADMIN',
      });

      if (item.status === 'CANCELLED' && item.cancellationReason) {
        await cancelLetter({
          letterId: created.id,
          reason: item.cancellationReason,
          userUid: item.createdByUid,
          userName: item.createdByName,
          userRole: 'SUPER_ADMIN',
        });
      }
    }

    isSeeded = true;
  } catch (error) {
    console.error('Failed to seed initial data:', error);
    throw new Error('Failed to initialize database seed data.', { cause: error });
  }
}

export async function recordAuditLog(params: {
  userUid: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string;
  metadata?: unknown;
}) {
  try {
    await db.insert(auditLogs).values({
      userUid: params.userUid,
      userName: params.userName,
      userRole: params.userRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      beforeValueJson: params.beforeValue ? JSON.stringify(params.beforeValue) : null,
      afterValueJson: params.afterValue ? JSON.stringify(params.afterValue) : null,
      reason: params.reason || null,
      metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
    });
  } catch (error) {
    console.error('Failed to record audit log:', error);
  }
}

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    await ensureSeeded();
    const existingByUid = await db.select().from(users).where(eq(users.uid, uid));
    if (existingByUid.length > 0) {
      return existingByUid[0];
    }

    const depts = await db.select().from(departments);
    const defaultDeptId = depts[0]?.id || null;

    const result = await db
      .insert(users)
      .values({
        uid,
        name: displayName || email.split('@')[0] || 'Pengguna Korporat',
        email,
        passwordHash: '',
        roleCode: 'SUPER_ADMIN', // Default authenticated workspace owner to SUPER_ADMIN
        departmentId: defaultDeptId,
        isActive: true,
        isDemo: false,
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Gagal memverifikasi profil pengguna di database.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    await ensureSeeded();
    const rows = await db.select().from(users).where(eq(users.uid, uid));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Gagal mengambil data pengguna.', { cause: error });
  }
}

export async function authenticateWithCredentials(email: string, passwordPlain: string) {
  try {
    await ensureSeeded();
    const rows = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
    const user = rows[0];
    if (!user || !user.isActive) {
      return null;
    }
    if (!verifyPassword(passwordPlain, user.passwordHash)) {
      return null;
    }
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return user;
  } catch (error) {
    console.error('Database query failed in authenticateWithCredentials:', error);
    throw new Error('Gagal melakukan autentikasi kredensial.', { cause: error });
  }
}

export async function previewLetterNumber(params: {
  category: string;
  departmentId: number;
  letterTypeId: number;
  classificationId: number;
  letterDate: string;
  numberingRuleId?: number;
}) {
  try {
    await ensureSeeded();

    const [dept] = await db.select().from(departments).where(eq(departments.id, params.departmentId));
    const [lType] = await db.select().from(letterTypes).where(eq(letterTypes.id, params.letterTypeId));
    const [lClass] = await db
      .select()
      .from(letterClassifications)
      .where(eq(letterClassifications.id, params.classificationId));
    const [comp] = await db.select().from(companySettings);

    if (!dept || !lType) {
      throw new Error('Departemen atau Jenis Surat tidak ditemukan.');
    }

    let rule;
    if (params.numberingRuleId) {
      const found = await db
        .select()
        .from(numberingRules)
        .where(eq(numberingRules.id, params.numberingRuleId));
      rule = found[0];
    }
    if (!rule) {
      const categoryRules = await db
        .select()
        .from(numberingRules)
        .where(and(eq(numberingRules.category, params.category), eq(numberingRules.isActive, true)));
      rule = categoryRules[0];
    }
    if (!rule) {
      const fallbackRules = await db
        .select()
        .from(numberingRules)
        .where(eq(numberingRules.isActive, true));
      rule = fallbackRules[0];
    }
    if (!rule) {
      throw new Error('Tidak ada aturan penomoran aktif yang ditemukan.');
    }

    const { year, month } = parseLetterDateParts(params.letterDate);
    const scopeKey = buildScopeKey(rule.scopeType, dept.code, lType.code);
    const { periodYear, periodMonth } = buildPeriodKeys(rule.resetPeriod, year, month);
    const counterKey = `${rule.id}:${scopeKey}:${periodYear}:${periodMonth}`;

    const existingCounters = await db
      .select()
      .from(numberingCounters)
      .where(eq(numberingCounters.counterKey, counterKey));

    const nextSeq = (existingCounters[0]?.lastSequence || 0) + 1;

    const { formatted, components } = formatLetterNumber({
      template: rule.formatTemplate,
      separator: rule.separator,
      digitPadding: rule.digitPadding,
      sequence: nextSeq,
      companyCode: comp?.companyCode || 'CORP',
      deptCode: dept.code,
      typeCode: lType.code,
      classCode: lClass?.code || 'BIASA',
      year,
      month,
    });

    return {
      isPreview: true,
      previewNumber: formatted,
      nextSequence: nextSeq,
      ruleId: rule.id,
      ruleName: rule.name,
      scopeType: rule.scopeType,
      resetPeriod: rule.resetPeriod,
      dateSource: 'LETTER_DATE',
      components,
    };
  } catch (error) {
    console.error('Failed to preview letter number:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Gagal membuat pratinjau nomor surat.',
      { cause: error }
    );
  }
}

export async function createOrRegisterLetter(params: {
  category: 'OUTGOING' | 'INCOMING' | 'INTERNAL';
  mode: 'DRAFT' | 'REGISTER';
  externalOriginalNumber?: string;
  letterTypeId: number;
  departmentId: number;
  classificationId: number;
  letterDate: string;
  registrationDate: string;
  subject: string;
  sender: string;
  recipient: string;
  destination: string;
  summary: string;
  adminNotes?: string;
  numberingRuleId?: number;
  userUid: string;
  userName: string;
  userRole: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const [dept] = await tx
        .select()
        .from(departments)
        .where(eq(departments.id, params.departmentId));
      const [lType] = await tx
        .select()
        .from(letterTypes)
        .where(eq(letterTypes.id, params.letterTypeId));
      const [lClass] = await tx
        .select()
        .from(letterClassifications)
        .where(eq(letterClassifications.id, params.classificationId));
      const [comp] = await tx.select().from(companySettings);

      if (!dept || !lType || !lClass) {
        throw new Error('Data Departemen, Jenis Surat, atau Klasifikasi tidak valid.');
      }

      const { year, month } = parseLetterDateParts(params.letterDate);
      const randomSuffix = String(Math.floor(100000 + Math.random() * 900000));
      const letterCode = `REG-${year}${String(month).padStart(2, '0')}-${randomSuffix}`;

      let officialNumber: string | null = null;
      let allocatedSeq: number | null = null;
      let selectedRuleId: number | null = params.numberingRuleId || null;
      let componentsJson: string | null = null;

      if (params.mode === 'REGISTER') {
        let rule;
        if (params.numberingRuleId) {
          const rRows = await tx
            .select()
            .from(numberingRules)
            .where(eq(numberingRules.id, params.numberingRuleId));
          rule = rRows[0];
        }
        if (!rule) {
          const catRules = await tx
            .select()
            .from(numberingRules)
            .where(and(eq(numberingRules.category, params.category), eq(numberingRules.isActive, true)));
          rule = catRules[0];
        }
        if (!rule) {
          const allRules = await tx
            .select()
            .from(numberingRules)
            .where(eq(numberingRules.isActive, true));
          rule = allRules[0];
        }
        if (!rule) {
          throw new Error('Aturan penomoran aktif tidak ditemukan untuk kategori ini.');
        }

        selectedRuleId = rule.id;
        const scopeKey = buildScopeKey(rule.scopeType, dept.code, lType.code);
        const { periodYear, periodMonth } = buildPeriodKeys(rule.resetPeriod, year, month);
        const counterKey = `${rule.id}:${scopeKey}:${periodYear}:${periodMonth}`;

        // Atomic concurrency-safe increment via PostgreSQL INSERT ... ON CONFLICT DO UPDATE
        const updatedCounters = await tx
          .insert(numberingCounters)
          .values({
            counterKey,
            ruleId: rule.id,
            scopeKey,
            periodYear,
            periodMonth,
            lastSequence: 1,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: numberingCounters.counterKey,
            set: {
              lastSequence: sql`${numberingCounters.lastSequence} + 1`,
              updatedAt: new Date(),
            },
          })
          .returning();

        allocatedSeq = updatedCounters[0].lastSequence;

        const formattedResult = formatLetterNumber({
          template: rule.formatTemplate,
          separator: rule.separator,
          digitPadding: rule.digitPadding,
          sequence: allocatedSeq,
          companyCode: comp?.companyCode || 'NTM',
          deptCode: dept.code,
          typeCode: lType.code,
          classCode: lClass.code,
          year,
          month,
        });

        officialNumber = formattedResult.formatted;
        componentsJson = JSON.stringify({
          ...formattedResult.components,
          ruleId: rule.id,
          ruleName: rule.name,
          scopeType: rule.scopeType,
          resetPeriod: rule.resetPeriod,
          allocatedAt: new Date().toISOString(),
        });
      }

      const inserted = await tx
        .insert(letters)
        .values({
          letterCode,
          category: params.category,
          status: params.mode === 'REGISTER' ? 'REGISTERED' : 'DRAFT',
          officialNumber,
          externalOriginalNumber:
            params.category === 'INCOMING' ? params.externalOriginalNumber || null : null,
          letterTypeId: params.letterTypeId,
          departmentId: params.departmentId,
          classificationId: params.classificationId,
          letterDate: params.letterDate,
          registrationDate: params.registrationDate,
          subject: params.subject,
          sender: params.sender,
          recipient: params.recipient,
          destination: params.destination,
          summary: params.summary,
          adminNotes: params.adminNotes || '',
          numberingRuleId: selectedRuleId,
          sequenceNumber: allocatedSeq,
          numberingComponentsJson: componentsJson,
          createdByUid: params.userUid,
          createdByName: params.userName,
        })
        .returning();

      const createdLetter = inserted[0];

      await tx.insert(auditLogs).values({
        userUid: params.userUid,
        userName: params.userName,
        userRole: params.userRole,
        action: params.mode === 'REGISTER' ? 'REGISTER_LETTER' : 'CREATE_DRAFT',
        entityType: 'LETTER',
        entityId: String(createdLetter.id),
        description:
          params.mode === 'REGISTER'
            ? `Menerbitkan nomor surat resmi ${officialNumber} (${params.subject})`
            : `Membuat draft surat ${letterCode} (${params.subject})`,
        afterValueJson: JSON.stringify(createdLetter),
      });

      return createdLetter;
    });
  } catch (error) {
    console.error('Transaction failed in createOrRegisterLetter:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Gagal menyimpan atau menerbitkan surat.',
      { cause: error }
    );
  }
}

export async function publishDraftLetter(params: {
  letterId: number;
  numberingRuleId?: number;
  userUid: string;
  userName: string;
  userRole: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const existingRows = await tx.select().from(letters).where(eq(letters.id, params.letterId));
      const existing = existingRows[0];
      if (!existing) {
        throw new Error('Surat tidak ditemukan.');
      }
      if (existing.status !== 'DRAFT') {
        throw new Error('Hanya surat berstatus Draft yang dapat diterbitkan nomor resminya.');
      }

      const [dept] = await tx
        .select()
        .from(departments)
        .where(eq(departments.id, existing.departmentId));
      const [lType] = await tx
        .select()
        .from(letterTypes)
        .where(eq(letterTypes.id, existing.letterTypeId));
      const [lClass] = await tx
        .select()
        .from(letterClassifications)
        .where(eq(letterClassifications.id, existing.classificationId));
      const [comp] = await tx.select().from(companySettings);

      const ruleIdToUse = params.numberingRuleId || existing.numberingRuleId;
      let rule;
      if (ruleIdToUse) {
        const found = await tx
          .select()
          .from(numberingRules)
          .where(eq(numberingRules.id, ruleIdToUse));
        rule = found[0];
      }
      if (!rule) {
        const catRules = await tx
          .select()
          .from(numberingRules)
          .where(and(eq(numberingRules.category, existing.category), eq(numberingRules.isActive, true)));
        rule = catRules[0];
      }
      if (!rule) {
        throw new Error('Aturan penomoran aktif tidak ditemukan.');
      }

      const { year, month } = parseLetterDateParts(existing.letterDate);
      const scopeKey = buildScopeKey(rule.scopeType, dept.code, lType.code);
      const { periodYear, periodMonth } = buildPeriodKeys(rule.resetPeriod, year, month);
      const counterKey = `${rule.id}:${scopeKey}:${periodYear}:${periodMonth}`;

      const updatedCounters = await tx
        .insert(numberingCounters)
        .values({
          counterKey,
          ruleId: rule.id,
          scopeKey,
          periodYear,
          periodMonth,
          lastSequence: 1,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: numberingCounters.counterKey,
          set: {
            lastSequence: sql`${numberingCounters.lastSequence} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning();

      const allocatedSeq = updatedCounters[0].lastSequence;
      const formattedResult = formatLetterNumber({
        template: rule.formatTemplate,
        separator: rule.separator,
        digitPadding: rule.digitPadding,
        sequence: allocatedSeq,
        companyCode: comp?.companyCode || 'NTM',
        deptCode: dept.code,
        typeCode: lType.code,
        classCode: lClass.code,
        year,
        month,
      });

      const componentsJson = JSON.stringify({
        ...formattedResult.components,
        ruleId: rule.id,
        ruleName: rule.name,
        scopeType: rule.scopeType,
        resetPeriod: rule.resetPeriod,
        allocatedAt: new Date().toISOString(),
      });

      const updatedRows = await tx
        .update(letters)
        .set({
          status: 'REGISTERED',
          officialNumber: formattedResult.formatted,
          numberingRuleId: rule.id,
          sequenceNumber: allocatedSeq,
          numberingComponentsJson: componentsJson,
          updatedAt: new Date(),
        })
        .where(eq(letters.id, existing.id))
        .returning();

      const updatedLetter = updatedRows[0];

      await tx.insert(auditLogs).values({
        userUid: params.userUid,
        userName: params.userName,
        userRole: params.userRole,
        action: 'REGISTER_LETTER',
        entityType: 'LETTER',
        entityId: String(existing.id),
        description: `Menerbitkan draft surat ${existing.letterCode} menjadi nomor resmi ${formattedResult.formatted}`,
        beforeValueJson: JSON.stringify(existing),
        afterValueJson: JSON.stringify(updatedLetter),
      });

      return updatedLetter;
    });
  } catch (error) {
    console.error('Transaction failed in publishDraftLetter:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Gagal menerbitkan nomor surat dari draft.',
      { cause: error }
    );
  }
}

export async function updateLetterDetails(params: {
  letterId: number;
  subject: string;
  sender: string;
  recipient: string;
  destination: string;
  summary: string;
  adminNotes: string;
  externalOriginalNumber?: string;
  letterDate?: string;
  departmentId?: number;
  letterTypeId?: number;
  classificationId?: number;
  userUid: string;
  userName: string;
  userRole: string;
}) {
  try {
    const existingRows = await db.select().from(letters).where(eq(letters.id, params.letterId));
    const existing = existingRows[0];
    if (!existing) {
      throw new Error('Surat tidak ditemukan.');
    }
    if (existing.status === 'CANCELLED') {
      throw new Error('Surat yang telah dibatalkan tidak dapat diubah kembali.');
    }

    // If REGISTERED, officialNumber and numbering components remain immutable
    const updateData: Record<string, unknown> = {
      subject: params.subject,
      sender: params.sender,
      recipient: params.recipient,
      destination: params.destination,
      summary: params.summary,
      adminNotes: params.adminNotes,
      updatedAt: new Date(),
    };

    if (existing.category === 'INCOMING' && params.externalOriginalNumber !== undefined) {
      updateData.externalOriginalNumber = params.externalOriginalNumber;
    }

    if (existing.status === 'DRAFT') {
      if (params.letterDate) updateData.letterDate = params.letterDate;
      if (params.departmentId) updateData.departmentId = params.departmentId;
      if (params.letterTypeId) updateData.letterTypeId = params.letterTypeId;
      if (params.classificationId) updateData.classificationId = params.classificationId;
    }

    const updatedRows = await db
      .update(letters)
      .set(updateData)
      .where(eq(letters.id, params.letterId))
      .returning();

    const updated = updatedRows[0];

    await recordAuditLog({
      userUid: params.userUid,
      userName: params.userName,
      userRole: params.userRole,
      action: 'UPDATE_LETTER',
      entityType: 'LETTER',
      entityId: String(existing.id),
      description: `Memperbarui informasi surat ${existing.officialNumber || existing.letterCode}`,
      beforeValue: existing,
      afterValue: updated,
    });

    return updated;
  } catch (error) {
    console.error('Failed to update letter details:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Gagal memperbarui data surat.',
      { cause: error }
    );
  }
}

export async function cancelLetter(params: {
  letterId: number;
  reason: string;
  userUid: string;
  userName: string;
  userRole: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const existingRows = await tx.select().from(letters).where(eq(letters.id, params.letterId));
      const existing = existingRows[0];
      if (!existing) {
        throw new Error('Surat tidak ditemukan.');
      }
      if (existing.status === 'CANCELLED') {
        throw new Error('Surat ini sudah berstatus Dibatalkan.');
      }

      // IMPORTANT RULE: Cancelled letter keeps its officialNumber permanently so it is never reused
      const updatedRows = await tx
        .update(letters)
        .set({
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: params.userName,
          cancellationReason: params.reason.trim(),
          updatedAt: new Date(),
        })
        .where(eq(letters.id, params.letterId))
        .returning();

      const updated = updatedRows[0];

      await tx.insert(auditLogs).values({
        userUid: params.userUid,
        userName: params.userName,
        userRole: params.userRole,
        action: 'CANCEL_LETTER',
        entityType: 'LETTER',
        entityId: String(existing.id),
        description: `Membatalkan surat ${existing.officialNumber || existing.letterCode}`,
        beforeValueJson: JSON.stringify(existing),
        afterValueJson: JSON.stringify(updated),
        reason: params.reason.trim(),
      });

      return updated;
    });
  } catch (error) {
    console.error('Failed to cancel letter:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Gagal membatalkan surat.',
      { cause: error }
    );
  }
}

export async function queryLetters(filters: {
  search?: string;
  category?: string;
  departmentId?: number;
  letterTypeId?: number;
  classificationId?: number;
  status?: string;
  year?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  try {
    await ensureSeeded();
    const allDepts = await db.select().from(departments);
    const allTypes = await db.select().from(letterTypes);
    const allClass = await db.select().from(letterClassifications);
    const allAttachments = await db.select().from(letterAttachments);

    const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d]));
    const typeMap = Object.fromEntries(allTypes.map((t) => [t.id, t]));
    const classMap = Object.fromEntries(allClass.map((c) => [c.id, c]));

    const conditions = [];

    if (filters.category && filters.category !== 'ALL') {
      conditions.push(eq(letters.category, filters.category));
    }
    if (filters.departmentId) {
      conditions.push(eq(letters.departmentId, filters.departmentId));
    }
    if (filters.letterTypeId) {
      conditions.push(eq(letters.letterTypeId, filters.letterTypeId));
    }
    if (filters.classificationId) {
      conditions.push(eq(letters.classificationId, filters.classificationId));
    }
    if (filters.status && filters.status !== 'ALL') {
      conditions.push(eq(letters.status, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(letters.letterDate, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(letters.letterDate, filters.dateTo));
    }
    if (filters.year && filters.year !== 'ALL') {
      conditions.push(ilike(letters.letterDate, `${filters.year}-%`));
    }
    if (filters.search && filters.search.trim() !== '') {
      const q = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(letters.officialNumber, q),
          ilike(letters.externalOriginalNumber, q),
          ilike(letters.letterCode, q),
          ilike(letters.subject, q),
          ilike(letters.sender, q),
          ilike(letters.recipient, q),
          ilike(letters.destination, q)
        )
      );
    }

    const rawRows =
      conditions.length > 0
        ? await db
            .select()
            .from(letters)
            .where(and(...conditions))
            .orderBy(desc(letters.letterDate), desc(letters.id))
        : await db.select().from(letters).orderBy(desc(letters.letterDate), desc(letters.id));

    const enriched = rawRows.map((row) => ({
      ...row,
      department: deptMap[row.departmentId] || null,
      letterType: typeMap[row.letterTypeId] || null,
      classification: classMap[row.classificationId] || null,
      attachments: allAttachments.filter((a) => a.letterId === row.id),
    }));

    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(200, filters.limit || 10));
    const total = enriched.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const items = enriched.slice((page - 1) * limit, page * limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  } catch (error) {
    console.error('Database query failed in queryLetters:', error);
    throw new Error('Gagal memuat daftar surat dari database.', { cause: error });
  }
}

export async function getLetterDetailById(letterId: number) {
  try {
    await ensureSeeded();
    const rows = await db.select().from(letters).where(eq(letters.id, letterId));
    const row = rows[0];
    if (!row) return null;

    const [dept] = await db.select().from(departments).where(eq(departments.id, row.departmentId));
    const [lType] = await db.select().from(letterTypes).where(eq(letterTypes.id, row.letterTypeId));
    const [lClass] = await db
      .select()
      .from(letterClassifications)
      .where(eq(letterClassifications.id, row.classificationId));
    const attachments = await db
      .select()
      .from(letterAttachments)
      .where(eq(letterAttachments.letterId, row.id))
      .orderBy(desc(letterAttachments.createdAt));
    const historyLogs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, 'LETTER'), eq(auditLogs.entityId, String(row.id))))
      .orderBy(desc(auditLogs.createdAt));

    return {
      ...row,
      department: dept || null,
      letterType: lType || null,
      classification: lClass || null,
      attachments,
      historyLogs,
    };
  } catch (error) {
    console.error('Database query failed in getLetterDetailById:', error);
    throw new Error('Gagal memuat detail surat.', { cause: error });
  }
}

export async function getDashboardAnalytics(filters: {
  year?: string;
  month?: string;
  departmentId?: number;
}) {
  try {
    await ensureSeeded();
    const allLetters = await db.select().from(letters).orderBy(desc(letters.letterDate), desc(letters.id));
    const allDepts = await db.select().from(departments);
    const allTypes = await db.select().from(letterTypes);
    const recentAudits = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(10);

    const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d]));
    const typeMap = Object.fromEntries(allTypes.map((t) => [t.id, t]));

    const targetYear = filters.year || '2026';
    const targetMonth = filters.month && filters.month !== 'ALL' ? filters.month.padStart(2, '0') : null;

    const filteredLetters = allLetters.filter((l) => {
      if (filters.departmentId && l.departmentId !== filters.departmentId) return false;
      if (targetYear !== 'ALL' && !l.letterDate.startsWith(targetYear)) return false;
      return true;
    });

    const currentMonthPrefix = targetMonth
      ? `${targetYear}-${targetMonth}`
      : '2026-10'; // Default current active month in 2026

    const totalRegistered = filteredLetters.filter((l) => l.status === 'REGISTERED').length;
    const totalDraft = filteredLetters.filter((l) => l.status === 'DRAFT').length;
    const totalCancelled = filteredLetters.filter((l) => l.status === 'CANCELLED').length;

    const monthLetters = filteredLetters.filter((l) =>
      targetMonth ? l.letterDate.startsWith(currentMonthPrefix) : true
    );

    const outgoingCount = monthLetters.filter(
      (l) => l.category === 'OUTGOING' && l.status === 'REGISTERED'
    ).length;
    const incomingCount = monthLetters.filter(
      (l) => l.category === 'INCOMING' && l.status === 'REGISTERED'
    ).length;
    const internalCount = monthLetters.filter(
      (l) => l.category === 'INTERNAL' && l.status === 'REGISTERED'
    ).length;

    // Monthly series (Jan - Dec)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthlySeries = monthNames.map((label, idx) => {
      const mStr = String(idx + 1).padStart(2, '0');
      const inM = filteredLetters.filter((l) => l.letterDate.slice(5, 7) === mStr);
      return {
        month: label,
        monthNumber: mStr,
        outgoing: inM.filter((l) => l.category === 'OUTGOING').length,
        incoming: inM.filter((l) => l.category === 'INCOMING').length,
        internal: inM.filter((l) => l.category === 'INTERNAL').length,
        total: inM.length,
      };
    });

    const byDepartment = allDepts.map((d) => {
      const deptLetters = filteredLetters.filter((l) => l.departmentId === d.id);
      return {
        id: d.id,
        code: d.code,
        name: d.name,
        total: deptLetters.length,
        outgoing: deptLetters.filter((l) => l.category === 'OUTGOING').length,
        incoming: deptLetters.filter((l) => l.category === 'INCOMING').length,
        internal: deptLetters.filter((l) => l.category === 'INTERNAL').length,
        cancelled: deptLetters.filter((l) => l.status === 'CANCELLED').length,
      };
    });

    const byType = allTypes.map((t) => {
      const count = filteredLetters.filter((l) => l.letterTypeId === t.id).length;
      return {
        id: t.id,
        code: t.code,
        name: t.name,
        count,
      };
    });

    const recentLetters = filteredLetters.slice(0, 7).map((l) => ({
      ...l,
      department: deptMap[l.departmentId] || null,
      letterType: typeMap[l.letterTypeId] || null,
    }));

    return {
      kpis: {
        totalLetters: filteredLetters.length,
        totalRegistered,
        totalDraft,
        totalCancelled,
        outgoingCount,
        incomingCount,
        internalCount,
      },
      monthlySeries,
      byDepartment,
      byType,
      recentLetters,
      recentAudits,
    };
  } catch (error) {
    console.error('Database query failed in getDashboardAnalytics:', error);
    throw new Error('Gagal memuat data analitik dashboard.', { cause: error });
  }
}
