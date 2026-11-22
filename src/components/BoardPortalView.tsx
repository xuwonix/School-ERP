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
  ChevronDown,
  ChevronRight,
  Download,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { BoardView, StaffMember } from '../types';
import { FinancialAnalyticsView } from './FinancialAnalyticsView';

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  const guarded = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function TeacherAvatar({ member }: { member: StaffMember }) {
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
        className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
      {initials || 'TR'}
    </div>
  );
}

/* ============================================================================
   BOARD SUB-VIEW 2: STUDENTS INFORMATION
   ============================================================================ */
function BoardStudentsInformation() {
  const { students, classes } = useSchool();
  const [gradeFilter, setGradeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'probation' | 'transferred' | 'graduated'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const grades = useMemo(() => {
    const set = new Set<string>(students.map((s) => s.gradeLevel));
    return ['All', ...Array.from(set).sort()];
  }, [students]);

  const metrics = useMemo(() => {
    const total = students.length;
    const activeCount = students.filter((s) => s.enrollmentStatus === 'active').length;
    const probationCount = students.filter((s) => s.enrollmentStatus === 'probation').length;
    const avgAttendance =
      total > 0
        ? students.reduce((acc, s) => acc + s.attendanceRate, 0) / total
        : 0;
    const totalCapacity = classes.reduce((acc, c) => acc + c.capacity, 0);
    const utilization = totalCapacity > 0 ? Math.min(100, (total / totalCapacity) * 100) : 0;
    return {
      total,
      activeCount,
      probationCount,
      avgAttendance,
      totalCapacity,
      utilization,
    };
  }, [students, classes]);

  const gradeChartData = useMemo(() => {
    const map = new Map<string, { grade: string; count: number; totalRate: number }>();
    for (const s of students) {
      const curr = map.get(s.gradeLevel) || { grade: s.gradeLevel, count: 0, totalRate: 0 };
      curr.count += 1;
      curr.totalRate += s.attendanceRate;
      map.set(s.gradeLevel, curr);
    }
    return Array.from(map.values())
      .sort((a, b) => a.grade.localeCompare(b.grade))
      .map((item) => ({
        grade: item.grade,
        'Avg Attendance %': Number((item.totalRate / item.count).toFixed(1)),
        Students: item.count,
      }));
  }, [students]);

  const sectionOccupancy = useMemo(() => {
    return classes.map((cls) => {
      const enrolled = students.filter((s) => s.classId === cls.id).length;
      const pct = cls.capacity > 0 ? Math.min(100, Math.round((enrolled / cls.capacity) * 100)) : 0;
      return { cls, enrolled, pct };
    });
  }, [classes, students]);

  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      if (gradeFilter !== 'All' && st.gradeLevel !== gradeFilter) return false;
      if (statusFilter !== 'all' && st.enrollmentStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay =
          `${st.firstName} ${st.lastName} ${st.studentCode} ${st.className} ${st.gradeLevel} ${st.guardianName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [students, gradeFilter, statusFilter, searchQuery]);

  const handleExportCsv = () => {
    const header = [
      'Student Code',
      'Full Name',
      'Grade Level',
      'Homeroom Section',
      'Primary Guardian',
      'Preferred Alert Channel',
      'Attendance Rate (%)',
      'Enrollment Status',
    ];
    const rows = filteredStudents.map((st) => [
      escapeCsvCell(st.studentCode),
      escapeCsvCell(`${st.firstName} ${st.lastName}`),
      escapeCsvCell(st.gradeLevel),
      escapeCsvCell(st.className),
      escapeCsvCell(st.guardianName),
      escapeCsvCell(st.preferredChannel),
      st.attendanceRate.toFixed(1),
      escapeCsvCell(st.enrollmentStatus),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'classytics-students-information.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Total Enrolled Students</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {metrics.total}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {metrics.activeCount} active across {classes.length} sections
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Average Attendance Rate</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {metrics.avgAttendance.toFixed(1)}%
          </p>
          <p className="text-xs text-green-700 font-medium">Real-time academic term mean</p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Academic Standing</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {metrics.probationCount === 0 ? 'All Clear' : `${metrics.probationCount} Watchlist`}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {metrics.activeCount} good standing · {metrics.probationCount} probation
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Section Seat Utilization</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {metrics.utilization.toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            {metrics.total} / {metrics.totalCapacity} campus seats filled
          </p>
        </div>
      </section>

      {/* Grade Attendance Chart + Section Capacity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Grade-Level Attendance Overview
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mean attendance rate (%) grouped by enrolled grade
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {gradeChartData.length} grades
            </span>
          </div>

          <div className="h-60 w-full">
            {gradeChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No student records available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={gradeChartData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="grade"
                    tick={{ fill: '#334155', fontSize: 12 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[60, 100]}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, name) =>
                      String(name ?? '').includes('%') ? `${Number(value ?? 0)}%` : Number(value ?? 0)
                    }
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="Avg Attendance %"
                    fill="#0F4C5C"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Homeroom Section Capacity</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enrolled roster count vs. classroom capacity
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">{classes.length} sections</span>
          </div>

          <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
            {sectionOccupancy.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No homeroom sections found.</p>
            ) : (
              sectionOccupancy.map(({ cls, enrolled, pct }) => (
                <div key={cls.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800 truncate">
                      {cls.code} · {cls.name}
                      <span className="text-slate-400 font-normal"> · {cls.teacherName}</span>
                    </span>
                    <span className="font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {enrolled} / {cls.capacity}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0F4C5C] rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Student Information Directory */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, code, guardian..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C] w-56"
              />
            </div>

            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              aria-label="Filter students by grade"
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
            >
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g === 'All' ? 'All Grades' : g}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as 'all' | 'active' | 'probation' | 'transferred' | 'graduated'
                )
              }
              aria-label="Filter students by standing"
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
            >
              <option value="all">All Standings</option>
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="transferred">Transferred</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start lg:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV
          </button>
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
                <th className="py-3 px-4 text-right">Attendance</th>
                <th className="py-3 px-4 text-right">Standing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    No students match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#0F4C5C] whitespace-nowrap">
                      {st.studentCode}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {st.firstName} {st.lastName}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-slate-800">{st.gradeLevel}</p>
                      <p className="text-xs text-slate-500">{st.className}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {st.guardianName}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {st.preferredChannel}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {st.attendanceRate.toFixed(1)}%
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold capitalize ${
                          st.enrollmentStatus === 'active'
                            ? 'text-green-700'
                            : st.enrollmentStatus === 'probation'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {st.enrollmentStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ============================================================================
   BOARD SUB-VIEW 3: TEACHERS INFORMATION
   ============================================================================ */
function BoardTeachersInformation() {
  const { staff, departments } = useSchool();
  const [scope, setScope] = useState<'teachers' | 'all'>('teachers');
  const [deptFilter, setDeptFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const teachersOnly = useMemo(
    () => staff.filter((s) => (s.staffCategory || 'teacher') === 'teacher'),
    [staff]
  );

  const scopedStaff = scope === 'teachers' ? teachersOnly : staff;

  const deptOptions = useMemo(() => {
    const set = new Set<string>(scopedStaff.map((s) => s.department));
    return ['All', ...Array.from(set).sort()];
  }, [scopedStaff]);

  const metrics = useMemo(() => {
    const total = scopedStaff.length;
    const active = scopedStaff.filter((s) => s.status === 'active').length;
    const onLeave = scopedStaff.filter((s) => s.status === 'on_leave').length;
    const avgRollRate =
      total > 0
        ? scopedStaff.reduce((acc, s) => acc + s.attendanceSubmissionRate, 0) / total
        : 0;
    const avgObservation =
      total > 0 ? scopedStaff.reduce((acc, s) => acc + s.observationScore, 0) / total : 0;
    const avgResponseMin =
      total > 0 ? scopedStaff.reduce((acc, s) => acc + s.parentResponseMinutes, 0) / total : 0;
    return { total, active, onLeave, avgRollRate, avgObservation, avgResponseMin };
  }, [scopedStaff]);

  const benchmarkChartData = useMemo(() => {
    return scopedStaff.map((s) => ({
      name: s.fullName.split(' ').slice(-1)[0],
      'Roll Submission %': s.attendanceSubmissionRate,
      'Observation Score': s.observationScore,
    }));
  }, [scopedStaff]);

  const departmentSummary = useMemo(() => {
    return departments
      .map((dept) => {
        const members = scopedStaff.filter(
          (s) => s.department.trim().toLowerCase() === dept.name.trim().toLowerCase()
        );
        const avgObs =
          members.length > 0
            ? Math.round(members.reduce((a, m) => a + m.observationScore, 0) / members.length)
            : null;
        return { dept, count: members.length, avgObs };
      })
      .filter((d) => d.count > 0 || d.dept.category === 'Academic');
  }, [departments, scopedStaff]);

  const filteredTeachers = useMemo(() => {
    return scopedStaff.filter((member) => {
      if (deptFilter !== 'All' && member.department !== deptFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay =
          `${member.fullName} ${member.roleTitle} ${member.department} ${member.employmentType}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scopedStaff, deptFilter, searchQuery]);

  const handleExportCsv = () => {
    const header = [
      'Full Name',
      'Role Title',
      'Department',
      'Contract Type',
      'Assigned Hours',
      'Target Hours',
      'Roll Submission %',
      'Parent Response SLA (min)',
      'Observation Score',
      'Status',
    ];
    const rows = filteredTeachers.map((m) => [
      escapeCsvCell(m.fullName),
      escapeCsvCell(m.roleTitle),
      escapeCsvCell(m.department),
      escapeCsvCell(m.employmentType),
      m.assignedHours,
      m.weeklyHoursTarget,
      m.attendanceSubmissionRate.toFixed(1),
      m.parentResponseMinutes,
      m.observationScore,
      escapeCsvCell(m.status),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'classytics-teachers-information.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">
            {scope === 'teachers' ? 'Teaching Faculty' : 'All Campus Personnel'}
          </p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {metrics.total}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {metrics.active} active · {metrics.onLeave} on leave
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Avg Roll Submission</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {metrics.avgRollRate.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500">On-time classroom attendance rolls</p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Avg Observation Score</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {metrics.avgObservation.toFixed(1)} <span className="text-sm text-slate-400">/100</span>
          </p>
          <p className="text-xs text-green-700 font-medium">Academic quality benchmark</p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Avg Parent Response SLA</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {Math.round(metrics.avgResponseMin)} min
          </p>
          <p className="text-xs text-slate-500">Mean guardian reply turnaround</p>
        </div>
      </section>

      {/* Benchmarks Chart + Academic Departments Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Faculty Performance &amp; Observation Benchmarks
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Attendance submission compliance (%) vs. classroom observation score (/100)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="text-[#0F4C5C] font-medium">Roll Submission %</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-500 font-medium">Observation Score</span>
            </div>
          </div>

          <div className="h-60 w-full">
            {benchmarkChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No teacher performance records available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={benchmarkChartData}
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
                    dataKey="Roll Submission %"
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
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Department Leadership</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Faculty distribution and average observation score
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {departmentSummary.length} divisions
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
            {departmentSummary.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No departments loaded.</p>
            ) : (
              departmentSummary.map(({ dept, count, avgObs }) => (
                <div
                  key={dept.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{dept.name}</p>
                    <p className="text-slate-500 truncate">Chair: {dept.headName}</p>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <p className="text-slate-900 font-semibold">{count} staff</p>
                    <p className="text-slate-400">
                      {avgObs !== null ? `Obs ${avgObs}/100` : 'No score'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Teachers Directory Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              <button
                type="button"
                onClick={() => {
                  setScope('teachers');
                  setDeptFilter('All');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                  scope === 'teachers'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Teachers Only ({teachersOnly.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope('all');
                  setDeptFilter('All');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                  scope === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Faculty &amp; Leadership ({staff.length})
              </button>
            </div>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              aria-label="Filter teachers by department"
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
            >
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d === 'All' ? 'All Departments' : d}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teacher or role..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C] w-52"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start lg:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">Teacher</th>
                <th className="py-3 px-4">Department &amp; Contract</th>
                <th className="py-3 px-4">Weekly Load</th>
                <th className="py-3 px-4 text-right">Roll Submission</th>
                <th className="py-3 px-4 text-right">Parent SLA</th>
                <th className="py-3 px-4 text-right">Observation</th>
                <th className="py-3 px-4 text-right">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    No teachers match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((member) => {
                  const loadPct =
                    member.weeklyHoursTarget > 0
                      ? Math.min(
                          100,
                          Math.round((member.assignedHours / member.weeklyHoursTarget) * 100)
                        )
                      : 0;
                  return (
                    <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <TeacherAvatar member={member} />
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
                      <td className="py-3.5 px-4 min-w-[140px]">
                        <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-700 mb-1">
                          <span>
                            {member.assignedHours}h / {member.weeklyHoursTarget}h
                          </span>
                          <span>{loadPct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0F4C5C] rounded-full"
                            style={{ width: `${loadPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                        {member.attendanceSubmissionRate.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {member.parentResponseMinutes} min
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                        {member.observationScore} / 100
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ============================================================================
   MAIN BOARD PORTAL SHELL
   Sidebar: Dashboard -> Financial Analytics, Students Information, Teachers Information
   ============================================================================ */
export function BoardPortalView() {
  const { profile, institution, dataLoading, students, staff, signOutUser } = useSchool();
  const [boardView, setBoardView] = useState<BoardView>('financial');
  const [dashboardGroupOpen, setDashboardGroupOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const schoolDisplayName = institution?.schoolName || profile?.schoolName || 'Classytics';
  const teacherCount = useMemo(
    () => staff.filter((s) => (s.staffCategory || 'teacher') === 'teacher').length,
    [staff]
  );

  const activeSectionTitle =
    boardView === 'financial'
      ? 'Financial Analytics'
      : boardView === 'students'
      ? 'Students Information'
      : 'Teachers Information';

  const renderBoardNav = (onAfterSelect?: () => void) => (
    <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto" aria-label="Board Navigation">
      <div>
        <button
          type="button"
          onClick={() => setDashboardGroupOpen((prev) => !prev)}
          aria-expanded={dashboardGroupOpen}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-md text-[#0F4C5C] bg-slate-50 cursor-pointer"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span className="truncate">Dashboard</span>
          </span>
          {dashboardGroupOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {dashboardGroupOpen && (
          <div className="mt-1 ml-4 pl-3 border-l border-slate-200 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setBoardView('financial');
                onAfterSelect?.();
              }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                boardView === 'financial'
                  ? 'bg-[#0F4C5C]/10 text-[#0F4C5C] font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <IndianRupee className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Financial Analytics</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBoardView('students');
                onAfterSelect?.();
              }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                boardView === 'students'
                  ? 'bg-[#0F4C5C]/10 text-[#0F4C5C] font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Students Information</span>
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {students.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBoardView('teachers');
                onAfterSelect?.();
              }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                boardView === 'teachers'
                  ? 'bg-[#0F4C5C]/10 text-[#0F4C5C] font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Teachers Information</span>
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {teacherCount}
              </span>
            </button>
          </div>
        )}
      </div>
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
          <p className="text-[11px] font-medium text-[#0F4C5C] mt-1">Board &amp; Governance Portal</p>
        </div>

        {renderBoardNav()}

        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {profile?.displayName || 'Board Member'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">Board / Stakeholder</p>
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

      {/* Mobile Drawer */}
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

            {renderBoardNav(() => setMobileMenuOpen(false))}

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

      {/* Main Executive Workspace */}
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
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="text-slate-400 hidden md:inline whitespace-nowrap">Dashboard</span>
              <span className="text-slate-300 hidden md:inline" aria-hidden="true">
                /
              </span>
              <h1 className="text-base font-semibold text-slate-900 truncate">
                {activeSectionTitle}
              </h1>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-500 hidden sm:block whitespace-nowrap">
            FY 2025-26 · Governance Oversight
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          {/* Welcome Executive Summary Bar */}
          <section className="bg-white border border-slate-200 rounded-lg px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Welcome, {profile?.displayName || 'Board Member'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {schoolDisplayName}
                {institution?.schoolAddress ? ` · ${institution.schoolAddress}` : ''}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBoardView('financial')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                  boardView === 'financial'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Financial Analytics
              </button>
              <button
                type="button"
                onClick={() => setBoardView('students')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                  boardView === 'students'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Students Info
              </button>
              <button
                type="button"
                onClick={() => setBoardView('teachers')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                  boardView === 'teachers'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Teachers Info
              </button>
            </div>
          </section>

          {dataLoading ? (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-600">
                Loading board analytics and institutional rosters...
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
              {boardView === 'financial' && <FinancialAnalyticsView canManage={false} />}
              {boardView === 'students' && <BoardStudentsInformation />}
              {boardView === 'teachers' && <BoardTeachersInformation />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
