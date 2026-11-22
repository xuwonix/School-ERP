import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import {
  detectLegacyDemoRecords,
  purgeLegacyDemoRecords,
  recordStudentAttendance,
  sendDirectParentNotification,
} from '../lib/schoolActions';
import { formatIsoDate } from '../lib/validation';
import { ActiveView, StaffCategory } from '../types';

interface DashboardHomeViewProps {
  onNavigate: (view: ActiveView) => void;
  onSelectStaffCategory?: (category: StaffCategory) => void;
}

export function DashboardHomeView({
  onNavigate,
  onSelectStaffCategory,
}: DashboardHomeViewProps) {
  const {
    user,
    profile,
    departments,
    classes,
    students,
    attendanceRecords,
    notifications,
    notificationRules,
    admissions,
    staff,
    schedules,
    financialRecords,
    invites,
  } = useSchool();

  const isSuperAdmin =
    profile?.role === 'super_admin' || user?.email === 'xuwonixweb@gmail.com';
  const currentYear = new Date().getFullYear();

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [purgingDemo, setPurgingDemo] = useState(false);

  const legacyDemoSnapshot = useMemo(
    () =>
      detectLegacyDemoRecords({
        departments,
        staff,
        classes,
        students,
        attendanceRecords,
        notificationRules,
        notifications,
        admissions,
        schedules,
        financialRecords,
      }),
    [
      departments,
      staff,
      classes,
      students,
      attendanceRecords,
      notificationRules,
      notifications,
      admissions,
      schedules,
      financialRecords,
    ]
  );

  const latestDate = useMemo(() => {
    const today = formatIsoDate(new Date());
    const hasToday = attendanceRecords.some((r) => r.date === today);
    if (hasToday) return today;
    const sortedDates = [...new Set(attendanceRecords.map((r) => r.date))].sort();
    return sortedDates[sortedDates.length - 1] || today;
  }, [attendanceRecords]);

  const todayRecords = useMemo(
    () => attendanceRecords.filter((r) => r.date === latestDate),
    [attendanceRecords, latestDate]
  );

  const flaggedToday = useMemo(
    () => todayRecords.filter((r) => r.status === 'absent' || r.status === 'tardy'),
    [todayRecords]
  );

  const operationalMetrics = useMemo(() => {
    const activeTeachers = staff.filter((s) => (s.staffCategory || 'teacher') === 'teacher').length;
    const onLeaveStaff = staff.filter((s) => s.status === 'on_leave').length;
    const currentYearAdmissions = admissions.filter(
      (a) => (a.admissionYear || currentYear) === currentYear
    );
    const openAdmissions = currentYearAdmissions.filter(
      (a) => a.stage !== 'enrolled' && a.stage !== 'declined'
    ).length;
    const readyToEnrol = admissions.filter((a) => a.stage === 'accepted');
    const flaggedSchedules = schedules.filter((s) => s.status !== 'scheduled');
    const activeInvites = invites.filter((i) => i.status === 'active').length;

    return {
      activeTeachers,
      onLeaveStaff,
      openAdmissions,
      readyToEnrol,
      flaggedSchedules,
      activeInvites,
    };
  }, [staff, admissions, schedules, invites, currentYear]);

  const onboardingSteps = useMemo(() => {
    return [
      {
        key: 'departments',
        label: 'Create Academic & Admin Departments',
        done: departments.length > 0,
        actionLabel: 'Open Departments',
        onClick: () => onNavigate('departments'),
      },
      {
        key: 'sections',
        label: 'Configure Homeroom Sections',
        done: classes.length > 0,
        actionLabel: 'Open School Setup',
        onClick: () => onNavigate('school'),
      },
      {
        key: 'staff',
        label: 'Add Teachers, Board & Staff Logins',
        done: staff.length > 0,
        actionLabel: 'Manage Staff',
        onClick: () => {
          onSelectStaffCategory?.('teacher');
          onNavigate('staff');
        },
      },
      {
        key: 'students',
        label: 'Enrol Students or Open Admissions',
        done: students.length > 0 || admissions.length > 0,
        actionLabel: 'Open Admissions',
        onClick: () => onNavigate('admissions'),
      },
    ];
  }, [departments.length, classes.length, staff.length, students.length, admissions.length, onNavigate, onSelectStaffCategory]);

  const completedOnboardingCount = onboardingSteps.filter((s) => s.done).length;
  const showOnboardingChecklist = isSuperAdmin && completedOnboardingCount < onboardingSteps.length;

  const staffBreakdown = useMemo(() => {
    const counts: Record<StaffCategory, number> = {
      stakeholder: 0,
      administration: 0,
      teacher: 0,
      staff: 0,
    };
    for (const member of staff) {
      const cat = member.staffCategory || 'teacher';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return [
      { key: 'stakeholder' as StaffCategory, label: 'Stakeholders / Board', count: counts.stakeholder },
      { key: 'administration' as StaffCategory, label: 'Administration', count: counts.administration },
      { key: 'teacher' as StaffCategory, label: 'Teachers', count: counts.teacher },
      { key: 'staff' as StaffCategory, label: 'Campus Staff', count: counts.staff },
    ];
  }, [staff]);

  const handlePurgeDemoData = async () => {
    setPurgingDemo(true);
    setFeedback(null);
    try {
      const removed = await purgeLegacyDemoRecords(legacyDemoSnapshot);
      setConfirmPurge(false);
      setFeedback(
        `Removed ${removed} legacy demo record${removed === 1 ? '' : 's'}. Your school configuration, user accounts, and real records remain intact.`
      );
    } finally {
      setPurgingDemo(false);
    }
  };

  const handleQuickFollowUp = async (recordId: string, studentId: string, status: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    setActionBusyId(recordId);
    setFeedback(null);
    try {
      await sendDirectParentNotification({
        student,
        channel: student.preferredChannel,
        subject: `Follow-Up: ${student.firstName} ${student.lastName} (${latestDate})`,
        message: `Hello ${student.guardianName}, our attendance office is following up regarding ${student.firstName}'s ${status} status on ${latestDate}. Please confirm receipt.`,
      });
      setFeedback(`Follow-up sent to ${student.guardianName} via ${student.preferredChannel}.`);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleQuickExcuse = async (recordId: string, studentId: string) => {
    if (!user) return;
    const student = students.find((s) => s.id === studentId);
    const existingRecord = todayRecords.find((r) => r.id === recordId);
    if (!student || !existingRecord) return;
    setActionBusyId(recordId);
    setFeedback(null);
    try {
      await recordStudentAttendance({
        uid: user.uid,
        student,
        date: existingRecord.date,
        period: existingRecord.period,
        status: 'excused',
        note: 'Excused by administration after guardian confirmation.',
        existingRecord,
        rules: notificationRules,
      });
      setFeedback(`Marked ${student.firstName} ${student.lastName} as excused.`);
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* One-time Legacy Demo Cleanup Notice (only visible if old seeded demo records exist in Firestore) */}
      {isSuperAdmin && legacyDemoSnapshot.totalCount > 0 && (
        <section className="bg-amber-50/80 border border-amber-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-950 space-y-0.5">
              <p className="font-semibold">
                {legacyDemoSnapshot.totalCount} legacy demo records detected from an earlier seed
              </p>
              <p className="text-amber-800 leading-relaxed">
                Automatic demo seeding has been removed. You can permanently clear these sample
                records now without affecting your school profile, role logins, or any records you
                added manually.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {confirmPurge ? (
              <>
                <button
                  type="button"
                  disabled={purgingDemo}
                  onClick={() => setConfirmPurge(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={purgingDemo}
                  onClick={handlePurgeDemoData}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {purgingDemo ? 'Removing...' : 'Confirm Remove Demo Data'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmPurge(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-950 bg-white border border-amber-300 hover:bg-amber-100/70 rounded-md whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Demo Records
              </button>
            )}
          </div>
        </section>
      )}

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

      {/* 4-Column Live Campus Operations Snapshot */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Enrolled Students</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {students.length}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            Across {classes.length} active homeroom section{classes.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Faculty &amp; Campus Staff</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {staff.length}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {operationalMetrics.activeTeachers} teacher
            {operationalMetrics.activeTeachers === 1 ? '' : 's'} ·{' '}
            {operationalMetrics.onLeaveStaff} on leave
          </p>
        </div>

        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Active Admissions ({currentYear})</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {operationalMetrics.openAdmissions}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {operationalMetrics.readyToEnrol.length} accepted &amp; ready to enrol
          </p>
        </div>

        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Campus Structure &amp; Logins</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {departments.length}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            Departments · {operationalMetrics.activeInvites} active invite login
            {operationalMetrics.activeInvites === 1 ? '' : 's'}
          </p>
        </div>
      </section>

      {/* Workspace Setup Readiness Checklist (shown automatically when starting clean) */}
      {showOnboardingChecklist && (
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Campus Setup Checklist</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Your institution starts with a clean database. Complete these foundational steps to
                launch daily attendance, admissions, and analytics.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums font-semibold text-[#0F4C5C] whitespace-nowrap">
              {completedOnboardingCount} / {onboardingSteps.length} Complete
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {onboardingSteps.map((step, index) => (
              <div
                key={step.key}
                className={`border rounded-md p-4 flex flex-col justify-between gap-3 ${
                  step.done ? 'bg-slate-50/70 border-slate-200' : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-slate-400">0{index + 1}</span>
                    <span
                      className={`font-semibold ${
                        step.done ? 'text-green-700' : 'text-amber-700'
                      }`}
                    >
                      {step.done ? 'Ready' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{step.label}</p>
                </div>
                <button
                  type="button"
                  onClick={step.onClick}
                  className="inline-flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium text-[#0F4C5C] bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  <span>{step.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Operations Desk: Daily Action Queue + Campus Activity & Directory */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): Daily Action Queues */}
        <div className="lg:col-span-7 space-y-6">
          {/* Today's Attendance Exceptions */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Today&apos;s Attendance Exceptions
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                  {latestDate} · {flaggedToday.length} student
                  {flaggedToday.length === 1 ? '' : 's'} needing follow-up
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F4C5C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Live Roll Call
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {flaggedToday.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-900">
                  {students.length === 0
                    ? 'No students enrolled yet'
                    : todayRecords.length === 0
                    ? `No attendance roll submitted for ${latestDate} yet`
                    : `No unexcused absences or tardies logged on ${latestDate}`}
                </p>
                <p className="text-xs text-slate-500">
                  {students.length === 0
                    ? 'Add a homeroom section and enroll students to begin tracking live attendance.'
                    : 'Open Live Roll Call to mark homeroom attendance or trigger automated guardian alerts.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {flaggedToday.map((rec) => (
                  <div
                    key={rec.id}
                    className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-900 truncate">
                          {rec.studentName}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span
                          className={`text-xs font-semibold ${
                            rec.status === 'absent' ? 'text-red-600' : 'text-amber-600'
                          }`}
                        >
                          {rec.status === 'absent' ? 'Absent' : 'Tardy'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {rec.className} · {rec.note || 'No teacher note recorded'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={actionBusyId === rec.id}
                        onClick={() => handleQuickExcuse(rec.id, rec.studentId)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
                      >
                        Mark Excused
                      </button>
                      <button
                        type="button"
                        disabled={actionBusyId === rec.id}
                        onClick={() => handleQuickFollowUp(rec.id, rec.studentId, rec.status)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        Notify Parent
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Operational Tasks: Admissions Ready to Enrol & Timetable Flags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#0F4C5C]" />
                  <h3 className="text-sm font-semibold text-slate-900">Ready to Enrol</h3>
                </div>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => onNavigate('admissions')}
                    className="text-xs font-medium text-[#0F4C5C] hover:underline cursor-pointer"
                  >
                    Open Pipeline
                  </button>
                )}
              </div>

              {operationalMetrics.readyToEnrol.length === 0 ? (
                <div className="p-5 text-xs text-slate-500">
                  No accepted applicants currently awaiting final enrolment.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {operationalMetrics.readyToEnrol.slice(0, 4).map((app) => (
                    <div key={app.id} className="px-5 py-3 space-y-0.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-900 truncate">
                          {app.applicantName}
                        </span>
                        <span className="font-mono text-slate-500 shrink-0">
                          {app.gradeApplying}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        Guardian: {app.guardianName} ·{' '}
                        {app.documentsVerified ? 'Docs verified' : 'Docs pending'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[#0F4C5C]" />
                  <h3 className="text-sm font-semibold text-slate-900">Timetable Flags</h3>
                </div>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStaffCategory?.('teacher');
                      onNavigate('staff');
                    }}
                    className="text-xs font-medium text-[#0F4C5C] hover:underline cursor-pointer"
                  >
                    Resolve
                  </button>
                )}
              </div>

              {operationalMetrics.flaggedSchedules.length === 0 ? (
                <div className="p-5 text-xs text-slate-500">
                  {schedules.length === 0
                    ? 'No timetable blocks scheduled yet.'
                    : 'All scheduled timetable blocks are conflict-free.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {operationalMetrics.flaggedSchedules.slice(0, 4).map((block) => (
                    <div key={block.id} className="px-5 py-3 space-y-0.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-900 truncate">
                          {block.className}
                        </span>
                        <span
                          className={`font-semibold shrink-0 ${
                            block.status === 'conflict' ? 'text-red-600' : 'text-amber-700'
                          }`}
                        >
                          {block.status === 'conflict' ? 'Conflict' : 'Sub Needed'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono truncate">
                        {block.dayOfWeek} P{block.periodNumber} · {block.room} · {block.staffName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Parent Communications & Campus Directory Snapshot */}
        <div className="lg:col-span-5 space-y-6">
          {/* Recent Parent Communications */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Recent Parent Communications
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest guardian alerts and replies
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('communications')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F4C5C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                View All
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No parent notifications have been dispatched yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.slice(0, 4).map((n) => (
                  <div key={n.id} className="px-6 py-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{n.studentName}</p>
                      <span
                        className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                          n.deliveryStatus === 'acknowledged'
                            ? 'text-green-700'
                            : n.deliveryStatus === 'delivered'
                            ? 'text-[#0F4C5C]'
                            : 'text-amber-700'
                        }`}
                      >
                        {n.deliveryStatus === 'acknowledged'
                          ? 'Acknowledged'
                          : n.deliveryStatus === 'delivered'
                          ? 'Delivered'
                          : 'Sent'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {n.guardianName} · {n.channel} · {n.triggerType.replace('_', ' ')}
                    </p>
                    {n.parentReply && (
                      <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200/80 rounded px-2.5 py-1.5 mt-1.5">
                        Guardian reply: &ldquo;{n.parentReply}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campus Personnel & Quick Navigation Card (Super Admin) */}
          {isSuperAdmin && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0F4C5C]" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Personnel &amp; Workspace Shortcuts
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('analytics')}
                  className="text-xs font-medium text-[#0F4C5C] hover:underline cursor-pointer"
                >
                  Open Analytics
                </button>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {staffBreakdown.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onSelectStaffCategory?.(item.key);
                      onNavigate('staff');
                    }}
                    className="w-full px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
                  >
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('school')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#0F4C5C]" />
                  School &amp; Sections
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('departments')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-[#0F4C5C]" />
                  Departments
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('school')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#0F4C5C]" />
                  Invite Logins
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
