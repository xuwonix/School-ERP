import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  MessageSquarePlus,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import {
  acknowledgeParentNotification,
  createNotificationRule,
  deleteNotificationRule,
  deleteParentNotification,
  sendDirectParentNotification,
  toggleNotificationRule,
} from '../lib/schoolActions';
import {
  DeliveryStatus,
  NotificationChannel,
  ParentNotification,
  RuleTriggerEvent,
} from '../types';

interface ParentCommunicationsViewProps {
  canManageRules?: boolean;
}

export function ParentCommunicationsView({
  canManageRules = true,
}: ParentCommunicationsViewProps) {
  const { user, students, notifications, notificationRules, invites } = useSchool();

  const [activeTab, setActiveTab] = useState<'log' | 'rules'>('log');
  const [channelFilter, setChannelFilter] = useState<'all' | NotificationChannel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DeliveryStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Compose Direct Message Modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeStudentId, setComposeStudentId] = useState('');
  const [composeChannel, setComposeChannel] = useState<NotificationChannel>('SMS');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Acknowledge / Log Parent Reply Modal
  const [ackTarget, setAckTarget] = useState<ParentNotification | null>(null);
  const [replyText, setReplyText] = useState('');
  const [acking, setAcking] = useState(false);

  // Create Rule Modal
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState<RuleTriggerEvent>('absent');
  const [ruleChannel, setRuleChannel] = useState<NotificationChannel>('SMS');
  const [ruleDelay, setRuleDelay] = useState(5);
  const [ruleTemplate, setRuleTemplate] = useState(
    'Attendance Alert: {{studentName}} was marked absent/tardy in {{className}} on {{date}}. Please confirm receipt.'
  );
  const [creatingRule, setCreatingRule] = useState(false);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (channelFilter !== 'all' && n.channel !== channelFilter) return false;
      if (statusFilter !== 'all' && n.deliveryStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${n.studentName} ${n.guardianName} ${n.subject} ${n.message}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notifications, channelFilter, statusFilter, searchQuery]);

  const handleOpenCompose = () => {
    setComposeStudentId(students[0]?.id || '');
    setComposeChannel(students[0]?.preferredChannel || 'SMS');
    setComposeSubject('');
    setComposeMessage('');
    setComposeOpen(true);
  };

  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find((s) => s.id === composeStudentId);
    if (!student || !composeSubject.trim() || !composeMessage.trim()) return;
    setSending(true);
    try {
      await sendDirectParentNotification({
        student,
        channel: composeChannel,
        subject: composeSubject,
        message: composeMessage,
      });
      setComposeOpen(false);
      setFeedback(`Dispatched ${composeChannel} message to ${student.guardianName}.`);
    } finally {
      setSending(false);
    }
  };

  const handleAckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackTarget) return;
    setAcking(true);
    try {
      await acknowledgeParentNotification(
        ackTarget.id,
        replyText.trim() || 'Guardian confirmed receipt via parent portal.'
      );
      setAckTarget(null);
      setReplyText('');
      setFeedback(`Recorded guardian acknowledgement for ${ackTarget.studentName}.`);
    } finally {
      setAcking(false);
    }
  };

  const handleToggleRule = async (ruleId: string, nextEnabled: boolean, name: string) => {
    await toggleNotificationRule(ruleId, nextEnabled);
    setFeedback(`${name} is now ${nextEnabled ? 'enabled' : 'paused'}.`);
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canManageRules || !ruleName.trim() || !ruleTemplate.trim()) return;
    setCreatingRule(true);
    try {
      const teacherViewerUids = invites
        .filter((inv) => (inv.role === 'teacher' || inv.role === 'staff') && inv.status === 'active')
        .map((inv) => inv.targetUid);
      await createNotificationRule({
        uid: user.uid,
        name: ruleName,
        triggerEvent: ruleTrigger,
        channel: ruleChannel,
        delayMinutes: ruleDelay,
        templateText: ruleTemplate,
        teacherViewerUids,
      });
      setRuleModalOpen(false);
      setRuleName('');
      setFeedback(`Created automated notification rule "${ruleName}".`);
    } finally {
      setCreatingRule(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation & Primary Action */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start">
          <button
            type="button"
            onClick={() => setActiveTab('log')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'log'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Communication Log ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Automation Rules ({notificationRules.length})
          </button>
        </div>

        {activeTab === 'log' ? (
          <button
            type="button"
            onClick={handleOpenCompose}
            disabled={students.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Compose Parent Message
          </button>
        ) : canManageRules ? (
          <button
            type="button"
            onClick={() => setRuleModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Automation Rule
          </button>
        ) : (
          <span className="text-xs text-slate-500">
            School-wide rules auto-trigger when you submit roll call
          </span>
        )}
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

      {activeTab === 'log' ? (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, guardian, or subject..."
                className="pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C] w-72 max-w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as 'all' | NotificationChannel)}
                aria-label="Filter by channel"
                className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
              >
                <option value="all">All Channels</option>
                <option value="SMS">SMS</option>
                <option value="Email">Email</option>
                <option value="App Push">App Push</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | DeliveryStatus)}
                aria-label="Filter by status"
                className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
              >
                <option value="all">All Delivery States</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="acknowledged">Acknowledged</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Student &amp; Guardian</th>
                  <th className="py-3 px-4">Message &amp; Trigger</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Delivery State</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredNotifications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      No parent notifications match the active filters.
                    </td>
                  </tr>
                ) : (
                  filteredNotifications.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors align-top">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-medium text-slate-900">{item.studentName}</p>
                        <p className="text-xs text-slate-500">{item.guardianName}</p>
                      </td>

                      <td className="py-3.5 px-4 max-w-md">
                        <p className="font-medium text-slate-900">{item.subject}</p>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          {item.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Trigger: {item.triggerType.replace('_', ' ')}
                        </p>
                        {item.parentReply && (
                          <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 mt-2">
                            Guardian reply: &ldquo;{item.parentReply}&rdquo;
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-slate-700">
                        {item.channel}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            item.deliveryStatus === 'acknowledged'
                              ? 'text-green-700'
                              : item.deliveryStatus === 'delivered'
                              ? 'text-[#0F4C5C]'
                              : 'text-amber-700'
                          }`}
                        >
                          {item.deliveryStatus === 'acknowledged'
                            ? 'Acknowledged'
                            : item.deliveryStatus === 'delivered'
                            ? 'Delivered'
                            : 'Sent'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          {item.deliveryStatus !== 'acknowledged' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setAckTarget(item);
                                setReplyText('');
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                            >
                              Log Guardian Reply
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Closed</span>
                          )}
                          {canManageRules && (
                            <button
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={async () => {
                                setDeletingId(item.id);
                                setFeedback(null);
                                try {
                                  await deleteParentNotification(item.id);
                                  setFeedback(`Removed communication log for ${item.studentName}.`);
                                } finally {
                                  setDeletingId(null);
                                }
                              }}
                              aria-label={`Delete notification for ${item.studentName}`}
                              className="p-1.5 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {notificationRules.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-900">No automation rules configured</p>
              <p className="text-xs text-slate-500">
                Create a rule to automatically alert guardians when attendance statuses change.
              </p>
            </div>
          ) : (
            notificationRules.map((rule) => (
              <div
                key={rule.id}
                className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 text-sm">
                    <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
                    <h3 className="font-semibold text-slate-900">{rule.name}</h3>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span
                      className={`text-xs font-medium ${
                        rule.enabled ? 'text-green-700' : 'text-slate-400'
                      }`}
                    >
                      {rule.enabled ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono tabular-nums">
                    Trigger: {rule.triggerEvent} · Channel: {rule.channel} · Delay:{' '}
                    {rule.delayMinutes} min
                  </p>
                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200/80 rounded px-3 py-2 font-mono">
                    {rule.templateText}
                  </p>
                </div>

                {canManageRules ? (
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleRule(rule.id, !rule.enabled, rule.name)}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                        rule.enabled
                          ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          : 'bg-[#0F4C5C] text-white border-[#0F4C5C] hover:bg-[#0B3945]'
                      }`}
                    >
                      {rule.enabled ? 'Pause Rule' : 'Enable Rule'}
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === rule.id}
                      onClick={async () => {
                        setDeletingId(rule.id);
                        setFeedback(null);
                        try {
                          await deleteNotificationRule(rule.id);
                          setFeedback(`Deleted automation rule "${rule.name}".`);
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                      aria-label={`Delete rule ${rule.name}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 shrink-0">Managed by Admin</span>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {/* Compose Direct Message Modal */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSendDirect}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-lg p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Compose Parent Message</h3>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Student &amp; Guardian
                </label>
                <select
                  value={composeStudentId}
                  onChange={(e) => {
                    setComposeStudentId(e.target.value);
                    const found = students.find((s) => s.id === e.target.value);
                    if (found) setComposeChannel(found.preferredChannel);
                  }}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.firstName} {st.lastName} ({st.guardianName} · {st.className})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Channel</label>
                <select
                  value={composeChannel}
                  onChange={(e) => setComposeChannel(e.target.value as NotificationChannel)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                >
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                  <option value="App Push">App Push</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="e.g., Homeroom Attendance Check-In"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  required
                  rows={4}
                  maxLength={1000}
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  placeholder="Write a clear message for the student's guardian..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
              >
                {sending ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Acknowledge Notification Modal */}
      {ackTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleAckSubmit}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Log Guardian Acknowledgement</h3>
              <button
                type="button"
                onClick={() => setAckTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Recording reply from <strong>{ackTarget.guardianName}</strong> regarding{' '}
              <strong>{ackTarget.studentName}</strong>. Acknowledged notices are locked for audit integrity.
            </p>
            <textarea
              rows={3}
              maxLength={500}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="e.g., Guardian called in with doctor's note; returning tomorrow."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAckTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={acking}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
              >
                {acking ? 'Saving...' : 'Mark Acknowledged'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Automation Rule Modal */}
      {ruleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRule}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-lg p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Create Notification Rule</h3>
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g., Afternoon Period Absence SMS"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Trigger</label>
                  <select
                    value={ruleTrigger}
                    onChange={(e) => setRuleTrigger(e.target.value as RuleTriggerEvent)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-md"
                  >
                    <option value="absent">Student Absent</option>
                    <option value="tardy">Student Tardy</option>
                    <option value="consecutive_absences">3+ Absences</option>
                    <option value="admission_stage_change">Admission Update</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Channel</label>
                  <select
                    value={ruleChannel}
                    onChange={(e) => setRuleChannel(e.target.value as NotificationChannel)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-md"
                  >
                    <option value="SMS">SMS</option>
                    <option value="Email">Email</option>
                    <option value="App Push">App Push</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Delay (min)</label>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    value={ruleDelay}
                    onChange={(e) => setRuleDelay(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-mono border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Message Template (supports {'{{studentName}}'}, {'{{className}}'}, {'{{date}}'})
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={600}
                  value={ruleTemplate}
                  onChange={(e) => setRuleTemplate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingRule}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
              >
                {creatingRule ? 'Creating...' : 'Save Rule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
