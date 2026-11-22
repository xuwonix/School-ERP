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
import { CheckCircle2, Download, Plus, Search, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { createFinancialRecord } from '../lib/schoolActions';
import {
  FinancialCategory,
  FinancialEntryType,
  FinancialStatus,
} from '../types';

const REVENUE_CATEGORIES: FinancialCategory[] = [
  'Tuition Fees',
  'Admission Fees',
  'Grants & Endowment',
  'Transport & Lab Fees',
];

const EXPENSE_CATEGORIES: FinancialCategory[] = [
  'Faculty Payroll',
  'Campus Operations',
  'Academic Resources',
  'Scholarships & Aid',
];

const STATUS_LABELS: Record<FinancialStatus, string> = {
  collected: 'Collected',
  pending: 'Pending',
  disbursed: 'Disbursed',
  scheduled: 'Scheduled',
};

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatInr(amount: number): string {
  return inrFormatter.format(Math.round(amount));
}

function formatCompactInr(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${Math.round(abs / 1000)}K`;
  return `${sign}₹${abs}`;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  const guarded = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function formatMonthLabel(ym: string): string {
  const [yr, mo] = ym.split('-').map(Number);
  if (!yr || !mo) return ym;
  const dt = new Date(yr, mo - 1, 1);
  return dt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

interface FinancialAnalyticsViewProps {
  canManage?: boolean;
}

export function FinancialAnalyticsView({ canManage = false }: FinancialAnalyticsViewProps) {
  const { user, financialRecords, departments, invites } = useSchool();

  const [typeFilter, setTypeFilter] = useState<'all' | FinancialEntryType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FinancialStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Super Admin Record Entry Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [fiscalYear, setFiscalYear] = useState('FY 2025-26');
  const [month, setMonth] = useState('2025-10');
  const [entryType, setEntryType] = useState<FinancialEntryType>('revenue');
  const [category, setCategory] = useState<FinancialCategory>('Tuition Fees');
  const [department, setDepartment] = useState('Administration');
  const [amount, setAmount] = useState(1250000);
  const [budgetedAmount, setBudgetedAmount] = useState(1200000);
  const [status, setStatus] = useState<FinancialStatus>('collected');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalExpense = 0;
    let budgetedExpense = 0;
    let collectedRevenue = 0;
    let pendingReceivables = 0;

    for (const rec of financialRecords) {
      if (rec.entryType === 'revenue') {
        totalRevenue += rec.amount;
        if (rec.status === 'collected') collectedRevenue += rec.amount;
        if (rec.status === 'pending' || rec.status === 'scheduled') {
          pendingReceivables += rec.amount;
        }
      } else {
        totalExpense += rec.amount;
        budgetedExpense += rec.budgetedAmount;
      }
    }

    const netSurplus = totalRevenue - totalExpense;
    const operatingMargin = totalRevenue > 0 ? (netSurplus / totalRevenue) * 100 : 0;
    const collectionRate = totalRevenue > 0 ? (collectedRevenue / totalRevenue) * 100 : 0;
    const expenseVariancePct =
      budgetedExpense > 0 ? ((totalExpense - budgetedExpense) / budgetedExpense) * 100 : 0;

    return {
      totalRevenue,
      totalExpense,
      netSurplus,
      operatingMargin,
      collectedRevenue,
      pendingReceivables,
      collectionRate,
      expenseVariancePct,
    };
  }, [financialRecords]);

  const monthlySeries = useMemo(() => {
    const map = new Map<
      string,
      { month: string; label: string; Revenue: number; Expenditure: number }
    >();
    for (const rec of financialRecords) {
      const existing = map.get(rec.month) || {
        month: rec.month,
        label: rec.monthLabel || formatMonthLabel(rec.month),
        Revenue: 0,
        Expenditure: 0,
      };
      if (rec.entryType === 'revenue') {
        existing.Revenue += rec.amount;
      } else {
        existing.Expenditure += rec.amount;
      }
      map.set(rec.month, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [financialRecords]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { category: string; type: FinancialEntryType; Actual: number; Budget: number }
    >();
    for (const rec of financialRecords) {
      const existing = map.get(rec.category) || {
        category: rec.category,
        type: rec.entryType,
        Actual: 0,
        Budget: 0,
      };
      existing.Actual += rec.amount;
      existing.Budget += rec.budgetedAmount;
      map.set(rec.category, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.Actual - a.Actual);
  }, [financialRecords]);

  const filteredRecords = useMemo(() => {
    return financialRecords
      .filter((rec) => {
        if (typeFilter !== 'all' && rec.entryType !== typeFilter) return false;
        if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const hay =
            `${rec.monthLabel} ${rec.category} ${rec.department} ${rec.notes} ${rec.fiscalYear}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [financialRecords, typeFilter, statusFilter, searchQuery]);

  const handleOpenModal = () => {
    setEntryType('revenue');
    setCategory('Tuition Fees');
    setStatus('collected');
    setDepartment(departments[0]?.name || 'Administration');
    setAmount(1250000);
    setBudgetedAmount(1200000);
    setNotes('');
    setModalOpen(true);
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setFeedback(null);
    try {
      const activeBoardUids = invites
        .filter((inv) => inv.role === 'board' && inv.status === 'active')
        .map((inv) => inv.targetUid);

      await createFinancialRecord({
        uid: user.uid,
        fiscalYear,
        month,
        monthLabel: formatMonthLabel(month),
        entryType,
        category,
        department,
        amount,
        budgetedAmount,
        status,
        notes,
        boardViewerUids: activeBoardUids,
      });
      setModalOpen(false);
      setFeedback(`Recorded ${category} (${formatInr(amount)}) for ${formatMonthLabel(month)}.`);
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = () => {
    const header = [
      'Fiscal Year',
      'Month',
      'Type',
      'Category',
      'Department',
      'Actual (INR)',
      'Budgeted (INR)',
      'Variance (INR)',
      'Status',
      'Notes',
    ];
    const rows = filteredRecords.map((rec) => [
      escapeCsvCell(rec.fiscalYear),
      escapeCsvCell(rec.monthLabel),
      escapeCsvCell(rec.entryType === 'revenue' ? 'Revenue' : 'Expense'),
      escapeCsvCell(rec.category),
      escapeCsvCell(rec.department),
      rec.amount,
      rec.budgetedAmount,
      rec.amount - rec.budgetedAmount,
      escapeCsvCell(STATUS_LABELS[rec.status]),
      escapeCsvCell(rec.notes),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'classytics-financial-analytics.csv';
    link.click();
    URL.revokeObjectURL(url);
    setFeedback('Exported financial analytics ledger as CSV.');
  };

  const availableCategories = entryType === 'revenue' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-6">
      {/* 4-Column Executive Financial KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Total Revenue (YTD)</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {formatInr(summary.totalRevenue)}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {formatCompactInr(summary.collectedRevenue)} collected to date
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Total Expenditure (YTD)</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {formatInr(summary.totalExpense)}
          </p>
          <p
            className={`text-xs font-mono tabular-nums ${
              summary.expenseVariancePct <= 2 ? 'text-green-700' : 'text-amber-700'
            }`}
          >
            {summary.expenseVariancePct >= 0 ? '+' : ''}
            {summary.expenseVariancePct.toFixed(1)}% vs. operating budget
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Net Operating Surplus</p>
          <p
            className={`text-2xl font-semibold font-mono tabular-nums ${
              summary.netSurplus >= 0 ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {formatInr(summary.netSurplus)}
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            {summary.operatingMargin.toFixed(1)}% net operating margin
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500">Fee Collection Rate</p>
          <p className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {summary.collectionRate.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            {formatCompactInr(summary.pendingReceivables)} pending receivables
          </p>
        </div>
      </section>

      {/* Primary Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Revenue vs Expenditure */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Monthly Revenue vs. Expenditure
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cashflow performance across fiscal months (INR)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="text-[#0F4C5C] font-medium">Revenue</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-500 font-medium">Expenditure</span>
            </div>
          </div>

          <div className="h-64 w-full">
            {monthlySeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No monthly financial records available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlySeries}
                  margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#334155', fontSize: 12 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatCompactInr(v)}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip
                    formatter={(value) => formatInr(Number(value ?? 0))}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="Revenue" fill="#0F4C5C" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar
                    dataKey="Expenditure"
                    fill="#94A3B8"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Budget vs Actual Breakdown */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Budget vs. Actual by Head</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cumulative allocation across revenue and cost centers
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {categoryBreakdown.length} heads
            </span>
          </div>

          <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">
                No category breakdown data available.
              </p>
            ) : (
              categoryBreakdown.map((item) => {
                const ratio =
                  item.Budget > 0 ? Math.min(100, Math.round((item.Actual / item.Budget) * 100)) : 0;
                const isRevenue = item.type === 'revenue';
                return (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-800 truncate">
                        {item.category}
                        <span className="text-slate-400 font-normal">
                          {' '}
                          · {isRevenue ? 'Revenue' : 'Expense'}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatCompactInr(item.Actual)}{' '}
                        <span className="text-slate-400">/ {formatCompactInr(item.Budget)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isRevenue ? 'bg-[#0F4C5C]' : 'bg-slate-500'
                        }`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
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
            className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Financial Ledger Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {(['all', 'revenue', 'expense'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                    typeFilter === t
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'all' ? 'All Entries' : t === 'revenue' ? 'Revenue' : 'Expenditure'}
                </button>
              ))}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | FinancialStatus)}
              aria-label="Filter by financial status"
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
            >
              <option value="all">All Statuses</option>
              <option value="collected">Collected</option>
              <option value="pending">Pending</option>
              <option value="disbursed">Disbursed</option>
              <option value="scheduled">Scheduled</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search head, department, month..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C] w-56"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
            {canManage && (
              <button
                type="button"
                onClick={handleOpenModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Entry
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Account Head &amp; Notes</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Actual</th>
                <th className="py-3 px-4 text-right">Budgeted</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    No financial ledger entries match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {rec.monthLabel}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">{rec.fiscalYear}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-900">{rec.category}</p>
                      {rec.notes && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{rec.notes}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {rec.department}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold ${
                          rec.entryType === 'revenue' ? 'text-[#0F4C5C]' : 'text-slate-600'
                        }`}
                      >
                        {rec.entryType === 'revenue' ? 'Revenue' : 'Expense'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatInr(rec.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatInr(rec.budgetedAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold ${
                          rec.status === 'collected' || rec.status === 'disbursed'
                            ? 'text-green-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {STATUS_LABELS[rec.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Super Admin Record Financial Entry Modal */}
      {canManage && modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRecord}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Record Financial Entry</h3>
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Entry Type</label>
                <select
                  value={entryType}
                  onChange={(e) => {
                    const next = e.target.value as FinancialEntryType;
                    setEntryType(next);
                    setCategory(next === 'revenue' ? 'Tuition Fees' : 'Faculty Payroll');
                    setStatus(next === 'revenue' ? 'collected' : 'disbursed');
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expenditure</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Account Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FinancialCategory)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fiscal Year</label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Month</label>
                <input
                  type="month"
                  required
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Actual Amount (INR)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100000000}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Budgeted Amount (INR)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100000000}
                  value={budgetedAmount}
                  onChange={(e) => setBudgetedAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as FinancialStatus)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                >
                  <option value="collected">Collected</option>
                  <option value="pending">Pending</option>
                  <option value="disbursed">Disbursed</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Executive Notes
              </label>
              <textarea
                rows={2}
                maxLength={300}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Fee cycle reference, grant details, or disbursement summary..."
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
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
