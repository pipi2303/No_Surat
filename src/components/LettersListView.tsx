import React, { useEffect, useState } from 'react';
import {
  ArrowUpDown,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FilePlus2,
  Paperclip,
  RotateCcw,
  Search,
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import {
  Department,
  LetterCategory,
  LetterClassification,
  LetterRecord,
  LetterType,
  RoleCode,
} from '../types.ts';

interface LettersListViewProps {
  fixedCategory?: LetterCategory | 'ALL';
  departments: Department[];
  letterTypes: LetterType[];
  classifications: LetterClassification[];
  userRole: RoleCode;
  onSelectLetter: (letterId: number) => void;
  onNavigateCreate: (defaultCategory?: LetterCategory) => void;
}

const CATEGORY_TITLES: Record<string, { title: string; subtitle: string }> = {
  ALL: {
    title: 'Manajemen Seluruh Surat',
    subtitle: 'Daftar terpadu Surat Keluar, Surat Masuk, dan Surat Internal perusahaan.',
  },
  OUTGOING: {
    title: 'Manajemen Surat Keluar',
    subtitle: 'Surat resmi yang diterbitkan perusahaan untuk instansi, klien, atau mitra eksternal.',
  },
  INCOMING: {
    title: 'Manajemen Surat Masuk',
    subtitle:
      'Surat dari pihak eksternal dengan pencatatan Nomor Registrasi Internal dan Nomor Surat Asli Pengirim.',
  },
  INTERNAL: {
    title: 'Manajemen Surat Internal & Memorandum',
    subtitle: 'Komunikasi resmi, SK, Surat Tugas, dan memorandum antardepartemen di dalam perusahaan.',
  },
};

export function LettersListView({
  fixedCategory = 'ALL',
  departments,
  letterTypes,
  classifications,
  userRole,
  onSelectLetter,
  onNavigateCreate,
}: LettersListViewProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(fixedCategory);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [letterTypeId, setLetterTypeId] = useState<string>('');
  const [classificationId, setClassificationId] = useState<string>('');
  const [status, setStatus] = useState<string>('ALL');
  const [year, setYear] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [sortField, setSortField] = useState<'letterDate' | 'officialNumber' | 'subject'>('letterDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [items, setItems] = useState<LetterRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCategory(fixedCategory);
    setPage(1);
  }, [fixedCategory]);

  const fetchLetters = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (category && category !== 'ALL') params.set('category', category);
      if (departmentId) params.set('departmentId', departmentId);
      if (letterTypeId) params.set('letterTypeId', letterTypeId);
      if (classificationId) params.set('classificationId', classificationId);
      if (status && status !== 'ALL') params.set('status', status);
      if (year && year !== 'ALL') params.set('year', year);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await apiRequest<{
        items: LetterRecord[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/api/letters?${params.toString()}`);

      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar surat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, [category, departmentId, letterTypeId, classificationId, status, year, dateFrom, dateTo, page, limit]);

  const handleResetFilters = () => {
    setSearch('');
    setCategory(fixedCategory);
    setDepartmentId('');
    setLetterTypeId('');
    setClassificationId('');
    setStatus('ALL');
    setYear('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setTimeout(() => fetchLetters(), 0);
  };

  const toggleSort = (field: 'letterDate' | 'officialNumber' | 'subject') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const valA = (a[sortField] || '').toString().toLowerCase();
    const valB = (b[sortField] || '').toString().toLowerCase();
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const headerMeta = CATEGORY_TITLES[fixedCategory] || CATEGORY_TITLES.ALL;
  const canCreate = userRole !== 'AUDITOR';

  return (
    <div className="space-y-5">
      {/* Header & Primary Action */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{headerMeta.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{headerMeta.subtitle}</p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() =>
              onNavigateCreate(fixedCategory !== 'ALL' ? (fixedCategory as LetterCategory) : 'OUTGOING')
            }
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>
              Registrasi{' '}
              {fixedCategory === 'INCOMING'
                ? 'Surat Masuk'
                : fixedCategory === 'INTERNAL'
                ? 'Surat Internal'
                : 'Surat Baru'}
            </span>
          </button>
        )}
      </div>

      {/* Multi-Criteria Search & Filter Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  fetchLetters();
                }
              }}
              placeholder="Cari nomor surat, perihal, pengirim, penerima, tujuan..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Semua Departemen</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={letterTypeId}
              onChange={(e) => {
                setLetterTypeId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Semua Jenis Surat</option>
              {letterTypes.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.code} — {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPage(1);
                fetchLetters();
              }}
              className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Terapkan Pencarian
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="Reset Filter"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Second Row Filters: Status, Classification, Year, Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100">
          {fixedCategory === 'ALL' && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Kategori</label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="ALL">Semua Kategori</option>
                <option value="OUTGOING">Surat Keluar</option>
                <option value="INCOMING">Surat Masuk</option>
                <option value="INTERNAL">Surat Internal</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Status Administratif
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="ALL">Semua Status</option>
              <option value="REGISTERED">Terdaftar (Resmi)</option>
              <option value="DRAFT">Draft (Belum Bernomor)</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Klasifikasi Surat
            </label>
            <select
              value={classificationId}
              onChange={(e) => {
                setClassificationId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="">Semua Klasifikasi</option>
              {classifications.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Tahun Surat</label>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="ALL">Semua Tahun</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2027">2027</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Dari Tanggal Surat
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Sampai Tanggal Surat
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {error}
        </div>
      )}

      {/* High-Density Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('officialNumber')}
                    className="flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    <span>Nomor Surat Resmi</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('subject')}
                    className="flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    <span>Perihal & Ringkasan</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Departemen · Jenis · Klasifikasi</th>
                <th className="py-3 px-4">Pengirim → Penerima</th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('letterDate')}
                    className="flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    <span>Tgl Surat</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-slate-200 rounded w-36" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-slate-200 rounded w-64" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-slate-200 rounded w-28" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-slate-200 rounded w-36" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-slate-200 rounded w-20" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-slate-200 rounded w-20" />
                    </td>
                    <td className="py-3.5 px-4" />
                  </tr>
                ))
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <p className="text-sm font-semibold text-slate-800">
                      Tidak ada data surat yang sesuai dengan filter pencarian
                    </p>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Silakan ubah kata kunci pencarian atau mendaftarkan surat baru.
                    </p>
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() =>
                          onNavigateCreate(
                            fixedCategory !== 'ALL' ? (fixedCategory as LetterCategory) : 'OUTGOING'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 cursor-pointer"
                      >
                        <FilePlus2 className="w-3.5 h-3.5" />
                        <span>Registrasi Surat Pertama</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                sortedItems.map((letter) => (
                  <tr
                    key={letter.id}
                    onClick={() => onSelectLetter(letter.id)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono tabular-nums font-bold text-slate-900">
                        {letter.officialNumber || (
                          <span className="text-slate-400 font-normal">
                            [DRAFT · {letter.letterCode}]
                          </span>
                        )}
                      </div>
                      {letter.category === 'INCOMING' && letter.externalOriginalNumber && (
                        <div className="text-[11px] font-mono text-teal-700 mt-0.5">
                          No. Asli: {letter.externalOriginalNumber}
                        </div>
                      )}
                      <div className="text-[11px] font-mono text-slate-400">
                        ID: {letter.letterCode}
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-semibold text-slate-900 line-clamp-1">
                        {letter.subject}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {letter.summary}
                      </div>
                      {letter.attachments && letter.attachments.length > 0 && (
                        <div className="inline-flex items-center gap-1 text-[11px] text-blue-700 mt-1">
                          <Paperclip className="w-3 h-3" />
                          <span>{letter.attachments.length} lampiran</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-800">
                        <span className="font-mono font-bold text-blue-700">
                          {letter.department?.code}
                        </span>
                        <span className="mx-1 text-slate-300">·</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {letter.letterType?.code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {letter.category === 'OUTGOING'
                          ? 'Surat Keluar'
                          : letter.category === 'INCOMING'
                          ? 'Surat Masuk'
                          : 'Surat Internal'}{' '}
                        · {letter.classification?.code}
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-[200px]">
                      <div className="text-xs text-slate-800 truncate" title={letter.sender}>
                        Dari: <span className="font-medium">{letter.sender}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5" title={letter.recipient}>
                        Kepada: {letter.recipient}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-900">{letter.letterDate}</div>
                      <div className="text-[11px] text-slate-400">Reg: {letter.registrationDate}</div>
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
                        <div>
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                            <Ban className="w-3.5 h-3.5" />
                            <span>Dibatalkan</span>
                          </span>
                          <div className="text-[10px] text-slate-500 max-w-[140px] truncate">
                            {letter.cancellationReason}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLetter(letter.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detail</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              Menampilkan <span className="font-mono font-semibold text-slate-900">{items.length}</span> dari{' '}
              <span className="font-mono font-semibold text-slate-900">{total}</span> surat
            </span>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <span>Baris per halaman:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono">
              Halaman {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
