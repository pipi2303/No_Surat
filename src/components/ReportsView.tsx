import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import {
  CompanySettings,
  Department,
  LetterRecord,
  LetterType,
} from '../types.ts';

interface ReportsViewProps {
  departments: Department[];
  letterTypes: LetterType[];
  companySettings: CompanySettings | null;
  onSelectLetter: (letterId: number) => void;
}

type ReportTab =
  | 'BY_PERIOD'
  | 'BY_DEPARTMENT'
  | 'BY_TYPE'
  | 'BY_CATEGORY'
  | 'CANCELLED_ONLY'
  | 'MONTHLY_RECAP'
  | 'USER_ACTIVITY';

export function ReportsView({
  departments,
  letterTypes,
  companySettings,
  onSelectLetter,
}: ReportsViewProps) {
  const [reportTab, setReportTab] = useState<ReportTab>('BY_PERIOD');
  const [category, setCategory] = useState('ALL');
  const [departmentId, setDepartmentId] = useState('');
  const [letterTypeId, setLetterTypeId] = useState('');
  const [year, setYear] = useState('2026');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [letters, setLetters] = useState<LetterRecord[]>([]);
  const [userActivity, setUserActivity] = useState<
    Array<{
      userUid: string;
      userName: string;
      total: number;
      registered: number;
      draft: number;
      cancelled: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'ALL') params.set('category', category);
      if (departmentId) params.set('departmentId', departmentId);
      if (letterTypeId) params.set('letterTypeId', letterTypeId);
      if (year !== 'ALL') params.set('year', year);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (reportTab === 'CANCELLED_ONLY') {
        params.set('status', 'CANCELLED');
      }

      const res = await apiRequest<{
        letters: LetterRecord[];
        userActivity: typeof userActivity;
      }>(`/api/reports?${params.toString()}`);

      setLetters(res.letters);
      setUserActivity(res.userActivity);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [reportTab, category, departmentId, letterTypeId, year, dateFrom, dateTo]);

  const buildExportRows = () =>
    letters.map((l, idx) => ({
      No: idx + 1,
      'ID Registrasi': l.letterCode,
      'Nomor Surat Resmi': l.officialNumber || '[DRAFT]',
      'Nomor Asli Pengirim (Surat Masuk)': l.externalOriginalNumber || '-',
      Kategori:
        l.category === 'OUTGOING'
          ? 'Surat Keluar'
          : l.category === 'INCOMING'
          ? 'Surat Masuk'
          : 'Surat Internal',
      'Status Administratif':
        l.status === 'REGISTERED'
          ? 'Terdaftar'
          : l.status === 'DRAFT'
          ? 'Draft'
          : 'Dibatalkan',
      Departemen: l.department ? `${l.department.code} - ${l.department.name}` : '-',
      'Jenis Surat': l.letterType ? `${l.letterType.code} - ${l.letterType.name}` : '-',
      Klasifikasi: l.classification?.code || '-',
      'Tanggal Surat': l.letterDate,
      'Tanggal Registrasi': l.registrationDate,
      Perihal: l.subject,
      Pengirim: l.sender,
      Penerima: l.recipient,
      Tujuan: l.destination,
      'Pencatat': l.createdByName,
      'Alasan Pembatalan': l.cancellationReason || '-',
    }));

  const handleExportCSV = () => {
    const rows = buildExportRows();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        headers
          .map((h) => `"${String((r as any)[h] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-surat-${reportTab.toLowerCase()}-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportXLSX = () => {
    const rows = buildExportRows();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Surat');
    XLSX.writeFile(workbook, `laporan-surat-${reportTab.toLowerCase()}-${year}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Laporan & Rekapitulasi Administrasi Surat
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Seluruh laporan dihasilkan langsung dari data aktual di PostgreSQL dan siap diekspor ke
            CSV, Excel (.XLSX), atau PDF/Cetak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-700" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportXLSX}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel (.XLSX)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / Export PDF</span>
          </button>
        </div>
      </div>

      {/* 7 Report Type Selector & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 no-print">
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
          {[
            { id: 'BY_PERIOD', label: '1. Daftar per Periode' },
            { id: 'BY_DEPARTMENT', label: '2. Rekap per Departemen' },
            { id: 'BY_TYPE', label: '3. Rekap per Jenis Surat' },
            { id: 'BY_CATEGORY', label: '4. Masuk, Keluar & Internal' },
            { id: 'CANCELLED_ONLY', label: '5. Surat Dibatalkan' },
            { id: 'MONTHLY_RECAP', label: '6. Rekap Bulanan & Tahunan' },
            { id: 'USER_ACTIVITY', label: '7. Aktivitas Registrasi Pengguna' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setReportTab(t.id as ReportTab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                reportTab === t.id
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Kategori Surat
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="OUTGOING">Surat Keluar</option>
              <option value="INCOMING">Surat Masuk</option>
              <option value="INTERNAL">Surat Internal</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Departemen</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="">Semua Departemen</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Tahun Surat</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2027">2027</option>
              <option value="ALL">Semua Tahun</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Printable Report Canvas */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        {/* Official Report Header */}
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {companySettings?.companyName || 'PT Nusantara Teknologi Mandiri'}
            </h3>
            <p className="text-xs text-slate-500">{companySettings?.address}</p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs font-bold text-slate-900">
              LAPORAN RESMI ADMINISTRASI SURAT KANTOR
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Periode Tahun: {year} · Total Rekaman: {letters.length} surat
            </div>
          </div>
        </div>

        {/* Special Summary Views for Department / Type / Monthly / User Activity */}
        {reportTab === 'BY_DEPARTMENT' && (
          <div className="overflow-x-auto">
            <h4 className="text-xs font-bold text-slate-900 mb-3">
              Rekapitulasi Volume Surat Berdasarkan Departemen
            </h4>
            <table className="w-full text-left border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-2.5 px-4">Kode</th>
                  <th className="py-2.5 px-4">Nama Departemen</th>
                  <th className="py-2.5 px-4 text-right">Surat Keluar</th>
                  <th className="py-2.5 px-4 text-right">Surat Masuk</th>
                  <th className="py-2.5 px-4 text-right">Surat Internal</th>
                  <th className="py-2.5 px-4 text-right">Dibatalkan</th>
                  <th className="py-2.5 px-4 text-right">Total Surat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {departments.map((d) => {
                  const deptItems = letters.filter((l) => l.departmentId === d.id);
                  return (
                    <tr key={d.id}>
                      <td className="py-2.5 px-4 font-mono font-bold text-blue-700">{d.code}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{d.name}</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {deptItems.filter((i) => i.category === 'OUTGOING').length}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {deptItems.filter((i) => i.category === 'INCOMING').length}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {deptItems.filter((i) => i.category === 'INTERNAL').length}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-red-600">
                        {deptItems.filter((i) => i.status === 'CANCELLED').length}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {deptItems.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {reportTab === 'BY_TYPE' && (
          <div className="overflow-x-auto">
            <h4 className="text-xs font-bold text-slate-900 mb-3">
              Rekapitulasi Volume Berdasarkan Jenis Surat
            </h4>
            <table className="w-full text-left border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-2.5 px-4">Kode Jenis</th>
                  <th className="py-2.5 px-4">Nama Jenis Surat</th>
                  <th className="py-2.5 px-4 text-right">Terdaftar</th>
                  <th className="py-2.5 px-4 text-right">Draft</th>
                  <th className="py-2.5 px-4 text-right">Dibatalkan</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {letterTypes.map((t) => {
                  const typeItems = letters.filter((l) => l.letterTypeId === t.id);
                  return (
                    <tr key={t.id}>
                      <td className="py-2.5 px-4 font-mono font-bold text-blue-700">{t.code}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{t.name}</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {typeItems.filter((i) => i.status === 'REGISTERED').length}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {typeItems.filter((i) => i.status === 'DRAFT').length}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-red-600">
                        {typeItems.filter((i) => i.status === 'CANCELLED').length}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">
                        {typeItems.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {reportTab === 'MONTHLY_RECAP' && (
          <div className="overflow-x-auto">
            <h4 className="text-xs font-bold text-slate-900 mb-3">
              Rekapitulasi Surat per Bulan ({year})
            </h4>
            <table className="w-full text-left border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-2.5 px-4">Bulan</th>
                  <th className="py-2.5 px-4 text-right">Surat Keluar</th>
                  <th className="py-2.5 px-4 text-right">Surat Masuk</th>
                  <th className="py-2.5 px-4 text-right">Surat Internal</th>
                  <th className="py-2.5 px-4 text-right">Dibatalkan</th>
                  <th className="py-2.5 px-4 text-right">Total Bulan Ini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[
                  '01 - Januari',
                  '02 - Februari',
                  '03 - Maret',
                  '04 - April',
                  '05 - Mei',
                  '06 - Juni',
                  '07 - Juli',
                  '08 - Agustus',
                  '09 - September',
                  '10 - Oktober',
                  '11 - November',
                  '12 - Desember',
                ].map((mLabel, idx) => {
                  const mNum = String(idx + 1).padStart(2, '0');
                  const mItems = letters.filter((l) => l.letterDate.slice(5, 7) === mNum);
                  return (
                    <tr key={mNum}>
                      <td className="py-2 px-4 font-medium text-slate-900">{mLabel}</td>
                      <td className="py-2 px-4 text-right font-mono">
                        {mItems.filter((i) => i.category === 'OUTGOING').length}
                      </td>
                      <td className="py-2 px-4 text-right font-mono">
                        {mItems.filter((i) => i.category === 'INCOMING').length}
                      </td>
                      <td className="py-2 px-4 text-right font-mono">
                        {mItems.filter((i) => i.category === 'INTERNAL').length}
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-red-600">
                        {mItems.filter((i) => i.status === 'CANCELLED').length}
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-slate-900">
                        {mItems.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {reportTab === 'USER_ACTIVITY' && (
          <div className="overflow-x-auto">
            <h4 className="text-xs font-bold text-slate-900 mb-3">
              Laporan Aktivitas Registrasi Pengguna
            </h4>
            <table className="w-full text-left border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-2.5 px-4">Nama Petugas / Pengguna</th>
                  <th className="py-2.5 px-4 text-right">Surat Terdaftar</th>
                  <th className="py-2.5 px-4 text-right">Draft Dibuat</th>
                  <th className="py-2.5 px-4 text-right">Surat Dibatalkan</th>
                  <th className="py-2.5 px-4 text-right">Total Kontribusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {userActivity.map((u) => (
                  <tr key={u.userUid}>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{u.userName}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                      {u.registered}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">{u.draft}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-red-600">{u.cancelled}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">{u.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detailed Register Ledger Table */}
        <div className="overflow-x-auto">
          <h4 className="text-xs font-bold text-slate-900 mb-3">
            Daftar Buku Agenda Surat ({letters.length} Rekaman)
          </h4>
          <table className="w-full text-left border-collapse border border-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">Nomor Surat Resmi</th>
                <th className="py-2.5 px-3">Kategori · Dept · Jenis</th>
                <th className="py-2.5 px-3">Tgl Surat</th>
                <th className="py-2.5 px-3">Perihal</th>
                <th className="py-2.5 px-3">Pengirim → Penerima</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Memuat data laporan...
                  </td>
                </tr>
              ) : (
                letters.map((l, index) => (
                  <tr
                    key={l.id}
                    onClick={() => onSelectLetter(l.id)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-500">{index + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {l.officialNumber || `[DRAFT: ${l.letterCode}]`}
                      {l.externalOriginalNumber && (
                        <div className="text-[10px] font-normal text-teal-700">
                          Asli: {l.externalOriginalNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {l.category} · {l.department?.code} · {l.letterType?.code}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">{l.letterDate}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{l.subject}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {l.sender} → {l.recipient}
                    </td>
                    <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                      {l.status === 'REGISTERED'
                        ? 'Terdaftar'
                        : l.status === 'DRAFT'
                        ? 'Draft'
                        : `Dibatalkan (${l.cancellationReason || ''})`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
