import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Mail, Chrome, Wallet, Loader2, Eye, EyeOff, KeyRound, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  fetchSignInMethodsForEmail,
  getAdditionalUserInfo,
  linkWithPopup,
  updateProfile as fbUpdateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

// ─── Magic link redirect URL ──────────────────────────────────────────────────
const EMAIL_LINK_SETTINGS = {
  url: `${window.location.origin}/login`,
  handleCodeInApp: true,
};

type EmailMode = "signin" | "signup" | "magic";

/**
 * Decode any Firebase auth error into a human-readable string.
 * Firebase SDK v9+ sometimes passes the raw REST API error string
 * (e.g. "OPERATION_NOT_ALLOWED") in err.message instead of a proper
 * err.code, so we check both.
 */
function firebaseAuthError(err: any): string {
  const code: string = err?.code ?? "";
  const msg: string = (err?.message ?? "").toUpperCase();

  if (code === "auth/operation-not-allowed" || msg.includes("OPERATION_NOT_ALLOWED")) {
    return "Email/Password sign-in is not enabled.\n\nFix: Firebase Console → Authentication → Sign-in method → Email/Password → Enable.";
  }
  if (code === "auth/wrong-password" || code === "auth/invalid-credential" || msg.includes("INVALID_LOGIN_CREDENTIALS") || msg.includes("INVALID_PASSWORD")) {
    return "Wrong email or password. Try again or use Forgot Password.";
  }
  if (code === "auth/user-not-found" || msg.includes("EMAIL_NOT_FOUND")) {
    return "No account found with this email. Switch to \"Create Account\" to sign up.";
  }
  if (code === "auth/email-already-in-use" || msg.includes("EMAIL_EXISTS")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (code === "auth/too-many-requests" || msg.includes("TOO_MANY_ATTEMPTS")) {
    return "Too many failed attempts. Please wait a few minutes or reset your password.";
  }
  if (code === "auth/invalid-email" || msg.includes("INVALID_EMAIL")) {
    return "Please enter a valid email address.";
  }
  if (code === "auth/weak-password" || msg.includes("WEAK_PASSWORD")) {
    return "Password is too weak. Use at least 6 characters.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Check your internet connection and try again.";
  }
  return err?.message ?? "An unknown error occurred.";
}

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, firebaseUser, clearError } = useAuth();
  const { toast } = useToast();

  const from = (location.state as any)?.from?.pathname || "/";

  // ── Mode state ─────────────────────────────────────────────────────────────
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");

  // ── Email + password fields ────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [confirmUpiId, setConfirmUpiId] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ── Misc ───────────────────────────────────────────────────────────────────
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  // Shown after email/password signup until the user clicks the verification link
  const [emailVerificationPending, setEmailVerificationPending] = useState(false);
  // Banner shown when Email/Password provider is disabled in Firebase Console
  const [providerDisabled, setProviderDisabled] = useState(false);

  // ── Redirect once authenticated ────────────────────────────────────────────
  // Checks firebaseUser.emailVerified directly to avoid a race condition where
  // onAuthStateChanged fires before setEmailVerificationPending(true) can run.
  useEffect(() => {
    if (isLoading || !user) return;

    // Email-only account that hasn't verified yet → keep on verification screen
    const isUnverifiedEmailUser =
      firebaseUser &&
      !firebaseUser.emailVerified &&
      firebaseUser.providerData.length === 1 &&
      firebaseUser.providerData[0]?.providerId === "password";

    if (isUnverifiedEmailUser) {
      setEmailVerificationPending(true);
      return;
    }

    if (!emailVerificationPending) {
      navigate(from, { replace: true });
    }
  }, [user, isLoading, firebaseUser, emailVerificationPending, navigate, from]);

  // ── Poll for email verification (every 3 s while screen is shown) ──────────
  useEffect(() => {
    if (!emailVerificationPending) return;
    const interval = setInterval(async () => {
      try {
        await auth.currentUser?.reload();
        if (auth.currentUser?.emailVerified) {
          setEmailVerificationPending(false);
          navigate("/onboarding", { replace: true });
        }
      } catch {
        setEmailVerificationPending(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [emailVerificationPending, navigate]);

  // ── Consume email magic-link on redirect back ──────────────────────────────
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    const saved = localStorage.getItem("fairpay_magic_email");
    const emailToUse = saved || window.prompt("Please confirm your email address:");
    if (!emailToUse) return;

    setLoggingIn(true);
    signInWithEmailLink(auth, emailToUse, window.location.href)
      .then((cred) => {
        localStorage.removeItem("fairpay_magic_email");
        window.history.replaceState({}, document.title, window.location.pathname);
        const isNew = getAdditionalUserInfo(cred)?.isNewUser ?? false;
        toast({ title: "Welcome!", description: "Signed in successfully." });
        navigate(isNew ? "/onboarding" : from, { replace: true });
      })
      .catch((err) => toast({ title: "Link sign-in failed", description: firebaseAuthError(err), variant: "destructive" }))
      .finally(() => setLoggingIn(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ══════════════════════════════════════════════════════════════════════════
  // EMAIL + PASSWORD — Sign In
  // ══════════════════════════════════════════════════════════════════════════
  const handleEmailPasswordSignIn = async () => {
    if (!email || !password) {
      toast({ title: "Missing fields", description: "Please enter your email and password.", variant: "destructive" });
      return;
    }
    setLoggingIn(true);
    setProviderDisabled(false);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email).catch(() => [] as string[]);
      if (methods.length > 0 && !methods.includes("password") && methods.includes("google.com")) {
        toast({
          title: "Use Google to sign in",
          description: "This account was created with Google. Tap \"Continue with Google\" below, or use Forgot Password to also set a password.",
          variant: "destructive",
        });
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Welcome back!", description: "You're now signed in." });
      navigate(from, { replace: true });
    } catch (err: any) {
      const decoded = firebaseAuthError(err);
      if (decoded.includes("not enabled")) setProviderDisabled(true);
      toast({ title: "Sign in failed", description: decoded, variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // EMAIL + PASSWORD — Create Account
  // ══════════════════════════════════════════════════════════════════════════
  const handleEmailPasswordSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are the same.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (!upiId || !confirmUpiId) {
      toast({ title: "Missing UPI ID", description: "Please provide a valid UPI ID.", variant: "destructive" });
      return;
    }
    if (upiId !== confirmUpiId) {
      toast({ title: "UPI IDs do not match", description: "Please ensure both UPI IDs are identical.", variant: "destructive" });
      return;
    }
    setLoggingIn(true);
    setProviderDisabled(false);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email).catch(() => [] as string[]);
      if (methods.includes("google.com") && !methods.includes("password")) {
        toast({
          title: "Account exists with Google",
          description: "This email is already registered via Google. Sign in with Google, then use Forgot Password to also set a password.",
          variant: "destructive",
        });
        setEmailMode("signin");
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Wait for AuthContext listener to pick up user before syncing extra properties to mongodb? 
      // The context will automatically sync default values. Then we can call our custom API directly here.
      if (displayName.trim()) {
        await fbUpdateProfile(cred.user, { displayName: displayName.trim() });
      }

      // Save UPI ID to database
      try {
        const { ApiService } = await import("@/services/ApiService");
        await ApiService.post("/api/users/sync", {
          authId: cred.user.uid,
          email: email,
          displayName: displayName.trim(),
          upiId: upiId.trim()
        });
      } catch (err) {
        console.warn("Failed immediate sync of UPI ID:", err);
      }

      // Send verification email — await so we know it fired before showing the screen
      await sendEmailVerification(cred.user).catch(() => { });
      // Stay on this page; polling useEffect will forward to /onboarding once verified
      setEmailVerificationPending(true);
      toast({
        title: "One more step!",
        description: `A verification email was sent to ${email}. Click the link, then you'll be taken to the app automatically.`,
      });
    } catch (err: any) {
      const decoded = firebaseAuthError(err);
      if (decoded.includes("not enabled")) setProviderDisabled(true);
      toast({ title: "Sign up failed", description: decoded, variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MAGIC LINK
  // ══════════════════════════════════════════════════════════════════════════
  const handleMagicLink = async () => {
    if (!email) {
      toast({ title: "Enter email", description: "Please enter your email to receive a sign-in link." });
      return;
    }
    setLoggingIn(true);
    try {
      await sendSignInLinkToEmail(auth, email, EMAIL_LINK_SETTINGS);
      localStorage.setItem("fairpay_magic_email", email);
      setMagicLinkSent(true);
      toast({ title: "Link sent!", description: `Check ${email} for your sign-in link.` });
    } catch (err: any) {
      toast({ title: "Failed to send link", description: firebaseAuthError(err), variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // GOOGLE
  // ══════════════════════════════════════════════════════════════════════════
  const handleGoogleLogin = async () => {
    setLoggingIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      if (firebaseUser) {
        await linkWithPopup(firebaseUser, provider);
        toast({ title: "Google linked!", description: "Google has been linked to your account." });
        navigate(from, { replace: true });
      } else {
        const result = await signInWithPopup(auth, provider);
        const isNew = getAdditionalUserInfo(result)?.isNewUser ?? false;
        toast({ title: isNew ? "Welcome to FairPay! 🎉" : "Welcome back!", description: "Signed in with Google." });
        navigate(isNew ? "/onboarding" : from, { replace: true });
      }
    } catch (err: any) {
      if (err.code === "auth/account-exists-with-different-credential") {
        const conflictEmail = err.customData?.email;
        if (conflictEmail) {
          const existing = await fetchSignInMethodsForEmail(auth, conflictEmail).catch(() => []);
          toast({
            title: "Email already in use",
            description: `This email is linked to: ${existing.join(", ")}. Please sign in with that method first.`,
            variant: "destructive",
          });
        }
      } else if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        toast({ title: "Google sign-in failed", description: firebaseAuthError(err), variant: "destructive" });
      }
    } finally {
      setLoggingIn(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // FORGOT PASSWORD — works for Google-only accounts too
  // sendPasswordResetEmail works for all providers. For Google-only users it
  // lets them set a password, enabling email+password sign-in alongside Google.
  // ══════════════════════════════════════════════════════════════════════════
  const handleForgotPassword = async () => {
    const target = (forgotEmail || email).trim();
    if (!target) {
      toast({ title: "Enter email", description: "Enter the email address linked to your account." });
      return;
    }
    setLoggingIn(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, target).catch(() => [] as string[]);
      const isGoogleOnly = methods.includes("google.com") && !methods.includes("password");

      await sendPasswordResetEmail(auth, target);

      toast({
        title: "Reset email sent!",
        description: isGoogleOnly
          ? `A password-setup link was sent to ${target}. After clicking it you'll also be able to sign in with email + password.`
          : `Check your inbox at ${target} for the reset link.`,
      });
      setShowForgotPassword(false);
      clearError();
    } catch (err: any) {
      toast({ title: "Failed", description: firebaseAuthError(err), variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  // ── Loading splash ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#4398BA] via-[#C3F0F7] to-background">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 max-w-md mx-auto bg-gradient-to-b from-[#4398BA] via-[#C3F0F7] to-background">

      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">Fair<span className="text-white/80">Pay</span></h1>
        <p className="text-sm text-white/70">Split smart. Stay fair.</p>
      </div>

      {/* Firebase Console config banner */}
      {providerDisabled && (
        <div className="w-full mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Email/Password is not enabled in Firebase</p>
            <p>
              Go to{" "}
              <a
                href="https://console.firebase.google.com/project/airpay-3f83e/authentication/providers"
                target="_blank"
                rel="noreferrer"
                className="underline font-medium"
              >
                Firebase Console → Authentication → Sign-in method
              </a>{" "}
              and enable <strong>Email/Password</strong>.
            </p>
          </div>
        </div>
      )}

      <Card className="w-full p-6 rounded-2xl border-0 shadow-lg space-y-4 animate-fade-in">

        {/* ══ FORGOT PASSWORD ══ */}
        {showForgotPassword ? (
          <>
            <div className="text-center mb-2">
              <p className="text-sm font-semibold">Reset your password</p>
              <p className="text-xs text-muted-foreground mt-1">
                Works for email accounts <em>and</em> Google accounts — we'll send a link to set a password.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                className="rounded-xl"
                value={forgotEmail || email}
                onChange={e => setForgotEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleForgotPassword()}
                autoFocus
              />
            </div>
            <Button onClick={handleForgotPassword} className="w-full rounded-xl" size="lg" disabled={loggingIn}>
              {loggingIn ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Reset Email
            </Button>
            <button
              onClick={() => { setShowForgotPassword(false); setForgotEmail(""); }}
              className="w-full text-center text-xs text-muted-foreground hover:underline"
            >
              ← Back to sign in
            </button>
          </>

          /* ══ EMAIL VERIFICATION PENDING ══ */
        ) : emailVerificationPending ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-semibold">Verify your email to continue</p>
            <p className="text-xs text-muted-foreground">
              We sent a verification link to <strong>{email}</strong>.<br />
              Click the link in your inbox — you'll be taken to the app automatically.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Waiting for verification…</span>
            </div>
            <button
              onClick={async () => {
                if (!auth.currentUser) return;
                await sendEmailVerification(auth.currentUser).catch(() => { });
                toast({ title: "Email resent!", description: `Check ${email} again.` });
              }}
              className="text-xs text-primary hover:underline"
            >
              Didn't receive it? Resend
            </button>
            <button
              onClick={() => setEmailVerificationPending(false)}
              className="block w-full text-center text-xs text-muted-foreground hover:underline"
            >
              ← Back
            </button>
          </div>

          /* ══ MAGIC LINK SENT ══ */
        ) : magicLinkSent ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-semibold">Check your inbox!</p>
            <p className="text-xs text-muted-foreground">
              We sent a sign-in link to <strong>{email}</strong>.<br />Tap the link to log in instantly — no password needed.
            </p>
            <button
              onClick={() => { setMagicLinkSent(false); setEmail(""); }}
              className="text-xs text-primary hover:underline"
            >
              Use a different email
            </button>
          </div>

          /* ══ EMAIL MODE ══ */
        ) : (
          <>
            {/* Sub-mode tabs */}
            <div className="flex rounded-xl bg-muted p-1 gap-1">
              {(["signin", "signup", "magic"] as EmailMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setEmailMode(m); setPassword(""); setConfirmPassword(""); setDisplayName(""); setUpiId(""); setConfirmUpiId(""); setProviderDisabled(false); }}
                  className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${emailMode === m ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {m === "signin" ? "Sign In" : m === "signup" ? "Create Account" : "Magic Link"}
                </button>
              ))}
            </div>

            {/* Shared email field */}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                className="rounded-xl"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            {/* ── Sign In ── */}
            {emailMode === "signin" && (
              <>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Your password"
                      className="rounded-xl pr-10"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleEmailPasswordSignIn()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button onClick={handleEmailPasswordSignIn} className="w-full rounded-xl" size="lg" disabled={loggingIn}>
                  {loggingIn ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                  Sign In
                </Button>
                <button
                  onClick={() => { setForgotEmail(email); setShowForgotPassword(true); }}
                  className="w-full text-center text-xs text-muted-foreground hover:underline"
                >
                  Forgot password? (works for Google accounts too)
                </button>
              </>
            )}

            {/* ── Create Account ── */}
            {emailMode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label>Your Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    type="text"
                    placeholder="Alex Johnson"
                    className="rounded-xl"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      className="rounded-xl pr-10"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Repeat password"
                    className="rounded-xl"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>UPI ID</Label>
                  <Input
                    type="text"
                    placeholder="e.g. name@bank"
                    className="rounded-xl"
                    value={upiId}
                    onChange={e => setUpiId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={upiId && upiId !== confirmUpiId ? "text-destructive" : ""}>Confirm UPI ID</Label>
                  <Input
                    type="text"
                    placeholder="Re-enter UPI ID"
                    className="rounded-xl"
                    value={confirmUpiId}
                    onChange={e => setConfirmUpiId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleEmailPasswordSignUp()}
                  />
                </div>
                <Button onClick={handleEmailPasswordSignUp} className="w-full rounded-xl" size="lg" disabled={loggingIn}>
                  {loggingIn ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Create Account
                </Button>
              </>
            )}

            {/* ── Magic Link ── */}
            {emailMode === "magic" && (
              <>
                <p className="text-xs text-muted-foreground -mt-1">
                  We'll email you a secure link — no password needed.<br />
                  <span className="text-amber-600 font-medium">Requires "Email link (passwordless)" enabled in Firebase Console.</span>
                </p>
                <Button onClick={handleMagicLink} className="w-full rounded-xl" size="lg" disabled={loggingIn}>
                  {loggingIn ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Send Magic Link
                </Button>
              </>
            )}
          </>
        )}

        {/* ── Divider + Google ── */}
        {!showForgotPassword && !magicLinkSent && !emailVerificationPending && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">or</span></div>
            </div>
            <Button onClick={handleGoogleLogin} variant="outline" className="w-full rounded-xl" size="lg" disabled={loggingIn}>
              <Chrome className="w-4 h-4 mr-2" /> Continue with Google
            </Button>
          </>
        )}
      </Card>

      <p className="text-xs text-muted-foreground mt-6">
        New here?{" "}
        <button
          onClick={() => setEmailMode("signup")}
          className="text-primary font-medium hover:underline"
        >
          Create a free account
        </button>
      </p>
    </div>
  );
};

export default LoginPage;
