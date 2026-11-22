import { BookOpen, LogOut, ShieldCheck } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

export function StudentPortalView() {
  const { profile, students, signOutUser } = useSchool();
  const studentRecord = students[0] || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-base font-bold text-slate-900 font-display">Classytics</span>
          <span className="text-slate-300" aria-hidden="true">/</span>
          <span className="text-slate-600">Student Portal</span>
        </div>

        <button
          type="button"
          onClick={signOutUser}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-6">
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-2">
          <p className="text-xs font-medium text-[#0F4C5C]">
            {profile?.schoolName || 'Classytics'} · Invite-Only Student Account
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {profile?.displayName || 'Student'}
          </h1>
          <p className="text-sm text-slate-600">
            View your homeroom assignment, attendance standing, and guardian alert channel settings.
          </p>
        </section>

        {studentRecord ? (
          <section className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            <div className="p-5 space-y-1">
              <p className="text-xs text-slate-500">Rolling Attendance</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {studentRecord.attendanceRate.toFixed(1)}%
              </p>
              <p className="text-xs text-green-700 capitalize">
                Status: {studentRecord.enrollmentStatus}
              </p>
            </div>
            <div className="p-5 space-y-1">
              <p className="text-xs text-slate-500">Homeroom Section</p>
              <p className="text-base font-semibold text-slate-900">{studentRecord.className}</p>
              <p className="text-xs font-mono text-slate-500">
                {studentRecord.studentCode} · {studentRecord.gradeLevel}
              </p>
            </div>
            <div className="p-5 space-y-1">
              <p className="text-xs text-slate-500">Guardian Contact Preference</p>
              <p className="text-base font-semibold text-slate-900">{studentRecord.guardianName}</p>
              <p className="text-xs text-slate-500">
                Preferred Channel: {studentRecord.preferredChannel}
              </p>
            </div>
          </section>
        ) : (
          <section className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-2">
            <BookOpen className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-900">No Homeroom Roster Linked Yet</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your Super Admin has provisioned your student login. Once your profile is linked to a
              homeroom section, your live attendance metrics will appear here.
            </p>
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-lg p-5 flex items-center gap-3 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-[#0F4C5C] shrink-0" />
          <span>
            Scoped strictly to your student record. Contact your homeroom advisor or school office
            for attendance corrections.
          </span>
        </section>
      </main>
    </div>
  );
}
