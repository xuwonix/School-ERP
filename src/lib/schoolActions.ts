import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, provisionerAuth } from '../firebase';
import {
  AdmissionApplication,
  AdmissionPrivateContact,
  AdmissionStage,
  AttendanceRecord,
  AttendanceStatus,
  ContactInquiry,
  DayOfWeek,
  DepartmentCategory,
  EmploymentType,
  FinancialCategory,
  FinancialEntryType,
  FinancialStatus,
  NotificationChannel,
  NotificationRule,
  ProvisionedRole,
  RuleTriggerEvent,
  ScheduleBlock,
  SchoolClass,
  StaffCategory,
  StaffMember,
  StaffStatus,
  Student,
  StudentGuardianPrivate,
} from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';
import {
  clampNumber,
  generateSafeId,
  sanitizeCode,
  sanitizeOptionalText,
  sanitizeText,
} from './validation';

function renderTemplate(
  template: string,
  vars: { studentName: string; className: string; date: string }
): string {
  return template
    .replaceAll('{{studentName}}', vars.studentName)
    .replaceAll('{{className}}', vars.className)
    .replaceAll('{{date}}', vars.date);
}

/**
 * One-time First-Run Institution Setup:
 * Creates the Super Admin Email/Password credential, claims /institution/config atomically
 * with verified Email & Phone OTP flags, and creates /admins/{uid} and /users/{uid}.
 * Starts with a clean database (zero hardcoded demo records).
 */
export async function completeFirstTimeSetup(params: {
  schoolName: string;
  schoolAddress: string;
  schoolOwner: string;
  ownerEmail: string;
  ownerUsername: string;
  password: string;
  contactNo: string;
  emailOtpVerified: boolean;
  phoneOtpVerified: boolean;
}): Promise<void> {
  if (!params.emailOtpVerified || !params.phoneOtpVerified) {
    throw new Error('Both Email OTP and Contact Number OTP must be verified before setup.');
  }

  const safeSchoolName = sanitizeText(params.schoolName, 120, 'Classytics Academy');
  const initials = safeSchoolName
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, '')[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 4);
  const safeSchoolCode = sanitizeCode(
    `${initials || 'CLS'}-${new Date().getFullYear()}`,
    24,
    `CLS-${new Date().getFullYear()}`
  );
  const safeSchoolAddress = sanitizeText(params.schoolAddress, 240, 'L.B Road, Tezpur, Assam');
  const safeSchoolOwner = sanitizeText(params.schoolOwner, 100, 'School Owner');
  const safeEmail = sanitizeText(params.ownerEmail, 160, '');
  const safePhone = sanitizeText(params.contactNo, 40, '');
  const safeUsername = params.ownerUsername
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 48);

  const cred = await createUserWithEmailAndPassword(auth, safeEmail, params.password);
  const uid = cred.user.uid;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'institution', 'config'), {
      setupComplete: true,
      superAdminUid: uid,
      schoolName: safeSchoolName,
      schoolCode: safeSchoolCode,
      schoolAddress: safeSchoolAddress,
      schoolOwner: safeSchoolOwner,
      ownerUsername: safeUsername || 'superadmin',
      emailOtpVerified: true,
      phoneOtpVerified: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'admins', uid), {
      uid,
      grantedBy: 'initial_setup',
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', uid), {
      uid,
      ownerId: uid,
      displayName: safeSchoolOwner,
      username: safeUsername || 'superadmin',
      role: 'super_admin',
      schoolName: safeSchoolName,
      department: 'Board & Governance',
      avatarUrl: '',
      accountStatus: 'active',
      seeded: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', uid, 'private', 'info'), {
      uid,
      email: safeEmail,
      phone: safePhone,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'institution/config');
  }
}

export async function updateInstitutionProfile(params: {
  schoolName: string;
  schoolAddress: string;
  schoolOwner: string;
  schoolCode: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'institution', 'config'), {
      schoolName: sanitizeText(params.schoolName, 120, 'Classytics Academy'),
      schoolAddress: sanitizeText(params.schoolAddress, 240, 'L.B Road, Tezpur, Assam'),
      schoolOwner: sanitizeText(params.schoolOwner, 100, 'School Owner'),
      schoolCode: sanitizeCode(params.schoolCode, 24, 'CLS-2026'),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'institution/config');
  }
}

export async function createDepartment(params: {
  uid: string;
  name: string;
  code: string;
  category: DepartmentCategory;
  headName: string;
  description: string;
  boardViewerUids?: string[];
  assignExistingTeacherIds?: string[];
  linkedUserUidsByStaffId?: Record<string, string>;
}): Promise<string> {
  const deptId = generateSafeId('dept');
  const safeName = sanitizeText(params.name, 100, 'Department');
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'departments', deptId), {
      name: safeName,
      code: sanitizeCode(params.code, 24, 'DEPT-01'),
      category: params.category,
      headName: sanitizeText(params.headName, 100, 'Department Chair'),
      description: sanitizeOptionalText(params.description, 300),
      status: 'active',
      boardViewerUids: (params.boardViewerUids || []).slice(0, 25),
      ownerId: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const staffId of params.assignExistingTeacherIds || []) {
      batch.update(doc(db, 'staff', staffId), {
        department: safeName.slice(0, 80),
        updatedAt: serverTimestamp(),
      });
      const linkedUid = params.linkedUserUidsByStaffId?.[staffId];
      if (linkedUid) {
        batch.update(doc(db, 'users', linkedUid), {
          department: safeName.slice(0, 80),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
    return deptId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `departments/${deptId}`);
  }
}

export async function assignExistingTeachersToDepartment(params: {
  departmentName: string;
  staffIds: string[];
  linkedUserUidsByStaffId?: Record<string, string>;
}): Promise<void> {
  const safeDept = sanitizeText(params.departmentName, 80, 'Department');
  if (params.staffIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const staffId of params.staffIds) {
      batch.update(doc(db, 'staff', staffId), {
        department: safeDept,
        updatedAt: serverTimestamp(),
      });
      const linkedUid = params.linkedUserUidsByStaffId?.[staffId];
      if (linkedUid) {
        batch.update(doc(db, 'users', linkedUid), {
          department: safeDept,
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'staff/department_assign');
  }
}

export async function toggleDepartmentStatus(
  departmentId: string,
  nextStatus: 'active' | 'inactive'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'departments', departmentId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `departments/${departmentId}`);
  }
}

export interface BoardSyncResourceIds {
  financialRecordIds: string[];
  studentIds: string[];
  staffIds: string[];
  classIds: string[];
  departmentIds: string[];
}

export interface TeacherSyncResourceIds {
  attendanceRecordIds: string[];
  notificationIds: string[];
  scheduleIds: string[];
  notificationRuleIds: string[];
}

export async function createFinancialRecord(params: {
  uid: string;
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
  boardViewerUids?: string[];
}): Promise<void> {
  const recordId = generateSafeId('fin');
  const safeMonth = /^[0-9]{4}-[0-9]{2}$/.test(params.month)
    ? params.month
    : new Date().toISOString().slice(0, 7);
  try {
    await setDoc(doc(db, 'financialRecords', recordId), {
      fiscalYear: sanitizeText(params.fiscalYear, 16, 'FY 2025-26'),
      month: safeMonth,
      monthLabel: sanitizeText(params.monthLabel, 20, safeMonth),
      entryType: params.entryType,
      category: params.category,
      department: sanitizeText(params.department, 80, 'Administration'),
      amount: clampNumber(Math.round(params.amount), 0, 100000000),
      budgetedAmount: clampNumber(Math.round(params.budgetedAmount), 0, 100000000),
      status: params.status,
      notes: sanitizeOptionalText(params.notes, 300),
      boardViewerUids: (params.boardViewerUids || []).slice(0, 25),
      ownerId: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `financialRecords/${recordId}`);
  }
}

/**
 * Super Admin Invite-Only Account Provisioning:
 * Uses secondary provisionerAuth so the Super Admin remains signed in.
 * Never persists plaintext passwords in Firestore.
 */
export async function provisionInvitedRoleAccount(params: {
  superAdminUid: string;
  schoolName: string;
  fullName: string;
  email: string;
  tempPassword: string;
  role: ProvisionedRole;
  department: string;
  assignClassId?: string;
  assignedStudentIds?: string[];
  linkStudentId?: string;
  existingStaffId?: string;
  createStaffRecord?: {
    roleTitle: string;
    staffCategory: StaffCategory;
    employmentType: EmploymentType;
    weeklyHoursTarget: number;
    activeBoardUids?: string[];
  };
  boardSyncIds?: BoardSyncResourceIds;
  teacherSyncIds?: TeacherSyncResourceIds;
}): Promise<{ targetUid: string; inviteId: string; staffId?: string }> {
  const safeName = sanitizeText(params.fullName, 100, 'Campus Member');
  const safeEmail = sanitizeText(params.email, 160, '');
  const safeDept = sanitizeText(params.department, 80, 'General');
  const safeSchool = sanitizeText(params.schoolName, 120, 'Classytics');
  const autoUsername = `${params.role}.${safeName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user'}`.slice(0, 48);

  const cred = await createUserWithEmailAndPassword(
    provisionerAuth,
    safeEmail,
    params.tempPassword
  );
  const targetUid = cred.user.uid;
  await firebaseSignOut(provisionerAuth);

  const inviteId = generateSafeId('inv');
  const createdStaffId = params.createStaffRecord ? generateSafeId('stf') : undefined;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', targetUid), {
      uid: targetUid,
      ownerId: params.superAdminUid,
      displayName: safeName,
      username: autoUsername,
      role: params.role,
      schoolName: safeSchool,
      department: safeDept,
      avatarUrl: '',
      accountStatus: 'active',
      seeded: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', targetUid, 'private', 'info'), {
      uid: targetUid,
      email: safeEmail,
      phone: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'invites', inviteId), {
      targetUid,
      fullName: safeName,
      role: params.role,
      department: safeDept,
      status: 'active',
      createdByUid: params.superAdminUid,
      ownerId: params.superAdminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.createStaffRecord && createdStaffId) {
      const boardList = Array.from(
        new Set([
          ...(params.createStaffRecord.activeBoardUids || []),
          ...(params.role === 'board' ? [targetUid] : []),
        ])
      ).slice(0, 25);

      batch.set(doc(db, 'staff', createdStaffId), {
        fullName: safeName,
        roleTitle: sanitizeText(params.createStaffRecord.roleTitle, 80, 'Staff Member'),
        department: safeDept,
        staffCategory: params.createStaffRecord.staffCategory,
        employmentType: params.createStaffRecord.employmentType,
        status: 'active',
        avatarUrl: '',
        weeklyHoursTarget: clampNumber(
          Math.round(params.createStaffRecord.weeklyHoursTarget),
          0,
          60
        ),
        assignedHours: 0,
        attendanceSubmissionRate: 100,
        parentResponseMinutes: 20,
        observationScore: 92,
        linkedUserUid: targetUid,
        boardViewerUids: boardList,
        ownerId: params.superAdminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (params.existingStaffId) {
      batch.update(doc(db, 'staff', params.existingStaffId), {
        linkedUserUid: targetUid,
        updatedAt: serverTimestamp(),
      });
    }

    if (params.role === 'admin') {
      batch.set(doc(db, 'admins', targetUid), {
        uid: targetUid,
        grantedBy: params.superAdminUid,
        createdAt: serverTimestamp(),
      });
    }

    if (params.role === 'board' && params.boardSyncIds) {
      const { financialRecordIds, studentIds, staffIds, classIds, departmentIds } =
        params.boardSyncIds;
      for (const fid of financialRecordIds) {
        batch.update(doc(db, 'financialRecords', fid), {
          boardViewerUids: arrayUnion(targetUid),
          updatedAt: serverTimestamp(),
        });
      }
      for (const sid of studentIds) {
        batch.update(doc(db, 'students', sid), {
          boardViewerUids: arrayUnion(targetUid),
          updatedAt: serverTimestamp(),
        });
      }
      for (const stid of staffIds) {
        batch.update(doc(db, 'staff', stid), {
          boardViewerUids: arrayUnion(targetUid),
          updatedAt: serverTimestamp(),
        });
      }
      for (const cid of classIds) {
        batch.update(doc(db, 'classes', cid), {
          boardViewerUids: arrayUnion(targetUid),
          updatedAt: serverTimestamp(),
        });
      }
      for (const did of departmentIds) {
        batch.update(doc(db, 'departments', did), {
          boardViewerUids: arrayUnion(targetUid),
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Only Teachers are assigned a Primary Homeroom Section
    if (params.role === 'teacher' && params.assignClassId) {
      batch.update(doc(db, 'classes', params.assignClassId), {
        assignedTeacherId: targetUid,
        updatedAt: serverTimestamp(),
      });
      for (const sid of params.assignedStudentIds || []) {
        batch.update(doc(db, 'students', sid), {
          assignedTeacherId: targetUid,
          updatedAt: serverTimestamp(),
        });
      }
      if (params.teacherSyncIds) {
        for (const aid of params.teacherSyncIds.attendanceRecordIds) {
          batch.update(doc(db, 'attendanceRecords', aid), {
            assignedTeacherId: targetUid,
            updatedAt: serverTimestamp(),
          });
        }
        for (const nid of params.teacherSyncIds.notificationIds) {
          batch.update(doc(db, 'notifications', nid), {
            assignedTeacherId: targetUid,
            updatedAt: serverTimestamp(),
          });
        }
        for (const scid of params.teacherSyncIds.scheduleIds) {
          batch.update(doc(db, 'schedules', scid), {
            assignedTeacherId: targetUid,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    if (
      (params.role === 'teacher' || params.role === 'staff') &&
      params.teacherSyncIds?.notificationRuleIds.length
    ) {
      for (const rid of params.teacherSyncIds.notificationRuleIds) {
        batch.update(doc(db, 'notificationRules', rid), {
          teacherViewerUids: arrayUnion(targetUid),
          updatedAt: serverTimestamp(),
        });
      }
    }

    if (params.role === 'student' && params.linkStudentId) {
      batch.update(doc(db, 'students', params.linkStudentId), {
        linkedUserUid: targetUid,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return { targetUid, inviteId, staffId: createdStaffId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `invites/${inviteId}`);
  }
}

export async function toggleRoleInviteStatus(
  inviteId: string,
  targetUid: string,
  nextActive: boolean,
  role?: ProvisionedRole,
  boardSyncIds?: BoardSyncResourceIds,
  teacherRuleIds?: string[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'invites', inviteId), {
      status: nextActive ? 'active' : 'revoked',
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', targetUid), {
      accountStatus: nextActive ? 'active' : 'suspended',
      updatedAt: serverTimestamp(),
    });

    if (role === 'board' && boardSyncIds) {
      const op = nextActive ? arrayUnion(targetUid) : arrayRemove(targetUid);
      for (const fid of boardSyncIds.financialRecordIds) {
        batch.update(doc(db, 'financialRecords', fid), {
          boardViewerUids: op,
          updatedAt: serverTimestamp(),
        });
      }
      for (const sid of boardSyncIds.studentIds) {
        batch.update(doc(db, 'students', sid), {
          boardViewerUids: op,
          updatedAt: serverTimestamp(),
        });
      }
      for (const stid of boardSyncIds.staffIds) {
        batch.update(doc(db, 'staff', stid), {
          boardViewerUids: op,
          updatedAt: serverTimestamp(),
        });
      }
      for (const cid of boardSyncIds.classIds) {
        batch.update(doc(db, 'classes', cid), {
          boardViewerUids: op,
          updatedAt: serverTimestamp(),
        });
      }
      for (const did of boardSyncIds.departmentIds) {
        batch.update(doc(db, 'departments', did), {
          boardViewerUids: op,
          updatedAt: serverTimestamp(),
        });
      }
    }

    if ((role === 'teacher' || role === 'staff') && teacherRuleIds && teacherRuleIds.length > 0) {
      const op = nextActive ? arrayUnion(targetUid) : arrayRemove(targetUid);
      for (const rid of teacherRuleIds) {
        batch.update(doc(db, 'notificationRules', rid), {
          teacherViewerUids: op,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `invites/${inviteId}`);
  }
}

/**
 * Public Contact Us Lead Submission
 */
export async function submitContactInquiry(params: {
  ownerId: string;
  fullName: string;
  institutionName: string;
  workEmail: string;
  phone: string;
  topic: ContactInquiry['topic'];
  message: string;
}): Promise<void> {
  const inquiryId = generateSafeId('inq');
  try {
    await setDoc(doc(db, 'contactInquiries', inquiryId), {
      fullName: sanitizeText(params.fullName, 100, 'Visitor'),
      institutionName: sanitizeText(params.institutionName, 120, 'School'),
      workEmail: sanitizeText(params.workEmail, 160, 'contact@school.org'),
      phone: sanitizeOptionalText(params.phone, 40),
      topic: params.topic,
      message: sanitizeText(params.message, 1500, 'Requesting information.'),
      status: 'new',
      ownerId: params.ownerId || 'public_intake',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `contactInquiries/${inquiryId}`);
  }
}

/**
 * Public Career Application Submission
 */
export async function submitCareerApplication(params: {
  ownerId: string;
  applicantName: string;
  email: string;
  roleTitle: string;
  department: string;
  portfolioUrl: string;
  coverNote: string;
}): Promise<void> {
  const appId = generateSafeId('car');
  try {
    await setDoc(doc(db, 'careerApplications', appId), {
      applicantName: sanitizeText(params.applicantName, 100, 'Applicant'),
      email: sanitizeText(params.email, 160, 'candidate@example.org'),
      roleTitle: sanitizeText(params.roleTitle, 120, 'Open Position'),
      department: sanitizeText(params.department, 80, 'General'),
      portfolioUrl: sanitizeOptionalText(params.portfolioUrl, 300),
      coverNote: sanitizeText(params.coverNote, 1500, 'Interested in joining Classytics.'),
      status: 'submitted',
      ownerId: params.ownerId || 'public_intake',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `careerApplications/${appId}`);
  }
}

/**
 * Records or updates a student's attendance for a date + period and automatically
 * dispatches a parent notification if an active automation rule matches.
 */
export async function recordStudentAttendance(params: {
  uid: string;
  student: Student;
  date: string;
  period: string;
  status: AttendanceStatus;
  note: string;
  existingRecord?: AttendanceRecord;
  rules: NotificationRule[];
}): Promise<{ autoNotified: boolean; ruleName?: string }> {
  const { uid, student, date, period, status, note, existingRecord, rules } = params;
  const safePeriod = sanitizeText(period, 32, 'Homeroom');
  const safeNote = sanitizeOptionalText(note, 300);
  const recordId =
    existingRecord?.id ||
    `${student.id}_${date.replace(/-/g, '')}_${safePeriod.replace(/[^a-zA-Z0-9]/g, '')}`;

  const matchingRule =
    status === 'absent' || status === 'tardy'
      ? rules.find((r) => r.enabled && r.triggerEvent === status)
      : undefined;

  const shouldNotify = Boolean(
    matchingRule && (!existingRecord || existingRecord.status !== status)
  );

  const studentFullName = `${student.firstName} ${student.lastName}`;

  try {
    if (existingRecord) {
      await updateDoc(doc(db, 'attendanceRecords', recordId), {
        status,
        note: safeNote,
        notifiedParent: existingRecord.notifiedParent || shouldNotify,
        recordedByUid: uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'attendanceRecords', recordId), {
        studentId: student.id,
        studentName: sanitizeText(studentFullName, 120, 'Student'),
        classId: student.classId,
        className: sanitizeText(student.className, 100, 'Class'),
        date,
        period: safePeriod,
        status,
        note: safeNote,
        notifiedParent: shouldNotify,
        recordedByUid: uid,
        ownerId: student.ownerId,
        assignedTeacherId: student.assignedTeacherId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existingRecord ? OperationType.UPDATE : OperationType.CREATE,
      `attendanceRecords/${recordId}`
    );
  }

  if (shouldNotify && matchingRule) {
    const notifId = generateSafeId('ntf');
    const message = sanitizeText(
      renderTemplate(matchingRule.templateText, {
        studentName: studentFullName,
        className: student.className,
        date,
      }),
      1000,
      `Attendance alert for ${studentFullName}`
    );
    const subject = sanitizeText(
      `${status === 'absent' ? 'Absence Alert' : 'Tardy Notice'}: ${studentFullName} (${date})`,
      140,
      'Attendance Alert'
    );

    try {
      await setDoc(doc(db, 'notifications', notifId), {
        studentId: student.id,
        studentName: sanitizeText(studentFullName, 120, 'Student'),
        guardianName: sanitizeText(student.guardianName, 100, 'Guardian'),
        classId: student.classId,
        channel: matchingRule.channel,
        triggerType: status === 'absent' ? 'auto_absence' : 'auto_tardy',
        subject,
        message,
        deliveryStatus: 'sent',
        parentReply: '',
        ownerId: student.ownerId,
        assignedTeacherId: student.assignedTeacherId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { autoNotified: true, ruleName: matchingRule.name };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
    }
  }

  return { autoNotified: false };
}

export async function markRemainingStudentsPresent(params: {
  uid: string;
  students: Student[];
  existingByStudentId: Map<string, AttendanceRecord>;
  date: string;
  period: string;
}): Promise<number> {
  const { uid, students, existingByStudentId, date, period } = params;
  const safePeriod = sanitizeText(period, 32, 'Homeroom');
  const unmarked = students.filter((st) => !existingByStudentId.has(st.id));
  if (unmarked.length === 0) return 0;

  try {
    const batch = writeBatch(db);
    for (const student of unmarked) {
      const recordId = `${student.id}_${date.replace(/-/g, '')}_${safePeriod.replace(/[^a-zA-Z0-9]/g, '')}`;
      batch.set(doc(db, 'attendanceRecords', recordId), {
        studentId: student.id,
        studentName: sanitizeText(`${student.firstName} ${student.lastName}`, 120, 'Student'),
        classId: student.classId,
        className: sanitizeText(student.className, 100, 'Class'),
        date,
        period: safePeriod,
        status: 'present',
        note: '',
        notifiedParent: false,
        recordedByUid: uid,
        ownerId: student.ownerId,
        assignedTeacherId: student.assignedTeacherId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return unmarked.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'attendanceRecords/batch_present');
  }
}

export async function fetchStudentPrivateContact(
  studentId: string
): Promise<StudentGuardianPrivate | null> {
  const path = `students/${studentId}/private/contact`;
  try {
    const snap = await getDoc(doc(db, 'students', studentId, 'private', 'contact'));
    return snap.exists() ? (snap.data() as StudentGuardianPrivate) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchAdmissionPrivateContact(
  applicationId: string
): Promise<AdmissionPrivateContact | null> {
  const path = `admissions/${applicationId}/private/contact`;
  try {
    const snap = await getDoc(doc(db, 'admissions', applicationId, 'private', 'contact'));
    return snap.exists() ? (snap.data() as AdmissionPrivateContact) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function sendDirectParentNotification(params: {
  student: Student;
  channel: NotificationChannel;
  subject: string;
  message: string;
}): Promise<void> {
  const notifId = generateSafeId('ntf');
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      studentId: params.student.id,
      studentName: sanitizeText(
        `${params.student.firstName} ${params.student.lastName}`,
        120,
        'Student'
      ),
      guardianName: sanitizeText(params.student.guardianName, 100, 'Guardian'),
      classId: params.student.classId,
      channel: params.channel,
      triggerType: 'teacher_direct',
      subject: sanitizeText(params.subject, 140, 'School Message'),
      message: sanitizeText(params.message, 1000, 'Please contact the school office.'),
      deliveryStatus: 'sent',
      parentReply: '',
      ownerId: params.student.ownerId,
      assignedTeacherId: params.student.assignedTeacherId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
  }
}

export async function acknowledgeParentNotification(
  notificationId: string,
  parentReply: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      deliveryStatus: 'acknowledged',
      parentReply: sanitizeOptionalText(parentReply, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function toggleNotificationRule(
  ruleId: string,
  enabled: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'notificationRules', ruleId), {
      enabled,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notificationRules/${ruleId}`);
  }
}

export async function createNotificationRule(params: {
  uid: string;
  name: string;
  triggerEvent: RuleTriggerEvent;
  channel: NotificationChannel;
  delayMinutes: number;
  templateText: string;
  teacherViewerUids?: string[];
}): Promise<void> {
  const ruleId = generateSafeId('rule');
  try {
    await setDoc(doc(db, 'notificationRules', ruleId), {
      name: sanitizeText(params.name, 120, 'Notification Rule'),
      triggerEvent: params.triggerEvent,
      channel: params.channel,
      delayMinutes: clampNumber(Math.round(params.delayMinutes), 0, 1440),
      templateText: sanitizeText(params.templateText, 600, 'Attendance notification'),
      enabled: true,
      teacherViewerUids: (params.teacherViewerUids || []).slice(0, 50),
      ownerId: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notificationRules/${ruleId}`);
  }
}

export async function createAdmissionApplication(params: {
  uid: string;
  applicantName: string;
  gradeApplying: string;
  admissionYear?: number;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  previousSchool: string;
  targetClassId: string;
  interviewDate: string;
  notes: string;
}): Promise<void> {
  const appId = generateSafeId('adm');
  const year = clampNumber(
    Math.round(params.admissionYear || new Date().getFullYear()),
    2020,
    2035
  );
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'admissions', appId), {
      applicantName: sanitizeText(params.applicantName, 120, 'Applicant'),
      gradeApplying: sanitizeText(params.gradeApplying, 30, 'Grade 9'),
      admissionYear: year,
      guardianName: sanitizeText(params.guardianName, 100, 'Guardian'),
      previousSchool: sanitizeText(params.previousSchool, 120, 'Independent School'),
      stage: 'inquiry',
      documentsVerified: false,
      tuitionDepositPaid: false,
      interviewDate: sanitizeOptionalText(params.interviewDate, 32),
      notes: sanitizeOptionalText(params.notes, 500),
      targetClassId: params.targetClassId,
      enrolledStudentId: '',
      ownerId: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'admissions', appId, 'private', 'contact'), {
      guardianEmail: sanitizeText(params.guardianEmail, 160, 'guardian@familymail.org'),
      guardianPhone: sanitizeText(params.guardianPhone, 40, '+91 98640 00000'),
      ownerId: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `admissions/${appId}`);
  }
}

export async function updateAdmissionProgress(
  applicationId: string,
  updates: {
    stage?: Exclude<AdmissionStage, 'enrolled'>;
    documentsVerified?: boolean;
    tuitionDepositPaid?: boolean;
    interviewDate?: string;
    notes?: string;
  }
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.stage !== undefined) payload.stage = updates.stage;
  if (updates.documentsVerified !== undefined)
    payload.documentsVerified = updates.documentsVerified;
  if (updates.tuitionDepositPaid !== undefined)
    payload.tuitionDepositPaid = updates.tuitionDepositPaid;
  if (updates.interviewDate !== undefined)
    payload.interviewDate = sanitizeOptionalText(updates.interviewDate, 32);
  if (updates.notes !== undefined)
    payload.notes = sanitizeOptionalText(updates.notes, 500);

  try {
    await updateDoc(doc(db, 'admissions', applicationId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `admissions/${applicationId}`);
  }
}

export async function completeAtomicEnrolment(params: {
  uid: string;
  application: AdmissionApplication;
  targetClass: SchoolClass;
  privateContact: AdmissionPrivateContact | null;
  boardViewerUids?: string[];
}): Promise<string> {
  const { uid, application, targetClass, privateContact } = params;
  const newStudentId = generateSafeId('stu');
  const nameParts = application.applicantName.trim().split(/\s+/);
  const firstName = sanitizeText(nameParts[0] || 'Student', 60, 'Student');
  const lastName = sanitizeText(
    nameParts.slice(1).join(' ') || 'Enrollee',
    60,
    'Enrollee'
  );
  const studentCode = sanitizeCode(
    `CL-${Math.floor(2700 + Math.random() * 7000)}`,
    32,
    'CL-2701'
  );

  try {
    const batch = writeBatch(db);

    batch.set(doc(db, 'students', newStudentId), {
      firstName,
      lastName,
      studentCode,
      gradeLevel: sanitizeText(application.gradeApplying, 30, targetClass.gradeLevel),
      classId: targetClass.id,
      className: sanitizeText(targetClass.name, 100, 'Homeroom'),
      guardianName: sanitizeText(application.guardianName, 100, 'Guardian'),
      preferredChannel: 'Email',
      enrollmentStatus: 'active',
      attendanceRate: 100,
      linkedUserUid: '',
      boardViewerUids: (params.boardViewerUids || []).slice(0, 25),
      ownerId: uid,
      assignedTeacherId: targetClass.assignedTeacherId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'students', newStudentId, 'private', 'contact'), {
      guardianEmail: sanitizeText(
        privateContact?.guardianEmail || 'guardian@familymail.org',
        160,
        'guardian@familymail.org'
      ),
      guardianPhone: sanitizeText(
        privateContact?.guardianPhone || '(415) 555-0190',
        40,
        '(415) 555-0190'
      ),
      emergencyNotes: sanitizeOptionalText(
        `Enrolled from Admissions (${application.previousSchool})`,
        300
      ),
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'admissions', application.id), {
      stage: 'enrolled',
      enrolledStudentId: newStudentId,
      documentsVerified: true,
      tuitionDepositPaid: true,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `admissions/${application.id}/enrol`);
  }

  const notifId = generateSafeId('ntf');
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      studentId: newStudentId,
      studentName: sanitizeText(`${firstName} ${lastName}`, 120, 'Student'),
      guardianName: sanitizeText(application.guardianName, 100, 'Guardian'),
      classId: targetClass.id,
      channel: 'Email',
      triggerType: 'admission_update',
      subject: `Enrolment Confirmed: ${firstName} ${lastName}`,
      message: `Welcome to ${targetClass.name}. ${firstName} ${lastName} (${studentCode}) is officially enrolled with ${targetClass.teacherName}.`,
      deliveryStatus: 'sent',
      parentReply: '',
      ownerId: uid,
      assignedTeacherId: targetClass.assignedTeacherId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
  }

  return newStudentId;
}

export async function addStaffMember(params: {
  uid: string;
  fullName: string;
  roleTitle: string;
  department: string;
  staffCategory: StaffCategory;
  employmentType: EmploymentType;
  weeklyHoursTarget: number;
  linkedUserUid?: string;
  boardViewerUids?: string[];
}): Promise<string> {
  const staffId = generateSafeId('stf');
  try {
    await setDoc(doc(db, 'staff', staffId), {
      fullName: sanitizeText(params.fullName, 100, 'Faculty Member'),
      roleTitle: sanitizeText(params.roleTitle, 80, 'Instructor'),
      department: sanitizeText(params.department, 80, 'Academics'),
      staffCategory: params.staffCategory,
      employmentType: params.employmentType,
      status: 'active',
      avatarUrl: '',
      weeklyHoursTarget: clampNumber(Math.round(params.weeklyHoursTarget), 0, 60),
      assignedHours: 0,
      attendanceSubmissionRate: 100,
      parentResponseMinutes: 20,
      observationScore: 92,
      ...(params.linkedUserUid ? { linkedUserUid: params.linkedUserUid.slice(0, 128) } : {}),
      boardViewerUids: (params.boardViewerUids || []).slice(0, 25),
      ownerId: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return staffId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `staff/${staffId}`);
  }
}

export async function updateStaffStatus(
  staffId: string,
  status: StaffStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'staff', staffId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `staff/${staffId}`);
  }
}

export async function updateStaffEvaluation(params: {
  staffId: string;
  attendanceSubmissionRate: number;
  parentResponseMinutes: number;
  observationScore: number;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'staff', params.staffId), {
      attendanceSubmissionRate: clampNumber(params.attendanceSubmissionRate, 0, 100),
      parentResponseMinutes: clampNumber(Math.round(params.parentResponseMinutes), 1, 10080),
      observationScore: clampNumber(Math.round(params.observationScore), 0, 100),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `staff/${params.staffId}`);
  }
}

const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '08:15', end: '09:05' },
  2: { start: '09:15', end: '10:05' },
  3: { start: '10:20', end: '11:10' },
  4: { start: '11:20', end: '12:10' },
  5: { start: '13:00', end: '13:50' },
};

export async function createScheduleBlock(params: {
  uid: string;
  staff: StaffMember;
  schoolClass: SchoolClass;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  room: string;
  subject: string;
  existingSchedules: ScheduleBlock[];
}): Promise<{ conflictDetected: boolean }> {
  const scheduleId = generateSafeId('sch');
  const slot = PERIOD_TIMES[params.periodNumber] || PERIOD_TIMES[1];
  const safeRoom = sanitizeText(params.room, 40, params.schoolClass.room);

  const hasConflict = params.existingSchedules.some(
    (s) =>
      s.dayOfWeek === params.dayOfWeek &&
      s.periodNumber === params.periodNumber &&
      (s.room.toLowerCase() === safeRoom.toLowerCase() || s.staffId === params.staff.id)
  );
  const needsSub = params.staff.status === 'on_leave';
  const status = needsSub ? 'substitute_needed' : hasConflict ? 'conflict' : 'scheduled';

  try {
    await setDoc(doc(db, 'schedules', scheduleId), {
      staffId: params.staff.id,
      staffName: sanitizeText(params.staff.fullName, 100, 'Instructor'),
      classId: params.schoolClass.id,
      className: sanitizeText(params.schoolClass.name, 100, 'Class'),
      dayOfWeek: params.dayOfWeek,
      periodNumber: clampNumber(params.periodNumber, 1, 5),
      startTime: slot.start,
      endTime: slot.end,
      room: safeRoom,
      subject: sanitizeText(params.subject, 80, params.schoolClass.name),
      status,
      assignedTeacherId: params.schoolClass.assignedTeacherId,
      ownerId: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { conflictDetected: hasConflict || needsSub };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `schedules/${scheduleId}`);
  }
}

export async function autoResolveScheduleConflicts(params: {
  schedules: ScheduleBlock[];
  staff: StaffMember[];
}): Promise<{ resolvedConflicts: number; assignedSubstitutes: number }> {
  const { schedules, staff } = params;
  const availableRooms = [
    'Hall B-204',
    'Hall B-208',
    'Lab Wing 108',
    'Lab Wing 112',
    'North 302',
    'North 306',
    'Seminar Room 104',
  ];

  const activeStaff = staff.filter((s) => s.status === 'active');
  const substitutePool = [
    ...activeStaff.filter((s) => s.employmentType === 'Substitute'),
    ...activeStaff.filter((s) => s.employmentType !== 'Substitute'),
  ];

  const occupiedRoomsBySlot = new Map<string, Set<string>>();
  const occupiedStaffBySlot = new Map<string, Set<string>>();

  const slotKey = (day: DayOfWeek, period: number) => `${day}_${period}`;

  for (const sc of schedules) {
    const k = slotKey(sc.dayOfWeek, sc.periodNumber);
    if (!occupiedRoomsBySlot.has(k)) occupiedRoomsBySlot.set(k, new Set());
    if (!occupiedStaffBySlot.has(k)) occupiedStaffBySlot.set(k, new Set());
    if (sc.status === 'scheduled') {
      occupiedRoomsBySlot.get(k)!.add(sc.room);
      occupiedStaffBySlot.get(k)!.add(sc.staffId);
    }
  }

  let resolvedConflicts = 0;
  let assignedSubstitutes = 0;

  try {
    const batch = writeBatch(db);
    const seenRoomInSlot = new Map<string, Set<string>>();
    const staffBlockCount = new Map<string, number>();

    for (const sc of schedules) {
      const k = slotKey(sc.dayOfWeek, sc.periodNumber);
      if (!seenRoomInSlot.has(k)) seenRoomInSlot.set(k, new Set());
      const staffRecord = staff.find((s) => s.id === sc.staffId);

      let nextStaffId = sc.staffId;
      let nextStaffName = sc.staffName;
      let nextRoom = sc.room;
      let changed = false;

      if (sc.status === 'substitute_needed' || staffRecord?.status === 'on_leave') {
        const busyInSlot = occupiedStaffBySlot.get(k) || new Set<string>();
        const replacement = substitutePool.find((candidate) => !busyInSlot.has(candidate.id));
        if (replacement) {
          nextStaffId = replacement.id;
          nextStaffName = replacement.fullName;
          busyInSlot.add(replacement.id);
          occupiedStaffBySlot.set(k, busyInSlot);
          assignedSubstitutes += 1;
          changed = true;
        }
      }

      const usedRooms = seenRoomInSlot.get(k)!;
      if (sc.status === 'conflict' || usedRooms.has(nextRoom)) {
        const freeRoom = availableRooms.find(
          (room) =>
            !usedRooms.has(room) &&
            !(occupiedRoomsBySlot.get(k)?.has(room) && room !== nextRoom)
        );
        if (freeRoom && freeRoom !== nextRoom) {
          nextRoom = freeRoom;
          resolvedConflicts += 1;
          changed = true;
        } else if (sc.status === 'conflict' && !usedRooms.has(nextRoom)) {
          resolvedConflicts += 1;
          changed = true;
        }
      }
      usedRooms.add(nextRoom);

      staffBlockCount.set(nextStaffId, (staffBlockCount.get(nextStaffId) || 0) + 1);

      if (changed || sc.status !== 'scheduled') {
        batch.update(doc(db, 'schedules', sc.id), {
          staffId: nextStaffId,
          staffName: nextStaffName,
          room: nextRoom,
          status: 'scheduled',
          updatedAt: serverTimestamp(),
        });
      }
    }

    for (const member of staff) {
      const blocks = staffBlockCount.get(member.id) || 0;
      const computedHours = clampNumber(
        Math.max(blocks * 4, member.roleTitle.includes('Head') ? 32 : blocks * 4),
        0,
        60
      );
      if (computedHours !== member.assignedHours) {
        batch.update(doc(db, 'staff', member.id), {
          assignedHours: computedHours,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
    return { resolvedConflicts, assignedSubstitutes };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'schedules/auto_resolve');
  }
}

export async function createSchoolClass(params: {
  uid: string;
  name: string;
  code: string;
  gradeLevel: string;
  room: string;
  scheduleSlot: string;
  teacherName: string;
  teacherStaffId: string;
  assignedTeacherId?: string;
  capacity: number;
  boardViewerUids?: string[];
}): Promise<string> {
  const classId = generateSafeId('cls');
  const safeCode = sanitizeCode(params.code, 24, `SEC-${Math.floor(100 + Math.random() * 900)}`);
  try {
    await setDoc(doc(db, 'classes', classId), {
      name: sanitizeText(params.name, 100, 'Homeroom Section'),
      code: safeCode,
      gradeLevel: sanitizeText(params.gradeLevel, 30, 'Grade 10'),
      room: sanitizeText(params.room, 40, 'Room 101'),
      scheduleSlot: sanitizeText(params.scheduleSlot, 60, 'Mon–Fri · 08:15–09:05'),
      teacherName: sanitizeText(params.teacherName, 100, 'Unassigned'),
      teacherStaffId: params.teacherStaffId?.trim()
        ? params.teacherStaffId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128)
        : 'unassigned',
      assignedTeacherId: params.assignedTeacherId?.trim() || params.uid,
      capacity: clampNumber(Math.round(params.capacity), 1, 120),
      boardViewerUids: (params.boardViewerUids || []).slice(0, 25),
      ownerId: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return classId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `classes/${classId}`);
  }
}

export async function createStudentDirectly(params: {
  uid: string;
  firstName: string;
  lastName: string;
  studentCode?: string;
  gradeLevel: string;
  targetClass: SchoolClass;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  emergencyNotes?: string;
  preferredChannel: NotificationChannel;
  boardViewerUids?: string[];
}): Promise<string> {
  const studentId = generateSafeId('stu');
  const safeCode = sanitizeCode(
    params.studentCode?.trim() || `CL-${Math.floor(2700 + Math.random() * 7000)}`,
    32,
    'CL-2701'
  );
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'students', studentId), {
      firstName: sanitizeText(params.firstName, 60, 'Student'),
      lastName: sanitizeText(params.lastName, 60, 'Name'),
      studentCode: safeCode,
      gradeLevel: sanitizeText(params.gradeLevel, 30, params.targetClass.gradeLevel),
      classId: params.targetClass.id,
      className: sanitizeText(params.targetClass.name, 100, 'Homeroom'),
      guardianName: sanitizeText(params.guardianName, 100, 'Guardian'),
      preferredChannel: params.preferredChannel,
      enrollmentStatus: 'active',
      attendanceRate: 100,
      linkedUserUid: '',
      boardViewerUids: (params.boardViewerUids || []).slice(0, 25),
      ownerId: params.uid,
      assignedTeacherId: params.targetClass.assignedTeacherId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'students', studentId, 'private', 'contact'), {
      guardianEmail: sanitizeText(params.guardianEmail, 160, 'guardian@school.edu.in'),
      guardianPhone: sanitizeText(params.guardianPhone, 40, '+91 98640 00000'),
      emergencyNotes: sanitizeOptionalText(params.emergencyNotes || '', 300),
      ownerId: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return studentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `students/${studentId}`);
  }
}

const LEGACY_SEED_SUFFIXES = {
  departments: ['dept_board', 'dept_admin', 'dept_math', 'dept_sci', 'dept_hum', 'dept_ops'],
  staff: [
    'stf_owner',
    'stf_board2',
    'stf_claire',
    'stf_registrar',
    'stf_marcus',
    'stf_elena',
    'stf_daniel',
    'stf_priya',
    'stf_bikash',
  ],
  classes: ['cls_10a', 'cls_9b', 'cls_11a', 'cls_10c'],
  students: Array.from({ length: 12 }, (_, i) => `stu_${String(i + 1).padStart(2, '0')}`),
  notificationRules: ['rule_absent', 'rule_tardy', 'rule_admission', 'rule_01', 'rule_02', 'rule_03'],
  notifications: [
    ...Array.from({ length: 12 }, (_, i) => `ntf_${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 12 }, (_, i) => `ntf_${i + 1}`),
    ...Array.from({ length: 12 }, (_, i) => `notif_${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 12 }, (_, i) => `notif_${i + 1}`),
  ],
  admissions: ['adm_01', 'adm_02', 'adm_03', 'adm_04', 'adm_prev1', 'adm_prev2', 'adm_prev3'],
  schedules: [
    'sch_mon_1',
    'sch_mon_2',
    'sch_mon_3',
    'sch_tue_1',
    'sch_tue_2',
    'sch_wed_1',
    'sch_wed_1b',
    'sch_wed_3',
    'sch_thu_2',
    'sch_thu_4',
    'sch_fri_1',
    'sch_fri_2',
  ],
  financialRecords: Array.from({ length: 24 }, (_, i) => `fin_${String(i + 1).padStart(2, '0')}`),
};

function matchesLegacySeedId(docId: string, suffixes: string[]): boolean {
  if (!docId) return false;
  return suffixes.some((suffix) => {
    const marker = `_${suffix}`;
    if (!docId.endsWith(marker)) return false;
    const prefix = docId.slice(0, docId.length - marker.length);
    return /^[a-zA-Z0-9]{4,10}$/.test(prefix);
  });
}

export interface LegacyDemoSnapshot {
  departmentIds: string[];
  staffIds: string[];
  classIds: string[];
  studentIds: string[];
  attendanceRecordIds: string[];
  notificationRuleIds: string[];
  notificationIds: string[];
  admissionIds: string[];
  scheduleIds: string[];
  financialRecordIds: string[];
  totalCount: number;
}

export function detectLegacyDemoRecords(collections: {
  departments: { id: string }[];
  staff: { id: string }[];
  classes: { id: string }[];
  students: { id: string }[];
  attendanceRecords: { id: string; studentId: string; classId?: string }[];
  notificationRules: { id: string }[];
  notifications: { id: string; studentId?: string; classId?: string }[];
  admissions: { id: string; targetClassId?: string }[];
  schedules: { id: string; classId?: string; staffId?: string }[];
  financialRecords: { id: string }[];
}): LegacyDemoSnapshot {
  const departmentIds = collections.departments
    .filter((d) => matchesLegacySeedId(d.id, LEGACY_SEED_SUFFIXES.departments))
    .map((d) => d.id);
  const staffIds = collections.staff
    .filter((s) => matchesLegacySeedId(s.id, LEGACY_SEED_SUFFIXES.staff))
    .map((s) => s.id);
  const classIds = collections.classes
    .filter((c) => matchesLegacySeedId(c.id, LEGACY_SEED_SUFFIXES.classes))
    .map((c) => c.id);
  const studentIds = collections.students
    .filter((st) => matchesLegacySeedId(st.id, LEGACY_SEED_SUFFIXES.students))
    .map((st) => st.id);

  const legacyStudentIdSet = new Set(studentIds);
  const activeStudentIdSet = new Set(collections.students.map((st) => st.id));

  const attendanceRecordIds = collections.attendanceRecords
    .filter(
      (a) =>
        legacyStudentIdSet.has(a.studentId) ||
        matchesLegacySeedId(a.studentId, LEGACY_SEED_SUFFIXES.students) ||
        (a.classId ? matchesLegacySeedId(a.classId, LEGACY_SEED_SUFFIXES.classes) : false) ||
        !activeStudentIdSet.has(a.studentId)
    )
    .map((a) => a.id);

  const notificationRuleIds = collections.notificationRules
    .filter((r) => matchesLegacySeedId(r.id, LEGACY_SEED_SUFFIXES.notificationRules))
    .map((r) => r.id);

  const notificationIds = collections.notifications
    .filter(
      (n) =>
        matchesLegacySeedId(n.id, LEGACY_SEED_SUFFIXES.notifications) ||
        (n.studentId ? legacyStudentIdSet.has(n.studentId) : false) ||
        (n.studentId ? matchesLegacySeedId(n.studentId, LEGACY_SEED_SUFFIXES.students) : false) ||
        (n.classId ? matchesLegacySeedId(n.classId, LEGACY_SEED_SUFFIXES.classes) : false) ||
        (n.studentId ? !activeStudentIdSet.has(n.studentId) : false)
    )
    .map((n) => n.id);

  const admissionIds = collections.admissions
    .filter(
      (a) =>
        matchesLegacySeedId(a.id, LEGACY_SEED_SUFFIXES.admissions) ||
        (a.targetClassId ? matchesLegacySeedId(a.targetClassId, LEGACY_SEED_SUFFIXES.classes) : false)
    )
    .map((a) => a.id);

  const scheduleIds = collections.schedules
    .filter(
      (sc) =>
        matchesLegacySeedId(sc.id, LEGACY_SEED_SUFFIXES.schedules) ||
        (sc.classId ? matchesLegacySeedId(sc.classId, LEGACY_SEED_SUFFIXES.classes) : false) ||
        (sc.staffId ? matchesLegacySeedId(sc.staffId, LEGACY_SEED_SUFFIXES.staff) : false)
    )
    .map((sc) => sc.id);

  const financialRecordIds = collections.financialRecords
    .filter((f) => matchesLegacySeedId(f.id, LEGACY_SEED_SUFFIXES.financialRecords))
    .map((f) => f.id);

  const totalCount =
    departmentIds.length +
    staffIds.length +
    classIds.length +
    studentIds.length +
    attendanceRecordIds.length +
    notificationRuleIds.length +
    notificationIds.length +
    admissionIds.length +
    scheduleIds.length +
    financialRecordIds.length;

  return {
    departmentIds,
    staffIds,
    classIds,
    studentIds,
    attendanceRecordIds,
    notificationRuleIds,
    notificationIds,
    admissionIds,
    scheduleIds,
    financialRecordIds,
    totalCount,
  };
}

/**
 * Deletes only legacy seeded demo records (matched by deterministic seed IDs).
 * Never removes institution config, user accounts, role invites, or real user-created records.
 */
export async function purgeLegacyDemoRecords(snapshot: LegacyDemoSnapshot): Promise<number> {
  if (snapshot.totalCount === 0) return 0;

  // Step 1: Delete isolated private subcollection docs BEFORE deleting parent students/admissions
  const privateRefs = [
    ...snapshot.studentIds.map((sid) => doc(db, 'students', sid, 'private', 'contact')),
    ...snapshot.admissionIds.map((aid) => doc(db, 'admissions', aid, 'private', 'contact')),
  ];

  // Step 2: Delete parent legacy demo documents across collections
  const parentRefs = [
    ...snapshot.attendanceRecordIds.map((id) => doc(db, 'attendanceRecords', id)),
    ...snapshot.notificationIds.map((id) => doc(db, 'notifications', id)),
    ...snapshot.notificationRuleIds.map((id) => doc(db, 'notificationRules', id)),
    ...snapshot.scheduleIds.map((id) => doc(db, 'schedules', id)),
    ...snapshot.admissionIds.map((id) => doc(db, 'admissions', id)),
    ...snapshot.studentIds.map((id) => doc(db, 'students', id)),
    ...snapshot.classIds.map((id) => doc(db, 'classes', id)),
    ...snapshot.staffIds.map((id) => doc(db, 'staff', id)),
    ...snapshot.departmentIds.map((id) => doc(db, 'departments', id)),
    ...snapshot.financialRecordIds.map((id) => doc(db, 'financialRecords', id)),
  ];

  const commitInChunks = async (refs: ReturnType<typeof doc>[]) => {
    const CHUNK_SIZE = 350;
    for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      for (const ref of refs.slice(i, i + CHUNK_SIZE)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  };

  try {
    if (privateRefs.length > 0) {
      await commitInChunks(privateRefs);
    }
    if (parentRefs.length > 0) {
      await commitInChunks(parentRefs);
    }
    return snapshot.totalCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'workspace/purge_legacy_demo');
  }
}

export async function deleteParentNotification(notificationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notifications/${notificationId}`);
  }
}

export async function deleteNotificationRule(ruleId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notificationRules', ruleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notificationRules/${ruleId}`);
  }
}
