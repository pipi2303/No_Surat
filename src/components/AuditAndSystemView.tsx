import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Code2,
  Edit3,
  History,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { AuditLogItem, Department, RoleCode, UserProfile } from '../types.ts';

interface AuditAndSystemViewProps {
  mode: 'AUDIT' | 'USERS' | 'SETTINGS';
  departments: Department[];
  userRole: RoleCode;
  onToast: (message: string) => void;
}

export function AuditAndSystemView({
  mode,
  departments,
  userRole,
  onToast,
}: AuditAndSystemViewProps) {
  // 1. Audit Trail State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('ALL');
  const [auditEntity, setAuditEntity] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // 2. Users Management State
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [rolesList, setRolesList] = useState<
    Array<{ id: number; code: string; name: string; description: string }>
  >([]);
  const [permissionsList, setPermissionsList] = useState<
    Array<{ id: number; code: string; name: string; module: string; roleCodes: string }>
  >([]);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRole, setURole] = useState<RoleCode>('STAFF');
  const [uDeptId, setUDeptId] = useState<string>('');
  const [uActive, setUActive] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  // 3. Automated Integration Test Runner & OpenAPI State
  const [testReport, setTestReport] = useState<{
    executedAt: string;
    allPassed: boolean;
    results: Array<{ name: string; category: string; passed: boolean; details: string }>;
  } | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [openApiSpec, setOpenApiSpec] = useState<any>(null);

  const loadAudits = async () => {
    setLoadingAudit(true);
    try {
      const params = new URLSearchParams();
      if (auditSearch.trim()) params.set('search', auditSearch.trim());
      if (auditAction !== 'ALL') params.set('action', auditAction);
      if (auditEntity !== 'ALL') params.set('entityType', auditEntity);
      const res = await apiRequest<{ items: AuditLogItem[] }>(
        `/api/audit-logs?${params.toString()}`
      );
      setAuditLogs(res.items);
    } catch {
      // handled
    } finally {
      setLoadingAudit(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await apiRequest<{
        users: UserProfile[];
        roles: typeof rolesList;
        permissions: typeof permissionsList;
      }>('/api/users');
      setUsersList(res.users);
      setRolesList(res.roles);
      setPermissionsList(res.permissions);
    } catch {
      // handled
    }
  };

  const loadOpenApi = async () => {
    try {
      const spec = await apiRequest('/api/openapi.json');
      setOpenApiSpec(spec);
    } catch {
      // handled
    }
  };

  useEffect(() => {
    if (mode === 'AUDIT') loadAudits();
    if (mode === 'USERS') loadUsers();
    if (mode === 'SETTINGS') loadOpenApi();
  }, [mode, auditAction, auditEntity]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    try {
      if (editingUserId) {
        await apiRequest(`/api/users/${editingUserId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: uName.trim(),
            roleCode: uRole,
            departmentId: uDeptId ? Number(uDeptId) : null,
            isActive: uActive,
            newPassword: uPassword.trim() ? uPassword.trim() : undefined,
          }),
        });
        onToast('Hak akses & profil pengguna berhasil diperbarui.');
      } else {
        await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            name: uName.trim(),
            email: uEmail.trim(),
            password: uPassword,
            roleCode: uRole,
            departmentId: uDeptId ? Number(uDeptId) : null,
            isActive: uActive,
          }),
        });
        onToast('Pengguna baru berhasil ditambahkan.');
      }
      setEditingUserId(null);
      setUName('');
      setUEmail('');
      setUPassword('');
      loadUsers();
    } catch (err: any) {
      setUserError(err.message);
    }
  };

  const handleRunIntegrationTests = async () => {
    setRunningTests(true);
    try {
      const res = await apiRequest<typeof testReport>('/api/system/run-tests', {
        method: 'POST',
      });
      setTestReport(res);
      onToast('Seluruh pengujian otomatis database & numbering engine selesai dijalankan.');
    } catch (err: any) {
      onToast(err.message || 'Gagal menjalankan pengujian otomatis.');
    } finally {
      setRunningTests(false);
    }
  };

  // ============================================================================
  // VIEW 1: AUDIT TRAIL
  // ============================================================================
  if (mode === 'AUDIT') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Jejak Audit Sistem (Immutable Audit Trail)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mencatat seluruh aktivitas login, pembuatan draft, penerbitan nomor surat, pembatalan,
              lampiran, dan perubahan konfigurasi beserta nilai sebelum & sesudah perubahan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadAudits()}
                placeholder="Cari pengguna, nomor, aktivitas..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <select
              value={auditAction}
              onChange={(e) => setAuditAction(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="ALL">Semua Jenis Aktivitas</option>
              <option value="REGISTER_LETTER">REGISTER_LETTER (Penerbitan Nomor)</option>
              <option value="CREATE_DRAFT">CREATE_DRAFT (Pembuatan Draft)</option>
              <option value="UPDATE_LETTER">UPDATE_LETTER (Perubahan Surat)</option>
              <option value="CANCEL_LETTER">CANCEL_LETTER (Pembatalan Surat)</option>
              <option value="UPLOAD_ATTACHMENT">UPLOAD_ATTACHMENT (Lampiran)</option>
              <option value="UPDATE_NUMBERING_RULE">UPDATE_NUMBERING_RULE (Aturan Nomor)</option>
              <option value="UPDATE_MASTER_DATA">UPDATE_MASTER_DATA (Master Data)</option>
              <option value="UPDATE_USER_ROLE">UPDATE_USER_ROLE (Hak Akses)</option>
              <option value="LOGIN">LOGIN</option>
            </select>

            <button
              type="button"
              onClick={loadAudits}
              className="p-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingAudit ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Waktu Aktivitas</th>
                  <th className="py-3 px-4">Pengguna & Role</th>
                  <th className="py-3 px-4">Aksi & Entitas</th>
                  <th className="py-3 px-4">Rincian Aktivitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {auditLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`hover:bg-slate-50 cursor-pointer ${
                      selectedLog?.id === log.id ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{log.userName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{log.userRole}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                      <span className="font-bold text-blue-700">{log.action}</span>
                      <div className="text-slate-400">
                        {log.entityType} #{log.entityId}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-800">
                      <div>{log.description}</div>
                      {log.reason && (
                        <div className="text-[11px] text-red-600 font-medium mt-0.5">
                          Alasan Pembatalan: {log.reason}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Audit Payload Diff Inspector */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 self-start space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Inspektor Data Audit (Sebelum & Sesudah)
            </h3>
            {!selectedLog ? (
              <p className="text-xs text-slate-500">
                Klik salah satu baris log di sebelah kiri untuk melihat perbandingan nilai sebelum
                dan sesudah perubahan.
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="font-mono text-[11px] text-blue-700 font-bold">
                    LOG #{selectedLog.id} · {selectedLog.action}
                  </div>
                  <div className="font-semibold text-slate-900">{selectedLog.description}</div>
                  <div className="text-[11px] text-slate-500">
                    Oleh: {selectedLog.userName} ({selectedLog.userRole})
                  </div>
                </div>

                {selectedLog.reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                    <span className="font-bold">Alasan Resmi:</span> {selectedLog.reason}
                  </div>
                )}

                {selectedLog.beforeValueJson && (
                  <div>
                    <div className="text-[11px] font-bold text-slate-600 mb-1">
                      Nilai Sebelum Perubahan (Before):
                    </div>
                    <pre className="p-2.5 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono overflow-x-auto max-h-44">
                      {JSON.stringify(JSON.parse(selectedLog.beforeValueJson), null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.afterValueJson && (
                  <div>
                    <div className="text-[11px] font-bold text-slate-600 mb-1">
                      Nilai Sesudah Perubahan (After):
                    </div>
                    <pre className="p-2.5 bg-slate-900 text-emerald-300 rounded-lg text-[10px] font-mono overflow-x-auto max-h-44">
                      {JSON.stringify(JSON.parse(selectedLog.afterValueJson), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: USER & RBAC MANAGEMENT
  // ============================================================================
  if (mode === 'USERS') {
    const isSuperAdmin = userRole === 'SUPER_ADMIN';
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Manajemen Pengguna & Hak Akses Berbasis Peran (RBAC)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pembatasan akses ditegakkan langsung di sisi server (backend middleware) sesuai peran
            Super Admin, Admin HRD/GA, Staff, dan Auditor.
          </p>
        </div>

        {userError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {userError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {isSuperAdmin && (
            <form
              onSubmit={handleSaveUser}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 self-start"
            >
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-700" />
                <span>{editingUserId ? 'Edit Pengguna & Role' : 'Tambah Pengguna Baru'}</span>
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              {!editingUserId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Perusahaan
                  </label>
                  <input
                    type="email"
                    required
                    value={uEmail}
                    onChange={(e) => setUEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingUserId ? 'Password Baru (Kosongkan jika tetap)' : 'Password'}
                </label>
                <input
                  type="password"
                  required={!editingUserId}
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Peran (Role RBAC)
                </label>
                <select
                  value={uRole}
                  onChange={(e) => setURole(e.target.value as RoleCode)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Super Admin)</option>
                  <option value="ADMIN_GA_HRD">ADMIN_GA_HRD (Admin HRD / GA / Sekretariat)</option>
                  <option value="STAFF">STAFF (Staff Departemen)</option>
                  <option value="AUDITOR">AUDITOR (Viewer / Auditor)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Departemen
                </label>
                <select
                  value={uDeptId}
                  onChange={(e) => setUDeptId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">Lintas Departemen / Korporat</option>
                  {departments.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uActive}
                  onChange={(e) => setUActive(e.target.checked)}
                />
                <span>Status Akun Aktif</span>
              </label>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {editingUserId ? 'Simpan Perubahan' : 'Buat Akun Pengguna'}
                </button>
                {editingUserId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUserId(null);
                      setUName('');
                      setUEmail('');
                      setUPassword('');
                    }}
                    className="py-2 px-3 bg-slate-100 text-slate-700 text-xs rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          )}

          <div
            className={`${
              isSuperAdmin ? 'lg:col-span-8' : 'lg:col-span-12'
            } space-y-6`}
          >
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-3 px-4">Nama & Email</th>
                    <th className="py-3 px-4">Role RBAC</th>
                    <th className="py-3 px-4">Departemen</th>
                    <th className="py-3 px-4">Status</th>
                    {isSuperAdmin && <th className="py-3 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {u.name} {u.isDemo && <span className="text-blue-700">[Akun Demo]</span>}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{u.roleCode}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {u.department ? `${u.department.code} - ${u.department.name}` : 'Korporat'}
                      </td>
                      <td className="py-3 px-4">
                        {u.isActive ? (
                          <span className="text-emerald-700 font-semibold">Aktif</span>
                        ) : (
                          <span className="text-red-600 font-semibold">Nonaktif</span>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUserId(u.id);
                              setUName(u.name);
                              setUEmail(u.email);
                              setURole(u.roleCode);
                              setUDeptId(u.departmentId ? String(u.departmentId) : '');
                              setUActive(u.isActive);
                            }}
                            className="inline-flex items-center gap-1 text-blue-700 hover:underline cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Matrix Izin RBAC */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                <h4 className="text-xs font-bold text-slate-900">
                  Matriks Hak Akses (Role-Permission Matrix)
                </h4>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Kode Izin</th>
                    <th className="py-2.5 px-4">Modul & Deskripsi</th>
                    <th className="py-2.5 px-4">Role yang Diizinkan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {permissionsList.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                        {p.code}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-slate-800">{p.module}:</span> {p.name}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-blue-700">
                        {JSON.parse(p.roleCodes).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 3: SETTINGS, AUTOMATED TESTS, OPENAPI & DOCKER GUIDE
  // ============================================================================
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Pengaturan Sistem, Pengujian Otomatis & Dokumentasi API
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verifikasi integritas mesin penomoran otomatis, transaksi database PostgreSQL,
            spesifikasi OpenAPI 3.0, dan panduan kontainerisasi Docker.
          </p>
        </div>

        <button
          type="button"
          disabled={runningTests}
          onClick={handleRunIntegrationTests}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer self-start md:self-auto"
        >
          <Play className="w-4 h-4" />
          <span>
            {runningTests
              ? 'Menjalankan Uji Integrasi Database...'
              : 'Jalankan Automated Integration Tests'}
          </span>
        </button>
      </div>

      {/* Automated Integration Test Results */}
      {testReport && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Hasil Pengujian Otomatis Fungsi Kritis (PostgreSQL Live Integration Tests)
              </h3>
            </div>
            <span className="text-xs font-mono text-emerald-700 font-bold">
              {testReport.allPassed ? 'SEMUA TEST LULUS (100% PASSED)' : 'PERIKSA HASIL'}
            </span>
          </div>
          <div className="divide-y divide-slate-200 text-xs">
            {testReport.results.map((r, i) => (
              <div key={i} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    {r.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{r.name}</span>
                  </div>
                  <div className="text-slate-600 pl-6 font-mono text-[11px]">{r.details}</div>
                </div>
                <span className="font-mono text-[11px] text-slate-500 shrink-0">{r.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OpenAPI & Docker Deployment Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Spesifikasi REST API (OpenAPI 3.0.3 — /api/openapi.json)
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Endpoint REST API terproteksi autentikasi Bearer Token dan validasi skema Zod.
          </p>
          <pre className="p-3.5 bg-slate-900 text-slate-200 rounded-lg text-[11px] font-mono overflow-x-auto max-h-80">
            {openApiSpec ? JSON.stringify(openApiSpec, null, 2) : 'Memuat spesifikasi OpenAPI...'}
          </pre>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Panduan Menjalankan Aplikasi & Docker Deployment
            </h3>
          </div>
          <div className="space-y-3 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="font-bold text-slate-900 mb-1">
                1. Asumsi Bisnis yang Diterapkan:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>
                  Dasar bulan dan tahun penomoran selalu menggunakan <b>Tanggal Surat</b>.
                </li>
                <li>
                  <b>Surat Masuk</b> menyimpan Nomor Surat Asli Pengirim sekaligus memperoleh Nomor
                  Registrasi Internal otomatis.
                </li>
                <li>
                  <b>Zero-Approval Policy:</b> Tidak ada status menunggu persetujuan; hanya{' '}
                  <span className="font-mono">Draft</span>,{' '}
                  <span className="font-mono">Terdaftar</span>, dan{' '}
                  <span className="font-mono">Dibatalkan</span>.
                </li>
                <li>
                  Surat yang dibatalkan tetap menyimpan nomor resminya agar nomor tidak pernah
                  digunakan ulang.
                </li>
              </ul>
            </div>

            <div>
              <div className="font-bold text-slate-900 mb-1">
                2. Menjalankan dengan Docker Compose (Produksi):
              </div>
              <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg text-[11px] font-mono overflow-x-auto">
{`# Build dan jalankan aplikasi beserta PostgreSQL 16
docker compose up -d --build

# Aplikasi berjalan pada:
http://localhost:3000`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
