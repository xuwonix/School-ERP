import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarCheck,
  Check,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Plus,
  RefreshCw,
  UserPlus,
  Wand2,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import {
  addStaffMember,
  autoResolveScheduleConflicts,
  createScheduleBlock,
  provisionInvitedRoleAccount,
  updateStaffEvaluation,
  updateStaffStatus,
} from '../lib/schoolActions';
import { generateTempPassword } from '../lib/validation';
import {
  DayOfWeek,
  EmploymentType,
  ProvisionedRole,
  StaffCategory,
  StaffMember,
  StaffStatus,
} from '../types';

const CATEGORY_LABELS: Record<StaffCategory | 'all', string> = {
  all: 'All Personnel',
  stakeholder: 'Stakeholders / Board',
  administration: 'Administration',
  teacher: 'Teachers',
  staff: 'Campus Staff',
};

const ADD_BUTTON_LABELS: Record<StaffCategory | 'all', string> = {
  all: 'Add Member',
  stakeholder: 'Add Board Member',
  administration: 'Add Administration',
  teacher: 'Add Teacher',
  staff: 'Add Staff Member',
};

const MODAL_TITLE_LABELS: Record<StaffCategory | 'all', string> = {
  all: 'Add Member',
  stakeholder: 'Add Board / Stakeholder Member',
  administration: 'Add Administration Member',
  teacher: 'Add Teacher',
  staff: 'Add Campus Staff Member',
};

const ROLE_TITLE_PLACEHOLDERS: Record<StaffCategory, string> = {
  stakeholder: 'e.g., Board Trustee / Finance Chair',
  administration: 'e.g., Vice Principal / Academic Registrar',
  teacher: 'e.g., Physics Instructor / Homeroom Lead',
  staff: 'e.g., Campus Operations Coordinator',
};

const PROVISIONED_ROLE_LABELS: Record<ProvisionedRole, string> = {
  board: 'Board / Stakeholder',
  student: 'Student',
  teacher: 'Teacher',
  staff: 'Staff & Administration',
  admin: 'Administrator',
};

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS = [1, 2, 3, 4, 5];

function escapeCsvCell(value: string | number): string {
  const raw = String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

function StaffAvatar({ member }: { member: StaffMember }) {
  const [failed, setFailed] = useState(false);
  const initials = member.fullName
    .split(' ')
    .filter((p) => !p.endsWith('.'))
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  if (member.avatarUrl && !failed) {
    return (
      <img
        src={member.avatarUrl}
        alt={member.fullName}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-9 h-9 rounded-md object-cover border border-slate-200 shrink-0"
      />
    );
  }

  return (
    <div className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
      {initials || 'ST'}
    </div>
  );
}

interface StaffSchedulingViewProps {
  selectedCategory?: StaffCategory | 'all';
}

export function StaffSchedulingView({ selectedCategory = 'all' }: StaffSchedulingViewProps) {
  const {
    user,
    profile,
    staff,
    departments,
    classes,
    students,
    attendanceRecords,
    notifications,
    notificationRules,
    schedules,
    financialRecords,
    invites,
  } = useSchool();

  const isSuperAdmin =
    profile?.role === 'super_admin' || user?.email === 'xuwonixweb@gmail.com';

  const [subTab, setSubTab] = useState<'directory' | 'schedule' | 'performance'>('directory');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // One-time transient credential handoff (never stored in Firestore)
  const [issuedCredential, setIssuedCredential] = useState<{
    fullName: string;
    email: string;
    password: string;
    role: ProvisionedRole;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Add Member + Optional Invite-Only Login Modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffModalError, setStaffModalError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [department, setDepartment] = useState('Mathematics');
  const [staffCategory, setStaffCategory] = useState<StaffCategory>(
    selectedCategory === 'all' ? 'teacher' : selectedCategory
  );
  const [employmentType, setEmploymentType] = useState<EmploymentType>('Full-Time');
  const [weeklyHoursTarget, setWeeklyHoursTarget] = useState(28);
  const [createLogin, setCreateLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [tempPassword, setTempPassword] = useState(() => generateTempPassword());
  const [adminAccessRole, setAdminAccessRole] = useState<'admin' | 'staff'>('admin');
  const [assignClassId, setAssignClassId] = useState('');

  // Issue Login for Existing Directory-Only Member Modal
  const [issueLoginTarget, setIssueLoginTarget] = useState<StaffMember | null>(null);
  const [issueLoginEmail, setIssueLoginEmail] = useState('');
  const [issueLoginPassword, setIssueLoginPassword] = useState(() => generateTempPassword());
  const [issueAdminRole, setIssueAdminRole] = useState<'admin' | 'staff'>('admin');
  const [issueClassId, setIssueClassId] = useState('');
  const [issueLoginError, setIssueLoginError] = useState<string | null>(null);

  // Add Schedule Block Modal
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockStaffId, setBlockStaffId] = useState('');
  const [blockClassId, setBlockClassId] = useState('');
  const [blockDay, setBlockDay] = useState<DayOfWeek>('Mon');
  const [blockPeriod, setBlockPeriod] = useState(1);
  const [blockRoom, setBlockRoom] = useState('Hall B-204');
  const [blockSubject, setBlockSubject] = useState('');

  // Evaluation Modal
  const [evalTarget, setEvalTarget] = useState<StaffMember | null>(null);
  const [evalAttendance, setEvalAttendance] = useState(98);
  const [evalResponseMin, setEvalResponseMin] = useState(20);
  const [evalObservation, setEvalObservation] = useState(94);

  const visibleStaff = useMemo(() => {
    if (selectedCategory === 'all') return staff;
    return staff.filter((member) => (member.staffCategory || 'teacher') === selectedCategory);
  }, [staff, selectedCategory]);

  const scheduleIssuesCount = useMemo(
    () => schedules.filter((s) => s.status !== 'scheduled').length,
    [schedules]
  );

  const performanceChartData = useMemo(() => {
    return visibleStaff.map((s) => ({
      name: s.fullName.split(' ').slice(-1)[0],
      fullName: s.fullName,
      'Attendance Submission %': s.attendanceSubmissionRate,
      'Observation Score': s.observationScore,
    }));
  }, [visibleStaff]);

  const boardSyncIds = useMemo(
    () => ({
      financialRecordIds: financialRecords.map((r) => r.id),
      studentIds: students.map((s) => s.id),
      staffIds: staff.map((m) => m.id),
      classIds: classes.map((c) => c.id),
      departmentIds: departments.map((d) => d.id),
    }),
    [financialRecords, students, staff, classes, departments]
  );

  const allNotificationRuleIds = useMemo(
    () => notificationRules.map((r) => r.id),
    [notificationRules]
  );

  const getDefaultDepartment = (category: StaffCategory) => {
    if (category === 'stakeholder') {
      return (
        departments.find((d) => d.category === 'Governance')?.name ||
        'Board & Governance'
      );
    }
    if (category === 'administration') {
      return (
        departments.find((d) => d.category === 'Administrative')?.name ||
        'Administration'
      );
    }
    if (category === 'staff') {
      return (
        departments.find((d) => d.category === 'Operations')?.name ||
        'Campus Operations'
      );
    }
    return (
      departments.find((d) => d.category === 'Academic')?.name ||
      departments[0]?.name ||
      'Mathematics'
    );
  };

  const getDefaultWeeklyHours = (category: StaffCategory) => {
    if (category === 'stakeholder') return 8;
    if (category === 'teacher') return 28;
    return 40;
  };

  const departmentOptions = useMemo(() => {
    const names = new Set<string>(departments.map((d) => d.name));
    names.add(getDefaultDepartment(staffCategory));
    if (department.trim()) names.add(department.trim());
    return Array.from(names);
  }, [departments, staffCategory, department]);

  const resolvePortalRole = (
    category: StaffCategory,
    selectedAdminRole: 'admin' | 'staff'
  ): ProvisionedRole => {
    if (category === 'stakeholder') return 'board';
    if (category === 'administration') return selectedAdminRole;
    if (category === 'teacher') return 'teacher';
    return 'staff';
  };

  const getMemberInvite = (member: StaffMember) => {
    if (member.linkedUserUid) {
      const byUid = invites.find((inv) => inv.targetUid === member.linkedUserUid);
      if (byUid) return byUid;
    }
    const normalizedName = member.fullName.trim().toLowerCase();
    return invites.find((inv) => inv.fullName.trim().toLowerCase() === normalizedName);
  };

  const handleOpenAddStaff = () => {
    const initialCategory: StaffCategory =
      selectedCategory === 'all' ? 'teacher' : selectedCategory;
    setFullName('');
    setRoleTitle('');
    setStaffCategory(initialCategory);
    setDepartment(getDefaultDepartment(initialCategory));
    setEmploymentType('Full-Time');
    setWeeklyHoursTarget(getDefaultWeeklyHours(initialCategory));
    setCreateLogin(isSuperAdmin);
    setLoginEmail('');
    setTempPassword(generateTempPassword());
    setAdminAccessRole('admin');
    setAssignClassId('');
    setStaffModalError(null);
    setStaffModalOpen(true);
  };

  const handleCategoryChange = (nextCategory: StaffCategory) => {
    setStaffCategory(nextCategory);
    setDepartment(getDefaultDepartment(nextCategory));
    setWeeklyHoursTarget(getDefaultWeeklyHours(nextCategory));
    if (nextCategory !== 'teacher') {
      setAssignClassId('');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !fullName.trim() || !roleTitle.trim()) return;
    setStaffModalError(null);

    const shouldProvisionLogin = isSuperAdmin && createLogin;
    if (shouldProvisionLogin) {
      if (!loginEmail.trim()) {
        setStaffModalError('Institutional login email is required when provisioning a login.');
        return;
      }
      if (tempPassword.length < 8) {
        setStaffModalError('Temporary password must be at least 8 characters.');
        return;
      }
    }

    setBusy(true);
    try {
      const activeBoardUids = invites
        .filter((inv) => inv.role === 'board' && inv.status === 'active')
        .map((inv) => inv.targetUid);

      if (shouldProvisionLogin) {
        const portalRole = resolvePortalRole(staffCategory, adminAccessRole);
        const selectedClassId =
          portalRole === 'teacher' && assignClassId ? assignClassId : undefined;
        const classStudentIds = selectedClassId
          ? students.filter((s) => s.classId === selectedClassId).map((s) => s.id)
          : undefined;

        const teacherSyncIds =
          portalRole === 'teacher'
            ? {
                attendanceRecordIds: selectedClassId
                  ? attendanceRecords.filter((a) => a.classId === selectedClassId).map((a) => a.id)
                  : [],
                notificationIds: selectedClassId
                  ? notifications.filter((n) => n.classId === selectedClassId).map((n) => n.id)
                  : [],
                scheduleIds: selectedClassId
                  ? schedules.filter((sc) => sc.classId === selectedClassId).map((sc) => sc.id)
                  : [],
                notificationRuleIds: allNotificationRuleIds,
              }
            : portalRole === 'staff'
            ? {
                attendanceRecordIds: [],
                notificationIds: [],
                scheduleIds: [],
                notificationRuleIds: allNotificationRuleIds,
              }
            : undefined;

        await provisionInvitedRoleAccount({
          superAdminUid: user.uid,
          schoolName: profile?.schoolName || 'Classytics',
          fullName,
          email: loginEmail,
          tempPassword,
          role: portalRole,
          department,
          assignClassId: selectedClassId,
          assignedStudentIds: classStudentIds,
          createStaffRecord: {
            roleTitle,
            staffCategory,
            employmentType,
            weeklyHoursTarget,
            activeBoardUids,
          },
          boardSyncIds: portalRole === 'board' ? boardSyncIds : undefined,
          teacherSyncIds,
        });

        setIssuedCredential({
          fullName: fullName.trim(),
          email: loginEmail.trim(),
          password: tempPassword,
          role: portalRole,
        });
        setCopiedCreds(false);
        setStaffModalOpen(false);
        setFeedback(
          `Added ${fullName.trim()} to ${CATEGORY_LABELS[staffCategory]} and provisioned an invite-only ${PROVISIONED_ROLE_LABELS[portalRole]} login.`
        );
      } else {
        await addStaffMember({
          uid: user.uid,
          fullName,
          roleTitle,
          department,
          staffCategory,
          employmentType,
          weeklyHoursTarget,
          boardViewerUids: activeBoardUids,
        });
        setStaffModalOpen(false);
        setFeedback(`Added ${fullName.trim()} under ${CATEGORY_LABELS[staffCategory]}.`);
      }
      setFullName('');
      setRoleTitle('');
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code.includes('email-already-in-use')) {
        setStaffModalError('That email already has an active login credential.');
      } else {
        setStaffModalError(
          err instanceof Error ? err.message : 'Unable to add member and provision login.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOpenIssueLogin = (member: StaffMember) => {
    setIssueLoginTarget(member);
    setIssueLoginEmail('');
    setIssueLoginPassword(generateTempPassword());
    setIssueAdminRole('admin');
    setIssueClassId('');
    setIssueLoginError(null);
  };

  const handleIssueExistingMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !issueLoginTarget || !isSuperAdmin) return;
    setIssueLoginError(null);

    if (issueLoginPassword.length < 8) {
      setIssueLoginError('Temporary password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      const category = issueLoginTarget.staffCategory || 'teacher';
      const portalRole = resolvePortalRole(category, issueAdminRole);
      const selectedClassId =
        portalRole === 'teacher' && issueClassId ? issueClassId : undefined;
      const classStudentIds = selectedClassId
        ? students.filter((s) => s.classId === selectedClassId).map((s) => s.id)
        : undefined;

      const teacherSyncIds =
        portalRole === 'teacher'
          ? {
              attendanceRecordIds: selectedClassId
                ? attendanceRecords.filter((a) => a.classId === selectedClassId).map((a) => a.id)
                : [],
              notificationIds: selectedClassId
                ? notifications.filter((n) => n.classId === selectedClassId).map((n) => n.id)
                : [],
              scheduleIds: selectedClassId
                ? schedules.filter((sc) => sc.classId === selectedClassId).map((sc) => sc.id)
                : [],
              notificationRuleIds: allNotificationRuleIds,
            }
          : portalRole === 'staff'
          ? {
              attendanceRecordIds: [],
              notificationIds: [],
              scheduleIds: [],
              notificationRuleIds: allNotificationRuleIds,
            }
          : undefined;

      await provisionInvitedRoleAccount({
        superAdminUid: user.uid,
        schoolName: profile?.schoolName || 'Classytics',
        fullName: issueLoginTarget.fullName,
        email: issueLoginEmail,
        tempPassword: issueLoginPassword,
        role: portalRole,
        department: issueLoginTarget.department,
        assignClassId: selectedClassId,
        assignedStudentIds: classStudentIds,
        existingStaffId: issueLoginTarget.id,
        boardSyncIds: portalRole === 'board' ? boardSyncIds : undefined,
        teacherSyncIds,
      });

      setIssuedCredential({
        fullName: issueLoginTarget.fullName,
        email: issueLoginEmail.trim(),
        password: issueLoginPassword,
        role: portalRole,
      });
      setCopiedCreds(false);
      setIssueLoginTarget(null);
      setFeedback(
        `Provisioned invite-only ${PROVISIONED_ROLE_LABELS[portalRole]} login for ${issueLoginTarget.fullName}.`
      );
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code.includes('email-already-in-use')) {
        setIssueLoginError('That email already has an active login credential.');
      } else {
        setIssueLoginError(err instanceof Error ? err.message : 'Unable to provision login.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!issuedCredential) return;
    const text = `Classytics Invite-Only Login\nRole: ${PROVISIONED_ROLE_LABELS[issuedCredential.role]}\nName: ${issuedCredential.fullName}\nEmail: ${issuedCredential.email}\nTemporary Password: ${issuedCredential.password}`;
    await navigator.clipboard.writeText(text);
    setCopiedCreds(true);
  };

  const handleStatusToggle = async (member: StaffMember, nextStatus: StaffStatus) => {
    await updateStaffStatus(member.id, nextStatus);
    setFeedback(`Updated ${member.fullName}'s status to ${nextStatus.replace('_', ' ')}.`);
  };

  const handleAutoResolve = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await autoResolveScheduleConflicts({ schedules, staff });
      setFeedback(
        `Automated scheduler completed: ${res.resolvedConflicts} room conflict(s) resolved and ${res.assignedSubstitutes} substitute assignment(s) updated.`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleOpenBlockModal = () => {
    setBlockStaffId(staff[0]?.id || '');
    setBlockClassId(classes[0]?.id || '');
    setBlockRoom(classes[0]?.room || 'Hall B-204');
    setBlockSubject(classes[0]?.name || 'Mathematics');
    setBlockDay('Tue');
    setBlockPeriod(3);
    setBlockModalOpen(true);
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const member = staff.find((s) => s.id === blockStaffId);
    const schoolClass = classes.find((c) => c.id === blockClassId);
    if (!member || !schoolClass) return;
    setBusy(true);
    try {
      const res = await createScheduleBlock({
        uid: user.uid,
        staff: member,
        schoolClass,
        dayOfWeek: blockDay,
        periodNumber: blockPeriod,
        room: blockRoom,
        subject: blockSubject || schoolClass.name,
        existingSchedules: schedules,
      });
      setBlockModalOpen(false);
      setFeedback(
        res.conflictDetected
          ? `Added ${blockDay} Period ${blockPeriod} block with a scheduling flag — click "Auto-Resolve Schedule" to optimize.`
          : `Scheduled ${schoolClass.name} with ${member.fullName} on ${blockDay} Period ${blockPeriod}.`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalTarget) return;
    setBusy(true);
    try {
      await updateStaffEvaluation({
        staffId: evalTarget.id,
        attendanceSubmissionRate: evalAttendance,
        parentResponseMinutes: evalResponseMin,
        observationScore: evalObservation,
      });
      setEvalTarget(null);
      setFeedback(`Saved performance evaluation for ${evalTarget.fullName}.`);
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = () => {
    const header = [
      'Full Name',
      'Role',
      'Department',
      'Employment Type',
      'Status',
      'Assigned Hours',
      'Target Hours',
      'Attendance Submission %',
      'Avg Parent Response (min)',
      'Observation Score',
    ];
    const rows = visibleStaff.map((s) => [
      escapeCsvCell(s.fullName),
      escapeCsvCell(s.roleTitle),
      escapeCsvCell(s.department),
      escapeCsvCell(s.employmentType),
      escapeCsvCell(s.status),
      s.assignedHours,
      s.weeklyHoursTarget,
      s.attendanceSubmissionRate,
      s.parentResponseMinutes,
      s.observationScore,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'classytics-staff-performance.csv';
    link.click();
    URL.revokeObjectURL(url);
    setFeedback('Exported staff performance report as CSV.');
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation & Contextual Action */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start overflow-x-auto">
          <button
            type="button"
            onClick={() => setSubTab('directory')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'directory'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {CATEGORY_LABELS[selectedCategory]} ({visibleStaff.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('schedule')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'schedule'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Automated Timetable ({scheduleIssuesCount > 0 ? `${scheduleIssuesCount} Flags` : 'Clean'})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('performance')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'performance'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Performance Reporting
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {subTab === 'directory' && (
            <button
              type="button"
              onClick={handleOpenAddStaff}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              {ADD_BUTTON_LABELS[selectedCategory]}
            </button>
          )}

          {subTab === 'schedule' && (
            <>
              <button
                type="button"
                onClick={handleOpenBlockModal}
                disabled={staff.length === 0 || classes.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add Block
              </button>
              <button
                type="button"
                onClick={handleAutoResolve}
                disabled={busy || schedules.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" />
                {busy ? 'Optimizing...' : 'Auto-Resolve Schedule'}
              </button>
            </>
          )}

          {subTab === 'performance' && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          )}
        </div>
      </section>

      {/* One-time Copyable Invite-Only Credentials Banner */}
      {issuedCredential && (
        <section className="bg-white border border-slate-300 rounded-lg p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
              <span>
                Invite-Only Login Created for {issuedCredential.fullName} (
                {PROVISIONED_ROLE_LABELS[issuedCredential.role]})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIssuedCredential(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-slate-600">
            This account is now listed under School → Invite-Only Logins &amp; Inquiries. Copy and
            deliver these credentials securely; the temporary password is never saved in Firestore
            and cannot be shown again once dismissed.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs text-slate-800">
            <div className="space-y-1">
              <p>Email: {issuedCredential.email}</p>
              <p>Password: {issuedCredential.password}</p>
            </div>
            <button
              type="button"
              onClick={handleCopyCredentials}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedCreds ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCreds ? 'Copied' : 'Copy Credentials'}
            </button>
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

      {/* TAB 1: FACULTY & PERSONNEL DIRECTORY */}
      {subTab === 'directory' && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Department &amp; Type</th>
                  <th className="py-3 px-4">Weekly Load</th>
                  <th className="py-3 px-4">Portal Login</th>
                  <th className="py-3 px-4">Availability</th>
                  <th className="py-3 px-4 text-right">Status Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {visibleStaff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                      No personnel currently listed under {CATEGORY_LABELS[selectedCategory]}.
                    </td>
                  </tr>
                ) : (
                  visibleStaff.map((member) => {
                    const pct =
                      member.weeklyHoursTarget > 0
                        ? Math.min(
                            100,
                            Math.round((member.assignedHours / member.weeklyHoursTarget) * 100)
                          )
                        : 0;
                    const linkedInvite = getMemberInvite(member);
                    return (
                      <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <StaffAvatar member={member} />
                            <div>
                              <p className="font-medium text-slate-900">{member.fullName}</p>
                              <p className="text-xs text-slate-500">{member.roleTitle}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="text-slate-800">{member.department}</p>
                          <p className="text-xs text-slate-500">{member.employmentType}</p>
                        </td>

                        <td className="py-3.5 px-4 min-w-[160px]">
                          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-700 mb-1">
                            <span>
                              {member.assignedHours}h / {member.weeklyHoursTarget}h
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#0F4C5C] rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {linkedInvite ? (
                            <div>
                              <span
                                className={`text-xs font-semibold ${
                                  linkedInvite.status === 'active'
                                    ? 'text-green-700'
                                    : 'text-red-600'
                                }`}
                              >
                                {linkedInvite.status === 'active'
                                  ? 'Login Active'
                                  : 'Login Revoked'}
                              </span>
                              <p className="text-[11px] text-slate-500">
                                {PROVISIONED_ROLE_LABELS[linkedInvite.role]}
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">Directory Only</span>
                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenIssueLogin(member)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#0F4C5C] bg-white border border-slate-200 hover:bg-slate-50 rounded cursor-pointer"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  Issue Login
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`text-xs font-semibold ${
                              member.status === 'active'
                                ? 'text-green-700'
                                : member.status === 'on_leave'
                                ? 'text-amber-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {member.status === 'active'
                              ? 'Active'
                              : member.status === 'on_leave'
                              ? 'On Leave'
                              : 'Inactive'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <select
                            value={member.status}
                            onChange={(e) =>
                              handleStatusToggle(member, e.target.value as StaffStatus)
                            }
                            aria-label={`Change status for ${member.fullName}`}
                            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                          >
                            <option value="active">Active</option>
                            <option value="on_leave">On Leave</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: AUTOMATED TIMETABLE */}
      {subTab === 'schedule' && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-[#0F4C5C]" />
              <span>
                Weekly Instructional Grid · {schedules.length} active blocks ·{' '}
                <strong className={scheduleIssuesCount > 0 ? 'text-red-600' : 'text-green-700'}>
                  {scheduleIssuesCount} conflict/coverage flag{scheduleIssuesCount === 1 ? '' : 's'}
                </strong>
              </span>
            </div>
            <span className="text-slate-400">
              Auto-Resolve reassigns double-booked rooms and covers on-leave staff automatically
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 w-28">Period</th>
                  {DAYS.map((day) => (
                    <th key={day} className="py-3 px-4">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs align-top">
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600 bg-slate-50/40 border-r border-slate-100">
                      <p className="font-semibold text-slate-900">Period {period}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {period === 1
                          ? '08:15–09:05'
                          : period === 2
                          ? '09:15–10:05'
                          : period === 3
                          ? '10:20–11:10'
                          : period === 4
                          ? '11:20–12:10'
                          : '13:00–13:50'}
                      </p>
                    </td>
                    {DAYS.map((day) => {
                      const cellBlocks = schedules.filter(
                        (s) => s.dayOfWeek === day && s.periodNumber === period
                      );
                      return (
                        <td
                          key={day}
                          className="p-2.5 border-r border-slate-100 last:border-r-0 min-w-[145px]"
                        >
                          {cellBlocks.length === 0 ? (
                            <span className="text-slate-300 text-[11px]">Open</span>
                          ) : (
                            <div className="space-y-2">
                              {cellBlocks.map((b) => (
                                <div
                                  key={b.id}
                                  className={`p-2.5 rounded border ${
                                    b.status === 'conflict'
                                      ? 'bg-red-50/70 border-red-200'
                                      : b.status === 'substitute_needed'
                                      ? 'bg-amber-50/70 border-amber-200'
                                      : 'bg-slate-50/70 border-slate-200'
                                  }`}
                                >
                                  <p className="font-semibold text-slate-900 truncate">
                                    {b.className}
                                  </p>
                                  <p className="text-slate-600 mt-0.5 truncate">{b.staffName}</p>
                                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                    {b.room}
                                  </p>
                                  {b.status !== 'scheduled' && (
                                    <p
                                      className={`text-[11px] font-semibold mt-1 ${
                                        b.status === 'conflict'
                                          ? 'text-red-700'
                                          : 'text-amber-700'
                                      }`}
                                    >
                                      {b.status === 'conflict'
                                        ? 'Room Conflict'
                                        : 'Substitute Needed'}
                                    </p>
                                  )}
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

      {/* TAB 3: PERFORMANCE REPORTING */}
      {subTab === 'performance' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Faculty Operational &amp; Observation Benchmarks
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  On-time attendance roll submission (%) compared with classroom observation scores (/100)
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="text-[#0F4C5C] font-medium">Attendance Submission %</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-500 font-medium">Observation Score</span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={performanceChartData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#334155', fontSize: 12 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[70, 100]}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="Attendance Submission %"
                    fill="#0F4C5C"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="Observation Score"
                    fill="#94A3B8"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">Instructor</th>
                    <th className="py-3 px-4 text-right">Roll Submission</th>
                    <th className="py-3 px-4 text-right">Parent Response SLA</th>
                    <th className="py-3 px-4 text-right">Observation Score</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {visibleStaff.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-900">{member.fullName}</p>
                        <p className="text-xs text-slate-500">
                          {member.department} · {member.roleTitle}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {member.attendanceSubmissionRate.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {member.parentResponseMinutes} min
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {member.observationScore} / 100
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEvalTarget(member);
                            setEvalAttendance(member.attendanceSubmissionRate);
                            setEvalResponseMin(member.parentResponseMinutes);
                            setEvalObservation(member.observationScore);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                        >
                          Log Evaluation
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Add Member + Invite-Only Login Modal */}
      {staffModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddStaff}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0F4C5C]" />
                <h3 className="text-base font-semibold text-slate-900">
                  {MODAL_TITLE_LABELS[selectedCategory]}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStaffModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {staffModalError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {staffModalError}
              </p>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Samuel Adeyemi"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Staff Classification
                  </label>
                  <select
                    value={staffCategory}
                    onChange={(e) => handleCategoryChange(e.target.value as StaffCategory)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  >
                    <option value="stakeholder">Stakeholders / Board</option>
                    <option value="administration">Administration</option>
                    <option value="teacher">Teachers</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role Title</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder={ROLE_TITLE_PLACEHOLDERS[staffCategory]}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  >
                    {departmentOptions.map((deptName) => (
                      <option key={deptName} value={deptName}>
                        {deptName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Contract Type
                  </label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Substitute">Substitute</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Weekly Hours
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={weeklyHoursTarget}
                    onChange={(e) => setWeeklyHoursTarget(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              {/* Super Admin Exclusive Invite-Only Login Section */}
              {isSuperAdmin && (
                <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createLogin}
                      onChange={(e) => setCreateLogin(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#0F4C5C]"
                    />
                    <span>
                      <span className="block text-xs font-semibold text-slate-900">
                        Provision Invite-Only Login Credential
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        Adds this member directly to School → Invite-Only Logins &amp; Inquiries in
                        one step.
                      </span>
                    </span>
                  </label>

                  {createLogin && (
                    <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3.5 space-y-3">
                      {staffCategory === 'administration' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Portal Access Level
                          </label>
                          <select
                            value={adminAccessRole}
                            onChange={(e) =>
                              setAdminAccessRole(e.target.value as 'admin' | 'staff')
                            }
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md"
                          >
                            <option value="admin">
                              Administrator (Full Management Access)
                            </option>
                            <option value="staff">
                              Staff &amp; Administration (Campus Operations)
                            </option>
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Institutional Login Email
                        </label>
                        <input
                          type="email"
                          required={createLogin}
                          maxLength={160}
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="member@school.edu.in"
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Temporary Password
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            required={createLogin}
                            minLength={8}
                            value={tempPassword}
                            onChange={(e) => setTempPassword(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() => setTempPassword(generateTempPassword())}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Regenerate
                          </button>
                        </div>
                      </div>

                      {staffCategory === 'teacher' && classes.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Assign Primary Homeroom Section (Optional)
                          </label>
                          <select
                            value={assignClassId}
                            onChange={(e) => setAssignClassId(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md"
                          >
                            <option value="">None / Assign Later</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.code} · {c.name} ({c.gradeLevel})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {staffCategory === 'stakeholder' && (
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Creates a read-only Board / Stakeholder account with access to Financial
                          Analytics, Students Information, and Teachers Information.
                        </p>
                      )}

                      {(staffCategory === 'administration' || staffCategory === 'staff') && (
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {staffCategory === 'administration' && adminAccessRole === 'admin'
                            ? 'Grants full Administrator access across campus operations. No homeroom section assignment is required.'
                            : 'Grants Staff & Administration campus operations access. No homeroom section assignment is required.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStaffModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
              >
                {busy
                  ? 'Saving...'
                  : isSuperAdmin && createLogin
                  ? `${ADD_BUTTON_LABELS[selectedCategory]} & Issue Login`
                  : ADD_BUTTON_LABELS[selectedCategory]}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Issue Login for Existing Directory-Only Member Modal (Super Admin Only) */}
      {issueLoginTarget && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleIssueExistingMemberLogin}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0F4C5C]" />
                <h3 className="text-base font-semibold text-slate-900">
                  Issue Invite-Only Login
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIssueLoginTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 text-xs">
              <p className="font-semibold text-slate-900">{issueLoginTarget.fullName}</p>
              <p className="text-slate-500 mt-0.5">
                {issueLoginTarget.roleTitle} · {issueLoginTarget.department}
              </p>
            </div>

            {issueLoginError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {issueLoginError}
              </p>
            )}

            <div className="space-y-3">
              {issueLoginTarget.staffCategory === 'administration' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Portal Access Level
                  </label>
                  <select
                    value={issueAdminRole}
                    onChange={(e) => setIssueAdminRole(e.target.value as 'admin' | 'staff')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  >
                    <option value="admin">Administrator (Full Management Access)</option>
                    <option value="staff">Staff &amp; Administration (Campus Operations)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Institutional Login Email
                </label>
                <input
                  type="email"
                  required
                  maxLength={160}
                  value={issueLoginEmail}
                  onChange={(e) => setIssueLoginEmail(e.target.value)}
                  placeholder="member@school.edu.in"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Temporary Password
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={issueLoginPassword}
                    onChange={(e) => setIssueLoginPassword(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => setIssueLoginPassword(generateTempPassword())}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </div>
              </div>

              {(issueLoginTarget.staffCategory || 'teacher') === 'teacher' && classes.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assign Primary Homeroom Section (Optional)
                  </label>
                  <select
                    value={issueClassId}
                    onChange={(e) => setIssueClassId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  >
                    <option value="">None / Assign Later</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name} ({c.gradeLevel})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIssueLoginTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Issuing Login...' : 'Create Invite Login'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Timetable Block Modal */}
      {blockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBlock}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Schedule Class Block</h3>
              <button
                type="button"
                onClick={() => setBlockModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Class Section</label>
                <select
                  value={blockClassId}
                  onChange={(e) => {
                    setBlockClassId(e.target.value);
                    const found = classes.find((c) => c.id === e.target.value);
                    if (found) {
                      setBlockRoom(found.room);
                      setBlockSubject(found.name);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Instructor</label>
                <select
                  value={blockStaffId}
                  onChange={(e) => setBlockStaffId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.status.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Day</label>
                  <select
                    value={blockDay}
                    onChange={(e) => setBlockDay(e.target.value as DayOfWeek)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Period</label>
                  <select
                    value={blockPeriod}
                    onChange={(e) => setBlockPeriod(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                  >
                    {PERIODS.map((p) => (
                      <option key={p} value={p}>
                        Period {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Room</label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={blockRoom}
                  onChange={(e) => setBlockRoom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBlockModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Scheduling...' : 'Save Block'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Log Performance Evaluation Modal */}
      {evalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEvaluation}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                Evaluate: {evalTarget.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setEvalTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Attendance Submission Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={evalAttendance}
                  onChange={(e) => setEvalAttendance(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Avg Parent Response Time (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10080}
                  value={evalResponseMin}
                  onChange={(e) => setEvalResponseMin(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Classroom Observation Score (0–100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={evalObservation}
                  onChange={(e) => setEvalObservation(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEvalTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Saving...' : 'Save Evaluation'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
