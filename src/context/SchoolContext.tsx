import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import {
  AdmissionApplication,
  AttendanceRecord,
  CareerApplication,
  ContactInquiry,
  Department,
  FinancialRecord,
  InstitutionConfig,
  NotificationRule,
  ParentNotification,
  RoleInvite,
  ScheduleBlock,
  SchoolClass,
  StaffMember,
  Student,
  UserProfile,
} from '../types';

interface SchoolContextValue {
  user: User | null;
  profile: UserProfile | null;
  institution: InstitutionConfig | null;
  institutionLoaded: boolean;
  authReady: boolean;
  dataLoading: boolean;
  justCompletedSetup: boolean;
  markSetupCompleted: () => void;
  dismissWelcome: () => void;
  departments: Department[];
  classes: SchoolClass[];
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  notifications: ParentNotification[];
  notificationRules: NotificationRule[];
  admissions: AdmissionApplication[];
  staff: StaffMember[];
  schedules: ScheduleBlock[];
  financialRecords: FinancialRecord[];
  invites: RoleInvite[];
  contactInquiries: ContactInquiry[];
  careerApplications: CareerApplication[];
  signInWithCredentials: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextValue | null>(null);

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [institution, setInstitution] = useState<InstitutionConfig | null>(null);
  const [institutionLoaded, setInstitutionLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [justCompletedSetup, setJustCompletedSetup] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionApplication[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [schedules, setSchedules] = useState<ScheduleBlock[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [invites, setInvites] = useState<RoleInvite[]>([]);
  const [contactInquiries, setContactInquiries] = useState<ContactInquiry[]>([]);
  const [careerApplications, setCareerApplications] = useState<CareerApplication[]>([]);

  // Public non-PII listener for first-time setup status
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'institution', 'config'),
      (snap) => {
        setInstitution(snap.exists() ? (snap.data() as InstitutionConfig) : null);
        setInstitutionLoaded(true);
      },
      () => {
        setInstitutionLoaded(true);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setProfile(null);
        setDepartments([]);
        setClasses([]);
        setStudents([]);
        setAttendanceRecords([]);
        setNotifications([]);
        setNotificationRules([]);
        setAdmissions([]);
        setStaff([]);
        setSchedules([]);
        setFinancialRecords([]);
        setInvites([]);
        setContactInquiries([]);
        setCareerApplications([]);
        setJustCompletedSetup(false);
        setDataLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load current user's role profile
  useEffect(() => {
    if (!authReady || !user) return;
    setDataLoading(true);
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile(null);
          setDataLoading(false);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`)
    );
    return () => unsub();
  }, [authReady, user]);

  // Attach role-appropriate real-time Firestore listeners once profile is resolved
  useEffect(() => {
    if (!authReady || !user || !profile) return;
    if (profile.accountStatus === 'suspended') {
      setDataLoading(false);
      return;
    }

    const uid = user.uid;
    const role = profile.role;
    const unsubs: (() => void)[] = [];
    let resolved = 0;

    const finishLoading = (target: number) => {
      resolved += 1;
      if (resolved >= target) setDataLoading(false);
    };

    if (role === 'student') {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'students'), where('linkedUserUid', '==', uid)),
          (snap) => {
            setStudents(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
            );
            finishLoading(1);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'students')
        )
      );
      return () => unsubs.forEach((u) => u());
    }

    // Board / Stakeholder Read-Only Executive Scope (Zero PII, cost-safe array-contains queries)
    if (role === 'board') {
      const total = 5;
      unsubs.push(
        onSnapshot(
          query(collection(db, 'financialRecords'), where('boardViewerUids', 'array-contains', uid)),
          (snap) => {
            setFinancialRecords(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<FinancialRecord, 'id'>) }))
                .sort((a, b) => a.month.localeCompare(b.month))
            );
            finishLoading(total);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'financialRecords')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'students'), where('boardViewerUids', 'array-contains', uid)),
          (snap) => {
            setStudents(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
                .sort((a, b) => a.lastName.localeCompare(b.lastName))
            );
            finishLoading(total);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'students')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'staff'), where('boardViewerUids', 'array-contains', uid)),
          (snap) => {
            setStaff(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<StaffMember, 'id'>) }))
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
            );
            finishLoading(total);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'staff')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'classes'), where('boardViewerUids', 'array-contains', uid)),
          (snap) => {
            setClasses(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) }))
                .sort((a, b) => a.code.localeCompare(b.code))
            );
            finishLoading(total);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'departments'), where('boardViewerUids', 'array-contains', uid)),
          (snap) => {
            setDepartments(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<Department, 'id'>) }))
                .sort((a, b) => a.name.localeCompare(b.name))
            );
            finishLoading(total);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'departments')
        )
      );
      return () => unsubs.forEach((u) => u());
    }

    const isWorkspaceOwner =
      role === 'super_admin' ||
      uid === profile.ownerId ||
      (user.email === 'xuwonixweb@gmail.com' && user.emailVerified);

    if (!isWorkspaceOwner) {
      const total = 6;
      unsubs.push(
        onSnapshot(
          query(collection(db, 'classes'), where('assignedTeacherId', '==', uid)),
          (snap) => {
            setClasses(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) }))
                .sort((a, b) => a.code.localeCompare(b.code))
            );
            finishLoading(total);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'students'), where('assignedTeacherId', '==', uid)),
          (snap) => {
            setStudents(
              snap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
                .sort((a, b) => a.lastName.localeCompare(b.lastName))
            );
            finishLoading(total);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'students')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'attendanceRecords'), where('assignedTeacherId', '==', uid)),
          (snap) => {
            setAttendanceRecords(
              snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<AttendanceRecord, 'id'>),
              }))
            );
            finishLoading(total);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'attendanceRecords')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('assignedTeacherId', '==', uid)),
          (snap) => {
            setNotifications(
              snap.docs
                .map((d) => ({
                  id: d.id,
                  ...(d.data() as Omit<ParentNotification, 'id'>),
                }))
                .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
            );
            finishLoading(total);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'schedules'), where('assignedTeacherId', '==', uid)),
          (snap) => {
            setSchedules(
              snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<ScheduleBlock, 'id'>),
              }))
            );
            finishLoading(total);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'schedules')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'notificationRules'), where('teacherViewerUids', 'array-contains', uid)),
          (snap) => {
            setNotificationRules(
              snap.docs
                .map((d) => ({
                  id: d.id,
                  ...(d.data() as Omit<NotificationRule, 'id'>),
                }))
                .sort((a, b) => a.name.localeCompare(b.name))
            );
            finishLoading(total);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'notificationRules')
        )
      );
      return () => unsubs.forEach((u) => u());
    }

    // Super Admin workspace owner scope
    const ownerScope = role === 'super_admin' ? uid : profile.ownerId;
    const total = 13;

    unsubs.push(
      onSnapshot(
        query(collection(db, 'financialRecords'), where('ownerId', '==', ownerScope)),
        (snap) => {
          const rows = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<FinancialRecord, 'id'>) }))
            .sort((a, b) => a.month.localeCompare(b.month));
          setFinancialRecords(rows);
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'financialRecords')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'departments'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setDepartments(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Department, 'id'>) }))
              .sort((a, b) => a.name.localeCompare(b.name))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'departments')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'classes'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setClasses(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) }))
              .sort((a, b) => a.code.localeCompare(b.code))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'students'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setStudents(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
              .sort((a, b) => a.lastName.localeCompare(b.lastName))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'students')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'attendanceRecords'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setAttendanceRecords(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<AttendanceRecord, 'id'>),
            }))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'attendanceRecords')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setNotifications(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<ParentNotification, 'id'>) }))
              .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'notificationRules'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setNotificationRules(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationRule, 'id'>) }))
              .sort((a, b) => a.name.localeCompare(b.name))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notificationRules')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'admissions'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setAdmissions(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<AdmissionApplication, 'id'>) }))
              .sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'admissions')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'staff'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setStaff(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<StaffMember, 'id'>) }))
              .sort((a, b) => a.fullName.localeCompare(b.fullName))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'staff')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'schedules'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setSchedules(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScheduleBlock, 'id'>) }))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'schedules')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'invites'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setInvites(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<RoleInvite, 'id'>) }))
              .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'invites')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'contactInquiries'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setContactInquiries(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<ContactInquiry, 'id'>) }))
              .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'contactInquiries')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'careerApplications'), where('ownerId', '==', ownerScope)),
        (snap) => {
          setCareerApplications(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<CareerApplication, 'id'>) }))
              .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
          );
          finishLoading(total);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'careerApplications')
      )
    );

    return () => unsubs.forEach((fn) => fn());
  }, [authReady, user, profile]);

  const signInWithCredentials = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const markSetupCompleted = () => setJustCompletedSetup(true);
  const dismissWelcome = () => setJustCompletedSetup(false);

  return (
    <SchoolContext.Provider
      value={{
        user,
        profile,
        institution,
        institutionLoaded,
        authReady,
        dataLoading,
        justCompletedSetup,
        markSetupCompleted,
        dismissWelcome,
        departments,
        classes,
        students,
        attendanceRecords,
        notifications,
        notificationRules,
        admissions,
        staff,
        schedules,
        financialRecords,
        invites,
        contactInquiries,
        careerApplications,
        signInWithCredentials,
        signOutUser,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used within SchoolProvider');
  return ctx;
}
