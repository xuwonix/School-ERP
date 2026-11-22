export const COMPANY_INFO = {
  name: 'Classytics',
  email: 'info@classytics.com',
  phone: '1800 129 1239',
  hours: 'Mon - Fri 07:00 - 11:30 IST',
  phoneWithHours: '1800 129 1239 · Mon - Fri 07:00 - 11:30 IST',
  headquarters: 'L.B Road, Tezpur, Sonitpur, Assam 784001',
};

export const SITE_IMAGES = {
  campusHero: '/src/assets/images/campus_architecture_hero_1795281323876.jpg',
  classroom: '/src/assets/images/classroom_teacher_session_1795282957752.jpg',
  library: '/src/assets/images/library_campus_study_1795282960275.jpg',
  collaboration: '/src/assets/images/educators_collaboration_1795282975051.jpg',
  principal: '/src/assets/images/avatar_principal_1795281324309.jpg',
  mathLead: '/src/assets/images/avatar_teacher_math_1795281327391.jpg',
  scienceLead: '/src/assets/images/avatar_teacher_science_1795281324018.jpg',
};

export interface ServiceItem {
  number: string;
  title: string;
  summary: string;
  outcome: string;
  details: string;
  deliverables: string[];
}

export const ALL_SERVICES: ServiceItem[] = [
  {
    number: '01',
    title: 'Real-Time Attendance & Homeroom Roll Call',
    summary:
      'Sub-minute period and homeroom roll call that syncs instantaneously to executive attendance analytics.',
    outcome: '98.4% on-time daily roll submission across partner schools',
    details:
      'Teachers mark Present, Tardy, Absent, or Excused from any classroom workstation with single-click bulk actions and structured notes. Every update propagates immediately to school administrators for early intervention.',
    deliverables: [
      'Period-by-period and homeroom roll call tables',
      'Live chronic absenteeism and rolling section benchmarks',
      'Instant audit trail tied to authenticated faculty accounts',
    ],
  },
  {
    number: '02',
    title: 'Automated Parent Notification Engine',
    summary:
      'Rule-driven SMS, Email, and App Push alerts dispatched minutes after an unexcused absence or tardy mark.',
    outcome: 'Under 4 minutes median time from absence mark to parent notice',
    details:
      'Eliminate manual morning phone trees. Schools configure custom trigger templates and delay windows once; Classytics dispatches alerts, records delivery states, and locks verified guardian replies for compliance.',
    deliverables: [
      'Configurable absence, tardy, and admissions alert templates',
      'Two-way guardian reply and acknowledgement tracking',
      'Isolated private contact storage for family phone and email PII',
    ],
  },
  {
    number: '03',
    title: 'Admissions & Atomic Enrolment Workflows',
    summary:
      'Guide prospective families from initial inquiry and campus tour straight into active homeroom rosters across academic years.',
    outcome: '42% reduction in admissions-to-enrolment administrative lag',
    details:
      'Track transcripts, immunization records, interviews, and tuition deposits in one structured multi-year pipeline. When an applicant is accepted, a single atomic workflow creates their live student record and sends a welcome confirmation.',
    deliverables: [
      'Year-by-year admissions archives alongside current-year intake',
      'Atomic enrolment synchronizing student rosters and private records',
      'Automated welcome notices to newly enrolled guardians',
    ],
  },
  {
    number: '04',
    title: 'Automated Faculty Scheduling & Coverage',
    summary:
      'Detect room double-bookings and faculty leave gaps automatically, then assign qualified substitutes in one click.',
    outcome: 'Zero unresolved period conflicts during morning bell transitions',
    details:
      'Visual Mon–Fri period timetables flag colliding classrooms and on-leave instructors automatically. The constraint-based scheduler reassigns open rooms, allocates float substitutes, and recalculates weekly teaching hours.',
    deliverables: [
      'Conflict detection across classrooms and faculty schedules',
      'One-click automated room and substitute optimization',
      'Live weekly teaching load vs. contract target monitoring',
    ],
  },
  {
    number: '05',
    title: 'Department & Staff Governance Reporting',
    summary:
      'Organize Stakeholders/Board, Administration, Teachers, and Staff by department with exportable performance reports.',
    outcome: '100% transparent faculty reviews backed by operational data',
    details:
      'Department chairs and school owners evaluate instructional and operational metrics side by side, log formal classroom observations, and export clean CSV reports for board and accreditation committees.',
    deliverables: [
      'Structured department hierarchies and staff category directories',
      'Structured observation score and parent response SLA logging',
      'One-click CSV export for academic leadership and board reviews',
    ],
  },
  {
    number: '06',
    title: 'Invite-Only Role-Based Campus Security',
    summary:
      'No open signups or consumer logins. Your Super Admin provisions scoped credentials for every role.',
    outcome: '100% verified institutional governance across students and staff',
    details:
      'Schools complete an OTP-verified Super Admin setup, then issue invite-only accounts tailored to Administrators, Teachers, Staff, and Students. Every database collection enforces strict ownership and isolated PII boundaries.',
    deliverables: [
      'OTP-verified one-time Super Admin institutional initialization',
      'Role-scoped portals for Admin, Teacher, Staff, and Student logins',
      'Instant access revocation and isolated guardian contact records',
    ],
  },
];

export interface ProgramItem {
  number: string;
  title: string;
  duration: string;
  audience: string;
  summary: string;
  outcome: string;
  curriculum: string[];
}

export const ALL_PROGRAMS: ProgramItem[] = [
  {
    number: '01',
    title: 'K–12 Attendance Turnaround Program',
    duration: '6-Week Rollout',
    audience: 'Principals & Deans of Students',
    summary:
      'A structured operational program pairing live period tracking with automated 5-minute parent SMS workflows.',
    outcome: '31% drop in chronic unexcused absences within one semester',
    curriculum: [
      'Homeroom bell-to-bell attendance policy alignment',
      'Automated SMS & email escalation rule configuration',
      'Weekly counselor intervention reviews using rolling section analytics',
    ],
  },
  {
    number: '02',
    title: 'Family Trust & Communication Track',
    duration: '4-Week Rollout',
    audience: 'Homeroom Faculty & Parent Liaisons',
    summary:
      'Standardize how teachers communicate attendance updates, tardy notices, and academic progress with guardians.',
    outcome: '89% guardian acknowledgement rate within 2 hours of dispatch',
    curriculum: [
      'Multilingual and channel-specific template design (SMS, Email, App Push)',
      'Structured guardian reply logging and closed-loop resolution',
      'Privacy-first management of family contact directories',
    ],
  },
  {
    number: '03',
    title: 'Admissions & Enrolment Acceleration Suite',
    duration: '8-Week Cycle',
    audience: 'Admissions Directors & Registrars',
    summary:
      'Replace paper folders and scattered spreadsheets with a unified digital funnel from open house to first day of class.',
    outcome: '2.3x faster transition from acceptance to live class roster',
    curriculum: [
      'Multi-year admissions intake archiving and seat forecasting',
      'Document verification and deposit milestone tracking',
      'Atomic roster provisioning and automated family onboarding',
    ],
  },
  {
    number: '04',
    title: 'Faculty Scheduling & Workload Equity Program',
    duration: 'Pre-Term Setup',
    audience: 'Academic Deans & Department Chairs',
    summary:
      'Build balanced master schedules with automated room conflict checks and on-call substitute coverage pools.',
    outcome: '14 hours saved per academic coordinator every month',
    curriculum: [
      'Master timetable import and room capacity mapping',
      'Automated leave coverage and substitute pool balancing',
      'Weekly assigned-vs-target teaching hour audits',
    ],
  },
  {
    number: '05',
    title: 'Super Admin & Governance Certification',
    duration: '2-Week Intensive',
    audience: 'School Owners & Operations Leads',
    summary:
      'Establish invite-only access governance, OTP-verified owner onboarding, and annual student/staff lifecycle audits.',
    outcome: 'Zero unauthorized accounts across multi-role school rosters',
    curriculum: [
      'One-time institution bootstrap and Super Admin handover protocol',
      'Role-based account provisioning for teachers, staff, and students',
      'End-of-term revocation and isolated PII compliance checks',
    ],
  },
  {
    number: '06',
    title: 'Student Portal & Academic Accountability Track',
    duration: 'Ongoing Term Program',
    audience: 'Upper School Students & Advisors',
    summary:
      'Equip students with invite-only visibility into their own attendance standing, homeroom assignments, and campus updates.',
    outcome: '18% improvement in student on-time arrival consistency',
    curriculum: [
      'Invite-only student onboarding during orientation',
      'Personal attendance rate visibility and advisor check-ins',
      'Structured homeroom schedule and notice clarity',
    ],
  },
];

export interface LeadershipProfile {
  name: string;
  role: string;
  bio: string;
  image: string;
  credentials: string;
}

export const LEADERSHIP_TEAM: LeadershipProfile[] = [
  {
    name: 'Dr. Claire Donovan',
    role: 'Co-Founder & Chief Academic Officer',
    bio: 'Former Head of Upper School for 16 years. Led K–12 attendance reform and parent engagement initiatives across 14 independent campuses before co-founding Classytics.',
    image: SITE_IMAGES.principal,
    credentials: 'Ed.D. Educational Leadership · 16 Years K–12 Administration',
  },
  {
    name: 'Marcus Chen',
    role: 'VP of School Systems & Scheduling',
    bio: 'Spent a decade teaching Honors Mathematics and architecting constraint-based master timetables for multi-building prep schools.',
    image: SITE_IMAGES.mathLead,
    credentials: 'M.S. Applied Mathematics · Former Department Chair',
  },
  {
    name: 'Elena Rostova',
    role: 'Head of Implementation & Campus Security',
    bio: 'Specializes in invite-only institutional identity governance, zero-trust student data privacy, and rapid faculty onboarding.',
    image: SITE_IMAGES.scienceLead,
    credentials: 'M.Ed. Curriculum Systems · Certified Data Privacy Lead',
  },
];

export interface CareerRole {
  id: string;
  title: string;
  department: 'Engineering' | 'School Onboarding' | 'Academic Advisory' | 'Operations';
  location: string;
  type: string;
  compensation: string;
  summary: string;
}

export const OPEN_ROLES: CareerRole[] = [
  {
    id: 'role_frontend',
    title: 'Senior Product Engineer, Teacher Workflows',
    department: 'Engineering',
    location: 'Tezpur, Assam or Remote (India)',
    type: 'Full-Time',
    compensation: '₹18L – ₹24L / yr',
    summary:
      'Design ultra-fast, zero-friction classroom attendance and timetable interfaces used by teachers every morning before the first bell.',
  },
  {
    id: 'role_onboarding',
    title: 'School Implementation Lead',
    department: 'School Onboarding',
    location: 'Tezpur / Guwahati Hybrid',
    type: 'Full-Time',
    compensation: '₹10L – ₹14L / yr',
    summary:
      'Guide principals, school owners, and registrars through first-time Super Admin setup, roster migration, and parent notification rules.',
  },
  {
    id: 'role_security',
    title: 'Security & Data Privacy Architect',
    department: 'Engineering',
    location: 'Remote (India)',
    type: 'Full-Time',
    compensation: '₹22L – ₹30L / yr',
    summary:
      'Own invite-only identity governance, OTP verification pipelines, and isolated guardian PII boundaries across Classytics.',
  },
  {
    id: 'role_advisor',
    title: 'K–12 Admissions & Attendance Strategist',
    department: 'Academic Advisory',
    location: 'Tezpur or Remote',
    type: 'Full-Time',
    compensation: '₹12L – ₹16L / yr',
    summary:
      'Partner directly with school heads to turn live attendance analytics and multi-year admissions funnels into measurable retention outcomes.',
  },
  {
    id: 'role_support',
    title: 'Campus Operations Specialist',
    department: 'Operations',
    location: 'Tezpur, Assam (HQ)',
    type: 'Full-Time',
    compensation: '₹7L – ₹10L / yr',
    summary:
      'Deliver responsive support during morning school hours (Mon - Fri 07:00 - 11:30 IST) for homeroom teachers and administrators.',
  },
  {
    id: 'role_data',
    title: 'Analytics & Reporting Systems Engineer',
    department: 'Engineering',
    location: 'Remote (India)',
    type: 'Full-Time',
    compensation: '₹17L – ₹23L / yr',
    summary:
      'Build real-time cohort attendance visualizations, faculty workload models, and automated board-ready reporting exports.',
  },
];
