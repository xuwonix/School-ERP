/**
 * Phase 0 Payload-First Security TDD specification for Kestrel Campus Firestore Rules.
 * Verifies all 12 adversarial payloads ("Dirty Dozen") against schema & rule invariants.
 */

export interface AdversarialCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  path: string;
  actor: {
    uid: string;
    email: string;
    emailVerified: boolean;
    isAdmin?: boolean;
  };
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
  guardEnforced: string;
}

export const DIRTY_DOZEN_CASES: AdversarialCase[] = [
  {
    id: 1,
    name: 'Self-Assigned Admin Role',
    operation: 'create',
    path: '/users/u_attacker',
    actor: { uid: 'u_attacker', email: 'eve@school.org', emailVerified: true },
    payload: {
      uid: 'u_attacker',
      displayName: 'Eve',
      role: 'admin',
      schoolName: 'Kestrel Campus',
      department: 'Admin',
      avatarUrl: '',
      seeded: false,
    },
    expected: 'PERMISSION_DENIED',
    guardEnforced: "incoming().role == 'teacher' || isAdmin()",
  },
  {
    id: 2,
    name: 'Shadow Field Injection',
    operation: 'create',
    path: '/students/stu_1',
    actor: { uid: 'u_owner', email: 'owner@school.org', emailVerified: true },
    payload: {
      firstName: 'Maya',
      lastName: 'Lin',
      studentCode: 'KC-101',
      gradeLevel: 'Grade 10',
      classId: 'cls_1',
      className: 'Honors Algebra II',
      guardianName: 'David Lin',
      preferredChannel: 'SMS',
      enrollmentStatus: 'active',
      attendanceRate: 98,
      ownerId: 'u_owner',
      assignedTeacherId: 'u_owner',
      isScholarshipApproved: true,
    },
    expected: 'PERMISSION_DENIED',
    guardEnforced: 'data.keys().hasOnly([...]) inside isValidStudent()',
  },
  {
    id: 3,
    name: 'Email Spoofing (Unverified Token)',
    operation: 'get',
    path: '/admissions/adm_1',
    actor: { uid: 'u_spoof', email: 'xuwonixweb@gmail.com', emailVerified: false },
    expected: 'PERMISSION_DENIED',
    guardEnforced: 'request.auth.token.email_verified == true inside isVerifiedUser() & isBootstrappedAdmin()',
  },
  {
    id: 4,
    name: 'PII Blanket Read on Student Guardian Contact',
    operation: 'get',
    path: '/students/stu_1/private/contact',
    actor: { uid: 'u_other', email: 'other@school.org', emailVerified: true },
    expected: 'PERMISSION_DENIED',
    guardEnforced: 'Master Gate parent get(/students/stu_1).data.ownerId == request.auth.uid',
  },
  {
    id: 5,
    name: 'Owner Spoofing on Class Create',
    operation: 'create',
    path: '/classes/cls_spoof',
    actor: { uid: 'u_attacker', email: 'eve@school.org', emailVerified: true },
    payload: {
      name: 'Fake Class',
      code: 'FAKE-1',
      gradeLevel: 'Grade 9',
      room: '101',
      scheduleSlot: 'Mon 08:00',
      teacherName: 'Eve',
      teacherStaffId: 'stf_1',
      assignedTeacherId: 'u_attacker',
      capacity: 25,
      ownerId: 'u_victim',
    },
    expected: 'PERMISSION_DENIED',
    guardEnforced: 'incoming().ownerId == request.auth.uid',
  },
  {
    id: 6,
    name: 'Orphaned Attendance Record',
    operation: 'create',
    path: '/attendanceRecords/att_orphan',
    actor: { uid: 'u_owner', email: 'owner@school.org', emailVerified: true },
    payload: {
      studentId: 'stu_nonexistent',
      studentName: 'Ghost',
      classId: 'cls_1',
      className: 'Algebra',
      date: '2026-11-21',
      period: 'Period 1',
      status: 'absent',
      note: '',
      notifiedParent: false,
      recordedByUid: 'u_owner',
      ownerId: 'u_owner',
      assignedTeacherId: 'u_owner',
    },
    expected: 'PERMISSION_DENIED',
    guardEnforced: 'exists(/databases/$(database)/documents/students/$(incoming().studentId))',
  },
  {
    id: 7,
    name: 'Non-Atomic Enrolment Transition',
    operation: 'update',
    path: '/admissions/adm_1',
    actor: { uid: 'u_owner', email: 'owner@school.org', emailVerified: true },
    payload: {
      stage: 'enrolled',
      enrolledStudentId: 'stu_never_created',
    },
    expected: 'PERMISSION_DENIED',
    guardEnforced: 'existsAfter(/databases/$(database)/documents/students/$(incoming().enrolledStudentId))',
  },
  {
    id: 8,
    name: 'Terminal State Bypass on Enrolled Admission',
    operation: 'update',
    path: '/admissions/adm_enrolled',
    actor: { uid: 'u_owner', email: 'owner@school.org', emailVerified: true },
    payload: {
      stage: 'inquiry',
    },
    expected: 'PERMISSION_DENIED',
    guardEnforced: "!(existing().stage in ['enrolled', 'declined']) || isAdmin()",
  },
  {
    id: 9,
    name: 'Document ID Poisoning',
    operation: 'create',
    path: '/staff/' + 'x'.repeat(180) + '$$$',
    actor: { uid: 'u_owner', email: 'owner@school.org', emailVerified: true },
    payload: { fullName: 'Oversized ID' },
    expected: 'PERMISSION_DENIED',
    guardEnforced: "isValidId(staffId) -> size() <= 128 && matches('^[a-zA-Z0-9_\\\\-]+$')",
  },
  {
    id: 10,
    name: 'Value Poisoning on Whitelisted Update Field',
    operation: 'update',
    path: '/attendanceRecords/att_1',
    actor: { uid: 'u_teacher', email: 'teacher@school.org', emailVerified: true },
    payload: {
      note: 'A'.repeat(1200),
    },
    expected: 'PERMISSION_DENIED',
    guardEnforced: 'isValidAttendanceRecord(incoming()) enforces note.size() <= 300',
  },
  {
    id: 11,
    name: 'Timestamp Forgery',
    operation: 'create',
    path: '/notificationRules/rule_backdated',
    actor: { uid: 'u_owner', email: 'owner@school.org', emailVerified: true },
    payload: {
      name: 'Backdated Rule',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
    guardEnforced: 'incoming().createdAt == request.time && incoming().updatedAt == request.time',
  },
  {
    id: 12,
    name: 'Unauthorized List Scraping',
    operation: 'list',
    path: '/students',
    actor: { uid: 'u_other', email: 'other@school.org', emailVerified: true },
    expected: 'PERMISSION_DENIED',
    guardEnforced: 'resource.data.ownerId == request.auth.uid || resource.data.assignedTeacherId == request.auth.uid || isBootstrappedAdmin()',
  },
];
