import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CornerDownLeft,
  Eye,
  FileText,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { LetterCategory, LetterRecord } from '../types.ts';

interface GlobalSearchBarProps {
  onSelectLetter: (letterId: number) => void;
  onViewAllResults: (query: string, category: LetterCategory | 'ALL') => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  OUTGOING: 'Surat Keluar',
  INCOMING: 'Surat Masuk',
  INTERNAL: 'Surat Internal',
};

const STATUS_LABELS: Record<string, { label: string; colorClass: string }> = {
  REGISTERED: { label: 'Terdaftar', colorClass: 'text-emerald-700 font-semibold' },
  DRAFT: { label: 'Draft', colorClass: 'text-amber-700 font-semibold' },
  CANCELLED: { label: 'Dibatalkan', colorClass: 'text-red-700 font-semibold' },
};

export function GlobalSearchBar({
  onSelectLetter,
  onViewAllResults,
}: GlobalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<LetterCategory | 'ALL'>('ALL');
  const [results, setResults] = useState<LetterRecord[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut Ctrl+K / Cmd+K to focus search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced live search across all categories
  useEffect(() => {
    const trimmed = query.trim();
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (trimmed) {
          params.set('search', trimmed);
        }
        if (categoryFilter !== 'ALL') {
          params.set('category', categoryFilter);
        }
        params.set('page', '1');
        params.set('limit', '8');

        const res = await apiRequest<{
          items: LetterRecord[];
          total: number;
        }>(`/api/letters?${params.toString()}`);

        setResults(res.items);
        setTotalMatches(res.total);
        setActiveIndex(-1);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, categoryFilter, isOpen]);

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        const selected = results[activeIndex];
        setIsOpen(false);
        onSelectLetter(selected.id);
      } else {
        setIsOpen(false);
        onViewAllResults(query.trim(), categoryFilter);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl">
      {/* Search Input Control */}
      <div
        className={`flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-1.5 transition-all ${
          isOpen
            ? 'bg-white border-blue-600 ring-2 ring-blue-600/15 shadow-xs'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDownInput}
          placeholder="Cari nomor surat, perihal, atau pengirim di semua kategori..."
          aria-label="Pencarian surat global"
          className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />}
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            title="Bersihkan pencarian"
            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
          Ctrl K
        </kbd>
      </div>

      {/* Instant Search Results Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Category Filter Bar (Interactive Segmented Buttons) */}
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/75 rounded-lg">
              {(
                [
                  { id: 'ALL', label: 'Semua Kategori' },
                  { id: 'OUTGOING', label: 'Surat Keluar' },
                  { id: 'INCOMING', label: 'Surat Masuk' },
                  { id: 'INTERNAL', label: 'Surat Internal' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                    categoryFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500">
              {query.trim()
                ? `${totalMatches} hasil ditemukan`
                : `Menampilkan arsip terbaru (${totalMatches} total)`}
            </span>
          </div>

          {/* Results List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {results.length === 0 && !loading ? (
              <div className="py-10 px-4 text-center space-y-1.5">
                <FileText className="w-6 h-6 text-slate-300 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">
                  Tidak ada surat yang cocok dengan &ldquo;{query}&rdquo;
                </div>
                <p className="text-[11px] text-slate-500">
                  Coba gunakan kata kunci perihal, nama pengirim, nomor surat resmi, atau nomor asli pengirim.
                </p>
              </div>
            ) : (
              results.map((letter, idx) => {
                const statusMeta = STATUS_LABELS[letter.status] || {
                  label: letter.status,
                  colorClass: 'text-slate-600',
                };
                const isSelected = idx === activeIndex;

                return (
                  <button
                    key={letter.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      setIsOpen(false);
                      onSelectLetter(letter.id);
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Reference Number Line */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-mono font-bold text-blue-700">
                          {letter.officialNumber || letter.letterCode}
                        </span>
                        {letter.externalOriginalNumber && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              No. Asli: {letter.externalOriginalNumber}
                            </span>
                          </>
                        )}
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className={`text-[11px] ${statusMeta.colorClass}`}>
                          {statusMeta.label}
                        </span>
                      </div>

                      {/* Subject */}
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {letter.subject}
                      </div>

                      {/* Unboxed Metadata Line (Category · Dept · Sender -> Recipient · Date) */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="font-medium text-slate-700">
                          {CATEGORY_LABELS[letter.category] || letter.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{letter.department?.code || '-'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[200px]">
                          Pengirim: <strong className="font-medium text-slate-700">{letter.sender}</strong>
                        </span>
                        <span aria-hidden="true">→</span>
                        <span className="truncate max-w-[180px]">{letter.recipient}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{letter.letterDate}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-blue-700 pt-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Detail</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Popover Footer Action */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="w-3 h-3" /> Enter untuk membuka semua hasil
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onViewAllResults(query.trim(), categoryFilter);
              }}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
            >
              <span>
                Lihat seluruh hasil di Manajemen Surat
                {query.trim() ? ` ("${query.trim()}")` : ''}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
