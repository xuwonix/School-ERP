import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  Mail,
  MapPin,
  Phone,
  X,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import {
  ALL_PROGRAMS,
  ALL_SERVICES,
  COMPANY_INFO,
  CareerRole,
  LEADERSHIP_TEAM,
  OPEN_ROLES,
  SITE_IMAGES,
} from '../../data/siteContent';
import { submitCareerApplication, submitContactInquiry } from '../../lib/schoolActions';
import { ContactInquiry, PublicPage } from '../../types';

interface NavProp {
  onNavigate: (page: PublicPage) => void;
}

/* ============================================================================
   1. ABOUT US PAGE (Full Content — 3x depth of Landing Page preview)
   ============================================================================ */
export function AboutPage({ onNavigate }: NavProp) {
  return (
    <div className="bg-white text-slate-900">
      {/* Editorial Header */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-14 lg:py-20 border-b border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 space-y-5 flex flex-col justify-center">
            <p className="text-xs font-medium text-[#0F4C5C]">About {COMPANY_INFO.name}</p>
            <h1
              className="font-bold tracking-tight text-slate-900 leading-[1.1]"
              style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.35rem)' }}
            >
              Calm institutional software built by people who ran K–12 schools.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed">
              We founded {COMPANY_INFO.name} after witnessing principals, registrars, and homeroom
              teachers stitch together attendance binders, manual SMS tools, and separate admissions
              spreadsheets every single week. Our mission is straightforward: give every school a
              single, invite-only operating system that respects teachers&apos; time and protects
              family privacy.
            </p>
          </div>
          <div className="lg:col-span-6 rounded-lg overflow-hidden border border-slate-200 min-h-[300px]">
            <img
              src={SITE_IMAGES.library}
              alt="Modern school library reading hall"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Institutional Principles */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16 lg:py-20 border-b border-slate-200 space-y-10">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-medium text-slate-500">Operating Philosophy</p>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Three architectural commitments behind every workflow.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2.5 border-t border-slate-200 pt-6">
            <p className="text-xs font-mono text-slate-400">01</p>
            <h3 className="text-base font-semibold text-slate-900">
              Sub-Minute Classroom Ergonomics
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Teachers have ninety seconds between the morning bell and instruction. Every roll-call
              screen is keyboard-ready, single-elevation, and free of distracting clutter.
            </p>
          </div>
          <div className="space-y-2.5 border-t border-slate-200 pt-6">
            <p className="text-xs font-mono text-slate-400">02</p>
            <h3 className="text-base font-semibold text-slate-900">
              Invite-Only Institutional Boundaries
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Open social logins blur personal and school identities. {COMPANY_INFO.name} locks
              access behind an OTP-verified Super Admin setup and role-provisioned institutional
              credentials.
            </p>
          </div>
          <div className="space-y-2.5 border-t border-slate-200 pt-6">
            <p className="text-xs font-mono text-slate-400">03</p>
            <h3 className="text-base font-semibold text-slate-900">
              Isolated Guardian &amp; Student PII
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Guardian emails, phone numbers, and emergency notes are architecturally separated into
              restricted private records accessible only to authorized school owners.
            </p>
          </div>
        </div>
      </section>

      {/* Full Leadership Team (All 3 profiles vs 1 on Landing Page) */}
      <section className="bg-slate-50/70 border-b border-slate-200 py-16 lg:py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 space-y-10">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-[#0F4C5C]">Leadership &amp; Academic Advisory</p>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
              Educators, schedulers, and security architects.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {LEADERSHIP_TEAM.map((leader) => (
              <article
                key={leader.name}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-slate-100 border-b border-slate-200 overflow-hidden">
                  <img
                    src={leader.image}
                    alt={leader.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-slate-900">{leader.name}</h3>
                    <p className="text-xs font-medium text-[#0F4C5C]">{leader.role}</p>
                    <p className="text-sm text-slate-600 leading-relaxed pt-1">{leader.bio}</p>
                  </div>
                  <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
                    {leader.credentials}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Quantified Campus Impact & Timeline */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16 lg:py-20 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-5">
            <p className="text-xs font-medium text-[#0F4C5C]">Verified Institutional Impact</p>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
              Measurable results across attendance, admissions, and faculty retention.
            </h2>
            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="border-t border-slate-200 pt-4">
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">14+</p>
                <p className="text-xs text-slate-600 mt-1">Independent &amp; Charter Campuses</p>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">98.4%</p>
                <p className="text-xs text-slate-600 mt-1">Daily Homeroom Roll Completion</p>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">31%</p>
                <p className="text-xs text-slate-600 mt-1">Drop in Unexcused Absences</p>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">14 hrs</p>
                <p className="text-xs text-slate-600 mt-1">Monthly Coordinator Time Saved</p>
              </div>
            </div>
            <div className="pt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('services')}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md cursor-pointer"
              >
                Explore Services
              </button>
              <button
                type="button"
                onClick={() => onNavigate('contact')}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Contact Leadership
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-lg overflow-hidden border border-slate-200">
            <img
              src={SITE_IMAGES.collaboration}
              alt="School administrators and faculty reviewing academic schedules"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================================================================
   2. SERVICES PAGE (All 6 Services + Institutional Deployment Comparison)
   ============================================================================ */
export function ServicesPage({ onNavigate }: NavProp) {
  return (
    <div className="bg-white text-slate-900">
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-14 lg:py-20 border-b border-slate-200">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-medium text-[#0F4C5C]">Platform Services</p>
          <h1
            className="font-bold tracking-tight text-slate-900 leading-[1.1]"
            style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.35rem)' }}
          >
            Six integrated services powering real-time school operations.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Every {COMPANY_INFO.name} deployment includes attendance tracking, automated parent
            notifications, multi-year admissions workflows, departments, staff scheduling,
            performance reporting, and invite-only role security on a unified real-time database.
          </p>
        </div>
      </section>

      {/* Complete 6-Service Catalog */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16 space-y-6">
        {ALL_SERVICES.map((svc) => (
          <article
            key={svc.number}
            className="bg-white border border-slate-200 rounded-lg p-7 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-7 space-y-3">
              <p className="text-xs font-mono text-slate-500">
                Service {svc.number} · {svc.outcome}
              </p>
              <h2 className="text-xl lg:text-2xl font-bold text-slate-900">{svc.title}</h2>
              <p className="text-sm lg:text-base text-slate-600 leading-relaxed">{svc.details}</p>
            </div>
            <div className="lg:col-span-5 lg:border-l lg:border-slate-200 lg:pl-8 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Included Capabilities</p>
              <ul className="space-y-2.5 text-sm text-slate-700">
                {svc.deliverables.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#0F4C5C] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>

      {/* Institutional Deployment Matrix */}
      <section className="bg-slate-50/70 border-t border-slate-200 py-16 lg:py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 space-y-8">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-[#0F4C5C]">Deployment Models</p>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
              Transparent institutional licensing by campus scale.
            </h2>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-4 px-5">Operational Capability</th>
                  <th className="py-4 px-5">For Independent Campuses</th>
                  <th className="py-4 px-5">For Multi-Campus Networks</th>
                  <th className="py-4 px-5">For Public &amp; Charter Districts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                <tr>
                  <td className="py-3.5 px-5 font-medium text-slate-900">Student Roster Capacity</td>
                  <td className="py-3.5 px-5 font-mono tabular-nums text-slate-700">Up to 750</td>
                  <td className="py-3.5 px-5 font-mono tabular-nums text-slate-700">Up to 3,500</td>
                  <td className="py-3.5 px-5 font-mono tabular-nums text-slate-700">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-slate-900">
                    Real-Time Attendance &amp; Auto-Notifications
                  </td>
                  <td className="py-3.5 px-5 text-slate-700">SMS + Email + App Push</td>
                  <td className="py-3.5 px-5 text-slate-700">Custom SLA + Multi-Language</td>
                  <td className="py-3.5 px-5 text-slate-700">District Escalation Engine</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-slate-900">
                    Admissions &amp; Atomic Enrolment
                  </td>
                  <td className="py-3.5 px-5 text-slate-700">Full 6-Stage Pipeline</td>
                  <td className="py-3.5 px-5 text-slate-700">Cross-Campus Waitlists</td>
                  <td className="py-3.5 px-5 text-slate-700">Lottery &amp; Zoning Support</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-slate-900">
                    Invite-Only Role Governance
                  </td>
                  <td className="py-3.5 px-5 text-slate-700">1 Super Admin + All Roles</td>
                  <td className="py-3.5 px-5 text-slate-700">Campus-Scoped Admins</td>
                  <td className="py-3.5 px-5 text-slate-700">Dedicated Audit &amp; SSO Bridge</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-slate-900">Annual Licensing</td>
                  <td className="py-3.5 px-5 font-mono tabular-nums font-semibold text-slate-900">
                    $4,800 / year
                  </td>
                  <td className="py-3.5 px-5 font-mono tabular-nums font-semibold text-slate-900">
                    $11,500 / year
                  </td>
                  <td className="py-3.5 px-5 font-mono tabular-nums font-semibold text-slate-900">
                    Custom District Quote
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md cursor-pointer"
            >
              Login to Campus Portal
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="px-5 py-2.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
            >
              Request Institutional Quote
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================================================================
   3. PROGRAMS PAGE (All 6 Implementation & Academic Programs)
   ============================================================================ */
export function ProgramsPage({ onNavigate }: NavProp) {
  return (
    <div className="bg-white text-slate-900">
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-14 lg:py-20 border-b border-slate-200">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-medium text-[#0F4C5C]">School Programs &amp; Rollout Tracks</p>
          <h1
            className="font-bold tracking-tight text-slate-900 leading-[1.1]"
            style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.35rem)' }}
          >
            Six structured programs to modernize your campus term by term.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Software alone does not transform school attendance or family trust. Each{' '}
            {COMPANY_INFO.name} program pairs our live workspace with guided implementation
            milestones for school owners, principals, faculty, admissions offices, and students.
          </p>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16 grid grid-cols-1 md:grid-cols-2 gap-6">
        {ALL_PROGRAMS.map((prog) => (
          <article
            key={prog.number}
            className="bg-white border border-slate-200 rounded-lg p-7 flex flex-col justify-between gap-6"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-500">
                <span>Program {prog.number} · {prog.duration}</span>
                <span>{prog.audience}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">{prog.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{prog.summary}</p>

              <div className="pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-700">Program Milestones</p>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {prog.curriculum.map((step) => (
                    <li key={step} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#0F4C5C] shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-semibold text-green-700">{prog.outcome}</span>
              <button
                type="button"
                onClick={() => onNavigate('contact')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F4C5C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Enroll Your School
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

/* ============================================================================
   4. CONTACT US PAGE (Directory + Live Firestore Inquiry Form + FAQ)
   ============================================================================ */
export function ContactPage() {
  const { institution } = useSchool();
  const [fullName, setFullName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState<ContactInquiry['topic']>('Demo Request');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!workEmail.includes('@') || message.trim().length < 5) {
      setErrorMsg('Please provide a valid institutional email and a brief message.');
      return;
    }
    setSubmitting(true);
    try {
      await submitContactInquiry({
        ownerId: institution?.superAdminUid || 'public_intake',
        fullName,
        institutionName,
        workEmail,
        phone,
        topic,
        message,
      });
      setSubmitted(true);
      setFullName('');
      setInstitutionName('');
      setWorkEmail('');
      setPhone('');
      setMessage('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to submit inquiry right now. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white text-slate-900">
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Direct Institutional Directory */}
        <div className="lg:col-span-5 space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#0F4C5C]">Contact {COMPANY_INFO.name}</p>
            <h1
              className="font-bold tracking-tight text-slate-900 leading-[1.1]"
              style={{ fontSize: 'clamp(2.1rem, 3.5vw, 3rem)' }}
            >
              Speak directly with our school onboarding and architecture team.
            </h1>
            <p className="text-sm lg:text-base text-slate-600 leading-relaxed">
              Whether you are preparing for a single-campus launch or migrating a multi-school
              network, our specialists respond within one business morning.
            </p>
          </div>

          <div className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
            <div className="py-4 flex items-start gap-3">
              <Mail className="w-4 h-4 text-[#0F4C5C] shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-slate-900">Admissions &amp; School Onboarding</p>
                <p className="text-slate-600 font-mono text-xs mt-0.5">{COMPANY_INFO.email}</p>
              </div>
            </div>
            <div className="py-4 flex items-start gap-3">
              <Phone className="w-4 h-4 text-[#0F4C5C] shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-slate-900">Toll-Free Helpline &amp; Support Hours</p>
                <p className="text-slate-600 font-mono text-xs mt-0.5">
                  {COMPANY_INFO.phoneWithHours}
                </p>
              </div>
            </div>
            <div className="py-4 flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#0F4C5C] shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-slate-900">Headquarters</p>
                <p className="text-slate-600 text-xs mt-0.5">{COMPANY_INFO.headquarters}</p>
              </div>
            </div>
            <div className="py-4 flex items-start gap-3">
              <Clock className="w-4 h-4 text-[#0F4C5C] shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-slate-900">Security &amp; Privacy Office</p>
                <p className="text-slate-600 text-xs mt-0.5">
                  Institutional data processing agreements &amp; invite-only access reviews
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Firestore Consultation Form */}
        <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200 rounded-lg p-7 lg:p-10">
          {submitted ? (
            <div className="py-12 text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-green-700 mx-auto" />
              <h2 className="text-xl font-bold text-slate-900">Inquiry Received</h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Thank you for reaching out. Your message has been securely logged for our campus
                onboarding specialists, who will respond within one business day.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="px-4 py-2 text-xs font-semibold text-[#0F4C5C] border border-slate-200 bg-white hover:bg-slate-50 rounded-md cursor-pointer"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Request a Campus Consultation</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  All submissions are stored securely and reviewed exclusively by authorized
                  administrators.
                </p>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5">
                  {errorMsg}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Sarah Mitchell"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    School / District Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="Greenfield Senior Secondary School"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Institutional Email
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={160}
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    placeholder="principal@yourschool.edu.in"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98640 12345"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Topic</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as ContactInquiry['topic'])}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                >
                  <option value="Demo Request">Demo Request</option>
                  <option value="Admissions Suite">Admissions Suite</option>
                  <option value="District Rollout">District Rollout</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Partnership">Partnership</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  How can we help your school?
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={5}
                  maxLength={1500}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share your student count, attendance workflow goals, or target launch date..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Submitting Inquiry...' : 'Send Consultation Request'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

/* ============================================================================
   5. CAREER PAGE (Culture + Department Filter + All 6 Open Roles + Live Apply)
   ============================================================================ */
export function CareerPage() {
  const { institution } = useSchool();
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [applyingRole, setApplyingRole] = useState<CareerRole | null>(null);
  const [applicantName, setApplicantName] = useState('');
  const [email, setEmail] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [coverNote, setCoverNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const departments = ['All', 'Engineering', 'School Onboarding', 'Academic Advisory', 'Operations'];

  const visibleRoles = useMemo(() => {
    if (deptFilter === 'All') return OPEN_ROLES;
    return OPEN_ROLES.filter((r) => r.department === deptFilter);
  }, [deptFilter]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingRole) return;
    setSubmitting(true);
    try {
      await submitCareerApplication({
        ownerId: institution?.superAdminUid || 'public_intake',
        applicantName,
        email,
        roleTitle: applyingRole.title,
        department: applyingRole.department,
        portfolioUrl,
        coverNote,
      });
      setSuccessMsg(`Application submitted for ${applyingRole.title}. Our hiring team will be in touch.`);
      setApplyingRole(null);
      setApplicantName('');
      setEmail('');
      setPortfolioUrl('');
      setCoverNote('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white text-slate-900">
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-14 lg:py-20 border-b border-slate-200">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-medium text-[#0F4C5C]">Careers at {COMPANY_INFO.name}</p>
          <h1
            className="font-bold tracking-tight text-slate-900 leading-[1.1]"
            style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.35rem)' }}
          >
            Build dependable software that teachers actually look forward to opening.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            We are a focused team of former educators, systems engineers, and school operations
            leads. We work in calm, high-trust sprints with transparent salaries, academic-calendar
            rest weeks, and real time spent visiting partner campuses.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-slate-200 pt-8 text-sm">
          <div>
            <p className="font-semibold text-slate-900">Direct Classroom Impact</p>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Every engineering and advisory hire shadows partner school mornings each semester.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Transparent Compensation</p>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Published salary bands, full medical coverage, and meaningful long-term equity.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Rest Aligned with Campuses</p>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Two company-wide winter and mid-summer shut-down weeks plus flexible PTO.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-14 space-y-6">
        {successMsg && (
          <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900">
            Open Positions ({visibleRoles.length})
          </h2>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto">
            {departments.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDeptFilter(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  deptFilter === d
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
          {visibleRoles.map((role) => (
            <div
              key={role.id}
              className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-slate-50/50 transition-colors"
            >
              <div className="space-y-1.5 max-w-2xl">
                <h3 className="text-base font-bold text-slate-900">{role.title}</h3>
                <p className="text-xs font-mono text-slate-500">
                  {role.department} · {role.location} · {role.type} · {role.compensation}
                </p>
                <p className="text-sm text-slate-600 leading-relaxed pt-1">{role.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setApplyingRole(role)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start md:self-center"
              >
                Apply Now
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Live Job Application Modal */}
      {applyingRole && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleApplySubmit}
            className="bg-white border border-slate-200 rounded-lg w-full max-w-lg p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-mono text-slate-500">
                  {applyingRole.department} · {applyingRole.location}
                </p>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Apply: {applyingRole.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setApplyingRole(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close application modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  maxLength={160}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  LinkedIn or Portfolio URL (Optional)
                </label>
                <input
                  type="url"
                  maxLength={300}
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Brief Cover Note
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={10}
                  maxLength={1500}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Tell us about your work in education, engineering, or school operations..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Lock className="w-3.5 h-3.5" />
                Stored privately in Firestore
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setApplyingRole(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
