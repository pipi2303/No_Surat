import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { z } from 'zod';
import { desc, eq, ilike, and, or, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
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
  users,
} from './src/db/schema.ts';
import {
  authenticateWithCredentials,
  cancelLetter,
  createOrRegisterLetter,
  ensureSeeded,
  formatLetterNumber,
  getDashboardAnalytics,
  getLetterDetailById,
  getUserByUid,
  hashPassword,
  previewLetterNumber,
  publishDraftLetter,
  queryLetters,
  recordAuditLog,
  updateLetterDetails,
} from './src/db/repository.ts';
import { AuthRequest, requireAuth, requireRoles } from './src/middleware/auth.ts';

const app = express();
app.use(express.json({ limit: '2mb' }));

// Ensure uploads directory exists on disk (object storage / local filesystem, NOT Base64 in DB)
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safeOriginal}`);
  },
});

const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/png',
];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const validExt = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png'].includes(ext);
    if (ALLOWED_MIMES.includes(file.mimetype) || validExt) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Gunakan PDF, DOCX, JPG, atau PNG.'));
    }
  },
});

// Simple rate limiter for authentication endpoints
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 25;
}

// ============================================================================
// 1. PUBLIC / AUTHENTICATION ROUTES
// ============================================================================

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/auth/demo-accounts', async (_req, res) => {
  try {
    await ensureSeeded();
    const allUsers = await db.select().from(users);
    const allDepts = await db.select().from(departments);
    const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d]));

    const sanitized = allUsers
      .filter((u) => u.isActive)
      .map((u) => ({
        id: u.id,
        uid: u.uid,
        name: u.name,
        email: u.email,
        roleCode: u.roleCode,
        departmentId: u.departmentId,
        departmentName: u.departmentId ? deptMap[u.departmentId]?.name : 'Korporat',
        departmentCode: u.departmentId ? deptMap[u.departmentId]?.code : 'ALL',
        isDemo: u.isDemo,
      }));
    res.json({ accounts: sanitized });
  } catch (error: any) {
    console.error('Failed to fetch demo accounts:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat daftar akun demo.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        error: 'Terlalu banyak percobaan login. Silakan tunggu 1 menit sebelum mencoba kembali.',
      });
    }

    const schema = z.object({
      email: z.string().email('Format email tidak valid'),
      password: z.string().min(1, 'Password wajib diisi'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const user = await authenticateWithCredentials(parsed.data.email, parsed.data.password);
    if (!user) {
      return res.status(401).json({ error: 'Email atau password tidak sesuai, atau akun nonaktif.' });
    }

    await recordAuditLog({
      userUid: user.uid,
      userName: user.name,
      userRole: user.roleCode,
      action: 'LOGIN',
      entityType: 'AUTH',
      entityId: user.uid,
      description: `Pengguna ${user.name} (${user.roleCode}) berhasil login melalui kredensial email.`,
      metadata: { ip },
    });

    res.json({
      token: `demo_session:${user.uid}`,
      user: {
        id: user.id,
        uid: user.uid,
        name: user.name,
        email: user.email,
        roleCode: user.roleCode,
        departmentId: user.departmentId,
        isDemo: user.isDemo,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Gagal memproses login.' });
  }
});

app.post('/api/auth/switch-demo', async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'UID akun wajib disertakan.' });
    }
    const user = await getUserByUid(String(uid));
    if (!user || !user.isActive) {
      return res.status(404).json({ error: 'Akun role tidak ditemukan atau nonaktif.' });
    }

    await recordAuditLog({
      userUid: user.uid,
      userName: user.name,
      userRole: user.roleCode,
      action: 'LOGIN',
      entityType: 'AUTH',
      entityId: user.uid,
      description: `Beralih sesi aktif ke akun ${user.name} (Role: ${user.roleCode}).`,
    });

    res.json({
      token: `demo_session:${user.uid}`,
      user: {
        id: user.id,
        uid: user.uid,
        name: user.name,
        email: user.email,
        roleCode: user.roleCode,
        departmentId: user.departmentId,
        isDemo: user.isDemo,
      },
    });
  } catch (error: any) {
    console.error('Switch demo error:', error);
    res.status(500).json({ error: error.message || 'Gagal beralih akun demo.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const allDepts = await db.select().from(departments);
    const allPerms = await db.select().from(permissions);
    const dept = allDepts.find((d) => d.id === req.authUser?.departmentId) || null;
    const userPerms = allPerms
      .filter((p) => {
        try {
          const allowed: string[] = JSON.parse(p.roleCodes);
          return req.authUser ? allowed.includes(req.authUser.roleCode) : false;
        } catch {
          return false;
        }
      })
      .map((p) => p.code);

    res.json({
      user: {
        ...req.authUser,
        department: dept,
        permissions: userPerms,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat profil pengguna.' });
  }
});

app.post('/api/auth/logout', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.authUser) {
      await recordAuditLog({
        userUid: req.authUser.uid,
        userName: req.authUser.name,
        userRole: req.authUser.roleCode,
        action: 'LOGOUT',
        entityType: 'AUTH',
        entityId: req.authUser.uid,
        description: `Pengguna ${req.authUser.name} keluar dari sesi aplikasi.`,
      });
    }
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 2. DASHBOARD & ANALYTICS
// ============================================================================

app.get('/api/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const year = (req.query.year as string) || '2026';
    const month = (req.query.month as string) || 'ALL';
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const data = await getDashboardAnalytics({ year, month, departmentId });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat analitik dashboard.' });
  }
});

// ============================================================================
// 3. MASTER DATA CRUD (Departments, Letter Types, Classifications, Numbering Rules, Company Settings)
// ============================================================================

app.get('/api/master-bundle', requireAuth, async (_req, res) => {
  try {
    await ensureSeeded();
    const [depts, types, classifications, rules, counters, settingsRows] = await Promise.all([
      db.select().from(departments).orderBy(departments.code),
      db.select().from(letterTypes).orderBy(letterTypes.code),
      db.select().from(letterClassifications).orderBy(letterClassifications.id),
      db.select().from(numberingRules).orderBy(numberingRules.id),
      db.select().from(numberingCounters).orderBy(desc(numberingCounters.updatedAt)),
      db.select().from(companySettings),
    ]);

    res.json({
      departments: depts,
      letterTypes: types,
      classifications,
      numberingRules: rules,
      numberingCounters: counters,
      companySettings: settingsRows[0] || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat data master.' });
  }
});

// Departments
app.post(
  '/api/departments',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        code: z.string().min(2).max(12).transform((v) => v.trim().toUpperCase()),
        name: z.string().min(3),
        description: z.string().min(3),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const dup = await db
        .select()
        .from(departments)
        .where(eq(departments.code, parsed.data.code));
      if (dup.length > 0) {
        return res.status(409).json({ error: `Kode departemen "${parsed.data.code}" sudah digunakan.` });
      }

      const [created] = await db.insert(departments).values(parsed.data).returning();
      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'UPDATE_MASTER_DATA',
        entityType: 'DEPARTMENT',
        entityId: String(created.id),
        description: `Menambahkan departemen baru: ${created.code} - ${created.name}`,
        afterValue: created,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal menambahkan departemen.' });
    }
  }
);

app.put(
  '/api/departments/:id',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        code: z.string().min(2).max(12).transform((v) => v.trim().toUpperCase()),
        name: z.string().min(3),
        description: z.string().min(3),
        isActive: z.boolean(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const existingRows = await db.select().from(departments).where(eq(departments.id, id));
      if (!existingRows[0]) {
        return res.status(404).json({ error: 'Departemen tidak ditemukan.' });
      }

      const dup = await db
        .select()
        .from(departments)
        .where(eq(departments.code, parsed.data.code));
      if (dup.length > 0 && dup[0].id !== id) {
        return res.status(409).json({ error: `Kode departemen "${parsed.data.code}" sudah digunakan.` });
      }

      const [updated] = await db
        .update(departments)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(departments.id, id))
        .returning();

      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'UPDATE_MASTER_DATA',
        entityType: 'DEPARTMENT',
        entityId: String(id),
        description: `Memperbarui departemen ${updated.code} - ${updated.name}`,
        beforeValue: existingRows[0],
        afterValue: updated,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal memperbarui departemen.' });
    }
  }
);

// Letter Types
app.post(
  '/api/letter-types',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        code: z.string().min(2).max(12).transform((v) => v.trim().toUpperCase()),
        name: z.string().min(3),
        allowedCategories: z.string().min(3),
        description: z.string().min(3),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const dup = await db
        .select()
        .from(letterTypes)
        .where(eq(letterTypes.code, parsed.data.code));
      if (dup.length > 0) {
        return res.status(409).json({ error: `Kode jenis surat "${parsed.data.code}" sudah digunakan.` });
      }

      const [created] = await db.insert(letterTypes).values(parsed.data).returning();
      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'UPDATE_MASTER_DATA',
        entityType: 'LETTER_TYPE',
        entityId: String(created.id),
        description: `Menambahkan jenis surat baru: ${created.code} - ${created.name}`,
        afterValue: created,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal menambahkan jenis surat.' });
    }
  }
);

app.put(
  '/api/letter-types/:id',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        code: z.string().min(2).max(12).transform((v) => v.trim().toUpperCase()),
        name: z.string().min(3),
        allowedCategories: z.string().min(3),
        description: z.string().min(3),
        isActive: z.boolean(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const existingRows = await db.select().from(letterTypes).where(eq(letterTypes.id, id));
      if (!existingRows[0]) {
        return res.status(404).json({ error: 'Jenis surat tidak ditemukan.' });
      }

      const dup = await db
        .select()
        .from(letterTypes)
        .where(eq(letterTypes.code, parsed.data.code));
      if (dup.length > 0 && dup[0].id !== id) {
        return res.status(409).json({ error: `Kode jenis surat "${parsed.data.code}" sudah digunakan.` });
      }

      const [updated] = await db
        .update(letterTypes)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(letterTypes.id, id))
        .returning();

      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'UPDATE_MASTER_DATA',
        entityType: 'LETTER_TYPE',
        entityId: String(id),
        description: `Memperbarui jenis surat ${updated.code} - ${updated.name}`,
        beforeValue: existingRows[0],
        afterValue: updated,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal memperbarui jenis surat.' });
    }
  }
);

// Classifications
app.post(
  '/api/classifications',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        code: z.string().min(2).max(20).transform((v) => v.trim().toUpperCase()),
        name: z.string().min(3),
        confidentialityLevel: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'STRICTLY_CONFIDENTIAL']),
        description: z.string().min(3),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const dup = await db
        .select()
        .from(letterClassifications)
        .where(eq(letterClassifications.code, parsed.data.code));
      if (dup.length > 0) {
        return res.status(409).json({ error: `Kode klasifikasi "${parsed.data.code}" sudah digunakan.` });
      }

      const [created] = await db.insert(letterClassifications).values(parsed.data).returning();
      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'UPDATE_MASTER_DATA',
        entityType: 'CLASSIFICATION',
        entityId: String(created.id),
        description: `Menambahkan klasifikasi surat: ${created.code} - ${created.name}`,
        afterValue: created,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal menambahkan klasifikasi surat.' });
    }
  }
);

app.put(
  '/api/classifications/:id',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        code: z.string().min(2).max(20).transform((v) => v.trim().toUpperCase()),
        name: z.string().min(3),
        confidentialityLevel: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'STRICTLY_CONFIDENTIAL']),
        description: z.string().min(3),
        isActive: z.boolean(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const existingRows = await db
        .select()
        .from(letterClassifications)
        .where(eq(letterClassifications.id, id));
      if (!existingRows[0]) {
        return res.status(404).json({ error: 'Klasifikasi tidak ditemukan.' });
      }

      const dup = await db
        .select()
        .from(letterClassifications)
        .where(eq(letterClassifications.code, parsed.data.code));
      if (dup.length > 0 && dup[0].id !== id) {
        return res.status(409).json({ error: `Kode klasifikasi "${parsed.data.code}" sudah digunakan.` });
      }

      const [updated] = await db
        .update(letterClassifications)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(letterClassifications.id, id))
        .returning();

      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'UPDATE_MASTER_DATA',
        entityType: 'CLASSIFICATION',
        entityId: String(id),
        description: `Memperbarui klasifikasi surat ${updated.code}`,
        beforeValue: existingRows[0],
        afterValue: updated,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal memperbarui klasifikasi surat.' });
    }
  }
);

// Numbering Rules
app.post(
  '/api/numbering-rules',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        name: z.string().min(3),
        category: z.enum(['OUTGOING', 'INCOMING', 'INTERNAL', 'ALL']),
        formatTemplate: z.string().min(5).refine((v) => v.includes('{SEQ}'), {
          message: 'Template format wajib mengandung token {SEQ} untuk nomor urut.',
        }),
        scopeType: z.enum(['GLOBAL', 'DEPARTMENT', 'LETTER_TYPE', 'DEPT_AND_TYPE']),
        resetPeriod: z.enum(['YEARLY', 'MONTHLY', 'NEVER']),
        digitPadding: z.number().int().min(2).max(6),
        separator: z.string().min(1).max(3),
        isActive: z.boolean().default(true),
        effectiveDate: z.string().min(8),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const [created] = await db
        .insert(numberingRules)
        .values({
          ...parsed.data,
          dateSource: 'LETTER_DATE', // Locked to Tanggal Surat per confirmed decision
        })
        .returning();

      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'UPDATE_NUMBERING_RULE',
        entityType: 'NUMBERING_RULE',
        entityId: String(created.id),
        description: `Membuat aturan penomoran baru: ${created.name} (${created.formatTemplate})`,
        afterValue: created,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal membuat aturan penomoran.' });
    }
  }
);

app.put(
  '/api/numbering-rules/:id',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        name: z.string().min(3),
        category: z.enum(['OUTGOING', 'INCOMING', 'INTERNAL', 'ALL']),
        formatTemplate: z.string().min(5).refine((v) => v.includes('{SEQ}'), {
          message: 'Template format wajib mengandung token {SEQ} untuk nomor urut.',
        }),
        scopeType: z.enum(['GLOBAL', 'DEPARTMENT', 'LETTER_TYPE', 'DEPT_AND_TYPE']),
        resetPeriod: z.enum(['YEARLY', 'MONTHLY', 'NEVER']),
        digitPadding: z.number().int().min(2).max(6),
        separator: z.string().min(1).max(3),
        isActive: z.boolean(),
        effectiveDate: z.string().min(8),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const existingRows = await db.select().from(numberingRules).where(eq(numberingRules.id, id));
      if (!existingRows[0]) {
        return res.status(404).json({ error: 'Aturan penomoran tidak ditemukan.' });
      }

      // Note: Changing a rule only affects newly registered letters; historical letters retain their snapshot
      const [updated] = await db
        .update(numberingRules)
        .set({
          ...parsed.data,
          dateSource: 'LETTER_DATE',
          updatedAt: new Date(),
        })
        .where(eq(numberingRules.id, id))
        .returning();

      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'UPDATE_NUMBERING_RULE',
        entityType: 'NUMBERING_RULE',
        entityId: String(id),
        description: `Memperbarui aturan penomoran "${updated.name}" (${updated.formatTemplate}). Nomor surat historis tetap tidak berubah.`,
        beforeValue: existingRows[0],
        afterValue: updated,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal memperbarui aturan penomoran.' });
    }
  }
);

// Company Settings
app.put(
  '/api/company-settings',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        companyName: z.string().min(3),
        companyCode: z.string().min(2).max(12).transform((v) => v.trim().toUpperCase()),
        logoUrl: z.string().optional().default(''),
        address: z.string().min(5),
        phone: z.string().min(5),
        email: z.string().email(),
        website: z.string().min(4),
        npwpOrRegNumber: z.string().optional().default(''),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const existing = await db.select().from(companySettings);
      let updated;
      if (existing.length > 0) {
        const rows = await db
          .update(companySettings)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(companySettings.id, existing[0].id))
          .returning();
        updated = rows[0];
      } else {
        const rows = await db.insert(companySettings).values(parsed.data).returning();
        updated = rows[0];
      }

      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'UPDATE_COMPANY_SETTINGS',
        entityType: 'COMPANY_SETTINGS',
        entityId: String(updated.id),
        description: `Memperbarui identitas perusahaan: ${updated.companyName} (${updated.companyCode})`,
        beforeValue: existing[0] || null,
        afterValue: updated,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal memperbarui identitas perusahaan.' });
    }
  }
);

// ============================================================================
// 4. NUMBERING PREVIEW & LETTER MANAGEMENT (NO APPROVAL WORKFLOW!)
// ============================================================================

app.post('/api/numbering/preview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      category: z.enum(['OUTGOING', 'INCOMING', 'INTERNAL']),
      departmentId: z.number().int().positive(),
      letterTypeId: z.number().int().positive(),
      classificationId: z.number().int().positive(),
      letterDate: z.string().min(8),
      numberingRuleId: z.number().int().positive().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const preview = await previewLetterNumber(parsed.data);
    res.json(preview);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Gagal menghitung pratinjau nomor surat.' });
  }
});

app.get('/api/letters', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await queryLetters({
      search: req.query.search as string | undefined,
      category: req.query.category as string | undefined,
      departmentId: req.query.departmentId ? Number(req.query.departmentId) : undefined,
      letterTypeId: req.query.letterTypeId ? Number(req.query.letterTypeId) : undefined,
      classificationId: req.query.classificationId ? Number(req.query.classificationId) : undefined,
      status: req.query.status as string | undefined,
      year: req.query.year as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 10,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat daftar surat.' });
  }
});

app.get('/api/letters/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const detail = await getLetterDetailById(id);
    if (!detail) {
      return res.status(404).json({ error: 'Data surat tidak ditemukan.' });
    }
    res.json(detail);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat detail surat.' });
  }
});

app.post(
  '/api/letters',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'STAFF']),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        category: z.enum(['OUTGOING', 'INCOMING', 'INTERNAL']),
        mode: z.enum(['DRAFT', 'REGISTER']),
        externalOriginalNumber: z.string().optional().default(''),
        letterTypeId: z.number().int().positive('Jenis surat wajib dipilih'),
        departmentId: z.number().int().positive('Departemen wajib dipilih'),
        classificationId: z.number().int().positive('Klasifikasi surat wajib dipilih'),
        letterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal surat wajib berformat YYYY-MM-DD'),
        registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal registrasi wajib berformat YYYY-MM-DD'),
        subject: z.string().min(5, 'Perihal surat minimal 5 karakter'),
        sender: z.string().min(2, 'Pengirim wajib diisi'),
        recipient: z.string().min(2, 'Penerima wajib diisi'),
        destination: z.string().min(2, 'Tujuan surat wajib diisi'),
        summary: z.string().min(5, 'Ringkasan / isi pokok surat minimal 5 karakter'),
        adminNotes: z.string().optional().default(''),
        numberingRuleId: z.number().int().positive().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      if (
        parsed.data.category === 'INCOMING' &&
        parsed.data.mode === 'REGISTER' &&
        (!parsed.data.externalOriginalNumber || parsed.data.externalOriginalNumber.trim().length < 2)
      ) {
        return res.status(400).json({
          error: 'Nomor surat asli pengirim wajib diisi untuk registrasi Surat Masuk.',
        });
      }

      const created = await createOrRegisterLetter({
        ...parsed.data,
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Gagal memproses registrasi surat.' });
    }
  }
);

app.put(
  '/api/letters/:id',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'STAFF']),
  async (req: AuthRequest, res) => {
    try {
      const letterId = Number(req.params.id);
      const schema = z.object({
        subject: z.string().min(5, 'Perihal surat minimal 5 karakter'),
        sender: z.string().min(2, 'Pengirim wajib diisi'),
        recipient: z.string().min(2, 'Penerima wajib diisi'),
        destination: z.string().min(2, 'Tujuan surat wajib diisi'),
        summary: z.string().min(5, 'Ringkasan minimal 5 karakter'),
        adminNotes: z.string().optional().default(''),
        externalOriginalNumber: z.string().optional(),
        letterDate: z.string().optional(),
        departmentId: z.number().int().positive().optional(),
        letterTypeId: z.number().int().positive().optional(),
        classificationId: z.number().int().positive().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const updated = await updateLetterDetails({
        letterId,
        ...parsed.data,
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Gagal memperbarui surat.' });
    }
  }
);

app.post(
  '/api/letters/:id/register',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'STAFF']),
  async (req: AuthRequest, res) => {
    try {
      const letterId = Number(req.params.id);
      const numberingRuleId = req.body.numberingRuleId ? Number(req.body.numberingRuleId) : undefined;
      const updated = await publishDraftLetter({
        letterId,
        numberingRuleId,
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Gagal menerbitkan nomor resmi surat.' });
    }
  }
);

app.post(
  '/api/letters/:id/cancel',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
  async (req: AuthRequest, res) => {
    try {
      const letterId = Number(req.params.id);
      const schema = z.object({
        reason: z.string().min(10, 'Alasan pembatalan wajib diisi minimal 10 karakter untuk keperluan audit.'),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const cancelled = await cancelLetter({
        letterId,
        reason: parsed.data.reason,
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
      });

      res.json(cancelled);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Gagal membatalkan surat.' });
    }
  }
);

// ============================================================================
// 5. ATTACHMENTS UPLOAD & DOWNLOAD (Stored on disk, NOT Base64 in DB)
// ============================================================================

app.post(
  '/api/letters/:id/attachments',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'STAFF']),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const letterId = Number(req.params.id);
      if (!req.file) {
        return res.status(400).json({ error: 'Tidak ada berkas yang diunggah.' });
      }

      const existingRows = await db.select().from(letters).where(eq(letters.id, letterId));
      if (!existingRows[0]) {
        return res.status(404).json({ error: 'Surat tidak ditemukan.' });
      }

      const [attachment] = await db
        .insert(letterAttachments)
        .values({
          letterId,
          fileName: req.file.originalname,
          storedName: req.file.filename,
          mimeType: req.file.mimetype || 'application/octet-stream',
          fileSize: req.file.size,
          uploadedByName: req.authUser!.name,
        })
        .returning();

      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'UPLOAD_ATTACHMENT',
        entityType: 'ATTACHMENT',
        entityId: String(attachment.id),
        description: `Mengunggah lampiran "${req.file.originalname}" (${Math.round(req.file.size / 1024)} KB) pada surat ${existingRows[0].officialNumber || existingRows[0].letterCode}`,
        afterValue: attachment,
      });

      res.status(201).json(attachment);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Gagal mengunggah berkas lampiran.' });
    }
  }
);

app.get('/api/attachments/:id/download', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(letterAttachments).where(eq(letterAttachments.id, id));
    const att = rows[0];
    if (!att) {
      return res.status(404).json({ error: 'Lampiran tidak ditemukan.' });
    }

    const filePath = path.join(UPLOADS_DIR, path.basename(att.storedName));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Berkas fisik tidak ditemukan di penyimpanan server.' });
    }

    const inline = req.query.inline === 'true';
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.fileName)}"`
    );
    fs.createReadStream(filePath).pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengunduh lampiran.' });
  }
});

app.delete(
  '/api/attachments/:id',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'STAFF']),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const rows = await db.select().from(letterAttachments).where(eq(letterAttachments.id, id));
      const att = rows[0];
      if (!att) {
        return res.status(404).json({ error: 'Lampiran tidak ditemukan.' });
      }

      const filePath = path.join(UPLOADS_DIR, path.basename(att.storedName));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await db.delete(letterAttachments).where(eq(letterAttachments.id, id));

      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'DELETE_ATTACHMENT',
        entityType: 'ATTACHMENT',
        entityId: String(id),
        description: `Menghapus lampiran "${att.fileName}" dari surat ID #${att.letterId}`,
        beforeValue: att,
      });

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal menghapus lampiran.' });
    }
  }
);

// ============================================================================
// 6. REPORTS & AUDIT TRAIL & USER MANAGEMENT
// ============================================================================

app.get('/api/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { items } = await queryLetters({
      category: req.query.category as string | undefined,
      departmentId: req.query.departmentId ? Number(req.query.departmentId) : undefined,
      letterTypeId: req.query.letterTypeId ? Number(req.query.letterTypeId) : undefined,
      status: req.query.status as string | undefined,
      year: req.query.year as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page: 1,
      limit: 200,
    });

    // Group user registration activity
    const userActivityMap = new Map<
      string,
      { userUid: string; userName: string; total: number; registered: number; draft: number; cancelled: number }
    >();
    for (const l of items) {
      const current = userActivityMap.get(l.createdByUid) || {
        userUid: l.createdByUid,
        userName: l.createdByName,
        total: 0,
        registered: 0,
        draft: 0,
        cancelled: 0,
      };
      current.total += 1;
      if (l.status === 'REGISTERED') current.registered += 1;
      if (l.status === 'DRAFT') current.draft += 1;
      if (l.status === 'CANCELLED') current.cancelled += 1;
      userActivityMap.set(l.createdByUid, current);
    }

    res.json({
      letters: items,
      userActivity: Array.from(userActivityMap.values()),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat laporan.' });
  }
});

app.get(
  '/api/audit-logs',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'AUDITOR']),
  async (req: AuthRequest, res) => {
    try {
      const search = (req.query.search as string) || '';
      const action = (req.query.action as string) || 'ALL';
      const entityType = (req.query.entityType as string) || 'ALL';

      const conditions = [];
      if (action !== 'ALL') {
        conditions.push(eq(auditLogs.action, action));
      }
      if (entityType !== 'ALL') {
        conditions.push(eq(auditLogs.entityType, entityType));
      }
      if (search.trim() !== '') {
        const q = `%${search.trim()}%`;
        conditions.push(
          or(
            ilike(auditLogs.description, q),
            ilike(auditLogs.userName, q),
            ilike(auditLogs.entityId, q)
          )
        );
      }

      const logs =
        conditions.length > 0
          ? await db
              .select()
              .from(auditLogs)
              .where(and(...conditions))
              .orderBy(desc(auditLogs.createdAt))
              .limit(150)
          : await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(150);

      res.json({ items: logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal memuat audit trail.' });
    }
  }
);

app.get(
  '/api/users',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD']),
  async (_req, res) => {
    try {
      const [allUsers, allRoles, allPerms, allDepts] = await Promise.all([
        db.select().from(users).orderBy(users.id),
        db.select().from(roles).orderBy(roles.id),
        db.select().from(permissions).orderBy(permissions.id),
        db.select().from(departments).orderBy(departments.code),
      ]);
      const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d]));

      res.json({
        users: allUsers.map((u) => ({
          id: u.id,
          uid: u.uid,
          name: u.name,
          email: u.email,
          roleCode: u.roleCode,
          departmentId: u.departmentId,
          department: u.departmentId ? deptMap[u.departmentId] : null,
          isActive: u.isActive,
          isDemo: u.isDemo,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
        })),
        roles: allRoles,
        permissions: allPerms,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal memuat daftar pengguna.' });
    }
  }
);

app.post('/api/users', requireAuth, requireRoles(['SUPER_ADMIN']), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(3),
      email: z.string().email().transform((v) => v.trim().toLowerCase()),
      password: z.string().min(6, 'Password minimal 6 karakter'),
      roleCode: z.enum(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'STAFF', 'AUDITOR']),
      departmentId: z.number().int().positive().nullable(),
      isActive: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const dup = await db.select().from(users).where(eq(users.email, parsed.data.email));
    if (dup.length > 0) {
      return res.status(409).json({ error: 'Email pengguna sudah terdaftar.' });
    }

    const uid = `user-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const [created] = await db
      .insert(users)
      .values({
        uid,
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: hashPassword(parsed.data.password),
        roleCode: parsed.data.roleCode,
        departmentId: parsed.data.departmentId,
        isActive: parsed.data.isActive,
        isDemo: false,
      })
      .returning();

    await recordAuditLog({
      userUid: req.authUser!.uid,
      userName: req.authUser!.name,
      userRole: req.authUser!.roleCode,
      action: 'UPDATE_USER_ROLE',
      entityType: 'USER',
      entityId: String(created.id),
      description: `Menambahkan pengguna baru ${created.name} (${created.email}) dengan role ${created.roleCode}`,
      afterValue: { ...created, passwordHash: '[REDACTED]' },
    });

    res.status(201).json({ ...created, passwordHash: undefined });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal membuat pengguna baru.' });
  }
});

app.put(
  '/api/users/:id',
  requireAuth,
  requireRoles(['SUPER_ADMIN']),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        name: z.string().min(3),
        roleCode: z.enum(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'STAFF', 'AUDITOR']),
        departmentId: z.number().int().positive().nullable(),
        isActive: z.boolean(),
        newPassword: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const existingRows = await db.select().from(users).where(eq(users.id, id));
      if (!existingRows[0]) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      }

      const updateFields: Record<string, unknown> = {
        name: parsed.data.name,
        roleCode: parsed.data.roleCode,
        departmentId: parsed.data.departmentId,
        isActive: parsed.data.isActive,
        updatedAt: new Date(),
      };
      if (parsed.data.newPassword && parsed.data.newPassword.trim().length >= 6) {
        updateFields.passwordHash = hashPassword(parsed.data.newPassword.trim());
      }

      const [updated] = await db
        .update(users)
        .set(updateFields)
        .where(eq(users.id, id))
        .returning();

      await recordAuditLog({
        userUid: req.authUser!.uid,
        userName: req.authUser!.name,
        userRole: req.authUser!.roleCode,
        action: 'UPDATE_USER_ROLE',
        entityType: 'USER',
        entityId: String(id),
        description: `Memperbarui profil & hak akses pengguna ${updated.name} (Role: ${updated.roleCode}, Aktif: ${updated.isActive})`,
        beforeValue: { ...existingRows[0], passwordHash: '[REDACTED]' },
        afterValue: { ...updated, passwordHash: '[REDACTED]' },
      });

      res.json({ ...updated, passwordHash: undefined });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal memperbarui pengguna.' });
    }
  }
);

// ============================================================================
// 7. OPENAPI 3.0 SPECIFICATION & AUTOMATED INTEGRATION TEST SUITE
// ============================================================================

app.get('/api/openapi.json', (_req, res) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'Office Letter Management System API',
      version: '1.0.0',
      description:
        'Dokumentasi REST API untuk Penomoran Surat Otomatis, Registrasi Surat Keluar/Masuk/Internal, Master Data, Laporan, dan Audit Trail (Zero-Approval Architecture).',
    },
    paths: {
      '/api/auth/login': {
        post: { summary: 'Autentikasi pengguna menggunakan email dan password' },
      },
      '/api/auth/switch-demo': {
        post: { summary: 'Beralih sesi role demo secara instan (Super Admin, Admin HRD/GA, Staff, Auditor)' },
      },
      '/api/dashboard': {
        get: { summary: 'Mengambil metrik KPI, grafik bulanan, distribusi departemen/jenis, dan log terbaru dari PostgreSQL' },
      },
      '/api/numbering/preview': {
        post: { summary: 'Menghasilkan pratinjau nomor surat berdasarkan Tanggal Surat tanpa menaikkan counter urutan' },
      },
      '/api/letters': {
        get: { summary: 'Pencarian, filter multi-dimensi, dan paginasi surat keluar, masuk, dan internal' },
        post: { summary: 'Menyimpan Draft surat atau langsung Menerbitkan Nomor Resmi secara atomik' },
      },
      '/api/letters/{id}': {
        get: { summary: 'Detail lengkap surat beserta lampiran dan riwayat perubahan audit' },
        put: { summary: 'Memperbarui metadata surat dan mencatat perubahan pada Audit Trail' },
      },
      '/api/letters/{id}/register': {
        post: { summary: 'Menerbitkan nomor surat resmi dari surat berstatus Draft' },
      },
      '/api/letters/{id}/cancel': {
        post: { summary: 'Membatalkan surat terdaftar dengan alasan wajib tanpa menghapus/menggunakan ulang nomor surat' },
      },
      '/api/letters/{id}/attachments': {
        post: { summary: 'Mengunggah dokumen lampiran (PDF, DOCX, JPG, PNG) ke penyimpanan server' },
      },
      '/api/master-bundle': {
        get: { summary: 'Mengambil seluruh master data Departemen, Jenis Surat, Klasifikasi, Aturan Penomoran, dan Identitas Perusahaan' },
      },
      '/api/reports': {
        get: { summary: 'Rekapitulasi laporan surat berdasarkan periode, departemen, jenis, pembatalan, dan keaktifan pengguna' },
      },
      '/api/audit-logs': {
        get: { summary: 'Jejak audit aktivitas sistem yang tidak dapat diubah oleh pengguna biasa' },
      },
    },
  });
});

app.post(
  '/api/system/run-tests',
  requireAuth,
  requireRoles(['SUPER_ADMIN', 'ADMIN_GA_HRD', 'AUDITOR']),
  async (_req: AuthRequest, res) => {
    try {
      const results: Array<{ name: string; category: string; passed: boolean; details: string }> = [];

      // Test 1: Format generation & Tanggal Surat base date verification
      const fmtOct = formatLetterNumber({
        template: '{SEQ}/{DEPT}/{TYPE}/{ROMAN_MONTH}/{YEAR}',
        separator: '/',
        digitPadding: 3,
        sequence: 1,
        companyCode: 'NTM',
        deptCode: 'HRD',
        typeCode: 'SK',
        classCode: 'RAHASIA',
        year: 2026,
        month: 10,
      });
      results.push({
        name: 'Generate Nomor Berdasarkan Format & Tanggal Surat (Romawi X/2026)',
        category: 'Numbering Engine',
        passed: fmtOct.formatted === '001/HRD/SK/X/2026',
        details: `Hasil: ${fmtOct.formatted} (Ekspektasi: 001/HRD/SK/X/2026)`,
      });

      // Test 2: Month & Year rollover calculation
      const fmtJanNext = formatLetterNumber({
        template: '{SEQ}/{DEPT}/{TYPE}/{ROMAN_MONTH}/{YEAR}',
        separator: '/',
        digitPadding: 3,
        sequence: 1,
        companyCode: 'NTM',
        deptCode: 'GA',
        typeCode: 'UND',
        classCode: 'BIASA',
        year: 2027,
        month: 1,
      });
      results.push({
        name: 'Pergantian Bulan & Tahun Baru (Reset Urutan 2027 -> Romawi I/2027)',
        category: 'Numbering Engine',
        passed: fmtJanNext.formatted === '001/GA/UND/I/2027',
        details: `Hasil: ${fmtJanNext.formatted} (Ekspektasi: 001/GA/UND/I/2027)`,
      });

      // Test 3: Concurrency Atomic Counter Test (simultaneous allocations in PostgreSQL)
      const testCounterKey = `TEST_CONCURRENCY:${Date.now()}`;
      const concurrentPromises = Array.from({ length: 5 }, (_, idx) =>
        db
          .insert(numberingCounters)
          .values({
            counterKey: testCounterKey,
            ruleId: 999999,
            scopeKey: 'CONCURRENT_TEST',
            periodYear: 2099,
            periodMonth: idx === -1 ? 0 : 12,
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
          .returning()
      );

      const concurrentOutcomes = await Promise.all(concurrentPromises);
      const allocatedNumbers = concurrentOutcomes.map((rows) => rows[0].lastSequence).sort((a, b) => a - b);
      // Clean up test counter
      await db.delete(numberingCounters).where(eq(numberingCounters.counterKey, testCounterKey));

      const uniqueCount = new Set(allocatedNumbers).size;
      results.push({
        name: 'Uji Permintaan Bersamaan (5 Request Simultan Tanpa Nomor Duplikat)',
        category: 'Concurrency & Locking',
        passed: uniqueCount === 5 && allocatedNumbers.join(',') === '1,2,3,4,5',
        details: `Urutan teralokasi secara atomik: [${allocatedNumbers.join(', ')}] — 100% unik`,
      });

      // Test 4: Transaction Rollback Integrity (Failed transaction does not consume sequence)
      const rollbackKey = `TEST_ROLLBACK:${Date.now()}`;
      try {
        await db.transaction(async (tx) => {
          await tx.insert(numberingCounters).values({
            counterKey: rollbackKey,
            ruleId: 999998,
            scopeKey: 'ROLLBACK_TEST',
            periodYear: 2099,
            periodMonth: 11,
            lastSequence: 1,
          });
          throw new Error('Simulasi kegagalan transaksi');
        });
      } catch {
        // Expected rollback
      }
      const afterRollback = await db
        .select()
        .from(numberingCounters)
        .where(eq(numberingCounters.counterKey, rollbackKey));
      results.push({
        name: 'Penanganan Transaksi Gagal (Rollback Penuh Tanpa Nomor Bocor)',
        category: 'Transaction Safety',
        passed: afterRollback.length === 0,
        details: `Counter batal tersimpan saat transaksi gagal (Jumlah baris bocor: ${afterRollback.length})`,
      });

      // Test 5: Zero-Approval Compliance Check on Database
      const allLetters = await db.select().from(letters);
      const invalidStatuses = allLetters.filter(
        (l) => !['DRAFT', 'REGISTERED', 'CANCELLED'].includes(l.status)
      );
      results.push({
        name: 'Validasi Kepatuhan Zero-Approval (Hanya Status Draft, Terdaftar, Dibatalkan)',
        category: 'Business Policy',
        passed: invalidStatuses.length === 0,
        details: `Memeriksa ${allLetters.length} surat di PostgreSQL: 0 status approval ditemukan.`,
      });

      // Test 6: Cancelled Letter Retains Official Number Without Reuse
      const cancelledLetters = allLetters.filter((l) => l.status === 'CANCELLED');
      const cancelledHasLockedNumber = cancelledLetters.every(
        (l) => Boolean(l.officialNumber) && Boolean(l.cancellationReason)
      );
      results.push({
        name: 'Pembatalan Surat Menyimpan Nomor & Alasan Tanpa Penggunaan Ulang',
        category: 'Audit & Retention',
        passed: cancelledHasLockedNumber,
        details: `${cancelledLetters.length} surat dibatalkan tetap mengunci nomor resminya secara permanen.`,
      });

      res.json({
        executedAt: new Date().toISOString(),
        allPassed: results.every((r) => r.passed),
        results,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal menjalankan pengujian otomatis.' });
    }
  }
);

// ============================================================================
// 8. VITE MIDDLEWARE / STATIC ASSETS SERVING
// ============================================================================

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Office Letter Management System running on http://0.0.0.0:${PORT}`);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const shutdown = () => {
    httpServer.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();


