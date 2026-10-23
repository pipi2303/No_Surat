import React, { useState } from 'react';
import { Building2, KeyRound, LogIn, ShieldCheck, UserCheck } from 'lucide-react';
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
  ADMIN_GA_HRD: 'Admin HRD / GA / Sekretariat',
  STAFF: 'Staff Departemen',
  AUDITOR: 'Viewer / Auditor',
};

export function LoginView({ demoAccounts, companyName, onAuthenticated }: LoginViewProps) {
  const [email, setEmail] = useState('superadmin@nusantaratek.co.id');
  const [password, setPassword] = useState('Demo123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.token, null);
      onAuthenticated(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Gagal login dengan kredensial.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoSwitch = async (account: DemoAccount) => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/switch-demo', {
        method: 'POST',
        body: JSON.stringify({ uid: account.uid }),
      });
      setAuthToken(res.token, null);
      onAuthenticated(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Gagal beralih ke akun demo.');
    } finally {
      setLoading(false);
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
      setError(err.message || 'Autentikasi Google gagal atau dibatalkan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {/* Left Panel: Enterprise Identity & Instant Demo Switcher */}
        <div className="lg:col-span-7 bg-slate-900 text-white p-8 lg:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Office Letter Management System
                </h1>
                <p className="text-xs text-slate-400">{companyName}</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white leading-snug mb-3">
              Sistem Registrasi, Penomoran Otomatis & Arsip Surat Korporat
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-8">
              Platform terpusat untuk penomoran surat keluar, surat masuk, dan memorandum internal
              dengan penguncian urutan transaksional (bebas nomor ganda), jejak audit menyeluruh,
              dan pemrosesan langsung sesuai kewenangan peran.
            </p>

            <div className="border-t border-slate-800 pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-300">
                  Akses Cepat Pengujian Multi-Role (Klik untuk Masuk Instan)
                </span>
                <span className="text-xs font-mono text-slate-400">Password Demo: Demo123!</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.uid}
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickDemoSwitch(acc)}
                    className="text-left p-3.5 rounded-lg border border-slate-800 bg-slate-800/60 hover:bg-slate-800 hover:border-blue-500/50 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-blue-400 group-hover:text-blue-300">
                        {ROLE_LABELS[acc.roleCode] || acc.roleCode}
                      </span>
                      <span className="text-xs font-mono text-slate-400">{acc.departmentCode}</span>
                    </div>
                    <div className="text-sm font-medium text-white truncate">{acc.name}</div>
                    <div className="text-xs font-mono text-slate-400 truncate mt-0.5">
                      {acc.email}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>PostgreSQL Transactional Engine</span>
            <span>·</span>
            <span>Zero-Approval Direct Registry</span>
            <span>·</span>
            <span>Full Audit Trail</span>
          </div>
        </div>

        {/* Right Panel: Credential Login & Google Workspace Sign-In */}
        <div className="lg:col-span-5 p-8 lg:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900">Masuk ke Portal Administrasi</h3>
            <p className="text-sm text-slate-600 mt-1">
              Gunakan kredensial akun perusahaan atau pilih akun role di sebelah kiri.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleCredentialLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alamat Email Perusahaan
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@nusantaratek.co.id"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kata Sandi
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Memverifikasi...' : 'Masuk dengan Email & Password'}</span>
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-xs text-slate-400">atau autentikasi SSO</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <span>Masuk dengan Akun Google Korporat</span>
          </button>

          <div className="mt-6 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-700" />
              <span>Informasi Kredensial Demo</span>
            </div>
            <p>
              Klik salah satu kartu akun di panel kiri untuk mengisi & masuk otomatis, atau gunakan
              kata sandi <span className="font-mono font-semibold text-slate-900">Demo123!</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
