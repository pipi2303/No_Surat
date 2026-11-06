import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { apiRequest, setAuthToken } from '../lib/api.ts';
import { DemoAccount, UserProfile } from '../types.ts';

interface LoginViewProps {
  demoAccounts: DemoAccount[];
  companyName: string;
  onAuthenticated: (user: UserProfile, token: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_GA_HRD: 'Admin HRD & GA',
  STAFF: 'Staff Departemen',
  AUDITOR: 'Auditor / Viewer',
};

export function LoginView({ demoAccounts, companyName, onAuthenticated }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingUid, setLoadingUid] = useState<string | null>(null);

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setAuthToken(res.token, null);
      onAuthenticated(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Gagal masuk. Periksa kembali email dan kata sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccountPreset = (account: DemoAccount) => {
    setSelectedUid(account.uid);
    setEmail(account.email);
    setPassword('Demo123!');
    setError(null);
  };

  const handleInstantLogin = async (account: DemoAccount) => {
    setError(null);
    setSelectedUid(account.uid);
    setEmail(account.email);
    setPassword('Demo123!');
    setLoading(true);
    setLoadingUid(account.uid);
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/switch-demo', {
        method: 'POST',
        body: JSON.stringify({ uid: account.uid }),
      });
      setAuthToken(res.token, null);
      onAuthenticated(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Gagal masuk dengan akun terpilih.');
    } finally {
      setLoading(false);
      setLoadingUid(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setAuthToken(idToken, null);
      const meRes = await apiRequest<{ user: UserProfile }>('/api/auth/me');
      onAuthenticated(meRes.user, idToken);
    } catch (err: any) {
      setError(err.message || 'Autentikasi Google dibatalkan atau belum berhasil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Subtle Architectural Grid Accent */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.35), transparent 45%), radial-gradient(circle at 80% 80%, rgba(15, 23, 42, 0.8), transparent 50%)',
        }}
      />

      <div className="w-full max-w-[960px] relative z-10 grid grid-cols-1 lg:grid-cols-12 bg-white rounded-2xl shadow-2xl border border-slate-800/20 overflow-hidden">
        {/* Left Column: Sleek Login Form (7 cols on lg) */}
        <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-between bg-white">
          <div>
            {/* Brand Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-sm shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 tracking-tight truncate">
                  Office Letter System
                </div>
                <div className="text-xs text-slate-500 truncate">{companyName}</div>
              </div>
            </div>

            {/* Welcome Heading */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Selamat Datang Kembali
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Masuk untuk mengelola penomoran otomatis, registrasi, dan arsip surat resmi.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            {/* Main Credential Form */}
            <form onSubmit={handleCredentialLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Pengguna
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@nusantaratek.co.id"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kata Sandi
                  </label>
                  {demoAccounts.length > 0 && (
                    <span className="text-[11px] font-mono text-slate-400">Default: Demo123!</span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer mt-2"
              >
                {loading && !loadingUid ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>{loading && !loadingUid ? 'Memverifikasi...' : 'Masuk ke Aplikasi'}</span>
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[11px] text-slate-400 font-medium">atau masuk dengan</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            {/* Google Sign-In */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>Akun Google Korporat (Single Sign-On)</span>
            </button>
          </div>

          {/* Footer Note */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>Penomoran Otomatis & Anti-Duplikat</span>
            <span>·</span>
            <span>Arsip Resmi & Audit Trail</span>
          </div>
        </div>

        {/* Right Column: 1-Click Quick Role Switcher (5 cols on lg) */}
        <div className="lg:col-span-5 bg-slate-900 text-white p-7 sm:p-8 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Akses Cepat Role
              </span>
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-blue-400" /> 1-Klik Login
              </span>
            </div>
            <h2 className="text-base font-bold text-white mb-1">
              Pilih Profil Pengguna
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              Klik akun di bawah untuk mengisi kredensial atau klik <strong className="text-slate-200">Masuk</strong> untuk langsung membuka dashboard sesuai hak akses.
            </p>

            {/* Role Cards List */}
            <div className="space-y-2.5">
              {demoAccounts.map((acc) => {
                const isSelected = selectedUid === acc.uid || email === acc.email;
                const isBusy = loadingUid === acc.uid;
                return (
                  <div
                    key={acc.uid}
                    onClick={() => handleSelectAccountPreset(acc)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-500/80'
                        : 'bg-slate-800/50 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-semibold text-blue-400">
                          {ROLE_LABELS[acc.roleCode] || acc.roleCode}
                        </span>
                        <span className="text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono text-slate-400">{acc.departmentCode}</span>
                      </div>
                      <div className="text-xs font-semibold text-white truncate mt-0.5">
                        {acc.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        {acc.email}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInstantLogin(acc);
                      }}
                      className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-slate-700/80 hover:bg-blue-600 text-slate-200 hover:text-white'
                      }`}
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <span>Masuk</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Mendukung 4 level hak akses: Super Admin, Admin HRD/GA, Staff, dan Auditor.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
