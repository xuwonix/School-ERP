# Security Specification — Kestrel Campus

## 1. Data Invariants

1. **Identity & Verification**: Every read and write operation requires `request.auth != null && request.auth.token.email_verified == true`. Unverified emails cannot access data or claim admin privileges.
2. **No Self-Assigned Roles**: Users creating `/users/{userId}` can only set `role == 'teacher'` unless they are already verified admins. Users cannot mutate `role` or `uid` on update.
3. **PII Isolation (Split Collection)**: Raw emails, phone numbers, and emergency notes are stored exclusively in `/users/{userId}/private/{docId}`, `/students/{studentId}/private/{docId}`, and `/admissions/{applicationId}/private/{docId}`, readable only by the verified owner or admin (verified via parent document `get()` Master Gate).
4. **Relational Integrity**:
   - `students` must reference an existing `classes/{classId}` document on create.
   - `attendanceRecords` must reference existing `students/{studentId}` and `classes/{classId}` documents on create.
   - `notifications` must reference an existing `students/{studentId}` document on create.
   - `schedules` must reference existing `staff/{staffId}` and `classes/{classId}` documents on create.
5. **Atomicity on Enrolment**: Transitioning an `admissions/{applicationId}` document to `stage == 'enrolled'` MUST atomically create the corresponding `/students/{enrolledStudentId}` document in the same batch (`existsAfter`).
6. **Terminal State Locking**: Once an `admission` reaches `'enrolled'` or `'declined'`, or a `notification` reaches `'acknowledged'`, non-admin updates are rejected.
7. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on create and remain immutable on update. `updatedAt` must equal `request.time` on both create and update. `ownerId` is immutable after creation.
8. **Secure List Queries**: Every `allow list` rule enforces `resource.data.ownerId == request.auth.uid` (or `assignedTeacherId == request.auth.uid` / `isBootstrappedAdmin()`) without calling `get()` or `exists()`.

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Category | Target Path | Malicious Payload / Context | Expected Outcome |
|---|----------------|-------------|-----------------------------|------------------|
| 1 | **Self-Assigned Admin Role** | `/users/u_attacker` (create) | `{ uid: "u_attacker", displayName: "Eve", role: "admin", schoolName: "X", department: "Ops", seeded: false, createdAt: serverTime, updatedAt: serverTime }` | `PERMISSION_DENIED` |
| 2 | **Shadow Field Injection** | `/students/stu_1` (create) | Valid student fields + `{ isScholarshipApproved: true }` | `PERMISSION_DENIED` |
| 3 | **Email Spoofing (Unverified)** | `/admissions/adm_1` (get) | Auth email = `xuwonixweb@gmail.com`, `email_verified = false` | `PERMISSION_DENIED` |
| 4 | **PII Blanket Read** | `/students/stu_1/private/contact` (get) | Authenticated user `u_other` who is neither `ownerId` nor admin | `PERMISSION_DENIED` |
| 5 | **Owner Spoofing** | `/classes/cls_1` (create) | Signed in as `u_attacker`, payload sets `ownerId: "u_victim"` | `PERMISSION_DENIED` |
| 6 | **Orphaned Attendance Record** | `/attendanceRecords/att_1` (create) | Valid payload referencing nonexistent `studentId: "stu_ghost"` | `PERMISSION_DENIED` |
| 7 | **Non-Atomic Enrolment** | `/admissions/adm_1` (update) | Sets `stage: "enrolled"`, `enrolledStudentId: "stu_fake"` without creating `/students/stu_fake` in the same batch | `PERMISSION_DENIED` |
| 8 | **Terminal State Bypass** | `/admissions/adm_enrolled` (update) | Non-admin attempts to revert `stage` from `"enrolled"` to `"inquiry"` | `PERMISSION_DENIED` |
| 9 | **ID Poisoning** | `/staff/a..[200 chars]..$$$` (create) | Document ID exceeds 128 chars or contains disallowed characters | `PERMISSION_DENIED` |
| 10 | **Value Poisoning on Update** | `/attendanceRecords/att_1` (update) | Allowed key `note` supplied as a 2,000-char string (exceeds `maxLength: 300`) | `PERMISSION_DENIED` |
| 11 | **Timestamp Forgery** | `/notificationRules/rule_1` (create) | Client passes backdated `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` | `PERMISSION_DENIED` |
| 12 | **Unauthorized Query Scraping** | `/students` (list) | Non-owner queries `collection(db, "students")` without matching `ownerId`/`assignedTeacherId` | `PERMISSION_DENIED` |
