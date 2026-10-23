import React, { useState } from 'react';
import {
  Building2,
  Check,
  Edit3,
  FileCog,
  Hash,
  Layers,
  Plus,
  Save,
  Shield,
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import {
  CompanySettings,
  Department,
  LetterClassification,
  LetterType,
  NumberingCounter,
  NumberingRule,
  RoleCode,
} from '../types.ts';

interface MasterDataViewProps {
  activeSubTab: 'DEPARTMENTS' | 'TYPES' | 'CLASSIFICATIONS' | 'RULES' | 'COMPANY';
  onChangeSubTab: (tab: 'DEPARTMENTS' | 'TYPES' | 'CLASSIFICATIONS' | 'RULES' | 'COMPANY') => void;
  departments: Department[];
  letterTypes: LetterType[];
  classifications: LetterClassification[];
  numberingRules: NumberingRule[];
  numberingCounters: NumberingCounter[];
  companySettings: CompanySettings | null;
  userRole: RoleCode;
  onRefreshMaster: (toastMessage?: string) => void;
}

export function MasterDataView({
  activeSubTab,
  onChangeSubTab,
  departments,
  letterTypes,
  classifications,
  numberingRules,
  numberingCounters,
  companySettings,
  userRole,
  onRefreshMaster,
}: MasterDataViewProps) {
  const canEdit = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_GA_HRD';
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Department Form State
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptActive, setDeptActive] = useState(true);

  // Letter Type Form State
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [typeCode, setTypeCode] = useState('');
  const [typeName, setTypeName] = useState('');
  const [typeCats, setTypeCats] = useState<string[]>(['OUTGOING', 'INTERNAL']);
  const [typeDesc, setTypeDesc] = useState('');
  const [typeActive, setTypeActive] = useState(true);

  // Classification Form State
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [classLevel, setClassLevel] = useState<
    'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICTLY_CONFIDENTIAL'
  >('PUBLIC');
  const [classDesc, setClassDesc] = useState('');
  const [classActive, setClassActive] = useState(true);

  // Numbering Rule Form State
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleCategory, setRuleCategory] = useState<'OUTGOING' | 'INCOMING' | 'INTERNAL' | 'ALL'>(
    'OUTGOING'
  );
  const [ruleTemplate, setRuleTemplate] = useState('{SEQ}/{DEPT}/{TYPE}/{ROMAN_MONTH}/{YEAR}');
  const [ruleScope, setRuleScope] = useState<
    'GLOBAL' | 'DEPARTMENT' | 'LETTER_TYPE' | 'DEPT_AND_TYPE'
  >('DEPT_AND_TYPE');
  const [ruleReset, setRuleReset] = useState<'YEARLY' | 'MONTHLY' | 'NEVER'>('YEARLY');
  const [ruleDigits, setRuleDigits] = useState(3);
  const [ruleSeparator, setRuleSeparator] = useState('/');
  const [ruleEffective, setRuleEffective] = useState('2026-01-01');
  const [ruleActive, setRuleActive] = useState(true);

  // Company Identity State
  const [compName, setCompName] = useState(
    companySettings?.companyName || 'PT Nusantara Teknologi Mandiri'
  );
  const [compCode, setCompCode] = useState(companySettings?.companyCode || 'NTM');
  const [compAddress, setCompAddress] = useState(companySettings?.address || '');
  const [compPhone, setCompPhone] = useState(companySettings?.phone || '');
  const [compEmail, setCompEmail] = useState(companySettings?.email || '');
  const [compWeb, setCompWeb] = useState(companySettings?.website || '');
  const [compNpwp, setCompNpwp] = useState(companySettings?.npwpOrRegNumber || '');

  // Live Rule Simulation
  const simulatedExample = ruleTemplate
    .replace(/\//g, ruleSeparator || '/')
    .replace(/\{SEQ\}/g, '1'.padStart(ruleDigits || 3, '0'))
    .replace(/\{COMP\}/g, companySettings?.companyCode || 'NTM')
    .replace(/\{DEPT\}/g, 'HRD')
    .replace(/\{TYPE\}/g, 'SK')
    .replace(/\{CLASS\}/g, 'RAHASIA')
    .replace(/\{ROMAN_MONTH\}/g, 'X')
    .replace(/\{MONTH\}/g, '10')
    .replace(/\{YEAR\}/g, '2026');

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        code: deptCode.trim().toUpperCase(),
        name: deptName.trim(),
        description: deptDesc.trim(),
        isActive: deptActive,
      };
      if (editingDeptId) {
        await apiRequest(`/api/departments/${editingDeptId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/departments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditingDeptId(null);
      setDeptCode('');
      setDeptName('');
      setDeptDesc('');
      setDeptActive(true);
      onRefreshMaster('Data departemen berhasil disimpan.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLetterType = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (typeCats.length === 0) {
      setError('Pilih minimal satu kategori surat yang diizinkan.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: typeCode.trim().toUpperCase(),
        name: typeName.trim(),
        allowedCategories: typeCats.join(','),
        description: typeDesc.trim(),
        isActive: typeActive,
      };
      if (editingTypeId) {
        await apiRequest(`/api/letter-types/${editingTypeId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/letter-types', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditingTypeId(null);
      setTypeCode('');
      setTypeName('');
      setTypeDesc('');
      setTypeActive(true);
      onRefreshMaster('Data jenis surat berhasil disimpan.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClassification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        code: classCode.trim().toUpperCase(),
        name: className.trim(),
        confidentialityLevel: classLevel,
        description: classDesc.trim(),
        isActive: classActive,
      };
      if (editingClassId) {
        await apiRequest(`/api/classifications/${editingClassId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/classifications', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditingClassId(null);
      setClassCode('');
      setClassName('');
      setClassDesc('');
      onRefreshMaster('Data klasifikasi surat berhasil disimpan.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name: ruleName.trim(),
        category: ruleCategory,
        formatTemplate: ruleTemplate.trim(),
        scopeType: ruleScope,
        resetPeriod: ruleReset,
        digitPadding: Number(ruleDigits),
        separator: ruleSeparator,
        isActive: ruleActive,
        effectiveDate: ruleEffective,
      };
      if (editingRuleId) {
        await apiRequest(`/api/numbering-rules/${editingRuleId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/numbering-rules', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditingRuleId(null);
      setRuleName('');
      onRefreshMaster(
        'Aturan penomoran berhasil disimpan. Nomor surat historis yang sudah diterbitkan tetap terjaga.'
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiRequest('/api/company-settings', {
        method: 'PUT',
        body: JSON.stringify({
          companyName: compName,
          companyCode: compCode,
          logoUrl: '',
          address: compAddress,
          phone: compPhone,
          email: compEmail,
          website: compWeb,
          npwpOrRegNumber: compNpwp,
        }),
      });
      onRefreshMaster('Identitas perusahaan berhasil diperbarui.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Master Data & Konfigurasi Mesin Penomoran
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola struktur departemen, jenis surat, klasifikasi kerahasiaan, rumus penomoran
            otomatis, dan profil perusahaan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          {[
            { id: 'DEPARTMENTS', label: 'Departemen', icon: Building2 },
            { id: 'TYPES', label: 'Jenis Surat', icon: Layers },
            { id: 'CLASSIFICATIONS', label: 'Klasifikasi', icon: Shield },
            { id: 'RULES', label: 'Aturan Penomoran', icon: Hash },
            { id: 'COMPANY', label: 'Identitas Perusahaan', icon: FileCog },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setError(null);
                  onChangeSubTab(tab.id as any);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* 1. DEPARTMENTS TAB */}
      {activeSubTab === 'DEPARTMENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {canEdit && (
            <form
              onSubmit={handleSaveDepartment}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 self-start"
            >
              <h3 className="text-sm font-bold text-slate-900">
                {editingDeptId ? 'Edit Departemen' : 'Tambah Departemen Baru'}
              </h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Departemen (Unik)
                </label>
                <input
                  type="text"
                  required
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: HRD, GA, FIN, LEGAL"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Departemen
                </label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="Nama lengkap departemen"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Tugas
                </label>
                <textarea
                  rows={2}
                  required
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  placeholder="Keterangan singkat..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deptActive}
                  onChange={(e) => setDeptActive(e.target.checked)}
                />
                <span>Status Departemen Aktif</span>
              </label>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {editingDeptId ? 'Simpan Perubahan' : 'Tambah Departemen'}
                </button>
                {editingDeptId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDeptId(null);
                      setDeptCode('');
                      setDeptName('');
                      setDeptDesc('');
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
              canEdit ? 'lg:col-span-8' : 'lg:col-span-12'
            } bg-white border border-slate-200 rounded-xl overflow-hidden`}
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Departemen</th>
                  <th className="py-3 px-4">Deskripsi</th>
                  <th className="py-3 px-4">Status</th>
                  {canEdit && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{d.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{d.name}</td>
                    <td className="py-3 px-4 text-slate-600">{d.description}</td>
                    <td className="py-3 px-4">
                      {d.isActive ? (
                        <span className="text-emerald-700 font-semibold">Aktif</span>
                      ) : (
                        <span className="text-slate-400">Nonaktif</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDeptId(d.id);
                            setDeptCode(d.code);
                            setDeptName(d.name);
                            setDeptDesc(d.description);
                            setDeptActive(d.isActive);
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
        </div>
      )}

      {/* 2. LETTER TYPES TAB */}
      {activeSubTab === 'TYPES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {canEdit && (
            <form
              onSubmit={handleSaveLetterType}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 self-start"
            >
              <h3 className="text-sm font-bold text-slate-900">
                {editingTypeId ? 'Edit Jenis Surat' : 'Tambah Jenis Surat'}
              </h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Jenis Surat (Unik)
                </label>
                <input
                  type="text"
                  required
                  value={typeCode}
                  onChange={(e) => setTypeCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: SK, ST, UND, SP, MEMO"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Jenis Surat
                </label>
                <input
                  type="text"
                  required
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  placeholder="Contoh: Surat Keputusan"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kategori yang Diizinkan
                </label>
                <div className="space-y-1.5 text-xs">
                  {[
                    { id: 'OUTGOING', label: 'Surat Keluar' },
                    { id: 'INCOMING', label: 'Surat Masuk' },
                    { id: 'INTERNAL', label: 'Surat Internal' },
                  ].map((c) => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={typeCats.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTypeCats((prev) => [...prev, c.id]);
                          } else {
                            setTypeCats((prev) => prev.filter((item) => item !== c.id));
                          }
                        }}
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  required
                  value={typeDesc}
                  onChange={(e) => setTypeDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typeActive}
                  onChange={(e) => setTypeActive(e.target.checked)}
                />
                <span>Status Jenis Surat Aktif</span>
              </label>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {editingTypeId ? 'Simpan Perubahan' : 'Tambah Jenis Surat'}
                </button>
                {editingTypeId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTypeId(null);
                      setTypeCode('');
                      setTypeName('');
                      setTypeDesc('');
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
              canEdit ? 'lg:col-span-8' : 'lg:col-span-12'
            } bg-white border border-slate-200 rounded-xl overflow-hidden`}
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Jenis Surat</th>
                  <th className="py-3 px-4">Kategori Diizinkan</th>
                  <th className="py-3 px-4">Status</th>
                  {canEdit && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {letterTypes.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{t.code}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{t.name}</div>
                      <div className="text-[11px] text-slate-500">{t.description}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{t.allowedCategories}</td>
                    <td className="py-3 px-4">
                      {t.isActive ? (
                        <span className="text-emerald-700 font-semibold">Aktif</span>
                      ) : (
                        <span className="text-slate-400">Nonaktif</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTypeId(t.id);
                            setTypeCode(t.code);
                            setTypeName(t.name);
                            setTypeCats(t.allowedCategories.split(','));
                            setTypeDesc(t.description);
                            setTypeActive(t.isActive);
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
        </div>
      )}

      {/* 3. CLASSIFICATIONS TAB */}
      {activeSubTab === 'CLASSIFICATIONS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {canEdit && (
            <form
              onSubmit={handleSaveClassification}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 self-start"
            >
              <h3 className="text-sm font-bold text-slate-900">
                {editingClassId ? 'Edit Klasifikasi' : 'Tambah Klasifikasi Surat'}
              </h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Klasifikasi
                </label>
                <input
                  type="text"
                  required
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: BIASA, RAHASIA"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Klasifikasi
                </label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tingkat Kerahasiaan
                </label>
                <select
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="PUBLIC">PUBLIC (Biasa / Umum)</option>
                  <option value="INTERNAL">INTERNAL (Internal Terbatas)</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL (Rahasia)</option>
                  <option value="STRICTLY_CONFIDENTIAL">
                    STRICTLY_CONFIDENTIAL (Sangat Rahasia)
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  required
                  value={classDesc}
                  onChange={(e) => setClassDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {editingClassId ? 'Simpan Perubahan' : 'Tambah Klasifikasi'}
              </button>
            </form>
          )}

          <div
            className={`${
              canEdit ? 'lg:col-span-8' : 'lg:col-span-12'
            } bg-white border border-slate-200 rounded-xl overflow-hidden`}
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Klasifikasi</th>
                  <th className="py-3 px-4">Tingkat Kerahasiaan</th>
                  <th className="py-3 px-4">Deskripsi</th>
                  {canEdit && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {classifications.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{c.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{c.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {c.confidentialityLevel}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{c.description}</td>
                    {canEdit && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClassId(c.id);
                            setClassCode(c.code);
                            setClassName(c.name);
                            setClassLevel(c.confidentialityLevel);
                            setClassDesc(c.description);
                            setClassActive(c.isActive);
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
        </div>
      )}

      {/* 4. NUMBERING RULES & COUNTERS TAB */}
      {activeSubTab === 'RULES' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {canEdit && (
              <form
                onSubmit={handleSaveRule}
                className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
              >
                <h3 className="text-sm font-bold text-slate-900">
                  {editingRuleId ? 'Edit Aturan Penomoran' : 'Buat Aturan Penomoran Baru'}
                </h3>

                {/* Live Simulation Banner */}
                <div className="p-3.5 bg-slate-900 text-white rounded-lg">
                  <div className="text-[10px] text-blue-400 font-semibold">
                    CONTOH HASIL FORMAT NOMOR OTOMATIS
                  </div>
                  <div className="text-lg font-mono font-bold mt-0.5">{simulatedExample}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Sumber Tanggal Terkunci: <span className="text-white">Tanggal Surat</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Aturan Penomoran
                  </label>
                  <input
                    type="text"
                    required
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="Contoh: Standar Surat Keluar Korporat"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Template Format Nomor (Wajib menyertakan {'{SEQ}'})
                  </label>
                  <input
                    type="text"
                    required
                    value={ruleTemplate}
                    onChange={(e) => setRuleTemplate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      '{SEQ}',
                      '{COMP}',
                      '{DEPT}',
                      '{TYPE}',
                      '{CLASS}',
                      '{ROMAN_MONTH}',
                      '{MONTH}',
                      '{YEAR}',
                    ].map((tok) => (
                      <button
                        key={tok}
                        type="button"
                        onClick={() => setRuleTemplate((prev) => `${prev}${ruleSeparator}${tok}`)}
                        className="px-2 py-1 text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 rounded cursor-pointer"
                      >
                        +{tok}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kategori Berlaku
                    </label>
                    <select
                      value={ruleCategory}
                      onChange={(e) => setRuleCategory(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="OUTGOING">Surat Keluar</option>
                      <option value="INCOMING">Surat Masuk</option>
                      <option value="INTERNAL">Surat Internal</option>
                      <option value="ALL">Semua Kategori</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ruang Lingkup Urutan
                    </label>
                    <select
                      value={ruleScope}
                      onChange={(e) => setRuleScope(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="DEPT_AND_TYPE">Per Departemen & Jenis Surat</option>
                      <option value="DEPARTMENT">Per Departemen</option>
                      <option value="LETTER_TYPE">Per Jenis Surat</option>
                      <option value="GLOBAL">Global Perusahaan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Periode Reset Nomor
                    </label>
                    <select
                      value={ruleReset}
                      onChange={(e) => setRuleReset(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="YEARLY">Tahunan (Reset tiap Tahun)</option>
                      <option value="MONTHLY">Bulanan (Reset tiap Bulan)</option>
                      <option value="NEVER">Tidak Pernah Reset</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jumlah Digit & Separator
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={ruleDigits}
                        onChange={(e) => setRuleDigits(Number(e.target.value))}
                        className="flex-1 px-2.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      >
                        <option value={3}>3 Digit (001)</option>
                        <option value={4}>4 Digit (0001)</option>
                        <option value={5}>5 Digit (00001)</option>
                      </select>
                      <select
                        value={ruleSeparator}
                        onChange={(e) => setRuleSeparator(e.target.value)}
                        className="w-20 px-2.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="/">/</option>
                        <option value="-">-</option>
                        <option value=".">.</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    {editingRuleId ? 'Simpan Perubahan Aturan' : 'Tambahkan Aturan Penomoran'}
                  </button>
                  {editingRuleId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRuleId(null);
                        setRuleName('');
                      }}
                      className="py-2.5 px-3 bg-slate-100 text-slate-700 text-xs rounded-lg cursor-pointer"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>
            )}

            <div
              className={`${
                canEdit ? 'lg:col-span-7' : 'lg:col-span-12'
              } space-y-6`}
            >
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                  <h4 className="text-xs font-bold text-slate-900">
                    Daftar Aturan Penomoran Aktif
                  </h4>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Nama Aturan & Kategori</th>
                      <th className="py-2.5 px-4">Template Format</th>
                      <th className="py-2.5 px-4">Ruang Lingkup & Reset</th>
                      {canEdit && <th className="py-2.5 px-4 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {numberingRules.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{r.name}</div>
                          <div className="text-[11px] text-slate-500">
                            Kategori: <span className="font-mono">{r.category}</span> · Digit:{' '}
                            {r.digitPadding}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-700">
                          {r.formatTemplate}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                          {r.scopeType} · {r.resetPeriod}
                        </td>
                        {canEdit && (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRuleId(r.id);
                                setRuleName(r.name);
                                setRuleCategory(r.category);
                                setRuleTemplate(r.formatTemplate);
                                setRuleScope(r.scopeType);
                                setRuleReset(r.resetPeriod);
                                setRuleDigits(r.digitPadding);
                                setRuleSeparator(r.separator);
                                setRuleEffective(r.effectiveDate);
                                setRuleActive(r.isActive);
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

              {/* Active Atomic Counters State Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                  <h4 className="text-xs font-bold text-slate-900">
                    Status Posisi Nomor Urut Terakhir (Tabel numbering_counters)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Mencatat posisi counter terakhir secara transaksional agar bebas duplikasi
                  </p>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Kunci Ruang Lingkup (Scope Key)</th>
                      <th className="py-2.5 px-4">Periode Tahun / Bulan</th>
                      <th className="py-2.5 px-4">Urutan Terakhir Dialokasikan</th>
                      <th className="py-2.5 px-4">Pembaruan Terakhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {numberingCounters.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                          {c.scopeKey}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          Tahun: {c.periodYear || 'Global'} · Bulan:{' '}
                          {c.periodMonth ? String(c.periodMonth).padStart(2, '0') : 'Tahunan'}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-blue-700">
                          #{String(c.lastSequence).padStart(3, '0')}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                          {new Date(c.updatedAt).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. COMPANY IDENTITY TAB */}
      {activeSubTab === 'COMPANY' && (
        <form
          onSubmit={handleSaveCompany}
          className="max-w-3xl bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div>
            <h3 className="text-base font-bold text-slate-900">Identitas Resmi Perusahaan</h3>
            <p className="text-xs text-slate-500">
              Informasi ini digunakan untuk token kode perusahaan {'{COMP}'} dan kop bukti
              registrasi surat.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Resmi Perusahaan
              </label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kode Perusahaan ({'{COMP}'})
              </label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={compCode}
                onChange={(e) => setCompCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alamat Lengkap Kantor Pusat
            </label>
            <input
              type="text"
              required
              disabled={!canEdit}
              value={compAddress}
              onChange={(e) => setCompAddress(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor Telepon
              </label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={compPhone}
                onChange={(e) => setCompPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Resmi Sekretariat
              </label>
              <input
                type="email"
                required
                disabled={!canEdit}
                value={compEmail}
                onChange={(e) => setCompEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Website</label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={compWeb}
                onChange={(e) => setCompWeb(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              NPWP / Nomor Induk Berusaha (Opsional)
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={compNpwp}
              onChange={(e) => setCompNpwp(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>

          {canEdit && (
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Identitas Perusahaan</span>
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
