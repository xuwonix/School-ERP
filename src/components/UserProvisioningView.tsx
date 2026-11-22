import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import {
  provisionInvitedRoleAccount,
  toggleRoleInviteStatus,
} from '../lib/schoolActions';
import { generateTempPassword } from '../lib/validation';
import { ProvisionedRole } from '../types';

const ROLE_LABELS: Record<ProvisionedRole, string> = {
  board: 'Board / Stakeholder',
  student: 'Student',
  teacher: 'Teacher',
  staff: 'Staff & Administration',
  admin: 'Administrator',
};

export function UserProvisioningView() {
  const {
    user,
    profile,
    departments,
    classes,
    students,
    attendanceRecords,
    notifications,
    notificationRules,
    schedules,
    staff,
    financialRecords,
    invites,
    contactInquiries,
    careerApplications,
  } = useSchool();

  const boardSyncIds = {
    financialRecordIds: financialRecords.map((r) => r.id),
    studentIds: students.map((s) => s.id),
    staffIds: staff.map((m) => m.id),
    classIds: classes.map((c) => c.id),
    departmentIds: departments.map((d) => d.id),
  };

  const allNotificationRuleIds = notificationRules.map((r) => r.id);

  const [tab, setTab] = useState<'invites' | 'inquiries' | 'careers'>('invites');
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProvisionedRole>('teacher');
  const [department, setDepartment] = useState('Mathematics');
  const [tempPassword, setTempPassword] = useState(() => generateTempPassword());
  const [assignClassId, setAssignClassId] = useState('');
  const [linkStudentId, setLinkStudentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // One-time transient credential handoff (never persisted to Firestore)
  const [issuedCredential, setIssuedCredential] = useState<{
    fullName: string;
    email: string;
    password: string;
    role: ProvisionedRole;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const getDefaultDepartmentForRole = (nextRole: ProvisionedRole) => {
    if (nextRole === 'board') {
      return (
        departments.find((d) => d.category === 'Governance')?.name ||
        'Board & Governance'
      );
    }
    if (nextRole === 'admin') {
      return (
        departments.find((d) => d.category === 'Administrative')?.name ||
        'Administration'
      );
    }
    if (nextRole === 'staff') {
      return (
        departments.find((d) => d.category === 'Operations')?.name ||
        'Campus Operations'
      );
    }
    if (nextRole === 'student') {
      return 'Grade 10';
    }
    return (
      departments.find((d) => d.category === 'Academic')?.name ||
      departments[0]?.name ||
      'Academic Faculty'
    );
  };

  const handleOpenCreate = () => {
    setFullName('');
    setEmail('');
    setRole('teacher');
    setDepartment(getDefaultDepartmentForRole('teacher'));
    setTempPassword(generateTempPassword());
    setAssignClassId(classes[0]?.id || '');
    setLinkStudentId(students.find((s) => !s.linkedUserUid)?.id || students[0]?.id || '');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setErrorMsg(null);
    if (tempPassword.length < 8) {
      setErrorMsg('Temporary password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      const isTeacher = role === 'teacher';
      const selectedClassId = isTeacher && assignClassId ? assignClassId : undefined;
      const classStudentIds = selectedClassId
        ? students.filter((s) => s.classId === selectedClassId).map((s) => s.id)
        : undefined;

      const teacherSyncIds = isTeacher
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
        : role === 'staff'
        ? {
            attendanceRecordIds: [],
            notificationIds: [],
            scheduleIds: [],
            notificationRuleIds: allNotificationRuleIds,
          }
        : undefined;

      await provisionInvitedRoleAccount({
        superAdminUid: user.uid,
        schoolName: profile.schoolName,
        fullName,
        email,
        tempPassword,
        role,
        department,
        assignClassId: selectedClassId,
        assignedStudentIds: classStudentIds,
        linkStudentId: role === 'student' ? linkStudentId : undefined,
        boardSyncIds: role === 'board' ? boardSyncIds : undefined,
        teacherSyncIds,
      });
      setIssuedCredential({
        fullName,
        email,
        password: tempPassword,
        role,
      });
      setCopied(false);
      setModalOpen(false);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code.includes('email-already-in-use')) {
        setErrorMsg('That email already has an active login credential.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to create login.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!issuedCredential) return;
    const text = `Classytics Invite-Only Login\nRole: ${ROLE_LABELS[issuedCredential.role]}\nName: ${issuedCredential.fullName}\nEmail: ${issuedCredential.email}\nTemporary Password: ${issuedCredential.password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab('invites')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'invites'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Role Logins ({invites.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('inquiries')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'inquiries'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Contact Inquiries ({contactInquiries.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('careers')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'careers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Career Applications ({careerApplications.length})
          </button>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Provision Role Login
        </button>
      </section>

      {/* One-time Copyable Invite Credential Banner */}
      {issuedCredential && (
        <section className="bg-white border border-slate-300 rounded-lg p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
              <span>
                Invite-Only Login Created for {issuedCredential.fullName} (
                {ROLE_LABELS[issuedCredential.role]})
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
            Copy and deliver these credentials securely. For security, this temporary password is
            never saved in Firestore and cannot be displayed again once dismissed.
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
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Credentials'}
            </button>
          </div>
        </section>
      )}

      {/* TAB 1: ROLE LOGINS */}
      {tab === 'invites' && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-[#0F4C5C]" />
              <span>
                Invite-only governance active. Only Super Admin provisioned credentials can sign in.
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Department / Grade</th>
                  <th className="py-3 px-4">Access State</th>
                  <th className="py-3 px-4 text-right">Governance Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {invites.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center space-y-2">
                      <p className="text-sm font-medium text-slate-900">
                        No role logins provisioned yet
                      </p>
                      <p className="text-xs text-slate-500">
                        Click &ldquo;Provision Role Login&rdquo; to create invite-only access for
                        Students, Teachers, Staff, or Administrators.
                      </p>
                    </td>
                  </tr>
                ) : (
                  invites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-900">{inv.fullName}</p>
                        <p className="text-xs font-mono text-slate-400">UID: {inv.targetUid.slice(0, 12)}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 font-medium">
                        {ROLE_LABELS[inv.role]}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{inv.department}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            inv.status === 'active' ? 'text-green-700' : 'text-red-600'
                          }`}
                        >
                          {inv.status === 'active' ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            toggleRoleInviteStatus(
                              inv.id,
                              inv.targetUid,
                              inv.status !== 'active',
                              inv.role,
                              inv.role === 'board' ? boardSyncIds : undefined,
                              inv.role === 'teacher' || inv.role === 'staff'
                                ? allNotificationRuleIds
                                : undefined
                            )
                          }
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                        >
                          {inv.status === 'active' ? 'Revoke Access' : 'Restore Access'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: PUBLIC CONTACT INQUIRIES */}
      {tab === 'inquiries' && (
        <section className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {contactInquiries.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No public Contact Us inquiries submitted yet.
            </div>
          ) : (
            contactInquiries.map((inq) => (
              <div key={inq.id} className="p-5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {inq.fullName} · {inq.institutionName}
                  </p>
                  <span className="text-xs font-mono text-[#0F4C5C]">{inq.topic}</span>
                </div>
                <p className="text-xs font-mono text-slate-500">
                  {inq.workEmail}
                  {inq.phone ? ` · ${inq.phone}` : ''}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed pt-1">{inq.message}</p>
              </div>
            ))
          )}
        </section>
      )}

      {/* TAB 3: PUBLIC CAREER APPLICATIONS */}
      {tab === 'careers' && (
        <section className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {careerApplications.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No public Career applications submitted yet.
            </div>
          ) : (
            careerApplications.map((app) => (
              <div key={app.id} className="p-5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {app.applicantName} · {app.roleTitle}
                  </p>
                  <span className="text-xs font-mono text-slate-500">{app.department}</span>
                </div>
                <p className="text-xs font-mono text-slate-500">
                  {app.email}
                  {app.portfolioUrl ? ` · ${app.portfolioUrl}` : ''}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed pt-1">{app.coverNote}</p>
              </div>
            ))
          )}
        </section>
      )}

      {/* Provision Role Login Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleProvision}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0F4C5C]" />
                <h3 className="text-base font-semibold text-slate-900">
                  Provision Invite-Only Role Login
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {errorMsg}
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role Type</label>
                <select
                  value={role}
                  onChange={(e) => {
                    const nextRole = e.target.value as ProvisionedRole;
                    setRole(nextRole);
                    setDepartment(getDefaultDepartmentForRole(nextRole));
                    if (nextRole === 'teacher') {
                      setAssignClassId(classes[0]?.id || '');
                    } else {
                      setAssignClassId('');
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  <option value="board">
                    Board / Stakeholder (Financial Analytics, Students &amp; Teachers Dashboard)
                  </option>
                  <option value="teacher">Teacher (Homeroom &amp; Attendance Desk)</option>
                  <option value="student">Student (Personal Attendance &amp; Schedule Portal)</option>
                  <option value="staff">Staff &amp; Administration (Campus Operations)</option>
                  <option value="admin">Administrator (Full Management Access)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Jordan Patel"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Department / Grade
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    list="provision-dept-suggestions"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g., Grade 10 or Science"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  />
                  <datalist id="provision-dept-suggestions">
                    {departments.map((d) => (
                      <option key={d.id} value={d.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Institutional Login Email
                </label>
                <input
                  type="email"
                  required
                  maxLength={160}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="j.patel@school.edu.in"
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
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => setTempPassword(generateTempPassword())}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </div>
              </div>

              {role === 'board' && (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600 leading-relaxed">
                  Board accounts receive dedicated read-only governance access to Financial
                  Analytics, Students Information, and Teachers Information (private guardian
                  contacts remain isolated).
                </div>
              )}

              {role === 'staff' && (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600 leading-relaxed">
                  Staff &amp; Administration (Campus Operations) accounts operate at the department
                  level and do not require a Primary Homeroom Section.
                </div>
              )}

              {role === 'admin' && (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600 leading-relaxed">
                  Administrator accounts receive full campus management access without requiring a
                  Primary Homeroom Section assignment.
                </div>
              )}

              {role === 'teacher' && classes.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assign Primary Homeroom Section
                  </label>
                  <select
                    value={assignClassId}
                    onChange={(e) => setAssignClassId(e.target.value)}
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

              {role === 'student' && students.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Link to Enrolled Student Profile
                  </label>
                  <select
                    value={linkStudentId}
                    onChange={(e) => setLinkStudentId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  >
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.firstName} {st.lastName} ({st.studentCode} · {st.className})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
                {busy ? 'Creating Account...' : 'Create Invite Login'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
