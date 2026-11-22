import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, BarChart3, Download } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { getRecentSchoolDates } from '../lib/validation';
import { ActiveView } from '../types';

interface CampusAnalyticsViewProps {
  onNavigate: (view: ActiveView) => void;
}

type TimeRangeKey = '5d' | '14d' | 'all';

function escapeCsvCell(value: string | number): string {
  const raw = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function CampusAnalyticsView({ onNavigate }: CampusAnalyticsViewProps) {
  const {
    departments,
    classes,
    students,
    attendanceRecords,
    notifications,
    admissions,
    staff,
  } = useSchool();

  const [timeRange, setTimeRange] = useState<TimeRangeKey>('5d');
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  const gradeLevels = useMemo(() => {
    const set = new Set<string>();
    classes.forEach((c) => {
      if (c.gradeLevel) set.add(c.gradeLevel);
    });
    students.forEach((s) => {
      if (s.gradeLevel) set.add(s.gradeLevel);
    });
    return Array.from(set).sort();
  }, [classes, students]);

  const scopedClasses = useMemo(() => {
    if (gradeFilter === 'all') return classes;
    return classes.filter((c) => c.gradeLevel === gradeFilter);
  }, [classes, gradeFilter]);

  const scopedClassIds = useMemo(
    () => new Set(scopedClasses.map((c) => c.id)),
    [scopedClasses]
  );

  const scopedStudents = useMemo(() => {
    if (gradeFilter === 'all') return students;
    return students.filter((s) => s.gradeLevel === gradeFilter || scopedClassIds.has(s.classId));
  }, [students, gradeFilter, scopedClassIds]);

  const targetDates = useMemo(() => {
    if (timeRange === '5d') return getRecentSchoolDates(5);
    if (timeRange === '14d') return getRecentSchoolDates(14);
    const recorded = [...new Set(attendanceRecords.map((r) => r.date))].sort();
    return recorded.length > 0 ? recorded : getRecentSchoolDates(5);
  }, [timeRange, attendanceRecords]);

  const targetDateSet = useMemo(() => new Set(targetDates), [targetDates]);

  const scopedAttendance = useMemo(() => {
    return attendanceRecords.filter((rec) => {
      if (gradeFilter !== 'all' && !scopedClassIds.has(rec.classId)) return false;
      if (timeRange !== 'all' && !targetDateSet.has(rec.date)) return false;
      return true;
    });
  }, [attendanceRecords, gradeFilter, scopedClassIds, timeRange, targetDateSet]);

  // 1. Top Analytical KPIs (Strictly derived from live Firestore data, never hardcoded 100%)
  const analyticalKpis = useMemo(() => {
    const totalLogs = scopedAttendance.length;
    const attendedLogs = scopedAttendance.filter(
      (r) => r.status === 'present' || r.status === 'tardy'
    ).length;
    const absentLogs = scopedAttendance.filter((r) => r.status === 'absent').length;
    const windowRate =
      totalLogs > 0 ? Math.round((attendedLogs / totalLogs) * 1000) / 10 : null;

    // Calculate per-student real attendance rate from recorded logs (falling back to student.attendanceRate only if no logs)
    const studentMetrics = scopedStudents.map((st) => {
      const logs = scopedAttendance.filter((r) => r.studentId === st.id);
      if (logs.length > 0) {
        const attended = logs.filter((r) => r.status === 'present' || r.status === 'tardy').length;
        return {
          student: st,
          rate: Math.round((attended / logs.length) * 1000) / 10,
          absences: logs.filter((r) => r.status === 'absent').length,
          tardies: logs.filter((r) => r.status === 'tardy').length,
          loggedDays: logs.length,
        };
      }
      return {
        student: st,
        rate: st.attendanceRate,
        absences: 0,
        tardies: 0,
        loggedDays: 0,
      };
    });

    const belowTargetStudents = studentMetrics.filter((m) => m.loggedDays > 0 && m.rate < 90);
    const ackCount = notifications.filter((n) => n.deliveryStatus === 'acknowledged').length;
    const ackRate =
      notifications.length > 0 ? Math.round((ackCount / notifications.length) * 100) : null;

    const enrolledApps = admissions.filter((a) => a.stage === 'enrolled').length;
    const conversionRate =
      admissions.length > 0 ? Math.round((enrolledApps / admissions.length) * 100) : null;

    return {
      totalLogs,
      absentLogs,
      windowRate,
      studentMetrics: studentMetrics.sort((a, b) => a.rate - b.rate),
      belowTargetCount: belowTargetStudents.length,
      ackCount,
      ackRate,
      enrolledApps,
      conversionRate,
    };
  }, [scopedAttendance, scopedStudents, notifications, admissions]);

  // 2. Daily Attendance Trend Series
  const trendSeries = useMemo(() => {
    return targetDates.map((date) => {
      const dayRecs = scopedAttendance.filter((r) => r.date === date);
      return {
        dateLabel: date.slice(5),
        Present: dayRecs.filter((r) => r.status === 'present').length,
        Tardy: dayRecs.filter((r) => r.status === 'tardy').length,
        Absent: dayRecs.filter((r) => r.status === 'absent').length,
        Excused: dayRecs.filter((r) => r.status === 'excused').length,
      };
    });
  }, [targetDates, scopedAttendance]);

  // 3. Homeroom Section Attendance Benchmarks
  const sectionBenchmarkData = useMemo(() => {
    return scopedClasses.map((cls) => {
      const recs = scopedAttendance.filter((r) => r.classId === cls.id);
      const attended = recs.filter((r) => r.status === 'present' || r.status === 'tardy').length;
      const rate = recs.length > 0 ? Math.round((attended / recs.length) * 1000) / 10 : 0;
      return {
        code: cls.code,
        name: cls.name,
        rate,
        records: recs.length,
      };
    });
  }, [scopedClasses, scopedAttendance]);

  // 4. Admissions Pipeline Conversion Funnel
  const admissionsFunnelData = useMemo(() => {
    const stages = [
      { key: 'inquiry', label: 'Inquiry' },
      { key: 'tour_scheduled', label: 'Tour Scheduled' },
      { key: 'documents_review', label: 'Docs Review' },
      { key: 'accepted', label: 'Accepted' },
      { key: 'enrolled', label: 'Enrolled' },
    ] as const;

    return stages.map((stage) => ({
      stage: stage.label,
      count: admissions.filter((a) => a.stage === stage.key).length,
    }));
  }, [admissions]);

  // 5. Departmental Workload & Faculty Benchmarks
  const departmentAnalytics = useMemo(() => {
    return departments.map((dept) => {
      const norm = dept.name.trim().toLowerCase();
      const members = staff.filter((s) => s.department.trim().toLowerCase() === norm);
      const totalAssigned = members.reduce((sum, m) => sum + m.assignedHours, 0);
      const totalTarget = members.reduce((sum, m) => sum + m.weeklyHoursTarget, 0);
      const utilizationPct =
        totalTarget > 0 ? Math.round((totalAssigned / totalTarget) * 100) : 0;
      const avgSubmission =
        members.length > 0
          ? Math.round(
              (members.reduce((sum, m) => sum + m.attendanceSubmissionRate, 0) / members.length) *
                10
            ) / 10
          : null;
      const avgObservation =
        members.length > 0
          ? Math.round(
              members.reduce((sum, m) => sum + m.observationScore, 0) / members.length
            )
          : null;

      return {
        id: dept.id,
        code: dept.code,
        name: dept.name,
        category: dept.category,
        headcount: members.length,
        totalAssigned,
        totalTarget,
        utilizationPct,
        avgSubmission,
        avgObservation,
      };
    });
  }, [departments, staff]);

  const handleExportAnalyticsCsv = () => {
    const header = [
      'Student Code',
      'Student Name',
      'Grade',
      'Section',
      'Logged Periods',
      'Absences',
      'Tardies',
      'Attendance Rate %',
      'Standing',
    ];
    const rows = analyticalKpis.studentMetrics.map((m) => [
      escapeCsvCell(m.student.studentCode),
      escapeCsvCell(`${m.student.firstName} ${m.student.lastName}`),
      escapeCsvCell(m.student.gradeLevel),
      escapeCsvCell(m.student.className),
      m.loggedDays,
      m.absences,
      m.tardies,
      m.loggedDays > 0 ? m.rate.toFixed(1) : 'N/A',
      escapeCsvCell(m.loggedDays === 0 ? 'No Logs' : m.rate < 90 ? 'Below Target' : 'On Track'),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `classytics-campus-analytics-${timeRange}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Analytical Filter & Export Toolbar */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {(
              [
                { key: '5d', label: '5 School Days' },
                { key: '14d', label: '14 School Days' },
                { key: 'all', label: 'All Recorded' },
              ] as { key: TimeRangeKey; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTimeRange(opt.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  timeRange === opt.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            aria-label="Filter analytics by grade level"
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
          >
            <option value="all">All Grade Levels</option>
            {gradeLevels.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleExportAnalyticsCsv}
          disabled={analyticalKpis.studentMetrics.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Export Analytics CSV
        </button>
      </section>

      {/* 4-Column Analytical KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Window Attendance Rate</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {analyticalKpis.windowRate !== null ? `${analyticalKpis.windowRate.toFixed(1)}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {analyticalKpis.totalLogs} attendance log{analyticalKpis.totalLogs === 1 ? '' : 's'} ·{' '}
            {analyticalKpis.absentLogs} absent
          </p>
        </div>

        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Chronic Absence Watch (&lt;90%)</p>
          <p
            className={`text-2xl font-semibold font-mono tabular-nums ${
              analyticalKpis.belowTargetCount > 0 ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {analyticalKpis.belowTargetCount}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            Out of {scopedStudents.length} student{scopedStudents.length === 1 ? '' : 's'} in scope
          </p>
        </div>

        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Parent Alert Acknowledgement</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {analyticalKpis.ackRate !== null ? `${analyticalKpis.ackRate}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {analyticalKpis.ackCount} acknowledged of {notifications.length} sent
          </p>
        </div>

        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Admissions Conversion</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {analyticalKpis.conversionRate !== null ? `${analyticalKpis.conversionRate}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {analyticalKpis.enrolledApps} enrolled of {admissions.length} application
            {admissions.length === 1 ? '' : 's'}
          </p>
        </div>
      </section>

      {/* Row 1 Charts: Attendance Trend & Section Benchmarks */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Attendance Distribution Over Time
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Recorded Present, Tardy, and Absent headcounts across selected dates
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 whitespace-nowrap">
              <span className="text-[#0F4C5C] font-medium">Present</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-600 font-medium">Tardy</span>
              <span aria-hidden="true">·</span>
              <span className="text-red-600 font-medium">Absent</span>
            </div>
          </div>

          {analyticalKpis.totalLogs === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-md p-6 space-y-2">
              <BarChart3 className="w-6 h-6 text-slate-300" />
              <p className="text-sm font-medium text-slate-900">No attendance trends yet</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Submit daily roll calls to populate multi-day attendance distributions and trend
                benchmarks.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md cursor-pointer"
              >
                Open Live Roll Call
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
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
                  <Bar dataKey="Present" stackId="a" fill="#0F4C5C" maxBarSize={36} />
                  <Bar dataKey="Tardy" stackId="a" fill="#D97706" maxBarSize={36} />
                  <Bar
                    dataKey="Absent"
                    stackId="a"
                    fill="#DC2626"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Section Attendance vs. 92% Target
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Homeroom section attendance rate within selected timeframe
            </p>
          </div>

          {sectionBenchmarkData.length === 0 || analyticalKpis.totalLogs === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-md p-6 space-y-1.5">
              <p className="text-sm font-medium text-slate-900">No section benchmarks available</p>
              <p className="text-xs text-slate-500">
                Create homeroom sections and record attendance to compare sections against the 92%
                target.
              </p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sectionBenchmarkData}
                  layout="vertical"
                  margin={{ top: 8, right: 20, left: 6, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="code"
                    width={76}
                    tick={{ fill: '#334155', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [`${Number(value ?? 0)}%`, 'Attendance']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <ReferenceLine x={92} stroke="#94A3B8" strokeDasharray="4 4" />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {sectionBenchmarkData.map((entry) => (
                      <Cell
                        key={entry.code}
                        fill={entry.rate >= 92 ? '#0F4C5C' : '#D97706'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Row 2 Cross-Campus Intelligence: Admissions Funnel + Departmental Benchmarks */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Admissions Conversion Funnel
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Applicant volume across enrolment workflow stages
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('admissions')}
              className="text-xs font-medium text-[#0F4C5C] hover:underline whitespace-nowrap cursor-pointer"
            >
              Admissions
            </button>
          </div>

          {admissions.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-md p-6 space-y-1.5">
              <p className="text-sm font-medium text-slate-900">No admissions pipeline data</p>
              <p className="text-xs text-slate-500">
                Applications created under Admission will chart conversion across each stage here.
              </p>
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={admissionsFunnelData}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    width={96}
                    tick={{ fill: '#334155', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [Number(value ?? 0), 'Applicants']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="#0F4C5C" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Department Workload &amp; Performance Benchmarks
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Weekly hour utilization, roll submission consistency, and observation scores
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('departments')}
              className="text-xs font-medium text-[#0F4C5C] hover:underline whitespace-nowrap cursor-pointer"
            >
              Departments
            </button>
          </div>

          {departmentAnalytics.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Create departments and assign staff to analyze departmental capacity and benchmarks.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Department</th>
                    <th className="py-2.5 px-4 text-right">Personnel</th>
                    <th className="py-2.5 px-4 text-right">Load Utilization</th>
                    <th className="py-2.5 px-4 text-right">Avg Roll %</th>
                    <th className="py-2.5 px-4 text-right">Avg Observation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {departmentAnalytics.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{d.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {d.code} · {d.category}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {d.headcount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {d.totalTarget > 0
                          ? `${d.utilizationPct}% (${d.totalAssigned}/${d.totalTarget}h)`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {d.avgSubmission !== null ? `${d.avgSubmission.toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {d.avgObservation !== null ? `${d.avgObservation} / 100` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Row 3: Student Cohort Attendance Standing Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Student Attendance Cohort Standing
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sorted from lowest attendance rate to highest to surface early intervention cohorts
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {analyticalKpis.studentMetrics.length} student
            {analyticalKpis.studentMetrics.length === 1 ? '' : 's'}
          </span>
        </div>

        {analyticalKpis.studentMetrics.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No enrolled students match the current grade filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Section &amp; Grade</th>
                  <th className="py-3 px-4 text-right">Logged Periods</th>
                  <th className="py-3 px-4 text-right">Absences</th>
                  <th className="py-3 px-4 text-right">Tardies</th>
                  <th className="py-3 px-4 text-right">Attendance Rate</th>
                  <th className="py-3 px-4 text-right">Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {analyticalKpis.studentMetrics.slice(0, 15).map((row) => (
                  <tr key={row.student.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">
                        {row.student.firstName} {row.student.lastName}
                      </p>
                      <p className="text-xs font-mono text-slate-500">{row.student.studentCode}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <p className="text-sm">{row.student.className}</p>
                      <p className="text-xs text-slate-500">{row.student.gradeLevel}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {row.loggedDays}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-red-600">
                      {row.absences}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                      {row.tardies}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {row.loggedDays > 0 ? `${row.rate.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold ${
                          row.loggedDays === 0
                            ? 'text-slate-400'
                            : row.rate < 90
                            ? 'text-red-600'
                            : row.rate < 95
                            ? 'text-amber-700'
                            : 'text-green-700'
                        }`}
                      >
                        {row.loggedDays === 0
                          ? 'Awaiting Logs'
                          : row.rate < 90
                          ? 'Below Target'
                          : row.rate < 95
                          ? 'Monitor'
                          : 'On Track'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
