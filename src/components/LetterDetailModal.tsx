import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileText,
  History,
  Paperclip,
  Printer,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiRequest, getAuthToken } from '../lib/api.ts';
import {
  CompanySettings,
  Department,
  LetterClassification,
  LetterRecord,
  LetterType,
  RoleCode,
} from '../types.ts';

interface LetterDetailModalProps {
  letterId: number;
  userRole: RoleCode;
  companySettings: CompanySettings | null;
  departments: Department[];
  letterTypes: LetterType[];
  classifications: LetterClassification[];
  onClose: () => void;
  onUpdated: (message: string) => void;
}

export function LetterDetailModal({
  letterId,
  userRole,
  companySettings,
  departments,
  letterTypes,
  classifications,
  onClose,
  onUpdated,
}: LetterDetailModalProps) {
  const [letter, setLetter] = useState<LetterRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editSender, setEditSender] = useState('');
  const [editRecipient, setEditRecipient] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [editExternalNumber, setEditExternalNumber] = useState('');

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [previewAttachmentId, setPreviewAttachmentId] = useState<number | null>(null);

  const canModify = userRole !== 'AUDITOR';
  const canCancel = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_GA_HRD';

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<LetterRecord>(`/api/letters/${letterId}`);
      setLetter(data);
      setEditSubject(data.subject);
      setEditSender(data.sender);
      setEditRecipient(data.recipient);
      setEditDestination(data.destination);
      setEditSummary(data.summary);
      setEditAdminNotes(data.adminNotes || '');
      setEditExternalNumber(data.externalOriginalNumber || '');
    } catch (err: any) {
      setError(err.message || 'Gagal memuat detail surat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [letterId]);

  const handlePublishDraft = async () => {
    if (!letter) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await apiRequest<LetterRecord>(`/api/letters/${letter.id}/register`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await loadDetail();
      onUpdated(`Nomor resmi berhasil diterbitkan: ${updated.officialNumber}`);
    } catch (err: any) {
      setError(err.message || 'Gagal menerbitkan nomor resmi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!letter) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/letters/${letter.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          subject: editSubject,
          sender: editSender,
          recipient: editRecipient,
          destination: editDestination,
          summary: editSummary,
          adminNotes: editAdminNotes,
          externalOriginalNumber: editExternalNumber,
        }),
      });
      setIsEditing(false);
      await loadDetail();
      onUpdated('Perubahan data surat berhasil disimpan dan dicatat dalam Audit Trail.');
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui data surat.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!letter) return;
    if (cancelReason.trim().length < 10) {
      setError('Alasan pembatalan wajib diisi minimal 10 karakter.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/letters/${letter.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      setShowCancelModal(false);
      await loadDetail();
      onUpdated(
        `Surat ${letter.officialNumber || letter.letterCode} telah dibatalkan. Nomor tetap dikunci dan tidak digunakan ulang.`
      );
    } catch (err: any) {
      setError(err.message || 'Gagal membatalkan surat.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadAttachment = async (file: File) => {
    if (!letter) return;
    setActionLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiRequest(`/api/letters/${letter.id}/attachments`, {
        method: 'POST',
        body: formData,
      });
      await loadDetail();
      onUpdated(`Lampiran "${file.name}" berhasil diunggah.`);
    } catch (err: any) {
      setError(err.message || 'Gagal mengunggah lampiran.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAttachment = async (attId: number) => {
    setActionLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/attachments/${attId}`, { method: 'DELETE' });
      await loadDetail();
      onUpdated('Lampiran berhasil dihapus.');
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus lampiran.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadAttachment = async (attId: number, fileName: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/attachments/${attId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Gagal mengunduh berkas.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Gagal mengunduh lampiran.');
    }
  };

  const handleExportSingleJson = () => {
    if (!letter) return;
    const blob = new Blob([JSON.stringify(letter, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arsip-surat-${letter.letterCode}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  let parsedComponents: Record<string, any> | null = null;
  if (letter?.numberingComponentsJson) {
    try {
      parsedComponents = JSON.parse(letter.numberingComponentsJson);
    } catch {
      parsedComponents = null;
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 no-print">
          <div>
            <div className="text-xs font-mono text-slate-500">
              DETAIL & ARSIP REGISTRASI SURAT · ID #{letter?.letterCode || letterId}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              {letter?.officialNumber || `Draft Surat (${letter?.letterCode || ''})`}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Bukti</span>
            </button>
            <button
              type="button"
              onClick={handleExportSingleJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor JSON</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Memuat rincian surat...</div>
          ) : !letter ? (
            <div className="py-12 text-center text-xs text-red-600">
              {error || 'Data surat tidak ditemukan.'}
            </div>
          ) : (
            <>
              {/* Print Header (Visible when printed) */}
              <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {companySettings?.companyName || 'PT Nusantara Teknologi Mandiri'}
                  </div>
                  <div className="text-xs text-slate-500">{companySettings?.address}</div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-[11px] font-semibold text-slate-500">
                    NOMOR RESMI SURAT TERDAFTAR
                  </div>
                  <div className="text-xl font-mono tabular-nums font-bold text-blue-700">
                    {letter.officialNumber || '[DRAFT - BELUM DIALOKASIKAN]'}
                  </div>
                  {letter.category === 'INCOMING' && letter.externalOriginalNumber && (
                    <div className="text-xs font-mono text-teal-700 mt-0.5">
                      No. Surat Asli Pengirim: {letter.externalOriginalNumber}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {error}
                </div>
              )}

              {/* Cancellation Banner if Cancelled */}
              {letter.status === 'CANCELLED' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-800">
                    <Ban className="w-4 h-4" />
                    <span>
                      SURAT INI TELAH DIBATALKAN (NOMOR TETAP DIKUNCI DAN TIDAK DIGUNAKAN ULANG)
                    </span>
                  </div>
                  <p className="text-xs text-red-700">
                    <span className="font-semibold">Alasan Pembatalan:</span>{' '}
                    {letter.cancellationReason}
                  </p>
                  <p className="text-[11px] font-mono text-red-600">
                    Dibatalkan oleh: {letter.cancelledBy} · Waktu:{' '}
                    {letter.cancelledAt
                      ? new Date(letter.cancelledAt).toLocaleString('id-ID')
                      : '-'}
                  </p>
                </div>
              )}

              {/* Administrative Status & Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl no-print">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 mr-1.5">Status Administratif:</span>
                    {letter.status === 'REGISTERED' && (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Terdaftar Resmi</span>
                      </span>
                    )}
                    {letter.status === 'DRAFT' && (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                        <Clock className="w-4 h-4" />
                        <span>Draft (Belum Bernomor)</span>
                      </span>
                    )}
                    {letter.status === 'CANCELLED' && (
                      <span className="inline-flex items-center gap-1 font-bold text-red-600">
                        <Ban className="w-4 h-4" />
                        <span>Dibatalkan</span>
                      </span>
                    )}
                  </div>
                  <span className="text-slate-300">·</span>
                  <div>
                    <span className="text-slate-500">Kategori: </span>
                    <span className="font-semibold text-slate-900">
                      {letter.category === 'OUTGOING'
                        ? 'Surat Keluar'
                        : letter.category === 'INCOMING'
                        ? 'Surat Masuk'
                        : 'Surat Internal'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {letter.status === 'DRAFT' && canModify && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handlePublishDraft}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Terbitkan Nomor Resmi Sekarang</span>
                    </button>
                  )}

                  {letter.status !== 'CANCELLED' && canModify && !isEditing && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Informasi</span>
                    </button>
                  )}

                  {letter.status !== 'CANCELLED' && canCancel && !showCancelModal && (
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Batalkan Surat</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Cancellation Confirmation Form */}
              {showCancelModal && (
                <div className="p-4 bg-red-50 border border-red-300 rounded-xl space-y-3 no-print">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-900">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Konfirmasi Pembatalan Surat Resmi</span>
                  </div>
                  <p className="text-xs text-red-800">
                    Surat yang dibatalkan dinyatakan tidak berlaku secara administratif, namun nomor{' '}
                    <span className="font-mono font-bold">
                      {letter.officialNumber || letter.letterCode}
                    </span>{' '}
                    tetap tersimpan permanen dan tidak akan pernah dialokasikan ulang ke surat lain.
                  </p>
                  <textarea
                    rows={2}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Masukkan alasan resmi pembatalan surat (minimal 10 karakter)..."
                    className="w-full px-3 py-2 text-xs bg-white border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
                    >
                      Urungkan
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleConfirmCancel}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                    >
                      Konfirmasi Batalkan Surat
                    </button>
                  </div>
                </div>
              )}

              {/* Letter Metadata View / Edit Form */}
              {isEditing ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 no-print">
                  <h4 className="text-xs font-bold text-slate-900">
                    Perbarui Informasi Surat (Tercatat pada Audit Trail)
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Perihal Surat
                      </label>
                      <input
                        type="text"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    {letter.category === 'INCOMING' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Nomor Surat Asli Pengirim
                        </label>
                        <input
                          type="text"
                          value={editExternalNumber}
                          onChange={(e) => setEditExternalNumber(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Pengirim
                        </label>
                        <input
                          type="text"
                          value={editSender}
                          onChange={(e) => setEditSender(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Penerima
                        </label>
                        <input
                          type="text"
                          value={editRecipient}
                          onChange={(e) => setEditRecipient(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Tujuan
                        </label>
                        <input
                          type="text"
                          value={editDestination}
                          onChange={(e) => setEditDestination(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Ringkasan Isi
                      </label>
                      <textarea
                        rows={2}
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Catatan Administrasi
                      </label>
                      <input
                        type="text"
                        value={editAdminNotes}
                        onChange={(e) => setEditAdminNotes(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleSaveEdit}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Simpan Perubahan</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 border border-slate-200 rounded-xl space-y-2.5">
                    <div>
                      <div className="text-[11px] text-slate-500">Perihal Surat</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {letter.subject}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <div className="text-[11px] text-slate-500">Departemen</div>
                        <div className="font-medium text-slate-900">
                          <span className="font-mono font-bold text-blue-700">
                            {letter.department?.code}
                          </span>{' '}
                          — {letter.department?.name}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Jenis Surat</div>
                        <div className="font-medium text-slate-900">
                          <span className="font-mono font-bold">{letter.letterType?.code}</span> —{' '}
                          {letter.letterType?.name}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Tanggal Surat (Acuan Nomor)
                        </div>
                        <div className="font-mono font-semibold text-slate-900">
                          {letter.letterDate}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Tanggal Registrasi</div>
                        <div className="font-mono text-slate-700">{letter.registrationDate}</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-500">Klasifikasi & Pencatat</div>
                      <div className="text-slate-800">
                        {letter.classification?.code} ({letter.classification?.name}) · Dicatat
                        oleh: <span className="font-semibold">{letter.createdByName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[11px] text-slate-500">Pengirim</div>
                        <div className="font-semibold text-slate-900">{letter.sender}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Penerima</div>
                        <div className="font-semibold text-slate-900">{letter.recipient}</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-500">Tujuan / Lokasi</div>
                      <div className="text-slate-800">{letter.destination}</div>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-500">Ringkasan Pokok Isi Surat</div>
                      <div className="text-slate-800 leading-relaxed">{letter.summary}</div>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-500">Catatan Administrasi</div>
                      <div className="text-slate-700">{letter.adminNotes || '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Historical Numbering Components Audit Snapshot */}
              {parsedComponents && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs font-bold text-slate-800 mb-2">
                    Komponen Pembentuk Nomor Historis (Terkunci Saat Penerbitan)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                    <div className="bg-white border border-slate-200 rounded p-2">
                      <div className="text-[10px] text-slate-400">Nomor Urut</div>
                      <div className="font-mono font-bold text-slate-900">
                        {parsedComponents.sequenceFormatted || parsedComponents.sequence}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded p-2">
                      <div className="text-[10px] text-slate-400">Kode Departemen</div>
                      <div className="font-mono font-bold text-slate-900">
                        {parsedComponents.departmentCode}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded p-2">
                      <div className="text-[10px] text-slate-400">Kode Jenis</div>
                      <div className="font-mono font-bold text-slate-900">
                        {parsedComponents.letterTypeCode}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded p-2">
                      <div className="text-[10px] text-slate-400">Bulan (Romawi)</div>
                      <div className="font-mono font-bold text-slate-900">
                        {parsedComponents.romanMonth} ({parsedComponents.month})
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded p-2">
                      <div className="text-[10px] text-slate-400">Tahun Surat</div>
                      <div className="font-mono font-bold text-slate-900">
                        {parsedComponents.year}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded p-2">
                      <div className="text-[10px] text-slate-400">Template Format</div>
                      <div className="font-mono text-[11px] text-slate-700 truncate">
                        {parsedComponents.template}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Attachments Section */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 no-print">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-700" />
                    <h4 className="text-xs font-bold text-slate-900">
                      Berkas Lampiran Dokumen ({letter.attachments?.length || 0})
                    </h4>
                  </div>

                  {canModify && letter.status !== 'CANCELLED' && (
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah Lampiran</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadAttachment(f);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {(!letter.attachments || letter.attachments.length === 0) ? (
                  <p className="text-xs text-slate-500">
                    Belum ada dokumen lampiran yang diunggah pada surat ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                    {letter.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate">
                              {att.fileName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {Math.max(1, Math.round(att.fileSize / 1024))} KB · Diunggah oleh{' '}
                              {att.uploadedByName}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {(att.mimeType.includes('image') || att.mimeType.includes('pdf')) && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewAttachmentId(
                                  previewAttachmentId === att.id ? null : att.id
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Preview</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(att.id, att.fileName)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh</span>
                          </button>
                          {canModify && letter.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              title="Hapus Lampiran"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {previewAttachmentId && (
                  <div className="mt-3 p-3 bg-slate-100 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                      <span>Pratinjau Dokumen Lampiran</span>
                      <button
                        type="button"
                        onClick={() => setPreviewAttachmentId(null)}
                        className="text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Tutup Pratinjau
                      </button>
                    </div>
                    <iframe
                      title="Document Preview"
                      src={`/api/attachments/${previewAttachmentId}/download?inline=true`}
                      className="w-full h-72 bg-white rounded border border-slate-300"
                    />
                  </div>
                )}
              </div>

              {/* Letter Audit Trail History */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 no-print">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-700" />
                  <h4 className="text-xs font-bold text-slate-900">
                    Riwayat Perubahan & Audit Trail Surat Ini
                  </h4>
                </div>
                <div className="space-y-2.5">
                  {(letter.historyLogs || []).map((h) => (
                    <div
                      key={h.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-800">
                          {h.userName} ({h.userRole}) · {h.action}
                        </span>
                        <span className="font-mono">
                          {new Date(h.createdAt).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="text-slate-700 mt-1">{h.description}</div>
                      {h.reason && (
                        <div className="text-red-700 mt-1 font-medium">
                          Alasan: {h.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
