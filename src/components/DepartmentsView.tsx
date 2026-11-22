import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  FolderKanban,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import {
  addStaffMember,
  assignExistingTeachersToDepartment,
  createDepartment,
  provisionInvitedRoleAccount,
  toggleDepartmentStatus,
} from '../lib/schoolActions';
import { generateSafeId, generateTempPassword } from '../lib/validation';
import { Department, DepartmentCategory, EmploymentType } from '../types';

const CATEGORIES: ('All' | DepartmentCategory)[] = [
  'All',
  'Academic',
  'Administrative',
  'Operations',
  'Governance',
];

interface DraftNewTeacher {
  localId: string;
  fullName: string;
  roleTitle: string;
  employmentType: EmploymentType;
  weeklyHoursTarget: number;
  createLogin: boolean;
  email: string;
  tempPassword: string;
  assignClassId: string;
}

interface IssuedTeacherCredential {
  fullName: string;
  email: string;
  password: string;
  department: string;
}

function createEmptyDraftTeacher(defaultCreateLogin: boolean): DraftNewTeacher {
  return {
    localId: generateSafeId('draft'),
    fullName: '',
    roleTitle: 'Subject Teacher',
    employmentType: 'Full-Time',
    weeklyHoursTarget: 28,
    createLogin: defaultCreateLogin,
    email: '',
    tempPassword: generateTempPassword(),
    assignClassId: '',
  };
}

export function DepartmentsView() {
  const {
    user,
    profile,
    departments,
    staff,
    classes,
    students,
    attendanceRecords,
    notifications,
    notificationRules,
    schedules,
    invites,
  } = useSchool();

  const isSuperAdmin =
    profile?.role === 'super_admin' || user?.email === 'xuwonixweb@gmail.com';

  const [categoryFilter, setCategoryFilter] = useState<'All' | DepartmentCategory>('All');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // One-time transient credentials banner (never stored in Firestore)
  const [issuedCredentials, setIssuedCredentials] = useState<IssuedTeacherCredential[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);

  // Create Department Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<DepartmentCategory>('Academic');
  const [headName, setHeadName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedExistingIds, setSelectedExistingIds] = useState<string[]>([]);
  const [draftTeachers, setDraftTeachers] = useState<DraftNewTeacher[]>([]);

  // Manage / Add Teachers for Existing Department Modal State
  const [manageDept, setManageDept] = useState<Department | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [manageExistingIds, setManageExistingIds] = useState<string[]>([]);
  const [manageDraftTeachers, setManageDraftTeachers] = useState<DraftNewTeacher[]>([]);

  const allTeachers = useMemo(
    () => staff.filter((s) => (s.staffCategory || 'teacher') === 'teacher'),
    [staff]
  );

  const allNotificationRuleIds = useMemo(
    () => notificationRules.map((r) => r.id),
    [notificationRules]
  );

  const activeBoardUids = useMemo(
    () =>
      invites
        .filter((inv) => inv.role === 'board' && inv.status === 'active')
        .map((inv) => inv.targetUid),
    [invites]
  );

  const filteredDepartments = useMemo(() => {
    if (categoryFilter === 'All') return departments;
    return departments.filter((d) => d.category === categoryFilter);
  }, [departments, categoryFilter]);

  const counts = useMemo(() => {
    const active = departments.filter((d) => d.status === 'active').length;
    const academic = departments.filter((d) => d.category === 'Academic').length;
    const opsAndAdmin = departments.filter(
      (d) => d.category === 'Administrative' || d.category === 'Operations'
    ).length;
    return { total: departments.length, active, academic, opsAndAdmin };
  }, [departments]);

  const getDepartmentStats = (deptName: string) => {
    const normalized = deptName.trim().toLowerCase();
    const members = staff.filter((s) => s.department.trim().toLowerCase() === normalized);
    const teachers = members.filter((s) => (s.staffCategory || 'teacher') === 'teacher');
    return { total: members.length, teachers: teachers.length };
  };

  const buildLinkedUserMap = (staffIds: string[]) => {
    const map: Record<string, string> = {};
    for (const id of staffIds) {
      const member = staff.find((s) => s.id === id);
      if (member?.linkedUserUid) {
        map[id] = member.linkedUserUid;
      }
    }
    return map;
  };

  const validateDraftTeachers = (drafts: DraftNewTeacher[]): string | null => {
    const seenEmails = new Set<string>();
    for (let i = 0; i < drafts.length; i += 1) {
      const d = drafts[i];
      if (!d.fullName.trim()) {
        return `New teacher #${i + 1} requires a full name.`;
      }
      if (isSuperAdmin && d.createLogin) {
        const cleanEmail = d.email.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          return `Enter a valid institutional login email for ${d.fullName.trim()}.`;
        }
        if (seenEmails.has(cleanEmail)) {
          return `Duplicate login email detected (${d.email.trim()}). Each teacher needs a unique email.`;
        }
        seenEmails.add(cleanEmail);
        if (d.tempPassword.length < 8) {
          return `Temporary password for ${d.fullName.trim()} must be at least 8 characters.`;
        }
      }
    }
    return null;
  };

  const createNewTeachersForDepartment = async (
    departmentName: string,
    drafts: DraftNewTeacher[]
  ): Promise<{
    addedCount: number;
    credentials: IssuedTeacherCredential[];
    failures: string[];
  }> => {
    if (!user) return { addedCount: 0, credentials: [], failures: [] };
    const credentials: IssuedTeacherCredential[] = [];
    const failures: string[] = [];
    let addedCount = 0;

    for (const draft of drafts) {
      const safeFullName = draft.fullName.trim();
      const safeRoleTitle = draft.roleTitle.trim() || 'Subject Teacher';
      try {
        if (isSuperAdmin && draft.createLogin) {
          const selectedClassId = draft.assignClassId || undefined;
          const classStudentIds = selectedClassId
            ? students.filter((s) => s.classId === selectedClassId).map((s) => s.id)
            : undefined;
          const teacherSyncIds = {
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
          };

          await provisionInvitedRoleAccount({
            superAdminUid: user.uid,
            schoolName: profile?.schoolName || 'Classytics',
            fullName: safeFullName,
            email: draft.email.trim(),
            tempPassword: draft.tempPassword,
            role: 'teacher',
            department: departmentName,
            assignClassId: selectedClassId,
            assignedStudentIds: classStudentIds,
            createStaffRecord: {
              roleTitle: safeRoleTitle,
              staffCategory: 'teacher',
              employmentType: draft.employmentType,
              weeklyHoursTarget: draft.weeklyHoursTarget,
              activeBoardUids,
            },
            teacherSyncIds,
          });
          credentials.push({
            fullName: safeFullName,
            email: draft.email.trim(),
            password: draft.tempPassword,
            department: departmentName,
          });
          addedCount += 1;
        } else {
          await addStaffMember({
            uid: user.uid,
            fullName: safeFullName,
            roleTitle: safeRoleTitle,
            department: departmentName,
            staffCategory: 'teacher',
            employmentType: draft.employmentType,
            weeklyHoursTarget: draft.weeklyHoursTarget,
            boardViewerUids: activeBoardUids,
          });
          addedCount += 1;
        }
      } catch (err) {
        const code = (err as { code?: string })?.code || '';
        if (code.includes('email-already-in-use')) {
          failures.push(`${safeFullName} (${draft.email.trim()} already has a login)`);
        } else {
          failures.push(`${safeFullName} (${err instanceof Error ? err.message : 'failed'})`);
        }
      }
    }

    return { addedCount, credentials, failures };
  };

  const handleOpenCreateModal = () => {
    setName('');
    setCode('');
    setCategory('Academic');
    setHeadName('');
    setDescription('');
    setSelectedExistingIds([]);
    setDraftTeachers([]);
    setModalError(null);
    setModalOpen(true);
  };

  const toggleExistingSelection = (
    staffId: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const updateDraftField = <K extends keyof DraftNewTeacher>(
    localId: string,
    key: K,
    value: DraftNewTeacher[K],
    setter: React.Dispatch<React.SetStateAction<DraftNewTeacher[]>>
  ) => {
    setter((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, [key]: value } : item))
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !code.trim() || !headName.trim()) return;
    setModalError(null);

    const validationError = validateDraftTeachers(draftTeachers);
    if (validationError) {
      setModalError(validationError);
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const trimmedName = name.trim();
      await createDepartment({
        uid: user.uid,
        name: trimmedName,
        code,
        category,
        headName,
        description,
        boardViewerUids: activeBoardUids,
        assignExistingTeacherIds: selectedExistingIds,
        linkedUserUidsByStaffId: buildLinkedUserMap(selectedExistingIds),
      });

      const { addedCount, credentials, failures } = await createNewTeachersForDepartment(
        trimmedName,
        draftTeachers
      );

      if (credentials.length > 0) {
        setIssuedCredentials(credentials);
        setCopiedAll(false);
      }

      const assignedTotal = selectedExistingIds.length + addedCount;
      const summaryParts = [`Created department "${trimmedName}" (${code.toUpperCase()}).`];
      if (assignedTotal > 0) {
        summaryParts.push(
          `Assigned ${assignedTotal} teacher${assignedTotal === 1 ? '' : 's'}${
            credentials.length > 0
              ? ` (${credentials.length} invite-only login${credentials.length === 1 ? '' : 's'} provisioned)`
              : ''
          }.`
        );
      }
      if (failures.length > 0) {
        summaryParts.push(`Skipped due to error: ${failures.join('; ')}.`);
      }

      setFeedback(summaryParts.join(' '));
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleOpenManageTeachers = (dept: Department) => {
    setManageDept(dept);
    setManageExistingIds([]);
    setManageDraftTeachers([]);
    setManageError(null);
  };

  const handleAssignTeachersToExistingDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !manageDept) return;
    setManageError(null);

    if (manageExistingIds.length === 0 && manageDraftTeachers.length === 0) {
      setManageError('Select at least one existing teacher or add a new teacher.');
      return;
    }

    const validationError = validateDraftTeachers(manageDraftTeachers);
    if (validationError) {
      setManageError(validationError);
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      if (manageExistingIds.length > 0) {
        await assignExistingTeachersToDepartment({
          departmentName: manageDept.name,
          staffIds: manageExistingIds,
          linkedUserUidsByStaffId: buildLinkedUserMap(manageExistingIds),
        });
      }

      const { addedCount, credentials, failures } = await createNewTeachersForDepartment(
        manageDept.name,
        manageDraftTeachers
      );

      if (credentials.length > 0) {
        setIssuedCredentials(credentials);
        setCopiedAll(false);
      }

      const totalUpdated = manageExistingIds.length + addedCount;
      const parts = [
        `Updated ${manageDept.name}: added ${totalUpdated} teacher${totalUpdated === 1 ? '' : 's'}.`,
      ];
      if (credentials.length > 0) {
        parts.push(
          `Provisioned ${credentials.length} invite-only Teacher login${credentials.length === 1 ? '' : 's'}.`
        );
      }
      if (failures.length > 0) {
        parts.push(`Skipped: ${failures.join('; ')}.`);
      }
      setFeedback(parts.join(' '));
      setManageDept(null);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyAllCredentials = async () => {
    if (issuedCredentials.length === 0) return;
    const text = issuedCredentials
      .map(
        (c) =>
          `Classytics Invite-Only Teacher Login\nName: ${c.fullName}\nDepartment: ${c.department}\nEmail: ${c.email}\nTemporary Password: ${c.password}`
      )
      .join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
  };

  const handleToggleStatus = async (dept: Department) => {
    const nextStatus = dept.status === 'active' ? 'inactive' : 'active';
    await toggleDepartmentStatus(dept.id, nextStatus);
    setFeedback(`Marked ${dept.name} as ${nextStatus}.`);
  };

  const headSuggestions = useMemo(() => {
    const names = new Set<string>();
    allTeachers.forEach((t) => names.add(t.fullName));
    draftTeachers.forEach((d) => {
      if (d.fullName.trim()) names.add(d.fullName.trim());
    });
    return Array.from(names);
  }, [allTeachers, draftTeachers]);

  const manageDeptCurrentTeachers = useMemo(() => {
    if (!manageDept) return [];
    const norm = manageDept.name.trim().toLowerCase();
    return allTeachers.filter((t) => t.department.trim().toLowerCase() === norm);
  }, [manageDept, allTeachers]);

  const manageDeptOtherTeachers = useMemo(() => {
    if (!manageDept) return [];
    const norm = manageDept.name.trim().toLowerCase();
    return allTeachers.filter((t) => t.department.trim().toLowerCase() !== norm);
  }, [manageDept, allTeachers]);

  const renderDraftTeacherCards = (
    drafts: DraftNewTeacher[],
    setter: React.Dispatch<React.SetStateAction<DraftNewTeacher[]>>
  ) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-800">Add New Teachers</p>
          <p className="text-[11px] text-slate-500">
            Create new teacher records directly inside this department
            {isSuperAdmin ? ' with optional invite-only Teacher logins' : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setter((prev) => [...prev, createEmptyDraftTeacher(isSuperAdmin)])}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#0F4C5C] bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Add Teacher
        </button>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-3">
          {drafts.map((draft, idx) => (
            <div
              key={draft.localId}
              className="bg-slate-50/70 border border-slate-200 rounded-md p-3.5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 font-mono">
                  New Teacher #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setter((prev) => prev.filter((item) => item.localId !== draft.localId))
                  }
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={draft.fullName}
                    onChange={(e) =>
                      updateDraftField(draft.localId, 'fullName', e.target.value, setter)
                    }
                    placeholder="e.g., Priya Kalita"
                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Role Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={draft.roleTitle}
                    onChange={(e) =>
                      updateDraftField(draft.localId, 'roleTitle', e.target.value, setter)
                    }
                    placeholder="e.g., Computer Science Teacher"
                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Contract Type
                  </label>
                  <select
                    value={draft.employmentType}
                    onChange={(e) =>
                      updateDraftField(
                        draft.localId,
                        'employmentType',
                        e.target.value as EmploymentType,
                        setter
                      )
                    }
                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-md"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Substitute">Substitute</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Weekly Hours Target
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={draft.weeklyHoursTarget}
                    onChange={(e) =>
                      updateDraftField(
                        draft.localId,
                        'weeklyHoursTarget',
                        Number(e.target.value),
                        setter
                      )
                    }
                    className="w-full px-2.5 py-1.5 text-sm font-mono bg-white border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              {isSuperAdmin && (
                <div className="border-t border-slate-200 pt-2.5 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.createLogin}
                      onChange={(e) =>
                        updateDraftField(draft.localId, 'createLogin', e.target.checked, setter)
                      }
                      className="h-3.5 w-3.5 rounded border-slate-300 accent-[#0F4C5C]"
                    />
                    <span className="text-xs font-medium text-slate-800">
                      Provision Invite-Only Teacher Login
                    </span>
                  </label>

                  {draft.createLogin && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Login Email
                        </label>
                        <input
                          type="email"
                          required
                          maxLength={160}
                          value={draft.email}
                          onChange={(e) =>
                            updateDraftField(draft.localId, 'email', e.target.value, setter)
                          }
                          placeholder="teacher@school.edu.in"
                          className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Temporary Password
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            required
                            minLength={8}
                            value={draft.tempPassword}
                            onChange={(e) =>
                              updateDraftField(
                                draft.localId,
                                'tempPassword',
                                e.target.value,
                                setter
                              )
                            }
                            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateDraftField(
                                draft.localId,
                                'tempPassword',
                                generateTempPassword(),
                                setter
                              )
                            }
                            aria-label="Regenerate temporary password"
                            className="p-1.5 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {classes.length > 0 && (
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Assign Primary Homeroom Section (Optional)
                          </label>
                          <select
                            value={draft.assignClassId}
                            onChange={(e) =>
                              updateDraftField(
                                draft.localId,
                                'assignClassId',
                                e.target.value,
                                setter
                              )
                            }
                            className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-md"
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
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Total Departments</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {counts.total}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {counts.active} currently active
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Academic Faculties</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {counts.academic}
          </p>
          <p className="text-xs text-slate-500">Curriculum &amp; instruction divisions</p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Admin &amp; Campus Operations</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {counts.opsAndAdmin}
          </p>
          <p className="text-xs text-slate-500">Admissions, registrar, logistics</p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Teaching Faculty</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {allTeachers.length}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {staff.length} total campus personnel
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </section>

      {/* One-time Copyable Issued Teacher Credentials Banner */}
      {issuedCredentials.length > 0 && (
        <section className="bg-white border border-slate-300 rounded-lg p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
              <span>
                Issued {issuedCredentials.length} Invite-Only Teacher Login
                {issuedCredentials.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopyAllCredentials}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md whitespace-nowrap cursor-pointer"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedAll ? 'Copied' : 'Copy Credentials'}
              </button>
              <button
                type="button"
                onClick={() => setIssuedCredentials([])}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            These accounts are registered under School → Invite-Only Logins &amp; Inquiries. Copy
            and deliver these credentials securely; temporary passwords are never persisted in
            Firestore.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-md divide-y divide-slate-200 font-mono text-xs text-slate-800">
            {issuedCredentials.map((cred) => (
              <div
                key={cred.email}
                className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="font-sans font-semibold text-slate-900">
                    {cred.fullName} · {cred.department}
                  </p>
                  <p className="mt-0.5">Email: {cred.email}</p>
                </div>
                <p>Password: {cred.password}</p>
              </div>
            ))}
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

      {/* Departments Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Division</th>
                <th className="py-3 px-4">Department Head</th>
                <th className="py-3 px-4 text-right">Personnel</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center space-y-2">
                    <FolderKanban className="w-6 h-6 text-slate-300 mx-auto" />
                    <p className="text-sm font-medium text-slate-900">
                      No departments match this filter
                    </p>
                    <p className="text-xs text-slate-500">
                      Create a new department or switch the division filter above.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((dept) => {
                  const stats = getDepartmentStats(dept.name);
                  return (
                    <tr key={dept.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#0F4C5C] whitespace-nowrap">
                        {dept.code}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-900">{dept.name}</p>
                        {dept.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {dept.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        {dept.category}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 whitespace-nowrap">
                        {dept.headName}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono tabular-nums">
                        <span className="text-slate-900 font-medium">{stats.total}</span>
                        <span className="text-xs text-slate-400"> · </span>
                        <span className="text-xs text-slate-600">
                          {stats.teachers} teacher{stats.teachers === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            dept.status === 'active' ? 'text-green-700' : 'text-slate-400'
                          }`}
                        >
                          {dept.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenManageTeachers(dept)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#0F4C5C] bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Add Teachers
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(dept)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                          >
                            {dept.status === 'active' ? 'Set Inactive' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create Department Modal (With Existing & New Teacher Assignment) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Create Department</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {modalError}
              </p>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Computer Science"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={24}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g., DEPT-CS"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Division</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as DepartmentCategory)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  >
                    <option value="Academic">Academic</option>
                    <option value="Administrative">Administrative</option>
                    <option value="Operations">Operations</option>
                    <option value="Governance">Governance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department Head
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    list="dept-head-suggestions"
                    value={headName}
                    onChange={(e) => setHeadName(e.target.value)}
                    placeholder="e.g., Dr. Ananya Baruah"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                  <datalist id="dept-head-suggestions">
                    {headSuggestions.map((personName) => (
                      <option key={personName} value={personName} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mandate / Description
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Scope, grade coverage, or operational responsibilities..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
            </div>

            {/* Assign Existing Teachers */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Assign Existing Teachers ({selectedExistingIds.length} selected)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Reassign current teaching faculty to this new department upon creation.
                  </p>
                </div>
              </div>

              {allTeachers.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5">
                  No existing teachers in the directory yet. Use &ldquo;Add Teacher&rdquo; below to
                  create teachers directly.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100">
                  {allTeachers.map((teacher) => {
                    const checked = selectedExistingIds.includes(teacher.id);
                    return (
                      <label
                        key={teacher.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleExistingSelection(teacher.id, setSelectedExistingIds)
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-[#0F4C5C] shrink-0"
                          />
                          <span className="font-medium text-slate-900 truncate">
                            {teacher.fullName}
                          </span>
                          <span className="text-slate-400 truncate">· {teacher.roleTitle}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                          Current: {teacher.department}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Brand-New Teachers Directly */}
            <div className="border-t border-slate-200 pt-4">
              {renderDraftTeacherCards(draftTeachers, setDraftTeachers)}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
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
                  ? 'Creating Department...'
                  : selectedExistingIds.length + draftTeachers.length > 0
                  ? `Create Department & Assign ${
                      selectedExistingIds.length + draftTeachers.length
                    } Teacher${selectedExistingIds.length + draftTeachers.length === 1 ? '' : 's'}`
                  : 'Create Department'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Teachers to Existing Department Modal */}
      {manageDept && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleAssignTeachersToExistingDept}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Add Teachers to {manageDept.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {manageDept.code} · {manageDeptCurrentTeachers.length} teacher
                  {manageDeptCurrentTeachers.length === 1 ? '' : 's'} currently assigned
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManageDept(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {manageError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {manageError}
              </p>
            )}

            {manageDeptCurrentTeachers.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 text-xs text-slate-600">
                <span className="font-medium text-slate-800">Current Teachers: </span>
                {manageDeptCurrentTeachers.map((t) => t.fullName).join(', ')}
              </div>
            )}

            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-slate-800">
                Assign Existing Teachers ({manageExistingIds.length} selected)
              </p>
              {manageDeptOtherTeachers.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5">
                  All existing teachers are already assigned to {manageDept.name}. You can add new
                  teachers below.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100">
                  {manageDeptOtherTeachers.map((teacher) => {
                    const checked = manageExistingIds.includes(teacher.id);
                    return (
                      <label
                        key={teacher.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleExistingSelection(teacher.id, setManageExistingIds)
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-[#0F4C5C] shrink-0"
                          />
                          <span className="font-medium text-slate-900 truncate">
                            {teacher.fullName}
                          </span>
                          <span className="text-slate-400 truncate">· {teacher.roleTitle}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                          Current: {teacher.department}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              {renderDraftTeacherCards(manageDraftTeachers, setManageDraftTeachers)}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setManageDept(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Saving Teachers...' : 'Save Teachers to Department'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
