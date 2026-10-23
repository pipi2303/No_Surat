import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Hash,
  Info,
  Save,
  Upload,
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import {
  Department,
  LetterCategory,
  LetterClassification,
  LetterRecord,
  LetterType,
  NumberingRule,
} from '../types.ts';

interface LetterFormViewProps {
  defaultCategory?: LetterCategory;
  departments: Department[];
  letterTypes: LetterType[];
  classifications: LetterClassification[];
  numberingRules: NumberingRule[];
  userDepartmentId: number | null;
  onSuccess: (createdLetter: LetterRecord, message: string) => void;
  onCancel: () => void;
}

interface PreviewResponse {
  isPreview: boolean;
  previewNumber: string;
  nextSequence: number;
  ruleId: number;
  ruleName: string;
  scopeType: string;
  resetPeriod: string;
  dateSource: string;
  components: Record<string, string | number>;
}

export function LetterFormView({
  defaultCategory = 'OUTGOING',
  departments,
  letterTypes,
  classifications,
  numberingRules,
  userDepartmentId,
  onSuccess,
  onCancel,
}: LetterFormViewProps) {
  const activeDepts = departments.filter((d) => d.isActive);
  const activeClass = classifications.filter((c) => c.isActive);

  const [category, setCategory] = useState<LetterCategory>(defaultCategory);
  const availableTypes = letterTypes.filter(
    (t) => t.isActive && t.allowedCategories.split(',').includes(category)
  );

  const [departmentId, setDepartmentId] = useState<number>(
    userDepartmentId || activeDepts[0]?.id || 1
  );
  const [letterTypeId, setLetterTypeId] = useState<number>(availableTypes[0]?.id || 1);
  const [classificationId, setClassificationId] = useState<number>(activeClass[0]?.id || 1);
  const [numberingRuleId, setNumberingRuleId] = useState<number | undefined>(undefined);

  const todayStr = '2026-10-22';
  const [letterDate, setLetterDate] = useState<string>(todayStr);
  const [registrationDate, setRegistrationDate] = useState<string>(todayStr);
  const [externalOriginalNumber, setExternalOriginalNumber] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [sender, setSender] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync valid letterTypeId when category changes
  useEffect(() => {
    const validForCat = letterTypes.filter(
      (t) => t.isActive && t.allowedCategories.split(',').includes(category)
    );
    if (validForCat.length > 0 && !validForCat.some((t) => t.id === letterTypeId)) {
      setLetterTypeId(validForCat[0].id);
    }

    const matchingRules = numberingRules.filter(
      (r) => r.isActive && (r.category === category || r.category === 'ALL')
    );
    setNumberingRuleId(matchingRules[0]?.id);
  }, [category, letterTypes, numberingRules]);

  // Live Numbering Preview based on Tanggal Surat (letterDate)
  useEffect(() => {
    let active = true;
    const loadPreview = async () => {
      if (!departmentId || !letterTypeId || !classificationId || !letterDate) return;
      setPreviewLoading(true);
      try {
        const res = await apiRequest<PreviewResponse>('/api/numbering/preview', {
          method: 'POST',
          body: JSON.stringify({
            category,
            departmentId: Number(departmentId),
            letterTypeId: Number(letterTypeId),
            classificationId: Number(classificationId),
            letterDate,
            numberingRuleId: numberingRuleId ? Number(numberingRuleId) : undefined,
          }),
        });
        if (active) setPreview(res);
      } catch {
        // Ignore transient preview error
      } finally {
        if (active) setPreviewLoading(false);
      }
    };
    loadPreview();
    return () => {
      active = false;
    };
  }, [category, departmentId, letterTypeId, classificationId, letterDate, numberingRuleId]);

  const handleSubmit = async (mode: 'DRAFT' | 'REGISTER') => {
    setError(null);

    if (subject.trim().length < 5) {
      setError('Perihal surat wajib diisi minimal 5 karakter.');
      return;
    }
    if (sender.trim().length < 2 || recipient.trim().length < 2 || destination.trim().length < 2) {
      setError('Pengirim, Penerima, dan Tujuan surat wajib diisi dengan lengkap.');
      return;
    }
    if (summary.trim().length < 5) {
      setError('Ringkasan / isi pokok surat wajib diisi minimal 5 karakter.');
      return;
    }
    if (category === 'INCOMING' && mode === 'REGISTER' && externalOriginalNumber.trim().length < 2) {
      setError('Nomor Surat Asli Pengirim wajib diisi saat mendaftarkan Surat Masuk.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiRequest<LetterRecord>('/api/letters', {
        method: 'POST',
        body: JSON.stringify({
          category,
          mode,
          externalOriginalNumber: category === 'INCOMING' ? externalOriginalNumber.trim() : '',
          letterTypeId: Number(letterTypeId),
          departmentId: Number(departmentId),
          classificationId: Number(classificationId),
          letterDate,
          registrationDate,
          subject: subject.trim(),
          sender: sender.trim(),
          recipient: recipient.trim(),
          destination: destination.trim(),
          summary: summary.trim(),
          adminNotes: adminNotes.trim(),
          numberingRuleId: numberingRuleId ? Number(numberingRuleId) : undefined,
        }),
      });

      // Upload attachment if provided
      if (attachmentFile) {
        const formData = new FormData();
        formData.append('file', attachmentFile);
        await apiRequest(`/api/letters/${created.id}/attachments`, {
          method: 'POST',
          body: formData,
        });
      }

      onSuccess(
        created,
        mode === 'REGISTER'
          ? `Surat berhasil didaftarkan dengan nomor resmi: ${created.officialNumber}`
          : `Draft surat berhasil disimpan dengan kode: ${created.letterCode}`
      );
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data surat.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Form Registrasi & Penomoran Surat Otomatis
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Nomor surat resmi dialokasikan secara langsung (tanpa antrean approval) saat Anda
            menekan tombol Terbitkan & Daftarkan Surat.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          Kembali ke Daftar
        </button>
      </div>

      {/* Live Numbering Engine Preview Box */}
      <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 mb-1">
              <Hash className="w-4 h-4" />
              <span>PRATINJAU NOMOR SURAT RESMI (ESTIMASI SEBELUM ALOKASI)</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono tabular-nums font-bold tracking-tight text-white">
              {previewLoading ? 'Menghitung...' : preview?.previewNumber || '—'}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Acuan Periode Bulan & Tahun menggunakan{' '}
              <span className="text-white font-semibold">Tanggal Surat ({letterDate})</span> ·
              Aturan: <span className="text-slate-200">{preview?.ruleName || '-'}</span>
            </p>
          </div>

          {preview && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2">
                <div className="text-[10px] text-slate-400">Urutan Berikutnya</div>
                <div className="font-mono font-bold text-white mt-0.5">
                  #{preview.components.sequenceFormatted}
                </div>
              </div>
              <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2">
                <div className="text-[10px] text-slate-400">Kode Dept / Jenis</div>
                <div className="font-mono font-bold text-white mt-0.5">
                  {preview.components.departmentCode} / {preview.components.letterTypeCode}
                </div>
              </div>
              <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2">
                <div className="text-[10px] text-slate-400">Bulan Romawi / Tahun</div>
                <div className="font-mono font-bold text-white mt-0.5">
                  {preview.components.romanMonth} / {preview.components.year}
                </div>
              </div>
              <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2">
                <div className="text-[10px] text-slate-400">Lingkup & Reset</div>
                <div className="font-mono font-bold text-blue-300 mt-0.5">
                  {preview.scopeType} · {preview.resetPeriod}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Registration Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        {/* Category Selector Tabs */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            1. Pilih Kategori Surat <span className="text-red-600">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'OUTGOING',
                label: 'Surat Keluar',
                desc: 'Diterbitkan perusahaan untuk pihak eksternal',
              },
              {
                id: 'INCOMING',
                label: 'Surat Masuk',
                desc: 'Diterima dari eksternal (No. Asli + No. Registrasi Internal)',
              },
              {
                id: 'INTERNAL',
                label: 'Surat Internal',
                desc: 'Komunikasi resmi / SK / Memo antardepartemen',
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id as LetterCategory)}
                className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                  category === tab.id
                    ? 'border-blue-700 bg-blue-50/50 text-slate-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-slate-900">{tab.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{tab.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Master Data Classification & Dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Departemen Penerbit / Tujuan <span className="text-red-600">*</span>
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {activeDepts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Jenis Surat <span className="text-red-600">*</span>
            </label>
            <select
              value={letterTypeId}
              onChange={(e) => setLetterTypeId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {availableTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Klasifikasi Kerahasiaan <span className="text-red-600">*</span>
            </label>
            <select
              value={classificationId}
              onChange={(e) => setClassificationId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {activeClass.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tanggal Surat (Dasar Bulan & Tahun Nomor) <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              required
              value={letterDate}
              onChange={(e) => setLetterDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tanggal Registrasi Sistem <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              required
              value={registrationDate}
              onChange={(e) => setRegistrationDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Aturan Penomoran yang Digunakan
            </label>
            <select
              value={numberingRuleId || ''}
              onChange={(e) =>
                setNumberingRuleId(e.target.value ? Number(e.target.value) : undefined)
              }
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {numberingRules
                .filter((r) => r.isActive && (r.category === category || r.category === 'ALL'))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.formatTemplate})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Special Field for Surat Masuk: Nomor Surat Asli Pengirim */}
        {category === 'INCOMING' && (
          <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl">
            <label className="block text-xs font-bold text-teal-950 mb-1">
              Nomor Surat Asli dari Pengirim Eksternal <span className="text-red-600">*</span>
            </label>
            <p className="text-[11px] text-teal-800 mb-2">
              Khusus Surat Masuk: Sistem akan menyimpan Nomor Surat Asli Pengirim ini sekaligus
              menerbitkan Nomor Registrasi Internal perusahaan secara otomatis.
            </p>
            <input
              type="text"
              value={externalOriginalNumber}
              onChange={(e) => setExternalOriginalNumber(e.target.value)}
              placeholder="Contoh: 412/DIR-MSP/X/2026 atau B-889/KPP.0402/2026"
              className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        )}

        {/* Subject, Sender, Recipient, Destination */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Perihal Surat <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Masukkan perihal surat secara jelas dan lengkap..."
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pengirim <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder={
                  category === 'INCOMING'
                    ? 'Nama instansi / perusahaan pengirim'
                    : 'Jabatan / Pejabat penandatangan'
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Penerima <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Nama pejabat / pihak penerima surat"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tujuan / Lokasi / Unit Tujuan <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Kota / Instansi / Departemen tujuan"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ringkasan Pokok / Keterangan Isi Surat <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ringkasan isi surat untuk memudahkan pencarian arsip..."
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Catatan Administrasi / Lokasi Arsip Fisik (Opsional)
              </label>
              <input
                type="text"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Contoh: Lemari Arsip HRD B-01 / Dikirim via Kurir"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Lampiran Dokumen (PDF, DOCX, JPG, PNG — Maks 10MB)
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-blue-700" />
                  <span className="truncate">
                    {attachmentFile
                      ? `${attachmentFile.name} (${Math.round(attachmentFile.size / 1024)} KB)`
                      : 'Pilih berkas dokumen lampiran...'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                {attachmentFile && (
                  <button
                    type="button"
                    onClick={() => setAttachmentFile(null)}
                    className="px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions: Save as Draft OR Direct Registration */}
        <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              Draft belum mengalokasikan nomor urut. Registrasi langsung mengunci nomor urut secara
              permanen.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit('DRAFT')}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              <span>Simpan sebagai Draft</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit('REGISTER')}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>
                {submitting ? 'Memproses...' : 'Terbitkan & Daftarkan Nomor Resmi'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
