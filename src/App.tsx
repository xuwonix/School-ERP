/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BellRing,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AdmissionsWorkflowView } from './components/AdmissionsWorkflowView';
import { BoardPortalView } from './components/BoardPortalView';
import { CampusAnalyticsView } from './components/CampusAnalyticsView';
import { DashboardHomeView } from './components/DashboardHomeView';
import { DepartmentsView } from './components/DepartmentsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FinancialAnalyticsView } from './components/FinancialAnalyticsView';
import { LiveAttendanceView } from './components/LiveAttendanceView';
import { ParentCommunicationsView } from './components/ParentCommunicationsView';
import { SchoolProfileView } from './components/SchoolProfileView';
import { StaffSchedulingView } from './components/StaffSchedulingView';
import { StudentPortalView } from './components/StudentPortalView';
import { TeacherPortalView } from './components/TeacherPortalView';
import { LoginPage, SetupPage } from './components/public/AuthPages';
import { LandingPage } from './components/public/LandingPage';
import {
  AboutPage,
  CareerPage,
  ContactPage,
  ProgramsPage,
  ServicesPage,
} from './components/public/PublicPages';
import { PublicShell } from './components/public/PublicShell';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { ActiveView, PublicPage, StaffCategory } from './types';

const STAFF_SUB_ITEMS: { key: StaffCategory; label: string }[] = [
  { key: 'stakeholder', label: 'Stakeholders/Board' },
  { key: 'administration', label: 'Administration' },
  { key: 'teacher', label: 'Teachers' },
  { key: 'staff', label: 'Staff' },
];

const ROLE_DISPLAY: Record<string, string> = {
  super_admin: 'Super Administrator',
  admin: 'Administrator',
  board: 'Board / Stakeholder',
  teacher: 'Faculty · Teacher',
  staff: 'Staff & Administration',
  student: 'Student',
};

function WorkspaceShell() {
  const {
    user,
    profile,
    institution,
    authReady,
    dataLoading,
    justCompletedSetup,
    dismissWelcome,
    signOutUser,
    departments,
    students,
    notifications,
    admissions,
    staff,
  } = useSchool();

  const currentYear = new Date().getFullYear();

  const [publicPage, setPublicPage] = useState<PublicPage>('home');
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [selectedStaffCategory, setSelectedStaffCategory] = useState<StaffCategory>('teacher');
  const [selectedAdmissionYear, setSelectedAdmissionYear] = useState<number>(currentYear);
  const [analyticsSubTab, setAnalyticsSubTab] = useState<
    'overview' | 'financial' | 'attendance' | 'communications'
  >('overview');
  const [staffMenuOpen, setStaffMenuOpen] = useState(true);
  const [admissionMenuOpen, setAdmissionMenuOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const archiveAdmissionYears = useMemo(() => {
    const yearSet = new Set<number>([currentYear - 1, currentYear - 2]);
    for (const app of admissions) {
      if (app.admissionYear && app.admissionYear !== currentYear) {
        yearSet.add(app.admissionYear);
      }
    }
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [admissions, currentYear]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-lg px-8 py-6 text-sm text-slate-600">
          Connecting to Classytics...
        </div>
      </div>
    );
  }

  // Unauthenticated Public Marketing Website + Invite-Only Login & Automatic First-Time Setup
  if (!user) {
    return (
      <PublicShell currentPage={publicPage} onNavigate={setPublicPage}>
        {publicPage === 'home' && <LandingPage onNavigate={setPublicPage} />}
        {publicPage === 'about' && <AboutPage onNavigate={setPublicPage} />}
        {publicPage === 'services' && <ServicesPage onNavigate={setPublicPage} />}
        {publicPage === 'programs' && <ProgramsPage onNavigate={setPublicPage} />}
        {publicPage === 'contact' && <ContactPage />}
        {publicPage === 'career' && <CareerPage />}
        {publicPage === 'login' && <LoginPage onNavigate={setPublicPage} />}
        {publicPage === 'setup' && <SetupPage onNavigate={setPublicPage} />}
      </PublicShell>
    );
  }

  // While Super Admin first-time setup or profile hydration completes
  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-7 text-center space-y-4">
          <p className="text-sm font-semibold text-slate-900">
            {dataLoading ? 'Initializing your Classytics workspace...' : 'Role Profile Pending'}
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            {dataLoading
              ? 'Loading your school profile, departments, staff directory, and real-time analytics.'
              : 'This login does not have an active role profile assigned by a Super Admin.'}
          </p>
          {!dataLoading && (
            <button
              type="button"
              onClick={signOutUser}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
            >
              Return to Public Site
            </button>
          )}
        </div>
      </div>
    );
  }

  // Revoked / Suspended Role Account
  if (profile.accountStatus === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4">
          <ShieldOff className="w-9 h-9 text-red-600 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900">Institutional Access Revoked</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your account for <strong>{profile.schoolName}</strong> has been suspended by the Super
            Administrator. Please contact your campus administration office for assistance.
          </p>
          <button
            type="button"
            onClick={signOutUser}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Student Role Dedicated Portal
  if (profile.role === 'student') {
    return <StudentPortalView />;
  }

  // Board / Stakeholder Executive Portal
  if (profile.role === 'board') {
    return <BoardPortalView />;
  }

  // Dedicated Teachers Portal
  if (profile.role === 'teacher') {
    return <TeacherPortalView />;
  }

  const isSuperAdmin =
    profile.role === 'super_admin' ||
    user.uid === profile.ownerId ||
    (user.email === 'xuwonixweb@gmail.com' && user.emailVerified);

  const handleNavigateView = (nextView: ActiveView) => {
    if (nextView === 'attendance') {
      if (isSuperAdmin) {
        setActiveView('analytics');
        setAnalyticsSubTab('attendance');
      } else {
        setActiveView('attendance');
      }
      return;
    }
    if (nextView === 'communications') {
      if (isSuperAdmin) {
        setActiveView('analytics');
        setAnalyticsSubTab('communications');
      } else {
        setActiveView('communications');
      }
      return;
    }
    setActiveView(nextView);
  };

  const handleSignOut = async () => {
    await signOutUser();
    setPublicPage('home');
  };

  const schoolDisplayName = institution?.schoolName || profile.schoolName || 'Classytics';
  const ownerDisplayName = institution?.schoolOwner || profile.displayName || 'Super Admin';
  const ownerHandle = institution?.ownerUsername || profile.username || 'superadmin';

  const currentYearAdmissionsCount = admissions.filter(
    (a) => (a.admissionYear || currentYear) === currentYear
  ).length;
  const unreadAlertsCount = notifications.filter(
    (n) => n.deliveryStatus !== 'acknowledged'
  ).length;

  const staffCountByCategory = (category: StaffCategory) =>
    staff.filter((m) => (m.staffCategory || 'teacher') === category).length;

  const admissionCountByYear = (year: number) =>
    admissions.filter((a) => (a.admissionYear || currentYear) === year).length;

  const getHeaderBreadcrumb = () => {
    if (!isSuperAdmin) {
      if (activeView === 'attendance') return 'Live Attendance';
      if (activeView === 'communications') return 'Parent Communications';
      return 'Dashboard';
    }
    if (activeView === 'dashboard') return 'Dashboard';
    if (activeView === 'school') return 'School';
    if (activeView === 'departments') return 'Departments';
    if (activeView === 'staff') {
      const subLabel =
        STAFF_SUB_ITEMS.find((s) => s.key === selectedStaffCategory)?.label || 'Staff';
      return `Staff / ${subLabel}`;
    }
    if (activeView === 'admissions') {
      return selectedAdmissionYear === currentYear
        ? `Admission / Current Year (${currentYear})`
        : `Admission / ${selectedAdmissionYear}`;
    }
    if (activeView === 'analytics') {
      if (analyticsSubTab === 'financial') return 'Analytics / Financial Analytics';
      if (analyticsSubTab === 'attendance') return 'Analytics / Live Attendance';
      if (analyticsSubTab === 'communications') return 'Analytics / Parent Communications';
      return 'Analytics';
    }
    return 'Dashboard';
  };

  const renderSuperAdminNav = (onAfterSelect?: () => void) => (
    <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto" aria-label="Super Admin Navigation">
      {/* 1. Dashboard */}
      <button
        type="button"
        onClick={() => {
          setActiveView('dashboard');
          onAfterSelect?.();
        }}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
          activeView === 'dashboard'
            ? 'bg-[#0F4C5C]/10 text-[#0F4C5C]'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span className="truncate">Dashboard</span>
        </span>
      </button>

      {/* 2. School */}
      <button
        type="button"
        onClick={() => {
          setActiveView('school');
          onAfterSelect?.();
        }}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
          activeView === 'school'
            ? 'bg-[#0F4C5C]/10 text-[#0F4C5C]'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Building2 className="w-4 h-4 shrink-0" />
          <span className="truncate">School</span>
        </span>
      </button>

      {/* 3. Departments */}
      <button
        type="button"
        onClick={() => {
          setActiveView('departments');
          onAfterSelect?.();
        }}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
          activeView === 'departments'
            ? 'bg-[#0F4C5C]/10 text-[#0F4C5C]'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <FolderKanban className="w-4 h-4 shrink-0" />
          <span className="truncate">Departments</span>
        </span>
        <span className="text-xs font-mono tabular-nums text-slate-400">
          {departments.length}
        </span>
      </button>

      {/* 4. Staff {Stakeholders/Board, Administration, Teachers, Staff} */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setStaffMenuOpen((prev) => !prev)}
          aria-expanded={staffMenuOpen}
          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            activeView === 'staff'
              ? 'text-[#0F4C5C] bg-slate-50'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate">Staff</span>
          </span>
          {staffMenuOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {staffMenuOpen && (
          <div className="mt-1 ml-4 pl-3 border-l border-slate-200 space-y-0.5">
            {STAFF_SUB_ITEMS.map((sub) => {
              const isSelected = activeView === 'staff' && selectedStaffCategory === sub.key;
              return (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => {
                    setSelectedStaffCategory(sub.key);
                    setActiveView('staff');
                    onAfterSelect?.();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0F4C5C]/10 text-[#0F4C5C] font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate">{sub.label}</span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    {staffCountByCategory(sub.key)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Admission {Current Year, [list(--year--)]} */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setAdmissionMenuOpen((prev) => !prev)}
          aria-expanded={admissionMenuOpen}
          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            activeView === 'admissions'
              ? 'text-[#0F4C5C] bg-slate-50'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <UserPlus className="w-4 h-4 shrink-0" />
            <span className="truncate">Admission</span>
          </span>
          {admissionMenuOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {admissionMenuOpen && (
          <div className="mt-1 ml-4 pl-3 border-l border-slate-200 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setSelectedAdmissionYear(currentYear);
                setActiveView('admissions');
                onAfterSelect?.();
              }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeView === 'admissions' && selectedAdmissionYear === currentYear
                  ? 'bg-[#0F4C5C]/10 text-[#0F4C5C] font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="truncate">Current Year ({currentYear})</span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {currentYearAdmissionsCount}
              </span>
            </button>

            {archiveAdmissionYears.map((yr) => {
              const isSelected = activeView === 'admissions' && selectedAdmissionYear === yr;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setSelectedAdmissionYear(yr);
                    setActiveView('admissions');
                    onAfterSelect?.();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0F4C5C]/10 text-[#0F4C5C] font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="font-mono tabular-nums">{yr}</span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    {admissionCountByYear(yr)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Analytics */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            setActiveView('analytics');
            setAnalyticsSubTab('overview');
            onAfterSelect?.();
          }}
          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            activeView === 'analytics'
              ? 'bg-[#0F4C5C]/10 text-[#0F4C5C]'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="truncate">Analytics</span>
          </span>
          {unreadAlertsCount > 0 && (
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {unreadAlertsCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );

  const renderStaffRoleNav = (onAfterSelect?: () => void) => (
    <nav className="flex-1 px-3 py-3 space-y-1" aria-label="Faculty Navigation">
      <button
        type="button"
        onClick={() => {
          setActiveView('dashboard');
          onAfterSelect?.();
        }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
          activeView === 'dashboard'
            ? 'bg-[#0F4C5C]/10 text-[#0F4C5C]'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <LayoutDashboard className="w-4 h-4 shrink-0" />
        <span>Dashboard</span>
      </button>

      <button
        type="button"
        onClick={() => {
          setActiveView('attendance');
          onAfterSelect?.();
        }}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
          activeView === 'attendance'
            ? 'bg-[#0F4C5C]/10 text-[#0F4C5C]'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <ClipboardCheck className="w-4 h-4 shrink-0" />
          <span>Live Attendance</span>
        </span>
        <span className="text-xs font-mono tabular-nums text-slate-400">{students.length}</span>
      </button>

      <button
        type="button"
        onClick={() => {
          setActiveView('communications');
          onAfterSelect?.();
        }}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
          activeView === 'communications'
            ? 'bg-[#0F4C5C]/10 text-[#0F4C5C]'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <BellRing className="w-4 h-4 shrink-0" />
          <span>Parent Comms</span>
        </span>
        {unreadAlertsCount > 0 && (
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {unreadAlertsCount}
          </span>
        )}
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar (264px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-slate-200 shrink-0">
        <div className="px-6 py-5 border-b border-slate-200">
          <span className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap">
            Classytics
          </span>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{schoolDisplayName}</p>
        </div>

        {isSuperAdmin ? renderSuperAdminNav() : renderStaffRoleNav()}

        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {profile.displayName || ownerDisplayName}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {ROLE_DISPLAY[profile.role] || profile.role}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-950/40 flex">
          <div className="w-72 bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-base font-bold text-slate-900 font-display">Classytics</span>
                <p className="text-xs text-slate-500 truncate">{schoolDisplayName}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isSuperAdmin
              ? renderSuperAdminNav(() => setMobileMenuOpen(false))
              : renderStaffRoleNav(() => setMobileMenuOpen(false))}

            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 truncate">
                {profile.displayName}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-5 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-md"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                {schoolDisplayName}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
              <h1 className="text-base font-semibold text-slate-900 truncate">
                {getHeaderBreadcrumb()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigateView('attendance')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Take Live Attendance
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-[1440px] w-full mx-auto">
          {dataLoading ? (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-600">
                Syncing real-time campus records...
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-24 bg-white border border-slate-200 rounded-lg animate-pulse"
                  />
                ))}
              </div>
              <div className="h-72 bg-white border border-slate-200 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              {/* DASHBOARD */}
              {activeView === 'dashboard' && (
                <div className="space-y-6">
                  {/* Post-Setup Super Admin Welcome Banner */}
                  {isSuperAdmin && justCompletedSetup ? (
                    <section className="bg-[#0F4C5C] text-white rounded-lg p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="inline-flex items-center gap-2 text-xs font-medium text-teal-100">
                            <ShieldCheck className="w-4 h-4 shrink-0" />
                            <span>Institution Setup Complete · Super Admin Signed In</span>
                          </div>
                          <h2 className="text-2xl font-bold font-display tracking-tight">
                            Welcome to Classytics, {ownerDisplayName}
                          </h2>
                          <p className="text-sm text-teal-50/90 max-w-2xl leading-relaxed">
                            <strong>{schoolDisplayName}</strong> is now live and locked for
                            invite-only governance. Your owner username{' '}
                            <span className="font-mono text-white underline decoration-teal-300/60">
                              {ownerHandle}
                            </span>{' '}
                            and both Email &amp; Contact Number OTP verifications have been
                            recorded.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={dismissWelcome}
                          className="text-xs font-medium text-teal-100 hover:text-white self-start whitespace-nowrap cursor-pointer"
                        >
                          Dismiss Welcome
                        </button>
                      </div>

                      <div className="pt-3 border-t border-white/15 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveView('school')}
                          className="px-3.5 py-2 text-xs font-semibold bg-white text-[#0F4C5C] hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                        >
                          Configure School &amp; Role Logins
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveView('departments')}
                          className="px-3.5 py-2 text-xs font-medium text-white border border-white/25 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                        >
                          Review Departments
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAdmissionYear(currentYear);
                            setActiveView('admissions');
                          }}
                          className="px-3.5 py-2 text-xs font-medium text-white border border-white/25 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                        >
                          Open {currentYear} Admissions
                        </button>
                      </div>
                    </section>
                  ) : (
                    <section className="bg-white border border-slate-200 rounded-lg px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">
                          Welcome, {profile.displayName || ownerDisplayName}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {schoolDisplayName}
                          {institution?.schoolAddress ? ` · ${institution.schoolAddress}` : ''}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-slate-500">
                        @{ownerHandle} · {ROLE_DISPLAY[profile.role] || profile.role}
                      </span>
                    </section>
                  )}

                  <DashboardHomeView
                    onNavigate={handleNavigateView}
                    onSelectStaffCategory={setSelectedStaffCategory}
                  />
                </div>
              )}

              {/* SCHOOL */}
              {activeView === 'school' && isSuperAdmin && <SchoolProfileView />}

              {/* DEPARTMENTS */}
              {activeView === 'departments' && isSuperAdmin && <DepartmentsView />}

              {/* STAFF (Category Filtered) */}
              {activeView === 'staff' && isSuperAdmin && (
                <StaffSchedulingView selectedCategory={selectedStaffCategory} />
              )}

              {/* ADMISSION (Year Filtered) */}
              {activeView === 'admissions' && isSuperAdmin && (
                <AdmissionsWorkflowView selectedYear={selectedAdmissionYear} />
              )}

              {/* ANALYTICS (Overview + Live Attendance + Parent Comms Hub for Super Admin) */}
              {activeView === 'analytics' && isSuperAdmin && (
                <div className="space-y-5">
                  <section className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => setAnalyticsSubTab('overview')}
                        className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                          analyticsSubTab === 'overview'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Attendance &amp; Campus Analytics
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalyticsSubTab('financial')}
                        className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                          analyticsSubTab === 'financial'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Financial Analytics
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalyticsSubTab('attendance')}
                        className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                          analyticsSubTab === 'attendance'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Live Roll Call ({students.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalyticsSubTab('communications')}
                        className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                          analyticsSubTab === 'communications'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Parent Communications ({notifications.length})
                      </button>
                    </div>
                  </section>

                  {analyticsSubTab === 'overview' && (
                    <CampusAnalyticsView onNavigate={handleNavigateView} />
                  )}
                  {analyticsSubTab === 'financial' && <FinancialAnalyticsView canManage />}
                  {analyticsSubTab === 'attendance' && <LiveAttendanceView />}
                  {analyticsSubTab === 'communications' && <ParentCommunicationsView />}
                </div>
              )}

              {/* NON-OWNER INVITED STAFF DIRECT ROUTES */}
              {activeView === 'attendance' && !isSuperAdmin && <LiveAttendanceView />}
              {activeView === 'communications' && !isSuperAdmin && (
                <ParentCommunicationsView canManageRules={false} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SchoolProvider>
        <WorkspaceShell />
      </SchoolProvider>
    </ErrorBoundary>
  );
}
