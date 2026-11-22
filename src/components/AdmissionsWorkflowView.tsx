import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  Plus,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import {
  completeAtomicEnrolment,
  createAdmissionApplication,
  fetchAdmissionPrivateContact,
  updateAdmissionProgress,
} from '../lib/schoolActions';
import {
  AdmissionApplication,
  AdmissionPrivateContact,
  AdmissionStage,
} from '../types';

const STAGES: { key: AdmissionStage; label: string }[] = [
  { key: 'inquiry', label: 'Inquiry' },
  { key: 'tour_scheduled', label: 'Tour Scheduled' },
  { key: 'documents_review', label: 'Docs Review' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'declined', label: 'Declined' },
];

const NEXT_STAGE_MAP: Partial<Record<AdmissionStage, Exclude<AdmissionStage, 'enrolled'>>> = {
  inquiry: 'tour_scheduled',
  tour_scheduled: 'documents_review',
  documents_review: 'accepted',
};

function stageColor(stage: AdmissionStage): string {
  if (stage === 'enrolled') return 'text-green-700';
  if (stage === 'accepted') return 'text-[#0F4C5C]';
  if (stage === 'declined') return 'text-red-600';
  return 'text-amber-700';
}

function stageLabel(stage: AdmissionStage): string {
  return STAGES.find((s) => s.key === stage)?.label || stage;
}

interface AdmissionsWorkflowViewProps {
  selectedYear?: number | 'all';
}

export function AdmissionsWorkflowView({ selectedYear = 'all' }: AdmissionsWorkflowViewProps) {
  const { user, classes, admissions, invites } = useSchool();
  const currentYear = new Date().getFullYear();

  const [stageFilter, setStageFilter] = useState<'all' | AdmissionStage>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [privateContact, setPrivateContact] = useState<AdmissionPrivateContact | null>(null);
  const [loadingPrivate, setLoadingPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Application Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [applicantName, setApplicantName] = useState('');
  const [gradeApplying, setGradeApplying] = useState('Grade 10');
  const [admissionYear, setAdmissionYear] = useState<number>(
    typeof selectedYear === 'number' ? selectedYear : currentYear
  );
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [previousSchool, setPreviousSchool] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [notes, setNotes] = useState('');

  const yearScopedAdmissions = useMemo(() => {
    if (selectedYear === 'all') return admissions;
    return admissions.filter((a) => (a.admissionYear || currentYear) === selectedYear);
  }, [admissions, selectedYear, currentYear]);

  const filteredAdmissions = useMemo(() => {
    return yearScopedAdmissions.filter((a) => {
      if (stageFilter !== 'all' && a.stage !== stageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${a.applicantName} ${a.guardianName} ${a.previousSchool} ${a.gradeApplying}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [yearScopedAdmissions, stageFilter, searchQuery]);

  const selectedApp: AdmissionApplication | null = useMemo(() => {
    if (selectedId) {
      return (
        yearScopedAdmissions.find((a) => a.id === selectedId) || filteredAdmissions[0] || null
      );
    }
    return filteredAdmissions[0] || null;
  }, [yearScopedAdmissions, filteredAdmissions, selectedId]);

  useEffect(() => {
    let active = true;
    if (!selectedApp) {
      setPrivateContact(null);
      return;
    }
    setLoadingPrivate(true);
    fetchAdmissionPrivateContact(selectedApp.id)
      .then((res) => {
        if (active) setPrivateContact(res);
      })
      .finally(() => {
        if (active) setLoadingPrivate(false);
      });
    return () => {
      active = false;
    };
  }, [selectedApp?.id]);

  const stageCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of STAGES) map[s.key] = 0;
    for (const a of yearScopedAdmissions) map[a.stage] = (map[a.stage] || 0) + 1;
    return map;
  }, [yearScopedAdmissions]);

  const handleOpenNewModal = () => {
    setApplicantName('');
    setAdmissionYear(typeof selectedYear === 'number' ? selectedYear : currentYear);
    setGuardianName('');
    setGuardianEmail('');
    setGuardianPhone('');
    setPreviousSchool('');
    setTargetClassId(classes[0]?.id || '');
    setInterviewDate('');
    setNotes('');
    setModalOpen(true);
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !targetClassId) return;
    setBusy(true);
    try {
      await createAdmissionApplication({
        uid: user.uid,
        applicantName,
        gradeApplying,
        admissionYear,
        guardianName,
        guardianEmail,
        guardianPhone,
        previousSchool,
        targetClassId,
        interviewDate,
        notes,
      });
      setModalOpen(false);
      setFeedback(`Added ${admissionYear} admission inquiry for ${applicantName}.`);
    } finally {
      setBusy(false);
    }
  };

  const handleAdvanceStage = async (app: AdmissionApplication, nextStage: Exclude<AdmissionStage, 'enrolled'>) => {
    setBusy(true);
    setFeedback(null);
    try {
      await updateAdmissionProgress(app.id, { stage: nextStage });
      setFeedback(`Moved ${app.applicantName} to ${stageLabel(nextStage)}.`);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleChecklist = async (
    app: AdmissionApplication,
    field: 'documentsVerified' | 'tuitionDepositPaid'
  ) => {
    setBusy(true);
    try {
      await updateAdmissionProgress(app.id, { [field]: !app[field] });
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteEnrolment = async (app: AdmissionApplication) => {
    if (!user) return;
    const targetClass = classes.find((c) => c.id === app.targetClassId) || classes[0];
    if (!targetClass) return;
    setBusy(true);
    setFeedback(null);
    try {
      const activeBoardUids = invites
        .filter((inv) => inv.role === 'board' && inv.status === 'active')
        .map((inv) => inv.targetUid);
      await completeAtomicEnrolment({
        uid: user.uid,
        application: app,
        targetClass,
        privateContact,
        boardViewerUids: activeBoardUids,
      });
      setFeedback(
        `${app.applicantName} is now enrolled in ${targetClass.name}. Live attendance roster and welcome notice updated atomically.`
      );
    } finally {
      setBusy(false);
    }
  };

  const targetClassForSelected = selectedApp
    ? classes.find((c) => c.id === selectedApp.targetClassId)
    : undefined;

  return (
    <div className="space-y-5">
      {/* Intake Year Context Header */}
      <section className="bg-white border border-slate-200 rounded-lg px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {selectedYear === 'all'
              ? 'All Admission Cycles'
              : selectedYear === currentYear
              ? `Current Year Admissions (${selectedYear})`
              : `Admission Archive · ${selectedYear} Intake`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Showing {yearScopedAdmissions.length} application{yearScopedAdmissions.length === 1 ? '' : 's'} for{' '}
            {selectedYear === 'all' ? 'all academic years' : `academic intake ${selectedYear}`}
          </p>
        </div>
        <span className="text-xs font-mono text-[#0F4C5C] font-semibold tabular-nums">
          Cycle: {selectedYear === 'all' ? 'ALL' : selectedYear}
        </span>
      </section>

      {/* Stage Funnel Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        {STAGES.map((st) => (
          <button
            key={st.key}
            type="button"
            onClick={() => setStageFilter(stageFilter === st.key ? 'all' : st.key)}
            className={`p-4 text-left transition-colors cursor-pointer ${
              stageFilter === st.key ? 'bg-slate-50' : 'hover:bg-slate-50/60'
            }`}
          >
            <p className="text-xs font-medium text-slate-500">{st.label}</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
              {stageCounts[st.key] || 0}
            </p>
          </button>
        ))}
      </section>

      {feedback && (
        <div className="flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Split Pipeline List & Application Review Inspector */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search applicant or school..."
                className="pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C] w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              {stageFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setStageFilter('all')}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Clear Filter
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenNewModal}
                disabled={classes.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                New Application
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredAdmissions.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No admission applications match the current view.
              </div>
            ) : (
              filteredAdmissions.map((app) => {
                const isSelected = selectedApp?.id === app.id;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setSelectedId(app.id)}
                    className={`w-full text-left px-5 py-4 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                      isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {app.applicantName}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {app.gradeApplying} · {app.previousSchool} · Guardian: {app.guardianName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-semibold ${stageColor(app.stage)}`}>
                        {stageLabel(app.stage)}
                      </p>
                      <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                        {app.documentsVerified ? 'Docs OK' : 'Docs Pending'} ·{' '}
                        {app.tuitionDepositPaid ? 'Deposit Paid' : 'No Deposit'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Application Inspector */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          {!selectedApp ? (
            <p className="text-sm text-slate-500 text-center py-10">
              Select an application to review enrolment readiness.
            </p>
          ) : (
            <>
              <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">
                    {selectedApp.admissionYear || currentYear} Intake · {selectedApp.gradeApplying} ·{' '}
                    {selectedApp.previousSchool}
                  </p>
                  <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                    {selectedApp.applicantName}
                  </h2>
                </div>
                <span className={`text-xs font-semibold ${stageColor(selectedApp.stage)}`}>
                  {stageLabel(selectedApp.stage)}
                </span>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Guardian</span>
                  <span className="font-medium text-slate-900">{selectedApp.guardianName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Target Homeroom</span>
                  <span className="font-medium text-slate-900">
                    {targetClassForSelected
                      ? `${targetClassForSelected.code} · ${targetClassForSelected.name}`
                      : 'Unassigned'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Tour / Interview</span>
                  <span className="font-mono text-xs text-slate-700">
                    {selectedApp.interviewDate || 'Not scheduled'}
                  </span>
                </div>
              </div>

              {/* Isolated Private Family Contact */}
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Lock className="w-3.5 h-3.5 text-[#0F4C5C]" />
                  <span>Protected Family Contact</span>
                </div>
                {loadingPrivate ? (
                  <p className="text-xs text-slate-500">Loading...</p>
                ) : privateContact ? (
                  <p className="text-xs font-mono text-slate-700">
                    {privateContact.guardianEmail} · {privateContact.guardianPhone}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">No private contact record.</p>
                )}
              </div>

              {/* Interactive Verification Checklists */}
              <div className="space-y-2.5 pt-1">
                <p className="text-xs font-semibold text-slate-700">Enrolment Readiness Checklist</p>
                <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedApp.documentsVerified}
                    disabled={busy || selectedApp.stage === 'enrolled' || selectedApp.stage === 'declined'}
                    onChange={() => handleToggleChecklist(selectedApp, 'documentsVerified')}
                    className="rounded border-slate-300 text-[#0F4C5C] focus:ring-[#0F4C5C]"
                  />
                  <span>Transcripts &amp; immunization documents verified</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedApp.tuitionDepositPaid}
                    disabled={busy || selectedApp.stage === 'enrolled' || selectedApp.stage === 'declined'}
                    onChange={() => handleToggleChecklist(selectedApp, 'tuitionDepositPaid')}
                    className="rounded border-slate-300 text-[#0F4C5C] focus:ring-[#0F4C5C]"
                  />
                  <span>Enrolment agreement &amp; deposit confirmed</span>
                </label>
              </div>

              {selectedApp.notes && (
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-md p-3 leading-relaxed">
                  {selectedApp.notes}
                </div>
              )}

              {/* Workflow Actions */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                {selectedApp.stage === 'enrolled' ? (
                  <p className="text-xs font-medium text-green-700">
                    Enrolled into live class roster (Student ID:{' '}
                    <span className="font-mono">{selectedApp.enrolledStudentId}</span>). Record locked.
                  </p>
                ) : selectedApp.stage === 'declined' ? (
                  <p className="text-xs font-medium text-slate-500">
                    Application closed as declined.
                  </p>
                ) : (
                  <>
                    {NEXT_STAGE_MAP[selectedApp.stage] && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleAdvanceStage(selectedApp, NEXT_STAGE_MAP[selectedApp.stage]!)
                        }
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        Advance to {stageLabel(NEXT_STAGE_MAP[selectedApp.stage]!)}
                      </button>
                    )}

                    {selectedApp.stage === 'accepted' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleCompleteEnrolment(selectedApp)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        <UserPlus className="w-4 h-4" />
                        {busy ? 'Enrolling...' : 'Complete Atomic Enrolment'}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAdvanceStage(selectedApp, 'declined')}
                      className="px-3.5 py-2 text-xs font-medium text-red-700 border border-red-200 hover:bg-red-50 rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* New Application Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateApplication}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">New Admission Application</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Applicant Full Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="e.g., Priya Sharma"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Grade Applying
                </label>
                <select
                  value={gradeApplying}
                  onChange={(e) => setGradeApplying(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  <option value="Grade 9">Grade 9</option>
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Admission Year
                </label>
                <input
                  type="number"
                  required
                  min={2020}
                  max={2035}
                  value={admissionYear}
                  onChange={(e) => setAdmissionYear(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Guardian Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="e.g., Vikram Sharma"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Previous School
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={previousSchool}
                  onChange={(e) => setPreviousSchool(e.target.value)}
                  placeholder="e.g., Lincoln Prep"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>

              <div>
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
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
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
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Class Section
                </label>
                {classes.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800">
                    Create at least one Homeroom Section under <strong>School → Homeroom Sections</strong> before adding applications.
                  </div>
                ) : (
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.code} · {cls.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tour / Interview Date
                </label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Admissions Notes
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Academic interests, accommodations, or tour notes..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
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
                disabled={busy || classes.length === 0 || !targetClassId}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Saving...' : 'Create Application'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
