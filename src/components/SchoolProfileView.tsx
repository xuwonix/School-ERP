import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Layers,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { createSchoolClass, updateInstitutionProfile } from '../lib/schoolActions';
import { UserProvisioningView } from './UserProvisioningView';

export function SchoolProfileView() {
  const { user, institution, profile, classes, students, departments, staff, invites } = useSchool();

  const [tab, setTab] = useState<'profile' | 'governance' | 'sections'>('profile');
  const [schoolName, setSchoolName] = useState(institution?.schoolName || profile?.schoolName || '');
  const [schoolCode, setSchoolCode] = useState(institution?.schoolCode || '');
  const [schoolAddress, setSchoolAddress] = useState(institution?.schoolAddress || '');
  const [schoolOwner, setSchoolOwner] = useState(
    institution?.schoolOwner || profile?.displayName || ''
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add Homeroom Section modal state
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [sectionCode, setSectionCode] = useState('');
  const [sectionGrade, setSectionGrade] = useState('Grade 10');
  const [sectionRoom, setSectionRoom] = useState('');
  const [sectionSlot, setSectionSlot] = useState('Mon–Fri · 08:15–09:05');
  const [sectionTeacherId, setSectionTeacherId] = useState('');
  const [sectionCapacity, setSectionCapacity] = useState(32);
  const [creatingSection, setCreatingSection] = useState(false);
  const [sectionFeedback, setSectionFeedback] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const teacherOptions = useMemo(
    () => staff.filter((member) => member.staffCategory === 'teacher'),
    [staff]
  );

  const boardViewerUids = useMemo(
    () =>
      invites
        .filter((inv) => inv.role === 'board' && inv.status === 'active' && inv.targetUid)
        .map((inv) => inv.targetUid),
    [invites]
  );

  useEffect(() => {
    if (institution) {
      setSchoolName(institution.schoolName || '');
      setSchoolCode(institution.schoolCode || '');
      setSchoolAddress(institution.schoolAddress || '');
      setSchoolOwner(institution.schoolOwner || '');
    }
  }, [institution]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim() || !schoolAddress.trim() || !schoolOwner.trim()) {
      setErrorMsg('School Name, School Address, and School Owner are required.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      await updateInstitutionProfile({
        schoolName,
        schoolCode: schoolCode || 'CLS-2026',
        schoolAddress,
        schoolOwner,
      });
      setFeedback('School institution profile updated in real time.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update school profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!sectionName.trim() || !sectionCode.trim()) {
      setSectionError('Section Name and Section Code are required.');
      return;
    }
    setCreatingSection(true);
    setSectionError(null);
    setSectionFeedback(null);
    try {
      const selectedTeacher = teacherOptions.find((t) => t.id === sectionTeacherId);
      await createSchoolClass({
        uid: user.uid,
        name: sectionName.trim(),
        code: sectionCode.trim().toUpperCase(),
        gradeLevel: sectionGrade.trim() || 'Grade 10',
        room: sectionRoom.trim() || 'Room 101',
        scheduleSlot: sectionSlot.trim() || 'Mon–Fri · 08:15–09:05',
        teacherName: selectedTeacher ? selectedTeacher.fullName : 'Unassigned',
        teacherStaffId: selectedTeacher ? selectedTeacher.id : 'unassigned',
        assignedTeacherId: selectedTeacher?.linkedUserUid || user.uid,
        capacity: sectionCapacity,
        boardViewerUids,
      });
      setSectionFeedback(`Created homeroom section ${sectionCode.trim().toUpperCase()} (${sectionName.trim()}).`);
      setSectionName('');
      setSectionCode('');
      setSectionRoom('');
      setSectionTeacherId('');
      setSectionCapacity(32);
      setSectionModalOpen(false);
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : 'Unable to create homeroom section.');
    } finally {
      setCreatingSection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Flat Hairline KPI Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Institution Code</p>
          <p className="text-xl font-semibold text-slate-900 font-mono tabular-nums">
            {institution?.schoolCode || 'CLS-2026'}
          </p>
          <p className="text-xs text-slate-500 truncate">
            Owner Handle: <span className="font-mono">{institution?.ownerUsername || profile?.username || 'superadmin'}</span>
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Enrolled Students</p>
          <p className="text-xl font-semibold text-slate-900 font-mono tabular-nums">
            {students.length}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            Across {classes.length} active homeroom sections
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Departments &amp; Personnel</p>
          <p className="text-xl font-semibold text-slate-900 font-mono tabular-nums">
            {departments.length} / {staff.length}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            Active departments &amp; staff records
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Verification &amp; Access</p>
          <p className="text-xl font-semibold text-green-700 font-mono tabular-nums">
            {institution?.emailOtpVerified && institution?.phoneOtpVerified ? 'Verified' : 'Active'}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {invites.filter((i) => i.status === 'active').length} invited role logins active
          </p>
        </div>
      </section>

      {/* Segmented Sub-Navigation */}
      <section className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'profile'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Institution Profile
          </button>
          <button
            type="button"
            onClick={() => setTab('governance')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'governance'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Invite-Only Logins &amp; Inquiries
          </button>
          <button
            type="button"
            onClick={() => setTab('sections')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'sections'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Homeroom Sections ({classes.length})
          </button>
        </div>
      </section>

      {tab === 'profile' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-5"
          >
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-semibold text-slate-900">
                School Registration &amp; Campus Details
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Core institution metadata displayed across dashboards, attendance notices, and admissions records.
              </p>
            </div>

            {feedback && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 text-xs text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span>{feedback}</span>
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    School Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    School Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={24}
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  School Owner / Principal
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={schoolOwner}
                  onChange={(e) => setSchoolOwner(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  School Campus Address
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={240}
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving Changes...' : 'Save School Profile'}
              </button>
            </div>
          </form>

          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <ShieldCheck className="w-4 h-4 text-[#0F4C5C]" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Super Admin Identity &amp; OTP Verification
                </h3>
              </div>

              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Auto-Generated Username</dt>
                  <dd className="font-mono text-xs font-semibold text-slate-900">
                    {institution?.ownerUsername || profile?.username || 'superadmin'}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Owner Email OTP</dt>
                  <dd className="text-xs font-semibold text-green-700">
                    {institution?.emailOtpVerified ? 'Verified at Setup' : 'Active'}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Contact Number OTP</dt>
                  <dd className="text-xs font-semibold text-green-700">
                    {institution?.phoneOtpVerified ? 'Verified at Setup' : 'Active'}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <dt className="text-slate-500">Setup State</dt>
                  <dd className="text-xs font-semibold text-[#0F4C5C]">
                    Locked · Setup redirects to Login
                  </dd>
                </div>
              </dl>

              <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-200/80 rounded-md p-3">
                Private owner email and phone credentials remain stored in an owner-only protected
                record and are never exposed to public endpoints.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <MapPin className="w-4 h-4 text-[#0F4C5C]" />
                <span>Registered Campus Location</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {institution?.schoolAddress || 'Not yet specified'}
              </p>
              <div className="flex items-center gap-2 pt-2 text-xs text-slate-500 border-t border-slate-100">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Primary Governance Owner: {institution?.schoolOwner || profile?.displayName}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'governance' && <UserProvisioningView />}

      {tab === 'sections' && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Active Homeroom Sections</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Classroom rosters linked to live attendance rolls, admissions placement, and parent notification rules.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSectionError(null);
                setSectionModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Homeroom Section
            </button>
          </div>

          {sectionFeedback && (
            <div className="mx-6 mt-4 flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 text-xs text-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span>{sectionFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setSectionFeedback(null)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {classes.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-3">
              <Layers className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">No homeroom sections created yet</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Create your first homeroom section to start enrolling students, assigning teachers, and recording daily attendance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSectionError(null);
                  setSectionModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Homeroom Section
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Section Name</th>
                    <th className="py-3 px-4">Grade</th>
                    <th className="py-3 px-4">Assigned Teacher</th>
                    <th className="py-3 px-4">Room &amp; Slot</th>
                    <th className="py-3 px-4 text-right">Enrolled / Cap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {classes.map((cls) => {
                    const enrolledCount = students.filter((s) => s.classId === cls.id).length;
                    return (
                      <tr key={cls.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#0F4C5C]">
                          {cls.code}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">{cls.name}</td>
                        <td className="py-3.5 px-4 text-slate-600">{cls.gradeLevel}</td>
                        <td className="py-3.5 px-4 text-slate-800">{cls.teacherName}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {cls.room} · {cls.scheduleSlot}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                          {enrolledCount} / {cls.capacity}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {sectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/35 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSection}
            className="w-full max-w-lg bg-white border border-slate-200 rounded-lg p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Add Homeroom Section</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure a classroom section for student rosters and attendance roll calls.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSectionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {sectionError && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5 text-xs text-red-700">
                {sectionError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Section Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder="e.g., Grade 10 — Section A"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Section Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={24}
                  value={sectionCode}
                  onChange={(e) => setSectionCode(e.target.value)}
                  placeholder="e.g., G10-A"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Grade Level
                </label>
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={sectionGrade}
                  onChange={(e) => setSectionGrade(e.target.value)}
                  placeholder="e.g., Grade 10"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Room / Wing
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={sectionRoom}
                  onChange={(e) => setSectionRoom(e.target.value)}
                  placeholder="e.g., Block B · Room 204"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Homeroom Schedule Slot
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={sectionSlot}
                  onChange={(e) => setSectionSlot(e.target.value)}
                  placeholder="Mon–Fri · 08:15–09:05"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Seat Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  required
                  value={sectionCapacity}
                  onChange={(e) => setSectionCapacity(Number(e.target.value) || 32)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Assigned Homeroom Teacher (Optional)
              </label>
              <select
                value={sectionTeacherId}
                onChange={(e) => setSectionTeacherId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
              >
                <option value="">Unassigned (assign teacher later)</option>
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName} · {teacher.department}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSectionModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingSection}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors disabled:opacity-50 cursor-pointer"
              >
                {creatingSection ? 'Creating...' : 'Create Section'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
