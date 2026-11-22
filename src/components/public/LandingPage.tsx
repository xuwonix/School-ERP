import { useState } from 'react';
import { ArrowRight, Building2, Lock, ShieldCheck } from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import {
  ALL_PROGRAMS,
  ALL_SERVICES,
  COMPANY_INFO,
  LEADERSHIP_TEAM,
  OPEN_ROLES,
  SITE_IMAGES,
} from '../../data/siteContent';
import { PublicPage } from '../../types';

interface LandingPageProps {
  onNavigate: (page: PublicPage) => void;
}

function EditorialImage({
  src,
  alt,
  className,
  fallbackTitle,
}: {
  src: string;
  alt: string;
  className: string;
  fallbackTitle: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`${className} bg-slate-100 flex flex-col items-center justify-center p-8 text-slate-500 gap-2`}>
        <Building2 className="w-8 h-8 text-slate-400" />
        <span className="text-xs font-medium">{fallbackTitle}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const { institution, institutionLoaded } = useSchool();

  // Strictly 1/3 previews of each full navigation page
  const previewServices = ALL_SERVICES.slice(0, 2); // 2 of 6
  const previewPrograms = ALL_PROGRAMS.slice(0, 2); // 2 of 6
  const previewLeader = LEADERSHIP_TEAM[0]; // 1 of 3
  const previewRoles = OPEN_ROLES.slice(0, 2); // 2 of 6

  const go = (page: PublicPage) => {
    let target = page;
    if (institutionLoaded) {
      if (page === 'login' && !institution?.setupComplete) {
        target = 'setup';
      } else if (page === 'setup' && institution?.setupComplete) {
        target = 'login';
      }
    }
    onNavigate(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-white text-slate-900">
      {/* ===================================================================
          1. HERO SECTION — Crisp 2-column architectural split (items-stretch)
          =================================================================== */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pt-10 pb-12 lg:pt-14 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between py-2 space-y-8">
            <div className="space-y-5">
              <p className="text-xs font-medium text-slate-500">
                K–12 School Operating System · Invite-Only Institutional Governance
              </p>

              <h1
                className="font-bold tracking-tight text-slate-900 leading-[1.08]"
                style={{ fontSize: 'clamp(2.35rem, 4.1vw, 3.75rem)' }}
              >
                Every morning bell, parent alert, and campus roster in sync.
              </h1>

              <p className="text-base lg:text-lg text-slate-600 leading-relaxed max-w-xl">
                {COMPANY_INFO.name} replaces fragmented attendance sheets, delayed phone calls, and
                manual admissions folders with one real-time platform governed strictly by your
                school&apos;s Super Admin.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => go('login')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>Login to Campus Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => go('contact')}
                  className="px-5 py-3 text-sm font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  Schedule School Consultation
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#0F4C5C]" />
                  100% Invite-Only Role Logins
                </span>
                <span aria-hidden="true">·</span>
                <span>Super Admin Provisions Stakeholders, Administration, Teachers &amp; Staff</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative min-h-[340px] lg:min-h-[480px] rounded-lg overflow-hidden border border-slate-200">
            <EditorialImage
              src={SITE_IMAGES.campusHero}
              alt="Sunlit independent school campus courtyard and timber library facade"
              fallbackTitle="Classytics Partner School"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent p-6 lg:p-8 text-white">
              <p className="text-xs text-slate-200">
                {COMPANY_INFO.name} · Real-Time Attendance &amp; Parent Engagement
              </p>
              <p className="text-base font-semibold mt-1 max-w-md">
                Trusted by school owners, principals, registrars, and homeroom faculty across K–12 campuses.
              </p>
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Proof Strip below Hero Split */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/50">
          <div className="p-6 space-y-1">
            <p className="text-2xl lg:text-3xl font-semibold font-mono tabular-nums text-slate-900">
              98.4%
            </p>
            <p className="text-xs font-medium text-slate-700">On-Time Morning Roll Submission</p>
            <p className="text-xs text-slate-500">Measured across 14 partner campuses in 2026</p>
          </div>
          <div className="p-6 space-y-1">
            <p className="text-2xl lg:text-3xl font-semibold font-mono tabular-nums text-slate-900">
              &lt; 4 min
            </p>
            <p className="text-xs font-medium text-slate-700">Absence-to-Parent Alert Delivery</p>
            <p className="text-xs text-slate-500">Automated SMS &amp; Email rule execution</p>
          </div>
          <div className="p-6 space-y-1">
            <p className="text-2xl lg:text-3xl font-semibold font-mono tabular-nums text-slate-900">
              42%
            </p>
            <p className="text-xs font-medium text-slate-700">Faster Admissions-to-Roster Time</p>
            <p className="text-xs text-slate-500">Multi-year intake &amp; atomic enrolment</p>
          </div>
          <div className="p-6 space-y-1">
            <p className="text-2xl lg:text-3xl font-semibold font-mono tabular-nums text-slate-900">
              100%
            </p>
            <p className="text-xs font-medium text-slate-700">Invite-Only Role Isolation</p>
            <p className="text-xs text-slate-500">Zero public signups · Private guardian records</p>
          </div>
        </div>
      </section>

      {/* ===================================================================
          2. WHY JOIN CLASSYTICS — Deep Institutional Rationale
          =================================================================== */}
      <section className="border-t border-slate-200 bg-slate-50/70 py-16 lg:py-24">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-7 space-y-3">
              <p className="text-xs font-medium text-[#0F4C5C]">Why Join {COMPANY_INFO.name}</p>
              <h2 className="text-2xl lg:text-4xl font-bold tracking-tight text-slate-900">
                Fragmented school tools cost hours every morning and erode parent trust.
              </h2>
            </div>
            <div className="lg:col-span-5">
              <p className="text-sm lg:text-base text-slate-600 leading-relaxed">
                When attendance sits in one spreadsheet, parent contact details in another, and
                admissions files in email threads, critical absences go unnoticed until afternoon.
                {` ${COMPANY_INFO.name}`} unifies every stakeholder under strict institutional control.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 rounded-lg overflow-hidden border border-slate-200 bg-white">
              <EditorialImage
                src={SITE_IMAGES.classroom}
                alt="Teacher guiding high school students in a sunlit modern classroom"
                fallbackTitle="Modern Homeroom Classroom"
                className="w-full h-full min-h-[320px] object-cover"
              />
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200 flex flex-col justify-between">
              <div className="p-6 space-y-2">
                <p className="text-xs font-mono text-slate-400">01</p>
                <h3 className="text-base font-semibold text-slate-900">
                  Immediate Student Safety &amp; Accountability
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Homeroom teachers log attendance in under 45 seconds. Unexcused absences trigger
                  automated guardian notifications before second period begins.
                </p>
              </div>
              <div className="p-6 space-y-2">
                <p className="text-xs font-mono text-slate-400">02</p>
                <h3 className="text-base font-semibold text-slate-900">
                  Closed-Door Institutional Security
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Consumer social logins do not belong in K–12 operations. After OTP-verified owner
                  onboarding, only your Super Admin creates and revokes Stakeholder, Administration,
                  Teacher, Staff, and Student credentials.
                </p>
              </div>
              <div className="p-6 space-y-2">
                <p className="text-xs font-mono text-slate-400">03</p>
                <h3 className="text-base font-semibold text-slate-900">
                  One Source of Truth from Inquiry to Graduation
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Accepted applicants convert atomically into enrolled homeroom students, while
                  faculty schedules resolve room conflicts and cover staff leave automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          3. SERVICES PREVIEW (1/3 of full Services page: 2 of 6 modules)
          =================================================================== */}
      <section className="border-t border-slate-200 bg-white py-16 lg:py-24">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-medium text-[#0F4C5C]">
                Services Preview · 2 of 6 Institutional Modules
              </p>
              <h2 className="text-2xl lg:text-4xl font-bold tracking-tight text-slate-900">
                Built around the daily workflows that run a school.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => go('services')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F4C5C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Explore All 6 Services</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <article className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-lg p-8 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <p className="text-xs font-mono text-slate-500">
                  {previewServices[0].number}. Core Attendance Infrastructure
                </p>
                <h3 className="text-xl lg:text-2xl font-bold text-slate-900">
                  {previewServices[0].title}
                </h3>
                <p className="text-sm lg:text-base text-slate-600 leading-relaxed max-w-xl">
                  {previewServices[0].summary}
                </p>
              </div>
              <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-700">
                  Outcome: {previewServices[0].outcome}
                </span>
                <button
                  type="button"
                  onClick={() => go('services')}
                  className="text-xs font-semibold text-[#0F4C5C] hover:underline whitespace-nowrap cursor-pointer"
                >
                  Read service specifications →
                </button>
              </div>
            </article>

            <article className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-8 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <p className="text-xs font-mono text-slate-500">
                  {previewServices[1].number}. Automated Communications
                </p>
                <h3 className="text-xl font-bold text-slate-900">
                  {previewServices[1].title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {previewServices[1].summary}
                </p>
              </div>
              <div className="pt-5 border-t border-slate-200 space-y-2">
                <p className="text-xs font-mono text-slate-700">{previewServices[1].outcome}</p>
                <button
                  type="button"
                  onClick={() => go('services')}
                  className="text-xs font-semibold text-[#0F4C5C] hover:underline cursor-pointer"
                >
                  See all 6 services &amp; deployment tiers →
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ===================================================================
          4. ABOUT US PREVIEW (1/3 of full About Us page)
          =================================================================== */}
      <section className="border-t border-slate-200 bg-slate-50/70 py-16 lg:py-24">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <p className="text-xs font-medium text-[#0F4C5C]">About Us Preview</p>
              <h2 className="text-2xl lg:text-4xl font-bold tracking-tight text-slate-900">
                Founded by educators who ran morning attendance offices first-hand.
              </h2>
              <p className="text-sm lg:text-base text-slate-600 leading-relaxed">
                {COMPANY_INFO.name} began inside independent K–12 campuses where principals needed
                real visibility without burdening classroom teachers. Headquartered in Tezpur,
                Assam, every workflow we ship prioritizes calm design and isolated family privacy.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5 flex items-center gap-4">
              <img
                src={previewLeader.image}
                alt={previewLeader.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-md object-cover border border-slate-200 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{previewLeader.name}</p>
                <p className="text-xs text-slate-500">{previewLeader.role}</p>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">{previewLeader.bio}</p>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => go('about')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F4C5C] hover:underline cursor-pointer"
              >
                <span>Read Our Full Story &amp; Leadership Team</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-lg overflow-hidden border border-slate-200 min-h-[300px]">
            <EditorialImage
              src={SITE_IMAGES.library}
              alt="Contemporary independent school library with oak bookshelves and daylight"
              fallbackTitle="Campus Library Architecture"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ===================================================================
          5. PROGRAMS PREVIEW (1/3 of full Programs page: 2 of 6 programs)
          =================================================================== */}
      <section className="border-t border-slate-200 bg-white py-16 lg:py-24">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-medium text-[#0F4C5C]">
                Programs Preview · 2 of 6 Implementation Tracks
              </p>
              <h2 className="text-2xl lg:text-4xl font-bold tracking-tight text-slate-900">
                Guided campus programs designed for measurable term outcomes.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => go('programs')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F4C5C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>View All 6 Programs</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {previewPrograms.map((prog) => (
              <article
                key={prog.number}
                className="bg-white border border-slate-200 rounded-lg p-7 flex flex-col justify-between gap-5"
              >
                <div className="space-y-2.5">
                  <p className="text-xs font-mono text-slate-500">
                    {prog.number} · {prog.duration} · {prog.audience}
                  </p>
                  <h3 className="text-lg font-bold text-slate-900">{prog.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{prog.summary}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <span className="text-xs font-medium text-green-700">{prog.outcome}</span>
                  <button
                    type="button"
                    onClick={() => go('programs')}
                    className="text-xs font-semibold text-[#0F4C5C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Curriculum →
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================
          6. CAREERS & CONTACT PREVIEW (1/3 of Career + Contact pages)
          =================================================================== */}
      <section className="bg-slate-900 text-white py-16 lg:py-24 border-t border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Careers 1/3 Preview (2 of 6 roles) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">
                Careers Preview · 2 of {OPEN_ROLES.length} Open Positions
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
                Help build calm, dependable software for schools.
              </h2>
            </div>

            <div className="divide-y divide-slate-800 border-y border-slate-800">
              {previewRoles.map((role) => (
                <div
                  key={role.id}
                  className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-base font-semibold text-white">{role.title}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {role.department} · {role.location} · {role.compensation}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => go('career')}
                    className="text-xs font-semibold text-slate-200 hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Apply on Career Page →
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => go('career')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white cursor-pointer"
            >
              <span>Browse All {OPEN_ROLES.length} Open Roles</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Contact & Portal Access Panel (Advertises Login only) */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-lg p-8 space-y-5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-slate-300" />
              <span>Ready to Access Your Campus Portal?</span>
            </div>
            <h3 className="text-xl font-bold text-white leading-snug">
              Sign in to {COMPANY_INFO.name} or connect with our Tezpur onboarding team.
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Call us at <span className="font-mono text-slate-200">{COMPANY_INFO.phone}</span> ({COMPANY_INFO.hours}) or email{' '}
              <span className="font-mono text-slate-200">{COMPANY_INFO.email}</span> to bring unified school governance to your campus.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => go('login')}
                className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-white hover:bg-slate-100 rounded-md transition-colors text-center whitespace-nowrap cursor-pointer"
              >
                Member Login
              </button>
              <button
                type="button"
                onClick={() => go('contact')}
                className="px-5 py-2.5 text-sm font-medium text-white border border-slate-700 hover:border-slate-500 rounded-md transition-colors text-center whitespace-nowrap cursor-pointer"
              >
                Contact Us
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
