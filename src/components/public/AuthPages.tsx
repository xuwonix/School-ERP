import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { COMPANY_INFO } from '../../data/siteContent';
import { FIREBASE_CONFIG } from '../../firebase';
import { completeFirstTimeSetup } from '../../lib/schoolActions';
import { PublicPage } from '../../types';

interface AuthPageProps {
  onNavigate: (page: PublicPage) => void;
}

interface OtpChallengeState {
  codeHash: string;
  targetValue: string;
  expiresAt: number;
  attempts: number;
  previewCode: string;
}

async function hashOtpValue(target: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${target.trim().toLowerCase()}:${code.trim()}`);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSecureSixDigitOtp(): string {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

function buildAutoUsername(ownerName: string, schoolName: string, suffix: string): string {
  const ownerSlug = ownerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12);
  const schoolSlug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 8);
  const base = ownerSlug || schoolSlug || 'superadmin';
  const mid = ownerSlug && schoolSlug ? `.${schoolSlug}` : '';
  return `sa.${base}${mid}.${suffix}`.slice(0, 48);
}

function randomShortSuffix(): string {
  const bytes = new Uint8Array(2);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('') + String(new Date().getFullYear()).slice(-2);
}

function FirebaseProviderHint() {
  const url = `https://console.firebase.google.com/project/${FIREBASE_CONFIG.projectId}/authentication/providers`;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-4 space-y-2 text-xs text-amber-900">
      <p className="font-semibold flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        Action Required: Enable Email/Password Sign-In in Firebase Console
      </p>
      <p className="leading-relaxed">
        Invite-only institutional credentials use Firebase Email/Password Authentication. Enable it
        once in your Firebase project:
      </p>
      <ol className="list-decimal pl-4 space-y-1">
        <li>
          Open{' '}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline text-amber-950"
          >
            Firebase Console → Authentication → Sign-in method
          </a>
        </li>
        <li>Click <strong>Add new provider</strong> → select <strong>Email/Password</strong>.</li>
        <li>Toggle <strong>Enable</strong>, click <strong>Save</strong>, then retry below.</li>
      </ol>
    </div>
  );
}

/* ============================================================================
   INVITE-ONLY LOGIN PAGE (Auto-triggers Setup when database has zero entry)
   ============================================================================ */
export function LoginPage({ onNavigate }: AuthPageProps) {
  const { institution, institutionLoaded, signInWithCredentials } = useSchool();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsProviderEnable, setNeedsProviderEnable] = useState(false);

  // Automatic first-time redirect: zero database entry -> automatically trigger Setup
  useEffect(() => {
    if (institutionLoaded && !institution?.setupComplete) {
      onNavigate('setup');
    }
  }, [institutionLoaded, institution?.setupComplete, onNavigate]);

  if (!institutionLoaded || !institution?.setupComplete) {
    return (
      <div className="bg-slate-50/70 py-16 px-6">
        <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-600">
          Checking institution status...
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNeedsProviderEnable(false);
    setBusy(true);
    try {
      await signInWithCredentials(email, password);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (
        code.includes('operation-not-allowed') ||
        code.includes('configuration-not-found')
      ) {
        setNeedsProviderEnable(true);
        setErrorMsg('Email/Password authentication is not yet enabled on this Firebase project.');
      } else if (
        code.includes('invalid-credential') ||
        code.includes('wrong-password') ||
        code.includes('user-not-found')
      ) {
        setErrorMsg(
          'Invalid institutional credentials. Please verify the email and password issued by your Super Admin.'
        );
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-50/70 py-14 lg:py-20 px-6">
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-lg p-8 space-y-6">
        <div className="space-y-2 border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-[#0F4C5C]">
            {COMPANY_INFO.name} · Role-Based Invite-Only Access
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to {institution.schoolName}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Enter your institutional email and password. You will be automatically directed to your
            assigned Super Admin, Board, Administration, Teacher, Staff, or Student workspace.
          </p>
        </div>

        {needsProviderEnable && <FirebaseProviderHint />}

        {errorMsg && !needsProviderEnable && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5">
            {errorMsg}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Institutional Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.edu.in"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors disabled:opacity-55 cursor-pointer"
          >
            <span>{busy ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Self-registration and consumer Google sign-in are disabled for campus safety.</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   FIRST-TIME INSTITUTION SETUP PAGE
   - Automatically redirects to Login without fail once a DB entry exists
   - Fields: School Name, School Address, School Owner, Owner Email (OTP Verify),
     Auto-Generated Username, Password, Contact No (OTP Verify)
   ============================================================================ */
export function SetupPage({ onNavigate }: AuthPageProps) {
  const { institution, institutionLoaded, markSetupCompleted } = useSchool();

  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolOwner, setSchoolOwner] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [usernameSuffix, setUsernameSuffix] = useState(() => randomShortSuffix());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Independent cryptographic OTP challenges for Email and Contact No
  const [emailChallenge, setEmailChallenge] = useState<OtpChallengeState | null>(null);
  const [emailOtpInput, setEmailOtpInput] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState<string | null>(null);

  const [phoneChallenge, setPhoneChallenge] = useState<OtpChallengeState | null>(null);
  const [phoneOtpInput, setPhoneOtpInput] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOtpError, setPhoneOtpError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsProviderEnable, setNeedsProviderEnable] = useState(false);

  // Strict redirect: once there is a database entry, Setup automatically redirects to Login without fail
  useEffect(() => {
    if (institutionLoaded && institution?.setupComplete) {
      onNavigate('login');
    }
  }, [institutionLoaded, institution?.setupComplete, onNavigate]);

  const autoUsername = useMemo(
    () => buildAutoUsername(schoolOwner, schoolName, usernameSuffix),
    [schoolOwner, schoolName, usernameSuffix]
  );

  if (!institutionLoaded || institution?.setupComplete) {
    return (
      <div className="bg-slate-50/70 py-16 px-6">
        <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-600">
          Redirecting to institutional login...
        </div>
      </div>
    );
  }

  const handleSendEmailOtp = async () => {
    setEmailOtpError(null);
    const cleaned = ownerEmail.trim();
    if (!cleaned || !cleaned.includes('@') || !cleaned.includes('.')) {
      setEmailOtpError('Enter a valid School Owner contact email before sending OTP.');
      return;
    }
    const code = generateSecureSixDigitOtp();
    const codeHash = await hashOtpValue(cleaned, code);
    setEmailChallenge({
      codeHash,
      targetValue: cleaned,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
      previewCode: code,
    });
    setEmailOtpInput('');
    setEmailVerified(false);
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailChallenge) return;
    setEmailOtpError(null);
    if (Date.now() > emailChallenge.expiresAt) {
      setEmailOtpError('Email OTP expired. Please request a fresh code.');
      setEmailChallenge(null);
      return;
    }
    if (emailChallenge.attempts >= 5) {
      setEmailOtpError('Maximum OTP attempts reached. Request a new Email OTP.');
      setEmailChallenge(null);
      return;
    }
    const candidateHash = await hashOtpValue(emailChallenge.targetValue, emailOtpInput);
    if (candidateHash === emailChallenge.codeHash) {
      setEmailVerified(true);
      setEmailChallenge(null);
      setEmailOtpInput('');
    } else {
      setEmailChallenge((prev) => (prev ? { ...prev, attempts: prev.attempts + 1 } : null));
      setEmailOtpError('Incorrect 6-digit Email OTP. Please check the code and retry.');
    }
  };

  const handleSendPhoneOtp = async () => {
    setPhoneOtpError(null);
    const cleaned = contactNo.trim();
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length < 10) {
      setPhoneOtpError('Enter a valid contact number (at least 10 digits) before sending OTP.');
      return;
    }
    const code = generateSecureSixDigitOtp();
    const codeHash = await hashOtpValue(cleaned, code);
    setPhoneChallenge({
      codeHash,
      targetValue: cleaned,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
      previewCode: code,
    });
    setPhoneOtpInput('');
    setPhoneVerified(false);
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneChallenge) return;
    setPhoneOtpError(null);
    if (Date.now() > phoneChallenge.expiresAt) {
      setPhoneOtpError('Contact No OTP expired. Please request a fresh code.');
      setPhoneChallenge(null);
      return;
    }
    if (phoneChallenge.attempts >= 5) {
      setPhoneOtpError('Maximum OTP attempts reached. Request a new Contact No OTP.');
      setPhoneChallenge(null);
      return;
    }
    const candidateHash = await hashOtpValue(phoneChallenge.targetValue, phoneOtpInput);
    if (candidateHash === phoneChallenge.codeHash) {
      setPhoneVerified(true);
      setPhoneChallenge(null);
      setPhoneOtpInput('');
    } else {
      setPhoneChallenge((prev) => (prev ? { ...prev, attempts: prev.attempts + 1 } : null));
      setPhoneOtpError('Incorrect 6-digit Contact No OTP. Please check the code and retry.');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNeedsProviderEnable(false);

    if (!emailVerified) {
      setErrorMsg('Please complete OTP verification for the School Owner Contact Email.');
      return;
    }
    if (!phoneVerified) {
      setErrorMsg('Please complete OTP verification for the Contact Number.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Super Admin password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      markSetupCompleted();
      await completeFirstTimeSetup({
        schoolName,
        schoolAddress,
        schoolOwner,
        ownerEmail,
        ownerUsername: autoUsername,
        password,
        contactNo,
        emailOtpVerified: true,
        phoneOtpVerified: true,
      });
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (
        code.includes('operation-not-allowed') ||
        code.includes('configuration-not-found')
      ) {
        setNeedsProviderEnable(true);
        setErrorMsg('Email/Password authentication is not yet enabled on this Firebase project.');
      } else if (code.includes('email-already-in-use')) {
        setErrorMsg(
          'An account with this email already exists. Please use a different School Owner email.'
        );
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to complete initial setup.');
      }
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-50/70 py-12 lg:py-16 px-6">
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-lg p-7 lg:p-9 space-y-6">
        <div className="space-y-2 border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-[#0F4C5C]">
            {COMPANY_INFO.name} · First-Time Institution Setup
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Initialize Your School &amp; Super Admin Account
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            No school database entry was detected. Complete this one-time OTP-verified setup to
            register your institution. Once finished, you will be automatically logged into the
            Super Admin Console and future logins will go directly to the Login screen.
          </p>
        </div>

        {needsProviderEnable && <FirebaseProviderHint />}

        {errorMsg && !needsProviderEnable && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5">
            {errorMsg}
          </p>
        )}

        <form onSubmit={handleSetup} className="space-y-5">
          {/* 1. School Name & 2. School Address */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">School Name</label>
              <input
                type="text"
                required
                maxLength={120}
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g., Brahmaputra Valley Academy"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                School Address
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={240}
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                placeholder="e.g., L.B Road, Tezpur, Sonitpur, Assam 784001"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
              />
            </div>
          </div>

          {/* 3. School Owner & 5. Auto-Generated Username */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">School Owner</label>
              <input
                type="text"
                required
                maxLength={100}
                value={schoolOwner}
                onChange={(e) => setSchoolOwner(e.target.value)}
                placeholder="e.g., Dr. Anirban Baruah"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Username (Auto-Generated)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={autoUsername}
                  aria-label="Auto-generated Super Admin username"
                  className="flex-1 px-3.5 py-2 text-sm font-mono bg-slate-50 text-slate-700 border border-slate-200 rounded-md"
                />
                <button
                  type="button"
                  onClick={() => setUsernameSuffix(randomShortSuffix())}
                  title="Regenerate username"
                  className="px-2.5 py-2 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 4. School Owner Contact Email + OTP Verify */}
          <div className="border border-slate-200 rounded-md p-4 space-y-3 bg-slate-50/40">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-800">
                School Owner Contact Mail (OTP Verify)
              </label>
              {emailVerified && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                maxLength={160}
                value={ownerEmail}
                onChange={(e) => {
                  setOwnerEmail(e.target.value);
                  setEmailVerified(false);
                  setEmailChallenge(null);
                  setEmailOtpError(null);
                }}
                placeholder="owner@school.edu.in"
                className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
              />
              <button
                type="button"
                onClick={handleSendEmailOtp}
                disabled={emailVerified}
                className="px-4 py-2 text-xs font-semibold text-[#0F4C5C] bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {emailVerified ? 'Email Verified' : emailChallenge ? 'Resend OTP' : 'Send Email OTP'}
              </button>
            </div>

            {emailOtpError && <p className="text-xs text-red-600">{emailOtpError}</p>}

            {emailChallenge && !emailVerified && (
              <div className="space-y-2.5 pt-1">
                <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded px-3 py-2">
                  Preview Delivery Code for{' '}
                  <span className="font-mono font-medium">{emailChallenge.targetValue}</span>:{' '}
                  <strong className="font-mono text-slate-900 tracking-wider">
                    {emailChallenge.previewCode}
                  </strong>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailOtpInput}
                    onChange={(e) => setEmailOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit Email OTP"
                    className="flex-1 px-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyEmailOtp}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Verify Email OTP
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 7. Contact No + OTP Verify */}
          <div className="border border-slate-200 rounded-md p-4 space-y-3 bg-slate-50/40">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-800">
                Contact No (OTP Verify)
              </label>
              {phoneVerified && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="tel"
                required
                maxLength={40}
                value={contactNo}
                onChange={(e) => {
                  setContactNo(e.target.value);
                  setPhoneVerified(false);
                  setPhoneChallenge(null);
                  setPhoneOtpError(null);
                }}
                placeholder="+91 98640 12345"
                className="flex-1 px-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
              />
              <button
                type="button"
                onClick={handleSendPhoneOtp}
                disabled={phoneVerified}
                className="px-4 py-2 text-xs font-semibold text-[#0F4C5C] bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {phoneVerified ? 'Phone Verified' : phoneChallenge ? 'Resend OTP' : 'Send SMS OTP'}
              </button>
            </div>

            {phoneOtpError && <p className="text-xs text-red-600">{phoneOtpError}</p>}

            {phoneChallenge && !phoneVerified && (
              <div className="space-y-2.5 pt-1">
                <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded px-3 py-2">
                  Preview SMS OTP for{' '}
                  <span className="font-mono font-medium">{phoneChallenge.targetValue}</span>:{' '}
                  <strong className="font-mono text-slate-900 tracking-wider">
                    {phoneChallenge.previewCode}
                  </strong>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={phoneOtpInput}
                    onChange={(e) => setPhoneOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit SMS OTP"
                    className="flex-1 px-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyPhoneOtp}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Verify Phone OTP
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 6. Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password (min 8 chars)
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create Super Admin password"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#0F4C5C]"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-[#0F4C5C] shrink-0 mt-0.5" />
            <span>
              Once verified and submitted, setup locks permanently and automatically logs you in as
              Super Admin with your school&apos;s departments, staff hierarchy, and multi-year
              admissions workspace ready.
            </span>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={busy || !emailVerified || !phoneVerified}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            >
              <span>{busy ? 'Initializing School...' : 'Complete Setup & Enter Console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
