import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderKanban,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { AuditLogItem, Department, LetterRecord } from '../types.ts';

interface DashboardViewProps {
  departments: Department[];
  onSelectLetter: (letterId: number) => void;
  onNavigateCreate: (defaultCategory?: 'OUTGOING' | 'INCOMING' | 'INTERNAL') => void;
  onNavigateCategory: (cat: 'OUTGOING' | 'INCOMING' | 'INTERNAL') => void;
}

interface DashboardData {
  kpis: {
    totalLetters: number;
    totalRegistered: number;
    totalDraft: number;
    totalCancelled: number;
    outgoingCount: number;
    incomingCount: number;
    internalCount: number;
  };
  monthlySeries: Array<{
    month: string;
    monthNumber: string;
    outgoing: number;
    incoming: number;
    internal: number;
    total: number;
  }>;
  byDepartment: Array<{
    id: number;
    code: string;
    name: string;
    total: number;
    outgoing: number;
    incoming: number;
    internal: number;
    cancelled: number;
  }>;
  byType: Array<{
    id: number;
    code: string;
    name: string;
    count: number;
  }>;
  recentLetters: LetterRecord[];
  recentAudits: AuditLogItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  OUTGOING: 'Surat Keluar',
  INCOMING: 'Surat Masuk',
  INTERNAL: 'Surat Internal',
};

export function DashboardView({
  departments,
  onSelectLetter,
  onNavigateCreate,
  onNavigateCategory,
}: DashboardViewProps) {
  const [year, setYear] = useState('2026');
  const [month, setMonth] = useState('ALL');
  const [departmentId, setDepartmentId] = useState<string>('ALL');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('year', year);
      params.set('month', month);
      if (departmentId !== 'ALL') {
        params.set('departmentId', departmentId);
      }
      const res = await apiRequest<DashboardData>(`/api/dashboard?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [year, month, departmentId]);

  const maxMonthlyTotal = Math.max(
    1,
    ...(data?.monthlySeries.map((m) => m.total) || [1])
  );

  return (
    <div className="space-y-6">
      {/* Top Filter & Quick Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Ringkasan Eksekutif & Statistik Surat</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Data real-time dari basis data PostgreSQL berdasarkan Tanggal Surat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter:</span>
          </div>

          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="2026">Tahun 2026</option>
            <option value="2025">Tahun 2025</option>
            <option value="2027">Tahun 2027</option>
            <option value="ALL">Semua Tahun</option>
          </select>

          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">Semua Bulan</option>
            <option value="01">Januari</option>
            <option value="02">Februari</option>
            <option value="03">Maret</option>
            <option value="04">April</option>
            <option value="05">Mei</option>
            <option value="06">Juni</option>
            <option value="07">Juli</option>
            <option value="08">Agustus</option>
            <option value="09">September</option>
            <option value="10">Oktober</option>
            <option value="11">November</option>
            <option value="12">Desember</option>
          </select>

          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">Semua Departemen</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchDashboard}
            className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            title="Muat Ulang Statistik"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => onNavigateCreate('OUTGOING')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Registrasi Surat Baru</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {error}
        </div>
      )}

      {/* 6 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Total Surat Terdaftar</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {loading ? '—' : data?.kpis.totalRegistered ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Dari total {data?.kpis.totalLetters ?? 0} rekaman
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateCategory('OUTGOING')}
          className="text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Surat Keluar</span>
            <ArrowUpRight className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {loading ? '—' : data?.kpis.outgoingCount ?? 0}
          </div>
          <div className="text-xs text-blue-700 mt-1">Lihat daftar surat keluar →</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateCategory('INCOMING')}
          className="text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Surat Masuk</span>
            <ArrowDownLeft className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {loading ? '—' : data?.kpis.incomingCount ?? 0}
          </div>
          <div className="text-xs text-teal-700 mt-1">Lihat daftar surat masuk →</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateCategory('INTERNAL')}
          className="text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Surat Internal</span>
            <FolderKanban className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {loading ? '—' : data?.kpis.internalCount ?? 0}
          </div>
          <div className="text-xs text-indigo-700 mt-1">Lihat surat internal →</div>
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Draft Belum Bernomor</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {loading ? '—' : data?.kpis.totalDraft ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Siap diterbitkan langsung</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Surat Dibatalkan</span>
            <Ban className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-red-600">
            {loading ? '—' : data?.kpis.totalCancelled ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Nomor tetap terkunci</div>
        </div>
      </div>

      {/* Charts & Distributions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Grafik Jumlah Surat per Bulan ({year === 'ALL' ? 'Semua Tahun' : `Tahun ${year}`})
              </h3>
              <p className="text-xs text-slate-500">
                Perbandingan volume Surat Keluar, Surat Masuk, dan Surat Internal setiap bulan
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-blue-700 inline-block rounded-xs" />
                Keluar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-teal-600 inline-block rounded-xs" />
                Masuk
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-indigo-500 inline-block rounded-xs" />
                Internal
              </span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 items-end h-48 pt-4 pb-2 border-b border-slate-200">
            {(data?.monthlySeries || []).map((item) => {
              const totalHeightPct = Math.round((item.total / maxMonthlyTotal) * 100);
              return (
                <div key={item.month} className="flex flex-col items-center h-full justify-end group">
                  <div className="text-[11px] font-mono tabular-nums text-slate-600 mb-1">
                    {item.total > 0 ? item.total : ''}
                  </div>
                  <div
                    className="w-full max-w-[28px] bg-slate-100 rounded-t overflow-hidden flex flex-col justify-end"
                    style={{ height: `${Math.max(6, totalHeightPct)}%` }}
                    title={`${item.month}: Keluar ${item.outgoing}, Masuk ${item.incoming}, Internal ${item.internal}`}
                  >
                    {item.total > 0 ? (
                      <>
                        {item.internal > 0 && (
                          <div
                            className="bg-indigo-500 w-full"
                            style={{ height: `${(item.internal / item.total) * 100}%` }}
                          />
                        )}
                        {item.incoming > 0 && (
                          <div
                            className="bg-teal-600 w-full"
                            style={{ height: `${(item.incoming / item.total) * 100}%` }}
                          />
                        )}
                        {item.outgoing > 0 && (
                          <div
                            className="bg-blue-700 w-full"
                            style={{ height: `${(item.outgoing / item.total) * 100}%` }}
                          />
                        )}
                      </>
                    ) : (
                      <div className="bg-slate-200 w-full h-1" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-600 mt-2 font-medium">{item.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribution by Department & Type */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Distribusi Surat Berdasarkan Departemen
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Rekapitulasi jumlah surat terdaftar per unit kerja
            </p>
            <div className="space-y-2.5">
              {(data?.byDepartment || []).map((dept) => {
                const maxDept = Math.max(1, ...(data?.byDepartment.map((d) => d.total) || [1]));
                const widthPct = Math.round((dept.total / maxDept) * 100);
                return (
                  <div key={dept.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">
                        <span className="font-mono font-semibold text-blue-700 mr-1.5">
                          {dept.code}
                        </span>
                        {dept.name}
                      </span>
                      <span className="font-mono tabular-nums text-slate-700 font-semibold">
                        {dept.total} surat
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-700 rounded-full"
                        style={{ width: `${Math.max(dept.total > 0 ? 8 : 0, widthPct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-xs font-bold text-slate-800 mb-2.5">
              Distribusi Berdasarkan Jenis Surat Terbanyak
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {(data?.byType || [])
                .filter((t) => t.count > 0)
                .slice(0, 6)
                .map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <span className="truncate text-slate-700">
                      <span className="font-mono font-semibold text-slate-900 mr-1">{t.code}</span>
                      · {t.name}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-blue-700 ml-2">
                      {t.count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Split: Recent Letters Table & Recent User Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Letters */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Surat Terbaru</h3>
              <p className="text-xs text-slate-500">
                Klik baris surat untuk melihat rincian nomor, lampiran, atau mencetak bukti registrasi
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Nomor Surat Resmi</th>
                  <th className="py-2.5 px-4">Perihal & Kategori</th>
                  <th className="py-2.5 px-4">Dept · Jenis</th>
                  <th className="py-2.5 px-4">Tanggal Surat</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {(data?.recentLetters || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Belum ada surat pada filter periode ini.
                    </td>
                  </tr>
                ) : (
                  (data?.recentLetters || []).map((letter) => (
                    <tr
                      key={letter.id}
                      onClick={() => onSelectLetter(letter.id)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {letter.officialNumber || (
                          <span className="text-slate-400 font-normal">
                            [DRAFT: {letter.letterCode}]
                          </span>
                        )}
                        {letter.category === 'INCOMING' && letter.externalOriginalNumber && (
                          <div className="text-[11px] text-slate-500 font-normal">
                            Asli: {letter.externalOriginalNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 line-clamp-1">
                          {letter.subject}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {CATEGORY_LABELS[letter.category]} · Tujuan: {letter.recipient}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {letter.department?.code || '-'} · {letter.letterType?.code || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {letter.letterDate}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {letter.status === 'REGISTERED' && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Terdaftar</span>
                          </span>
                        )}
                        {letter.status === 'DRAFT' && (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Draft</span>
                          </span>
                        )}
                        {letter.status === 'CANCELLED' && (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                            <Ban className="w-3.5 h-3.5" />
                            <span>Dibatalkan</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Audit Trail Activity */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Aktivitas Pengguna Terbaru</h3>
            <p className="text-xs text-slate-500">Jejak audit langsung dari aktivitas sistem</p>
          </div>

          <div className="space-y-3.5">
            {(data?.recentAudits || []).map((log) => (
              <div key={log.id} className="pb-3 border-b border-slate-100 last:border-none last:pb-0">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                  <span className="font-semibold text-slate-800">{log.userName}</span>
                  <span className="font-mono tabular-nums">
                    {new Date(log.createdAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-snug">{log.description}</p>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  {log.action} · {log.userRole}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
