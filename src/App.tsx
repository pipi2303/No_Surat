/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileBarChart2,
  FilePlus2,
  Files,
  FolderKanban,
  Hash,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { apiRequest, setAuthToken } from './lib/api.ts';
import {
  CompanySettings,
  DemoAccount,
  Department,
  LetterCategory,
  LetterClassification,
  LetterType,
  NumberingCounter,
  NumberingRule,
  RoleCode,
  UserProfile,
} from './types.ts';
import { LoginView } from './components/LoginView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { LettersListView } from './components/LettersListView.tsx';
import { LetterFormView } from './components/LetterFormView.tsx';
import { LetterDetailModal } from './components/LetterDetailModal.tsx';
import { MasterDataView } from './components/MasterDataView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { AuditAndSystemView } from './components/AuditAndSystemView.tsx';

type NavPage =
  | 'DASHBOARD'
  | 'LETTERS_ALL'
  | 'LETTERS_OUTGOING'
  | 'LETTERS_INCOMING'
  | 'LETTERS_INTERNAL'
  | 'CREATE_LETTER'
  | 'MASTER_DATA'
  | 'REPORTS'
  | 'AUDIT_TRAIL'
  | 'USER_MANAGEMENT'
  | 'SETTINGS'
  | 'NOT_FOUND';

const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_GA_HRD: 'Admin HRD / GA / Sekretariat',
  STAFF: 'Staff Departemen',
  AUDITOR: 'Viewer / Auditor',
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [initializing, setInitializing] = useState<boolean>(true);

  // Navigation State
  const [activePage, setActivePage] = useState<NavPage>('DASHBOARD');
  const [defaultCreateCategory, setDefaultCreateCategory] = useState<LetterCategory>('OUTGOING');
  const [masterSubTab, setMasterSubTab] = useState<
    'DEPARTMENTS' | 'TYPES' | 'CLASSIFICATIONS' | 'RULES' | 'COMPANY'
  >('RULES');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Master Data State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [letterTypes, setLetterTypes] = useState<LetterType[]>([]);
  const [classifications, setClassifications] = useState<LetterClassification[]>([]);
  const [numberingRules, setNumberingRules] = useState<NumberingRule[]>([]);
  const [numberingCounters, setNumberingCounters] = useState<NumberingCounter[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  // Detail Modal & Toast State
  const [selectedLetterId, setSelectedLetterId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dashboardRefreshTrigger, setDashboardRefreshTrigger] = useState(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  const loadMasterAndProfile = async () => {
    try {
      const [demoRes, meRes, masterRes] = await Promise.all([
        apiRequest<{ accounts: DemoAccount[] }>('/api/auth/demo-accounts'),
        apiRequest<{ user: UserProfile }>('/api/auth/me'),
        apiRequest<{
          departments: Department[];
          letterTypes: LetterType[];
          classifications: LetterClassification[];
          numberingRules: NumberingRule[];
          numberingCounters: NumberingCounter[];
          companySettings: CompanySettings | null;
        }>('/api/master-bundle'),
      ]);

      setDemoAccounts(demoRes.accounts);
      setCurrentUser(meRes.user);
      setDepartments(masterRes.departments);
      setLetterTypes(masterRes.letterTypes);
      setClassifications(masterRes.classifications);
      setNumberingRules(masterRes.numberingRules);
      setNumberingCounters(masterRes.numberingCounters);
      setCompanySettings(masterRes.companySettings);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Initialization failed:', err);
      setIsAuthenticated(false);
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    loadMasterAndProfile();
  }, []);

  const handleInstantRoleSwitch = async (uid: string) => {
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/switch-demo', {
        method: 'POST',
        body: JSON.stringify({ uid }),
      });
      setAuthToken(res.token, uid);
      const meRes = await apiRequest<{ user: UserProfile }>('/api/auth/me');
      setCurrentUser(meRes.user);
      showToast(
        `Sesi beralih ke: ${meRes.user.name} (${ROLE_LABELS[meRes.user.roleCode]})`
      );
      if (meRes.user.roleCode === 'AUDITOR' && activePage === 'CREATE_LETTER') {
        setActivePage('DASHBOARD');
      }
      if (
        meRes.user.roleCode === 'STAFF' &&
        (activePage === 'AUDIT_TRAIL' || activePage === 'USER_MANAGEMENT')
      ) {
        setActivePage('DASHBOARD');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal beralih akun role.');
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null, null);
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-lg bg-blue-700 text-white flex items-center justify-center mx-auto font-bold">
            OL
          </div>
          <div className="text-sm font-bold text-slate-900">
            Office Letter Management System
          </div>
          <div className="text-xs text-slate-500">
            Menghubungkan ke basis data PostgreSQL & memuat aturan penomoran...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <LoginView
        demoAccounts={demoAccounts}
        companyName={companySettings?.companyName || 'PT Nusantara Teknologi Mandiri'}
        onAuthenticated={async (user, token) => {
          setAuthToken(token, null);
          setCurrentUser(user);
          setIsAuthenticated(true);
          await loadMasterAndProfile();
          showToast(`Selamat datang kembali, ${user.name}.`);
        }}
      />
    );
  }

  const role = currentUser.roleCode;
  const canCreateLetter = role !== 'AUDITOR';
  const canViewAudit = role === 'SUPER_ADMIN' || role === 'ADMIN_GA_HRD' || role === 'AUDITOR';
  const canManageUsers = role === 'SUPER_ADMIN' || role === 'ADMIN_GA_HRD';

  const navigateTo = (page: NavPage) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-3 text-xs font-medium no-print">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Left Sidebar Navigation (268px Desktop, Drawer on Mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[268px] bg-slate-900 text-slate-300 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 no-print ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-6 overflow-y-auto">
          {/* Brand Lockup */}
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  Office Letter System
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {companySettings?.companyCode || 'NTM'} · Administrasi Korporat
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Primary Navigation Menu (Role-Based) */}
          <nav className="space-y-5 text-xs">
            {/* 1. Dashboard & Registrasi */}
            <div className="space-y-1">
              <div className="px-2.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5">
                Utama
              </div>
              <button
                type="button"
                onClick={() => navigateTo('DASHBOARD')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  activePage === 'DASHBOARD'
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>1. Dashboard Eksekutif</span>
              </button>

              {canCreateLetter && (
                <button
                  type="button"
                  onClick={() => {
                    setDefaultCreateCategory('OUTGOING');
                    navigateTo('CREATE_LETTER');
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                    activePage === 'CREATE_LETTER'
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-blue-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <FilePlus2 className="w-4 h-4 shrink-0" />
                  <span>3. Buat / Registrasi Surat</span>
                </button>
              )}
            </div>

            {/* 2. Manajemen Surat */}
            <div className="space-y-1">
              <div className="px-2.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5">
                2. Manajemen Surat
              </div>
              <button
                type="button"
                onClick={() => navigateTo('LETTERS_ALL')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  activePage === 'LETTERS_ALL'
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Files className="w-4 h-4 shrink-0" />
                <span>Semua Arsip Surat</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('LETTERS_OUTGOING')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  activePage === 'LETTERS_OUTGOING'
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 shrink-0" />
                <span>Surat Keluar</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('LETTERS_INCOMING')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  activePage === 'LETTERS_INCOMING'
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 shrink-0" />
                <span>Surat Masuk</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('LETTERS_INTERNAL')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  activePage === 'LETTERS_INTERNAL'
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <FolderKanban className="w-4 h-4 shrink-0" />
                <span>Surat Internal</span>
              </button>
            </div>

            {/* 4. Master Data */}
            <div className="space-y-1">
              <div className="px-2.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5">
                4. Master Data & Penomoran
              </div>
              {[
                { sub: 'RULES', label: 'Aturan Penomoran', icon: Hash },
                { sub: 'DEPARTMENTS', label: 'Departemen', icon: Building2 },
                { sub: 'TYPES', label: 'Jenis Surat', icon: Layers },
                { sub: 'CLASSIFICATIONS', label: 'Klasifikasi Surat', icon: Shield },
                { sub: 'COMPANY', label: 'Identitas Perusahaan', icon: Settings },
              ].map((m) => {
                const Icon = m.icon;
                const active = activePage === 'MASTER_DATA' && masterSubTab === m.sub;
                return (
                  <button
                    key={m.sub}
                    type="button"
                    onClick={() => {
                      setMasterSubTab(m.sub as any);
                      navigateTo('MASTER_DATA');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-700 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 5 - 8. Laporan, Audit, Pengguna, Pengaturan */}
            <div className="space-y-1">
              <div className="px-2.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5">
                Tata Kelola & Sistem
              </div>
              <button
                type="button"
                onClick={() => navigateTo('REPORTS')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  activePage === 'REPORTS'
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <FileBarChart2 className="w-4 h-4 shrink-0" />
                <span>5. Laporan Surat</span>
              </button>

              {canViewAudit && (
                <button
                  type="button"
                  onClick={() => navigateTo('AUDIT_TRAIL')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                    activePage === 'AUDIT_TRAIL'
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <History className="w-4 h-4 shrink-0" />
                  <span>6. Audit Trail</span>
                </button>
              )}

              {canManageUsers && (
                <button
                  type="button"
                  onClick={() => navigateTo('USER_MANAGEMENT')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                    activePage === 'USER_MANAGEMENT'
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>7. Manajemen Pengguna</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => navigateTo('SETTINGS')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  activePage === 'SETTINGS'
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span>8. Pengaturan & Uji Sistem</span>
              </button>
            </div>
          </nav>
        </div>

        {/* 9. Logout & User Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 space-y-3">
          <div className="text-xs">
            <div className="font-semibold text-white truncate">{currentUser.name}</div>
            <div className="text-[11px] font-mono text-blue-400">
              {ROLE_LABELS[currentUser.roleCode]}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-red-600/90 text-slate-200 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>9. Keluar (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Enterprise Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {companySettings?.companyName || 'PT Nusantara Teknologi Mandiri'}
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                Office Letter Management System · Direktori Penomoran & Arsip Resmi
              </p>
            </div>
          </div>

          {/* Right Zone: Instant Role Switcher & Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1">
              <span className="text-[11px] font-medium text-slate-500">Simulasi Role:</span>
              <select
                value={currentUser.uid}
                onChange={(e) => handleInstantRoleSwitch(e.target.value)}
                className="text-xs font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {demoAccounts.map((acc) => (
                  <option key={acc.uid} value={acc.uid}>
                    {acc.name} — [{acc.roleCode}]
                  </option>
                ))}
              </select>
            </div>

            {canCreateLetter && (
              <button
                type="button"
                onClick={() => {
                  setDefaultCreateCategory('OUTGOING');
                  navigateTo('CREATE_LETTER');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>Buat Surat</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activePage === 'DASHBOARD' && (
            <DashboardView
              key={dashboardRefreshTrigger}
              departments={departments}
              onSelectLetter={(id) => setSelectedLetterId(id)}
              onNavigateCreate={(cat) => {
                setDefaultCreateCategory(cat || 'OUTGOING');
                navigateTo('CREATE_LETTER');
              }}
              onNavigateCategory={(cat) => {
                if (cat === 'OUTGOING') navigateTo('LETTERS_OUTGOING');
                if (cat === 'INCOMING') navigateTo('LETTERS_INCOMING');
                if (cat === 'INTERNAL') navigateTo('LETTERS_INTERNAL');
              }}
            />
          )}

          {(activePage === 'LETTERS_ALL' ||
            activePage === 'LETTERS_OUTGOING' ||
            activePage === 'LETTERS_INCOMING' ||
            activePage === 'LETTERS_INTERNAL') && (
            <LettersListView
              fixedCategory={
                activePage === 'LETTERS_OUTGOING'
                  ? 'OUTGOING'
                  : activePage === 'LETTERS_INCOMING'
                  ? 'INCOMING'
                  : activePage === 'LETTERS_INTERNAL'
                  ? 'INTERNAL'
                  : 'ALL'
              }
              departments={departments}
              letterTypes={letterTypes}
              classifications={classifications}
              userRole={role}
              onSelectLetter={(id) => setSelectedLetterId(id)}
              onNavigateCreate={(cat) => {
                setDefaultCreateCategory(cat || 'OUTGOING');
                navigateTo('CREATE_LETTER');
              }}
            />
          )}

          {activePage === 'CREATE_LETTER' && (
            <LetterFormView
              defaultCategory={defaultCreateCategory}
              departments={departments}
              letterTypes={letterTypes}
              classifications={classifications}
              numberingRules={numberingRules}
              userDepartmentId={currentUser.departmentId}
              onSuccess={(created, msg) => {
                showToast(msg);
                loadMasterAndProfile();
                setSelectedLetterId(created.id);
                navigateTo(
                  created.category === 'OUTGOING'
                    ? 'LETTERS_OUTGOING'
                    : created.category === 'INCOMING'
                    ? 'LETTERS_INCOMING'
                    : 'LETTERS_INTERNAL'
                );
              }}
              onCancel={() => navigateTo('LETTERS_ALL')}
            />
          )}

          {activePage === 'MASTER_DATA' && (
            <MasterDataView
              activeSubTab={masterSubTab}
              onChangeSubTab={setMasterSubTab}
              departments={departments}
              letterTypes={letterTypes}
              classifications={classifications}
              numberingRules={numberingRules}
              numberingCounters={numberingCounters}
              companySettings={companySettings}
              userRole={role}
              onRefreshMaster={(msg) => {
                loadMasterAndProfile();
                if (msg) showToast(msg);
              }}
            />
          )}

          {activePage === 'REPORTS' && (
            <ReportsView
              departments={departments}
              letterTypes={letterTypes}
              companySettings={companySettings}
              onSelectLetter={(id) => setSelectedLetterId(id)}
            />
          )}

          {activePage === 'AUDIT_TRAIL' && (
            <AuditAndSystemView
              mode="AUDIT"
              departments={departments}
              userRole={role}
              onToast={showToast}
            />
          )}

          {activePage === 'USER_MANAGEMENT' && (
            <AuditAndSystemView
              mode="USERS"
              departments={departments}
              userRole={role}
              onToast={showToast}
            />
          )}

          {activePage === 'SETTINGS' && (
            <AuditAndSystemView
              mode="SETTINGS"
              departments={departments}
              userRole={role}
              onToast={showToast}
            />
          )}

          {activePage === 'NOT_FOUND' && (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
              <div className="text-2xl font-mono font-bold text-slate-900">404</div>
              <div className="text-base font-bold text-slate-800">Halaman Tidak Ditemukan</div>
              <p className="text-xs text-slate-500">
                Halaman yang Anda tuju tidak tersedia atau Anda tidak memiliki akses.
              </p>
              <button
                type="button"
                onClick={() => navigateTo('DASHBOARD')}
                className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Kembali ke Dashboard
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Letter Detail, Print & Archive Modal */}
      {selectedLetterId !== null && (
        <LetterDetailModal
          letterId={selectedLetterId}
          userRole={role}
          companySettings={companySettings}
          departments={departments}
          letterTypes={letterTypes}
          classifications={classifications}
          onClose={() => setSelectedLetterId(null)}
          onUpdated={(msg) => {
            showToast(msg);
            loadMasterAndProfile();
            setDashboardRefreshTrigger((c) => c + 1);
          }}
        />
      )}
    </div>
  );
}
