import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CheckCheck,
  Lock,
  Search,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import {
  createStudentDirectly,
  fetchStudentPrivateContact,
  markRemainingStudentsPresent,
  recordStudentAttendance,
} from '../lib/schoolActions';
import { getRecentSchoolDates } from '../lib/validation';
import {
  AttendanceRecord,
  AttendanceStatus,
  NotificationChannel,
  Student,
  StudentGuardianPrivate,
} from '../types';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'present', label: 'Present', activeClass: 'bg-green-700 text-white border-green-700' },
  { value: 'tardy', label: 'Tardy', activeClass: 'bg-amber-600 text-white border-amber-600' },
  { value: 'absent', label: 'Absent', activeClass: 'bg-red-600 text-white border-red-600' },
  { value: 'excused', label: 'Excused', activeClass: 'bg-slate-700 text-white border-slate-700' },
];

export function LiveAttendanceView() {
  const { user, profile, classes, students, attendanceRecords, notificationRules, invites } = useSchool();

  const canManageRoster =
    profile?.role === 'super_admin' ||
    profile?.role === 'admin' ||
    user?.email === 'xuwonixweb@gmail.com';

  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => getRecentSchoolDates(1)[0]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Homeroom');
  const [searchQuery, setSearchQuery] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Add Student modal state (for clean-start direct roster enrollment)
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [gradeLevel, setGradeLevel] = useState('Grade 10');
  const [targetClassId, setTargetClassId] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [preferredChannel, setPreferredChannel] = useState<NotificationChannel>('SMS');
  const [emergencyNotes, setEmergencyNotes] = useState('');
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState<string | null>(null);

  // Private guardian contact inspector (Split Collection PII verification)
  const [inspectedStudent, setInspectedStudent] = useState<Student | null>(null);
  const [privateContact, setPrivateContact] = useState<StudentGuardianPrivate | null>(null);
  const [loadingPrivate, setLoadingPrivate] = useState(false);

  const boardViewerUids = useMemo(
    () =>
      invites
        .filter((inv) => inv.role === 'board' && inv.status === 'active' && inv.targetUid)
        .map((inv) => inv.targetUid),
    [invites]
  );

  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      if (selectedClassId !== 'all' && st.classId !== selectedClassId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${st.firstName} ${st.lastName} ${st.studentCode} ${st.guardianName} ${st.className}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [students, selectedClassId, searchQuery]);

  const recordByStudentId = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const rec of attendanceRecords) {
      if (rec.date === selectedDate && rec.period === selectedPeriod) {
        map.set(rec.studentId, rec);
      }
    }
    return map;
  }, [attendanceRecords, selectedDate, selectedPeriod]);

  const summary = useMemo(() => {
    let present = 0;
    let tardy = 0;
    let absent = 0;
    let excused = 0;
    let unmarked = 0;
    for (const st of filteredStudents) {
      const rec = recordByStudentId.get(st.id);
      if (!rec) unmarked += 1;
      else if (rec.status === 'present') present += 1;
      else if (rec.status === 'tardy') tardy += 1;
      else if (rec.status === 'absent') absent += 1;
      else if (rec.status === 'excused') excused += 1;
    }
    return { present, tardy, absent, excused, unmarked };
  }, [filteredStudents, recordByStudentId]);

  const handleSetStatus = async (student: Student, status: AttendanceStatus) => {
    if (!user) return;
    setSavingStudentId(student.id);
    setToast(null);
    const existing = recordByStudentId.get(student.id);
    const note = noteDrafts[student.id] ?? existing?.note ?? '';
    try {
      const res = await recordStudentAttendance({
        uid: user.uid,
        student,
        date: selectedDate,
        period: selectedPeriod,
        status,
        note,
        existingRecord: existing,
        rules: notificationRules,
      });
      if (res.autoNotified) {
        setToast(
          `Saved ${student.firstName} ${student.lastName} as ${status}. Automated alert dispatched via "${res.ruleName}".`
        );
      } else {
        setToast(`Updated ${student.firstName} ${student.lastName} to ${status}.`);
      }
    } finally {
      setSavingStudentId(null);
    }
  };

  const handleMarkRemainingPresent = async () => {
    if (!user) return;
    setMarkingAll(true);
    setToast(null);
    try {
      const count = await markRemainingStudentsPresent({
        uid: user.uid,
        students: filteredStudents,
        existingByStudentId: recordByStudentId,
        date: selectedDate,
        period: selectedPeriod,
      });
      setToast(
        count > 0
          ? `Marked ${count} unmarked student${count === 1 ? '' : 's'} present for ${selectedPeriod}.`
          : 'All students in this view already have an attendance record for this period.'
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const handleInspectStudent = async (student: Student) => {
    setInspectedStudent(student);
    setPrivateContact(null);
    setLoadingPrivate(true);
    try {
      const data = await fetchStudentPrivateContact(student.id);
      setPrivateContact(data);
    } finally {
      setLoadingPrivate(false);
    }
  };

  const handleOpenAddStudent = () => {
    const defaultClass = classes[0];
    setTargetClassId(defaultClass?.id || '');
    setGradeLevel(defaultClass?.gradeLevel || 'Grade 10');
    setFirstName('');
    setLastName('');
    setStudentCode('');
    setGuardianName('');
    setGuardianEmail('');
    setGuardianPhone('');
    setPreferredChannel('SMS');
    setEmergencyNotes('');
    setAddStudentError(null);
    setAddStudentOpen(true);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const targetClass = classes.find((c) => c.id === targetClassId);
    if (!targetClass) {
      setAddStudentError('Create a Homeroom Section under School → Homeroom Sections first.');
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !guardianName.trim()) {
      setAddStudentError('Student first name, last name, and guardian name are required.');
      return;
    }
    setCreatingStudent(true);
    setAddStudentError(null);
    try {
      await createStudentDirectly({
        uid: user.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        studentCode: studentCode.trim() || undefined,
        gradeLevel: gradeLevel.trim() || targetClass.gradeLevel,
        targetClass,
        guardianName: guardianName.trim(),
        guardianEmail: guardianEmail.trim(),
        guardianPhone: guardianPhone.trim(),
        emergencyNotes: emergencyNotes.trim(),
        preferredChannel,
        boardViewerUids,
      });
      setToast(`Enrolled ${firstName.trim()} ${lastName.trim()} into ${targetClass.name}.`);
      setAddStudentOpen(false);
    } catch (err) {
      setAddStudentError(err instanceof Error ? err.message : 'Unable to enroll student.');
    } finally {
      setCreatingStudent(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Control Toolbar */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Interactive Class Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedClassId('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedClassId === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Sections ({students.length})
            </button>
            {classes.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedClassId === cls.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cls.code} · {cls.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canManageRoster && (
              <button
                type="button"
                onClick={handleOpenAddStudent}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Student
              </button>
            )}
            <button
              type="button"
              disabled={markingAll || summary.unmarked === 0}
              onClick={handleMarkRemainingPresent}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              {markingAll
                ? 'Saving Roll Call...'
                : `Mark Remaining Present (${summary.unmarked})`}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter student, code, or guardian..."
                className="pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C] w-64"
              />
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Attendance date"
              className="px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
            />

            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              aria-label="Attendance period"
              className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
            >
              <option value="Homeroom">Homeroom</option>
              <option value="Period 1">Period 1</option>
              <option value="Period 2">Period 2</option>
              <option value="Period 3">Period 3</option>
              <option value="Period 4">Period 4</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600 font-mono tabular-nums">
            <span className="text-green-700 font-medium">{summary.present} Present</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-amber-700 font-medium">{summary.tardy} Tardy</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-red-600 font-medium">{summary.absent} Absent</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>{summary.excused} Excused</span>
          </div>
        </div>
      </section>

      {toast && (
        <div className="flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-[#0F4C5C] shrink-0" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* High-Density Roll Call Grid */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Section &amp; Guardian</th>
                <th className="py-3 px-4">Attendance Status</th>
                <th className="py-3 px-4">Teacher Note</th>
                <th className="py-3 px-4 text-right">Parent Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 px-4 text-center">
                    {students.length === 0 ? (
                      <div className="space-y-2.5 max-w-md mx-auto">
                        <p className="text-sm font-medium text-slate-900">
                          No students enrolled yet
                        </p>
                        <p className="text-xs text-slate-500">
                          {classes.length === 0
                            ? 'First create a Homeroom Section under School → Homeroom Sections, then enroll students directly here or convert applicants from Admissions.'
                            : 'Enroll your first student directly into an active section or convert approved applicants from Admissions.'}
                        </p>
                        {canManageRoster && classes.length > 0 && (
                          <button
                            type="button"
                            onClick={handleOpenAddStudent}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Enroll First Student
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500">
                        No students match the selected class or search filter.
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const rec = recordByStudentId.get(student.id);
                  const noteVal = noteDrafts[student.id] ?? rec?.note ?? '';
                  const isSaving = savingStudentId === student.id;

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleInspectStudent(student)}
                          className="text-left group cursor-pointer"
                        >
                          <p className="font-medium text-slate-900 group-hover:text-[#0F4C5C] transition-colors">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-slate-500 font-mono tabular-nums">
                            {student.studentCode} · {student.gradeLevel} · {student.attendanceRate.toFixed(1)}%
                          </p>
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        <p className="text-slate-800">{student.className}</p>
                        <p className="text-xs text-slate-500">
                          {student.guardianName} · {student.preferredChannel}
                        </p>
                      </td>

                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1">
                          {STATUS_OPTIONS.map((opt) => {
                            const active = rec?.status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleSetStatus(student, opt.value)}
                                className={`px-2.5 py-1.5 text-xs font-medium border rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                                  active
                                    ? opt.activeClass
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      <td className="py-3 px-4 min-w-[200px]">
                        <input
                          type="text"
                          value={noteVal}
                          onChange={(e) =>
                            setNoteDrafts((prev) => ({
                              ...prev,
                              [student.id]: e.target.value,
                            }))
                          }
                          onBlur={() => {
                            if (rec && noteVal !== rec.note) {
                              handleSetStatus(student, rec.status);
                            }
                          }}
                          placeholder="Add roll-call note..."
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-[#0F4C5C]"
                        />
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {rec?.notifiedParent ? (
                          <span className="text-xs font-medium text-[#0F4C5C]">
                            Auto-Alert Sent
                          </span>
                        ) : rec ? (
                          <span className="text-xs text-slate-400">No Alert Required</span>
                        ) : (
                          <span className="text-xs text-slate-400">Unmarked</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Student Profile & Isolated Guardian PII Drawer */}
      {inspectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/35 flex justify-end">
          <div className="w-full max-w-md bg-white h-full border-l border-slate-200 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-mono text-slate-500">
                    {inspectedStudent.studentCode} · {inspectedStudent.gradeLevel}
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
                    {inspectedStudent.firstName} {inspectedStudent.lastName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedStudent(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Homeroom Section</span>
                  <span className="font-medium text-slate-900">{inspectedStudent.className}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Enrolment Status</span>
                  <span className="font-medium text-green-700 capitalize">
                    {inspectedStudent.enrollmentStatus}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Rolling Attendance Rate</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {inspectedStudent.attendanceRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Primary Guardian</span>
                  <span className="font-medium text-slate-900">{inspectedStudent.guardianName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Preferred Alert Channel</span>
                  <span className="font-medium text-slate-900">
                    {inspectedStudent.preferredChannel}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Lock className="w-3.5 h-3.5 text-[#0F4C5C]" />
                  <span>Protected Guardian Contact Record</span>
                </div>
                {loadingPrivate ? (
                  <p className="text-xs text-slate-500">Loading private contact record...</p>
                ) : privateContact ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Email Address</span>
                      <span className="font-mono text-slate-900">
                        {privateContact.guardianEmail}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Mobile / SMS</span>
                      <span className="font-mono text-slate-900">
                        {privateContact.guardianPhone}
                      </span>
                    </div>
                    {privateContact.emergencyNotes && (
                      <div>
                        <span className="text-slate-500 block">Notes</span>
                        <span className="text-slate-800">{privateContact.emergencyNotes}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No private contact record found.</p>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <UserCheck className="w-4 h-4" />
                <span>Synced with Firestore</span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedStudent(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Student Enrollment Modal */}
      {addStudentOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/35 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateStudent}
            className="w-full max-w-xl bg-white border border-slate-200 rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Enroll Student Directly</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adds the student to the attendance roster with guardian contacts isolated in a protected subcollection.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddStudentOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {classes.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 text-xs text-amber-800">
                No homeroom sections exist yet. Please open <strong>School → Homeroom Sections</strong> to create at least one section before enrolling students.
              </div>
            )}

            {addStudentError && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5 text-xs text-red-700">
                {addStudentError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g., Aarav"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g., Bora"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Homeroom Section
                </label>
                <select
                  value={targetClassId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setTargetClassId(nextId);
                    const found = classes.find((c) => c.id === nextId);
                    if (found) setGradeLevel(found.gradeLevel);
                  }}
                  required
                  disabled={classes.length === 0}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C] disabled:bg-slate-50"
                >
                  {classes.length === 0 ? (
                    <option value="">No sections available</option>
                  ) : (
                    classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.code} · {cls.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Grade Level
                </label>
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  placeholder="e.g., Grade 10"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Student ID Code (Optional)
                </label>
                <input
                  type="text"
                  maxLength={32}
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="Auto-generated if blank"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Alert Channel
                </label>
                <select
                  value={preferredChannel}
                  onChange={(e) => setPreferredChannel(e.target.value as NotificationChannel)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                >
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                  <option value="App Push">App Push</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Primary Guardian Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="e.g., Ranjit Bora"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Guardian Phone (Private)
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="+91 98640 12345"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Guardian Email (Private)
                </label>
                <input
                  type="email"
                  required
                  maxLength={160}
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="guardian@example.org"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Emergency / Medical Notes (Optional)
              </label>
              <textarea
                rows={2}
                maxLength={300}
                value={emergencyNotes}
                onChange={(e) => setEmergencyNotes(e.target.value)}
                placeholder="Optional medical, bus route, or pickup notes..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAddStudentOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingStudent || classes.length === 0 || !targetClassId}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors disabled:opacity-50 cursor-pointer"
              >
                {creatingStudent ? 'Enrolling...' : 'Enroll Student'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
