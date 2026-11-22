import { Timestamp } from 'firebase/firestore';

export type UserRole = 'super_admin' | 'admin' | 'board' | 'teacher' | 'staff' | 'student';
export type ProvisionedRole = 'admin' | 'board' | 'teacher' | 'staff' | 'student';
export type AccountStatus = 'active' | 'suspended';
export type StaffCategory = 'stakeholder' | 'administration' | 'teacher' | 'staff';
export type DepartmentCategory = 'Academic' | 'Administrative' | 'Operations' | 'Governance';
export type NotificationChannel = 'SMS' | 'Email' | 'App Push';
export type AttendanceStatus = 'present' | 'tardy' | 'absent' | 'excused';
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'acknowledged';
export type NotificationTriggerType =
  | 'auto_absence'
  | 'auto_tardy'
  | 'admission_update'
  | 'teacher_direct'
  | 'attendance_summary';
export type RuleTriggerEvent =
  | 'absent'
  | 'tardy'
  | 'consecutive_absences'
  | 'admission_stage_change';
export type AdmissionStage =
  | 'inquiry'
  | 'tour_scheduled'
  | 'documents_review'
  | 'accepted'
  | 'enrolled'
  | 'declined';
export type EmploymentType = 'Full-Time' | 'Part-Time' | 'Substitute';
export type StaffStatus = 'active' | 'on_leave' | 'inactive';
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
export type ScheduleStatus = 'scheduled' | 'conflict' | 'substitute_needed';

export type PublicPage =
  | 'home'
  | 'about'
  | 'services'
  | 'programs'
  | 'contact'
  | 'career'
  | 'login'
  | 'setup';

export interface InstitutionConfig {
  setupComplete: boolean;
  superAdminUid: string;
  schoolName: string;
  schoolCode: string;
  schoolAddress: string;
  schoolOwner: string;
  ownerUsername: string;
  emailOtpVerified: boolean;
  phoneOtpVerified: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserProfile {
  uid: string;
  ownerId: string;
  displayName: string;
  username: string;
  role: UserRole;
  schoolName: string;
  department: string;
  avatarUrl: string;
  accountStatus: AccountStatus;
  seeded: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  category: DepartmentCategory;
  headName: string;
  description: string;
  status: 'active' | 'inactive';
  boardViewerUids?: string[];
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface RoleInvite {
  id: string;
  targetUid: string;
  fullName: string;
  role: ProvisionedRole;
  department: string;
  status: 'active' | 'revoked';
  createdByUid: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ContactInquiry {
  id: string;
  fullName: string;
  institutionName: string;
  workEmail: string;
  phone: string;
  topic: 'Demo Request' | 'Admissions Suite' | 'District Rollout' | 'Technical Support' | 'Partnership';
  message: string;
  status: 'new' | 'reviewed' | 'archived';
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CareerApplication {
  id: string;
  applicantName: string;
  email: string;
  roleTitle: string;
  department: string;
  portfolioUrl: string;
  coverNote: string;
  status: 'submitted' | 'reviewing' | 'closed';
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SchoolClass {
  id: string;
  name: string;
  code: string;
  gradeLevel: string;
  room: string;
  scheduleSlot: string;
  teacherName: string;
  teacherStaffId: string;
  assignedTeacherId: string;
  capacity: number;
  boardViewerUids?: string[];
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  gradeLevel: string;
  classId: string;
  className: string;
  guardianName: string;
  preferredChannel: NotificationChannel;
  enrollmentStatus: 'active' | 'probation' | 'transferred' | 'graduated';
  attendanceRate: number;
  linkedUserUid: string;
  boardViewerUids?: string[];
  ownerId: string;
  assignedTeacherId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StudentGuardianPrivate {
  guardianEmail: string;
  guardianPhone: string;
  emergencyNotes: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  date: string;
  period: string;
  status: AttendanceStatus;
  note: string;
  notifiedParent: boolean;
  recordedByUid: string;
  ownerId: string;
  assignedTeacherId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ParentNotification {
  id: string;
  studentId: string;
  studentName: string;
  guardianName: string;
  classId: string;
  channel: NotificationChannel;
  triggerType: NotificationTriggerType;
  subject: string;
  message: string;
  deliveryStatus: DeliveryStatus;
  parentReply: string;
  ownerId: string;
  assignedTeacherId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface NotificationRule {
  id: string;
  name: string;
  triggerEvent: RuleTriggerEvent;
  channel: NotificationChannel;
  delayMinutes: number;
  templateText: string;
  enabled: boolean;
  teacherViewerUids?: string[];
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AdmissionApplication {
  id: string;
  applicantName: string;
  gradeApplying: string;
  admissionYear: number;
  guardianName: string;
  previousSchool: string;
  stage: AdmissionStage;
  documentsVerified: boolean;
  tuitionDepositPaid: boolean;
  interviewDate: string;
  notes: string;
  targetClassId: string;
  enrolledStudentId: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AdmissionPrivateContact {
  guardianEmail: string;
  guardianPhone: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StaffMember {
  id: string;
  fullName: string;
  roleTitle: string;
  department: string;
  staffCategory: StaffCategory;
  employmentType: EmploymentType;
  status: StaffStatus;
  avatarUrl: string;
  weeklyHoursTarget: number;
  assignedHours: number;
  attendanceSubmissionRate: number;
  parentResponseMinutes: number;
  observationScore: number;
  linkedUserUid?: string;
  boardViewerUids?: string[];
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ScheduleBlock {
  id: string;
  staffId: string;
  staffName: string;
  classId: string;
  className: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  room: string;
  subject: string;
  status: ScheduleStatus;
  assignedTeacherId?: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type FinancialEntryType = 'revenue' | 'expense';
export type FinancialCategory =
  | 'Tuition Fees'
  | 'Admission Fees'
  | 'Grants & Endowment'
  | 'Transport & Lab Fees'
  | 'Faculty Payroll'
  | 'Campus Operations'
  | 'Academic Resources'
  | 'Scholarships & Aid';
export type FinancialStatus = 'collected' | 'pending' | 'disbursed' | 'scheduled';

export interface FinancialRecord {
  id: string;
  fiscalYear: string;
  month: string;
  monthLabel: string;
  entryType: FinancialEntryType;
  category: FinancialCategory;
  department: string;
  amount: number;
  budgetedAmount: number;
  status: FinancialStatus;
  notes: string;
  boardViewerUids: string[];
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ActiveView =
  | 'dashboard'
  | 'school'
  | 'departments'
  | 'staff'
  | 'admissions'
  | 'analytics'
  | 'attendance'
  | 'communications';

export type BoardView = 'financial' | 'students' | 'teachers';

export type TeacherView = 'overview' | 'attendance' | 'students' | 'communications' | 'schedule';

export type WorkspaceMode = 'admin' | 'teacher';
