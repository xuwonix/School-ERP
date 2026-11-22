import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquarePlus,
  Phone,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSchool } from '../context/SchoolContext';
import {
  fetchStudentPrivateContact,
  sendDirectParentNotification,
} from '../lib/schoolActions';
import { formatIsoDate, getRecentSchoolDates } from '../lib/validation';
import {
  DayOfWeek,
  NotificationChannel,
  ScheduleBlock,
  Student,
  StudentGuardianPrivate,
  TeacherView,
} from '../types';
import { LiveAttendanceView } from './LiveAttendanceView';
import { ParentCommunicationsView } from './ParentCommunicationsView';

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS = [
  { num: 1, label: 'Period 1', time: '08:15 – 09:05' },
  { num: 2, label: 'Period 2', time: '09:15 – 10:05' },
  { num: 3, label: 'Period 3', time: '10:20 – 11:10' },
  { num: 4, label: 'Period 4', time: '11:20 – 12:10' },
  { num: 5, label: 'Period 5', time: '13:00 – 13:50' },
];

function csvEscapeCell(val: string | number): string {
  const s = String(val);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function TeacherPortalView() {
  const {
    profile,
    institution,
    dataLoading,
    classes,
    students,
    attendanceRecords,
    notifications,
    schedules,
    signOutUser,
  } = useSchool();

  const [activeView, setActiveView] = useState<TeacherView>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // My Students filters
  const [studentSearch, setStudentSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [standingFilter, setStandingFilter] = useState<string>('all');

  // Guardian Private Contact Drawer
  const [contactStudent, setContactStudent] = useState<Student | null>(null);
  const [privateContact, setPrivateContact] = useState<StudentGuardianPrivate | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  // Quick Direct Guardian Message Modal
  const [msgTarget, setMsgTarget] = useState<Student | null>(null);
  const [msgChannel, setMsgChannel] = useState<NotificationChannel>('SMS');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const schoolDates = useMemo(() => getRecentSchoolDates(5), []);
  const today = schoolDates[schoolDates.length - 1] || formatIsoDate(new Date());

  const schoolDisplayName = institution?.schoolName || profile?.schoolName || 'Classytics';

  // Today's attendance metrics scoped to this teacher's roster
  const todayRecords = useMemo(
    () => attendanceRecords.filter((r) => r.date === today),
    [attendanceRecords, today]
  );

  const todayRecordByStudentId = useMemo(() => {
    const map = new Map<string, (typeof attendanceRecords)[number]>();
    for (const rec of todayRecords) {
      map.set(rec.studentId, rec);
    }
    return map;
  }, [todayRecords]);

  const todayPresentCount = useMemo(
    () => todayRecords.filter((r) => r.status === 'present' || r.status === 'excused').length,
    [todayRecords]
  );

  const todayAbsentOrTardyCount = useMemo(
    () => todayRecords.filter((r) => r.status === 'absent' || r.status === 'tardy').length,
    [todayRecords]
  );

  const todayAttendanceRate = useMemo(() => {
    if (todayRecords.length === 0) return null;
    return Number(((todayPresentCount / todayRecords.length) * 100).toFixed(1));
  }, [todayRecords.length, todayPresentCount]);

  const pendingRepliesCount = useMemo(
    () => notifications.filter((n) => n.deliveryStatus !== 'acknowledged').length,
    [notifications]
  );

  const flaggedScheduleCount = useMemo(
    () => schedules.filter((s) => s.status !== 'scheduled').length,
    [schedules]
  );

  // 5-Day Attendance Trend for teacher's classes
  const fiveDayTrend = useMemo(() => {
    return schoolDates.map((d) => {
      const dayRecs = attendanceRecords.filter((r) => r.date === d);
      const present = dayRecs.filter((r) => r.status === 'present' || r.status === 'excused').length;
      const absent = dayRecs.filter((r) => r.status === 'absent').length;
      const tardy = dayRecs.filter((r) => r.status === 'tardy').length;
      const shortLabel = d.slice(5);
      return {
        date: shortLabel,
        Present: present,
        Tardy: tardy,
        Absent: absent,
      };
    });
  }, [attendanceRecords, schoolDates]);

  const hasTrendData = useMemo(
    () => fiveDayTrend.some((d) => d.Present + d.Tardy + d.Absent > 0),
    [fiveDayTrend]
  );

  // Students needing follow-up (marked absent/tardy today or attendance < 92% or on probation)
  const attentionStudents = useMemo(() => {
    return students
      .map((st) => {
        const rec = todayRecordByStudentId.get(st.id);
        const flaggedToday = rec && (rec.status === 'absent' || rec.status === 'tardy');
        const lowAttendance = st.attendanceRate < 92 || st.enrollmentStatus === 'probation';
        if (!flaggedToday && !lowAttendance) return null;
        return { student: st, todayRecord: rec };
      })
      .filter((x): x is { student: Student; todayRecord: (typeof attendanceRecords)[number] | undefined } => x !== null)
      .sort((a, b) => a.student.attendanceRate - b.student.attendanceRate);
  }, [students, todayRecordByStudentId]);

  // Filtered roster for My Students view
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      if (sectionFilter !== 'all' && st.classId !== sectionFilter) return false;
      if (standingFilter !== 'all' && st.enrollmentStatus !== standingFilter) return false;
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        const hay = `${st.firstName} ${st.lastName} ${st.studentCode} ${st.className} ${st.guardianName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [students, sectionFilter, standingFilter, studentSearch]);

  // Timetable lookup by Day + Period
  const scheduleGrid = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const sc of schedules) {
      const key = `${sc.dayOfWeek}_${sc.periodNumber}`;
      const list = map.get(key) || [];
      list.push(sc);
      map.set(key, list);
    }
    return map;
  }, [schedules]);

  const handleOpenContact = async (st: Student) => {
    setContactStudent(st);
    setPrivateContact(null);
    setLoadingContact(true);
    try {
      const data = await fetchStudentPrivateContact(st.id);
      setPrivateContact(data);
    } finally {
      setLoadingContact(false);
    }
  };

  const handleOpenMessage = (st: Student, defaultSubject?: string) => {
    setMsgTarget(st);
    setMsgChannel(st.preferredChannel);
    setMsgSubject(defaultSubject || `Class Update: ${st.firstName} ${st.lastName}`);
    setMsgBody('');
  };

  const handleSendQuickMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgTarget || !msgSubject.trim() || !msgBody.trim()) return;
    setSendingMsg(true);
    try {
      await sendDirectParentNotification({
        student: msgTarget,
        channel: msgChannel,
        subject: msgSubject,
        message: msgBody,
      });
      setFeedback(`Sent ${msgChannel} notice to ${msgTarget.guardianName} (${msgTarget.firstName} ${msgTarget.lastName}).`);
      setMsgTarget(null);
      setMsgSubject('');
      setMsgBody('');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleExportMyStudentsCsv = () => {
    const headers = [
      'Student Code',
      'First Name',
      'Last Name',
      'Grade',
      'Section',
      'Primary Guardian',
      'Preferred Channel',
      'Attendance Rate (%)',
      'Standing',
    ];
    const rows = filteredStudents.map((st) =>
      [
        st.studentCode,
        st.firstName,
        st.lastName,
        st.gradeLevel,
        st.className,
        st.guardianName,
        st.preferredChannel,
        st.attendanceRate.toFixed(1),
        st.enrollmentStatus,
      ]
        .map(csvEscapeCell)
        .join(',')
    );
    const csv = [headers.map(csvEscapeCell).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'classytics-my-students.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const navItems: {
    key: TeacherView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'attendance', label: 'Live Attendance', icon: ClipboardCheck, count: students.length },
    { key: 'students', label: 'My Students', icon: GraduationCap, count: students.length },
    {
      key: 'communications',
      label: 'Parent Comms',
      icon: BellRing,
      count: pendingRepliesCount > 0 ? pendingRepliesCount : undefined,
    },
    { key: 'schedule', label: 'My Timetable', icon: CalendarClock, count: schedules.length },
  ];

  const activeNavLabel = navItems.find((item) => item.key === activeView)?.label || 'Dashboard';

  const renderNav = (onAfterSelect?: () => void) => (
    <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto" aria-label="Teacher Portal Navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setActiveView(item.key);
              onAfterSelect?.();
            }}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
              isActive
                ? 'bg-[#0F4C5C]/10 text-[#0F4C5C]'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </span>
            {item.count !== undefined && (
              <span className="text-xs font-mono tabular-nums text-slate-400">{item.count}</span>
            )}
          </button>
        );
      })}
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
          <p className="text-xs text-[#0F4C5C] font-medium mt-0.5 truncate">Teacher Portal</p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{schoolDisplayName}</p>
        </div>

        {renderNav()}

        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {profile?.displayName || 'Faculty Member'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {profile?.department || 'Academic Faculty'}
            </p>
          </div>
          <button
            type="button"
            onClick={signOutUser}
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
                <p className="text-xs text-[#0F4C5C] font-medium">Teacher Portal</p>
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

            {renderNav(() => setMobileMenuOpen(false))}

            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 truncate">
                {profile?.displayName}
              </span>
              <button
                type="button"
                onClick={signOutUser}
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
              <span className="text-slate-400 hidden md:inline whitespace-nowrap">
                Teacher Portal
              </span>
              <span className="text-slate-300 hidden md:inline" aria-hidden="true">/</span>
              <h1 className="text-base font-semibold text-slate-900 truncate">{activeNavLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeView !== 'attendance' && (
              <button
                type="button"
                onClick={() => setActiveView('attendance')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Take Live Attendance
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          {feedback && (
            <div className="flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span>{feedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {dataLoading ? (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-600">
                Loading your assigned classes, student rosters, and timetable...
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
              {/* 1. TEACHER DASHBOARD OVERVIEW */}
              {activeView === 'overview' && (
                <div className="space-y-6">
                  {/* Welcome Strip */}
                  <section className="bg-white border border-slate-200 rounded-lg px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Welcome, {profile?.displayName}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {profile?.department || 'Academic Faculty'} · {schoolDisplayName} ·{' '}
                        <span className="font-mono tabular-nums">{today}</span>
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-500">
                      @{profile?.username || 'faculty'} · Faculty Role
                    </span>
                  </section>

                  {/* 4-Column Hairline KPI Strip */}
                  <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-1">
                      <p className="text-xs font-medium text-slate-500">Assigned Students</p>
                      <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                        {students.length}
                      </p>
                      <p className="text-xs text-slate-500">
                        Across {classes.length} homeroom section{classes.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-1">
                      <p className="text-xs font-medium text-slate-500">Today&apos;s Roll Call</p>
                      <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                        {todayRecords.length > 0
                          ? `${todayPresentCount}/${todayRecords.length}`
                          : `0/${students.length}`}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {todayAttendanceRate !== null
                          ? `${todayAttendanceRate}% present · ${todayAbsentOrTardyCount} flagged`
                          : 'No marks submitted today'}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-1">
                      <p className="text-xs font-medium text-slate-500">Pending Guardian Replies</p>
                      <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                        {pendingRepliesCount}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {notifications.length} total logged notices
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-1">
                      <p className="text-xs font-medium text-slate-500">Weekly Teaching Periods</p>
                      <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                        {schedules.length}
                      </p>
                      <p className="text-xs text-slate-500">
                        {flaggedScheduleCount > 0
                          ? `${flaggedScheduleCount} slot(s) need attention`
                          : 'No timetable conflicts'}
                      </p>
                    </div>
                  </section>

                  {/* 12-Col Analytical Split (7 + 5) */}
                  <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left 7 cols: 5-Day Attendance Trend */}
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            5-Day Section Attendance Trend
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Daily Present, Tardy, and Absent counts across your assigned sections
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveView('attendance')}
                          className="text-xs font-semibold text-[#0F4C5C] hover:underline whitespace-nowrap cursor-pointer"
                        >
                          Open Roll Call
                        </button>
                      </div>

                      {hasTrendData ? (
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={fiveDayTrend}
                              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: '#64748B' }}
                                axisLine={{ stroke: '#E2E8F0' }}
                                tickLine={false}
                              />
                              <YAxis
                                allowDecimals={false}
                                tick={{ fontSize: 11, fill: '#64748B' }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip
                                formatter={(value, name) => [
                                  `${Number(value ?? 0)} student(s)`,
                                  String(name ?? ''),
                                ]}
                                contentStyle={{
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                }}
                              />
                              <Bar dataKey="Present" stackId="a" fill="#0F4C5C" radius={[0, 0, 0, 0]} />
                              <Bar dataKey="Tardy" stackId="a" fill="#D97706" radius={[0, 0, 0, 0]} />
                              <Bar dataKey="Absent" stackId="a" fill="#DC2626" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-md p-6">
                          <ClipboardCheck className="w-7 h-7 text-slate-300 mb-2" />
                          <p className="text-sm font-medium text-slate-800">
                            No attendance records logged yet
                          </p>
                          <p className="text-xs text-slate-500 mt-1 max-w-xs">
                            Start taking roll call in Live Attendance to populate your 5-day
                            section attendance chart.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right 5 cols: Assigned Sections & Today's Roll Status */}
                    <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            Assigned Homeroom Sections
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Today&apos;s roll call completion by section
                          </p>
                        </div>
                        <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>

                      {classes.length === 0 ? (
                        <div className="py-10 text-center space-y-1.5 border border-dashed border-slate-200 rounded-md px-4">
                          <p className="text-sm font-medium text-slate-800">
                            No sections assigned yet
                          </p>
                          <p className="text-xs text-slate-500">
                            Ask your Super Administrator to assign your primary homeroom section.
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {classes.map((cls) => {
                            const sectionStudents = students.filter((s) => s.classId === cls.id);
                            const markedCount = sectionStudents.filter((s) =>
                              todayRecordByStudentId.has(s.id)
                            ).length;
                            const pct =
                              sectionStudents.length > 0
                                ? Math.round((markedCount / sectionStudents.length) * 100)
                                : 0;

                            return (
                              <div key={cls.id} className="py-3.5 first:pt-1 last:pb-0 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">
                                      {cls.name}
                                    </p>
                                    <p className="text-xs text-slate-500 font-mono">
                                      {cls.code} · {cls.gradeLevel} · {cls.room}
                                    </p>
                                  </div>
                                  <span className="text-xs font-mono tabular-nums text-slate-600 shrink-0">
                                    {sectionStudents.length}/{cls.capacity} seats
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                                  <span>{cls.scheduleSlot}</span>
                                  <span className="font-mono tabular-nums text-slate-700">
                                    {markedCount}/{sectionStudents.length} marked
                                  </span>
                                </div>

                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#0F4C5C] transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Students Needing Follow-Up */}
                  <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Students Needing Attention
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Marked absent or tardy today, or cumulative attendance below 92%
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveView('students')}
                        className="text-xs font-semibold text-[#0F4C5C] hover:underline self-start sm:self-auto cursor-pointer"
                      >
                        View Full Roster ({students.length})
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                            <th className="py-3 px-4">Student</th>
                            <th className="py-3 px-4">Section</th>
                            <th className="py-3 px-4">Today&apos;s Status</th>
                            <th className="py-3 px-4">Term Rate</th>
                            <th className="py-3 px-4">Guardian</th>
                            <th className="py-3 px-4 text-right">Follow-Up</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {attentionStudents.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                                All assigned students are in good attendance standing today.
                              </td>
                            </tr>
                          ) : (
                            attentionStudents.map(({ student, todayRecord }) => (
                              <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <p className="font-medium text-slate-900">
                                    {student.firstName} {student.lastName}
                                  </p>
                                  <p className="text-xs font-mono text-slate-400">
                                    {student.studentCode}
                                  </p>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                                  {student.className}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold">
                                  {todayRecord ? (
                                    <span
                                      className={
                                        todayRecord.status === 'absent'
                                          ? 'text-red-700'
                                          : todayRecord.status === 'tardy'
                                          ? 'text-amber-700'
                                          : 'text-green-700'
                                      }
                                    >
                                      {todayRecord.status.charAt(0).toUpperCase() +
                                        todayRecord.status.slice(1)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-normal">Not marked</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-xs">
                                  <span
                                    className={
                                      student.attendanceRate < 90
                                        ? 'text-red-700 font-semibold'
                                        : 'text-amber-700 font-semibold'
                                    }
                                  >
                                    {student.attendanceRate.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <p className="text-slate-800">{student.guardianName}</p>
                                  <p className="text-xs text-slate-400">
                                    Prefers {student.preferredChannel}
                                  </p>
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenMessage(
                                        student,
                                        `Attendance Follow-Up: ${student.firstName} ${student.lastName}`
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                                  >
                                    <MessageSquarePlus className="w-3.5 h-3.5 text-[#0F4C5C]" />
                                    Message Guardian
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {/* 2. LIVE ATTENDANCE DESK */}
              {activeView === 'attendance' && <LiveAttendanceView />}

              {/* 3. MY STUDENTS ROSTER */}
              {activeView === 'students' && (
                <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search student, code, or guardian..."
                        className="pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C] w-72 max-w-full"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={sectionFilter}
                        onChange={(e) => setSectionFilter(e.target.value)}
                        aria-label="Filter by section"
                        className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                      >
                        <option value="all">All My Sections ({classes.length})</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} · {c.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={standingFilter}
                        onChange={(e) => setStandingFilter(e.target.value)}
                        aria-label="Filter by standing"
                        className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                      >
                        <option value="all">All Standings</option>
                        <option value="active">Active</option>
                        <option value="probation">Probation</option>
                        <option value="transferred">Transferred</option>
                        <option value="graduated">Graduated</option>
                      </select>

                      <button
                        type="button"
                        onClick={handleExportMyStudentsCsv}
                        disabled={filteredStudents.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                          <th className="py-3 px-4">Student Code</th>
                          <th className="py-3 px-4">Student Name</th>
                          <th className="py-3 px-4">Grade &amp; Section</th>
                          <th className="py-3 px-4">Primary Guardian</th>
                          <th className="py-3 px-4">Alert Channel</th>
                          <th className="py-3 px-4">Attendance %</th>
                          <th className="py-3 px-4">Standing</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-slate-500">
                              No assigned students match the current filter.
                            </td>
                          </tr>
                        ) : (
                          filteredStudents.map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                                {st.studentCode}
                              </td>
                              <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                                {st.firstName} {st.lastName}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <p className="text-slate-800">{st.className}</p>
                                <p className="text-xs text-slate-500">{st.gradeLevel}</p>
                              </td>
                              <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                                {st.guardianName}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                                {st.preferredChannel}
                              </td>
                              <td className="py-3.5 px-4 font-mono tabular-nums text-xs whitespace-nowrap">
                                <span
                                  className={
                                    st.attendanceRate >= 95
                                      ? 'text-green-700 font-semibold'
                                      : st.attendanceRate >= 90
                                      ? 'text-slate-700 font-medium'
                                      : 'text-red-700 font-semibold'
                                  }
                                >
                                  {st.attendanceRate.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-xs font-medium capitalize">
                                <span
                                  className={
                                    st.enrollmentStatus === 'active'
                                      ? 'text-green-700'
                                      : st.enrollmentStatus === 'probation'
                                      ? 'text-amber-700'
                                      : 'text-slate-500'
                                  }
                                >
                                  {st.enrollmentStatus}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenContact(st)}
                                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                                  >
                                    Guardian Contact
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenMessage(st)}
                                    className="px-2.5 py-1.5 text-xs font-semibold text-[#0F4C5C] bg-white border border-[#0F4C5C]/30 hover:bg-[#0F4C5C]/5 rounded-md cursor-pointer"
                                  >
                                    Message
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* 4. PARENT COMMUNICATIONS (Read-Only Rules for Teachers) */}
              {activeView === 'communications' && (
                <ParentCommunicationsView canManageRules={false} />
              )}

              {/* 5. MY TIMETABLE */}
              {activeView === 'schedule' && (
                <div className="space-y-5">
                  <section className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Weekly Instructional Timetable
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {schedules.length} scheduled teaching period
                        {schedules.length === 1 ? '' : 's'} · Monday through Friday
                      </p>
                    </div>
                    {flaggedScheduleCount > 0 && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          {flaggedScheduleCount} block(s) flagged for admin schedule resolution
                        </span>
                      </div>
                    )}
                  </section>

                  {schedules.length === 0 ? (
                    <section className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-2">
                      <CalendarClock className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold text-slate-900">
                        No timetable periods assigned yet
                      </p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Once your Super Administrator publishes periods for your assigned homeroom
                        sections, your weekly Monday–Friday grid will appear here in real time.
                      </p>
                    </section>
                  ) : (
                    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[780px]">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                              <th className="py-3 px-4 w-36">Period</th>
                              {DAYS.map((day) => (
                                <th key={day} className="py-3 px-4">
                                  {day}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {PERIODS.map((p) => (
                              <tr key={p.num} className="align-top">
                                <td className="py-3.5 px-4 bg-slate-50/40 border-r border-slate-100 whitespace-nowrap">
                                  <p className="font-semibold text-slate-800">{p.label}</p>
                                  <p className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                                    {p.time}
                                  </p>
                                </td>
                                {DAYS.map((day) => {
                                  const blocks = scheduleGrid.get(`${day}_${p.num}`) || [];
                                  return (
                                    <td
                                      key={day}
                                      className="py-3 px-3 border-r border-slate-100 last:border-r-0 min-w-[140px]"
                                    >
                                      {blocks.length === 0 ? (
                                        <span className="text-slate-300">—</span>
                                      ) : (
                                        <div className="space-y-2">
                                          {blocks.map((blk) => (
                                            <div
                                              key={blk.id}
                                              className={`p-2.5 rounded-md border ${
                                                blk.status === 'conflict'
                                                  ? 'bg-red-50/60 border-red-200'
                                                  : blk.status === 'substitute_needed'
                                                  ? 'bg-amber-50/60 border-amber-200'
                                                  : 'bg-slate-50/80 border-slate-200'
                                              }`}
                                            >
                                              <p className="font-semibold text-slate-900 leading-snug">
                                                {blk.className}
                                              </p>
                                              <p className="text-[11px] text-slate-600 mt-0.5">
                                                {blk.subject} · {blk.room}
                                              </p>
                                              <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                                                {blk.startTime}–{blk.endTime}
                                                {blk.status !== 'scheduled' && (
                                                  <span
                                                    className={
                                                      blk.status === 'conflict'
                                                        ? ' text-red-700 font-sans font-medium'
                                                        : ' text-amber-700 font-sans font-medium'
                                                    }
                                                  >
                                                    {' '}
                                                    ·{' '}
                                                    {blk.status === 'conflict'
                                                      ? 'Room conflict'
                                                      : 'Sub requested'}
                                                  </span>
                                                )}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Guardian Private Contact Drawer (Protected Subcollection Read) */}
      {contactStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex justify-end">
          <div className="w-full max-w-md bg-white h-full border-l border-slate-200 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-mono text-slate-400">{contactStudent.studentCode}</p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {contactStudent.firstName} {contactStudent.lastName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {contactStudent.gradeLevel} · {contactStudent.className}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setContactStudent(null)}
                  className="text-slate-400 hover:text-slate-800 cursor-pointer"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0F4C5C]">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Protected Guardian Contact Record</span>
                </div>

                {loadingContact ? (
                  <div className="h-28 bg-slate-50 border border-slate-200 rounded-md animate-pulse" />
                ) : privateContact ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Primary Guardian</p>
                      <p className="font-medium text-slate-900">{contactStudent.guardianName}</p>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 font-mono text-xs">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{privateContact.guardianPhone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 font-mono text-xs">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{privateContact.guardianEmail}</span>
                    </div>
                    {privateContact.emergencyNotes && (
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Campus &amp; Pickup Notes</p>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {privateContact.emergencyNotes}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-4">
                    No private guardian contact document found for this student.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setContactStudent(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = contactStudent;
                  setContactStudent(null);
                  handleOpenMessage(target);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md cursor-pointer"
              >
                Send Parent Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Direct Parent Message Modal */}
      {msgTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSendQuickMessage}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-lg p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Message Guardian</h3>
                <p className="text-xs text-slate-500">
                  {msgTarget.guardianName} · Parent of {msgTarget.firstName} {msgTarget.lastName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMsgTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Channel</label>
                <select
                  value={msgChannel}
                  onChange={(e) => setMsgChannel(e.target.value as NotificationChannel)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                >
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                  <option value="App Push">App Push</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={msgSubject}
                  onChange={(e) => setMsgSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  required
                  rows={4}
                  maxLength={1000}
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  placeholder="Share attendance context, classroom progress, or a follow-up request..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMsgTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingMsg}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
              >
                {sendingMsg ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
