import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowLeft, Check, User as UserIcon } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { orbitaAuth } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { authDebug } from "@/lib/auth/debug";
import { ensureUserProfile } from "@/lib/auth/profile";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "signup" | "signin" } => {
    const mode = search.mode === "signup" || search.mode === "signin" ? search.mode : undefined;
    if (mode) return { mode };
    return {};
  },
  head: () => ({
    meta: [
      { title: "Sign in · Orbita" },
      {
        name: "description",
        content:
          "Sign in to Orbita to sync your geography mastery, streaks and challenges across devices.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot" | "check-email";
type Notice = { tone: "success" | "error" | "info"; message: string } | null;

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email")
  .max(255);
const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "Too long");
const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter at least 2 characters")
  .max(60, "Too long");

function scorePassword(p: string): { score: number; label: string } {
  if (!p) return { score: 0, label: "" };
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const label = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"][s] ?? "";
  return { score: s, label };
}

function friendlyAuthMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Authentication failed");
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "__EMAIL_NOT_CONFIRMED__";
  if (/already registered|already been registered|user already/i.test(message)) return "This email already has an account. Try signing in instead.";
  if (/password/i.test(message) && /weak|pwned|compromised/i.test(message)) return "Choose a stronger password that has not appeared in a data breach.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a moment and try again.";
  if (/provider is not enabled|unsupported provider/i.test(message)) return "Google sign-in is not configured yet. Use email and password to sign in.";
  if (/oauth/i.test(message)) return "Google sign-in failed. Please try again or use email and password.";
  return message;
}

function AuthPage() {
  const router = useRouter();
  const { mode: urlMode } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [submittedEmail, setSubmittedEmail] = useState("");

  useEffect(() => {
    if (urlMode === "signup") setMode("signup");
    else if (urlMode === "signin") setMode("signin");
  }, [urlMode]);

  useEffect(() => {
    if (!authLoading && user) router.navigate({ to: "/" });
  }, [user, authLoading, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const authError = params.get("error_description") || hashParams.get("error_description");
    if (authError) {
      const message = friendlyAuthMessage(new Error(authError));
      authDebug("url auth error", { message });
      setNotice({ tone: "error", message });
      toast.error(message);
    }
  }, []);

  const strength = useMemo(() => scorePassword(password), [password]);

  const validate = (): boolean => {
    const next: typeof errors = {};
    const e = emailSchema.safeParse(email);
    if (!e.success) next.email = e.error.issues[0]?.message;
    if (mode !== "forgot") {
      const p = passwordSchema.safeParse(password);
      if (!p.success) next.password = p.error.issues[0]?.message;
    }
    if (mode === "signup") {
      const n = nameSchema.safeParse(name);
      if (!n.success) next.name = n.error.issues[0]?.message;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        authDebug("signin:start", { emailDomain: email.split("@")[1] ?? null });
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          const msg = friendlyAuthMessage(error);
          // Special case: email not confirmed — offer direct resend flow
          if (msg === "__EMAIL_NOT_CONFIRMED__") {
            setSubmittedEmail(email.trim());
            setNotice({ tone: "info", message: "You need to confirm your email before signing in. Check your inbox, or resend below." });
            setMode("check-email");
            return;
          }
          throw error;
        }
        authDebug("signin:success", { userId: data.user?.id, hasSession: !!data.session });
        if (data.user) await ensureUserProfile(data.user);
        toast.success("Welcome back");
        await router.navigate({ to: "/" });
      } else if (mode === "signup") {
        authDebug("signup:start", { emailDomain: email.split("@")[1] ?? null, hasName: !!name.trim() });
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { display_name: name.trim() },
          },
        });
        if (error) throw error;
        authDebug("signup:success", { userId: data.user?.id, hasSession: !!data.session, identities: data.user?.identities?.length ?? null });
        if (data.session && data.user) {
          await ensureUserProfile(data.user, name);
          toast.success("Account created");
          await router.navigate({ to: "/" });
          return;
        }
        setSubmittedEmail(email.trim());
        setNotice({ tone: "success", message: "Account created. Check your inbox and spam folder to confirm your email." });
        toast.success("Account created — check your email to confirm");
        setMode("check-email");
      } else {
        authDebug("password reset:start", { emailDomain: email.split("@")[1] ?? null });
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        authDebug("password reset:sent", { emailDomain: email.split("@")[1] ?? null });
        setNotice({ tone: "success", message: "Reset link sent. Check your inbox and spam folder." });
        toast.success("Reset link sent — check your inbox");
        setMode("signin");
      }
    } catch (err) {
      const message = friendlyAuthMessage(err);
      const display = message === "__EMAIL_NOT_CONFIRMED__" ? "Please confirm your email before signing in." : message;
      authDebug("submit:failed", { mode, error: display });
      setNotice({ tone: "error", message: display });
      toast.error(display);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setGoogleBusy(true);
    setNotice(null);
    try {
      authDebug("oauth google:start");
      const result = await orbitaAuth.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        const message = friendlyAuthMessage(result.error);
        authDebug("oauth google:failed", { error: message });
        setNotice({ tone: "error", message });
        toast.error(message);
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      authDebug("oauth google:session set", { userId: data.user?.id });
      if (data.user) await ensureUserProfile(data.user);
      await router.navigate({ to: "/" });
    } catch (err) {
      const message = friendlyAuthMessage(err);
      authDebug("oauth google:exception", { error: message });
      setNotice({ tone: "error", message });
      toast.error(message);
    } finally {
      setGoogleBusy(false);
    }
  };

  const title =
    mode === "signin"
      ? "Welcome back"
      : mode === "signup"
        ? "Create your account"
        : mode === "check-email"
          ? "Check your email"
        : "Reset your password";
  const subtitle =
    mode === "signin"
      ? "Continue your journey through every corner of the world."
      : mode === "signup"
        ? "Sync your progress, streaks and unlocks across every device."
        : mode === "check-email"
          ? "Confirm your address to activate ORBITA sync."
        : "We'll email you a secure link to set a new password.";

  return (
    <main className="relative min-h-dvh flex items-center justify-center px-4 pt-24 pb-12">
      {/* Orbital ambience */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          className="absolute left-1/2 top-[18%] -translate-x-1/2 size-[640px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--violet) 40%, transparent), transparent 60%)",
            filter: "blur(40px)",
          }}
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 80, ease: "linear", repeat: Infinity }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[820px] rounded-full border border-white/5"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 120, ease: "linear", repeat: Infinity }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[1100px] rounded-full border border-white/[0.03]"
        />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong relative w-full max-w-md rounded-3xl p-7 sm:p-9"
      >
        {/* Brand */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to Orbita
        </Link>

        <header className="mt-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="font-display text-3xl font-bold tracking-tight text-white">
                {title}
              </h1>
              <p className="mt-1.5 text-sm text-white/55 leading-relaxed">{subtitle}</p>
            </motion.div>
          </AnimatePresence>
        </header>

        {notice && <AuthNotice notice={notice} />}

        {mode === "check-email" ? (
          <CheckEmailPanel
            email={submittedEmail || email}
            busy={busy}
            onResend={async () => {
              const target = submittedEmail || email;
              if (!target) {
                setMode("signup");
                return;
              }
              setBusy(true);
              setNotice(null);
              try {
                authDebug("resend confirmation:start", { emailDomain: target.split("@")[1] ?? null });
                const { error } = await supabase.auth.resend({
                  type: "signup",
                  email: target,
                  options: { emailRedirectTo: `${window.location.origin}/auth` },
                });
                if (error) throw error;
                authDebug("resend confirmation:sent");
                setNotice({ tone: "success", message: "Confirmation email sent again. Check your inbox and spam folder." });
                toast.success("Confirmation email sent");
              } catch (err) {
                const message = friendlyAuthMessage(err);
                const display = message === "__EMAIL_NOT_CONFIRMED__" ? "Please confirm your email first." : message;
                setNotice({ tone: "error", message: display });
                toast.error(display);
              } finally {
                setBusy(false);
              }
            }}
            onBack={() => {
              setErrors({});
              setMode("signin");
            }}
          />
        ) : (
          <>
            {mode !== "forgot" && (
              <>
                <button
                  type="button"
                  onClick={onGoogle}
                  disabled={googleBusy || busy}
                  className="mt-6 w-full inline-flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
                >
                  {googleBusy ? (
                    <Loader2 className="size-4 animate-spin text-cyan" aria-hidden />
                  ) : (
                    <GoogleIcon />
                  )}
                  <span>Continue with Google</span>
                </button>

                <div className="my-5 flex items-center gap-3 text-[10px] uppercase font-mono tracking-[0.2em] text-white/35">
                  <span className="h-px flex-1 bg-white/10" />
                  or with email
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              </>
            )}

            <form onSubmit={onSubmit} className={mode === "forgot" ? "mt-6 space-y-4" : "space-y-4"} noValidate>
              {mode === "signup" && (
                <Field
                  id="name"
                  label="Display Name"
                  icon={<UserIcon className="size-4" aria-hidden />}
                  error={errors.name}
                >
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Commander / Explorer name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    onBlur={() => name && validate()}
                    required
                    maxLength={60}
                    disabled={busy || googleBusy}
                    className="w-full bg-transparent pl-10 pr-3 py-3 text-sm text-white placeholder:text-white/30 outline-none"
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "name-err" : undefined}
                  />
                </Field>
              )}

              <Field
                id="email"
                label="Email"
                icon={<Mail className="size-4" aria-hidden />}
                error={errors.email}
              >
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  onBlur={() => email && validate()}
                  required
                  disabled={busy || googleBusy}
                  className="w-full bg-transparent pl-10 pr-3 py-3 text-sm text-white placeholder:text-white/30 outline-none"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-err" : undefined}
                />
              </Field>

              {mode !== "forgot" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="text-xs font-mono uppercase tracking-wider text-white/50">
                      Password
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setErrors({});
                          setNotice(null);
                          setMode("forgot");
                        }}
                        className="text-xs text-cyan hover:text-cyan/80 transition-colors font-medium"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>

                  <Field
                    id="password"
                    label="Password"
                    hideLabel
                    icon={<Lock className="size-4" aria-hidden />}
                    error={errors.password}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPwd((s) => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition"
                        aria-label={showPwd ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    }
                  >
                    <input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      placeholder={mode === "signin" ? "Enter your password" : "At least 8 characters"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      onBlur={() => password && validate()}
                      required
                      minLength={8}
                      maxLength={72}
                      disabled={busy || googleBusy}
                      className="w-full bg-transparent pl-10 pr-11 py-3 text-sm text-white placeholder:text-white/30 outline-none"
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "password-err" : undefined}
                    />
                  </Field>
                </div>
              )}

              {mode === "signup" && password.length > 0 && (
                <StrengthBar score={strength.score} label={strength.label} password={password} />
              )}

              <button
                type="submit"
                disabled={busy || googleBusy}
                className="group relative w-full overflow-hidden rounded-2xl px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70 active:scale-[0.99] transition-all shadow-[0_10px_30px_-8px_color-mix(in_oklab,var(--violet)_60%,transparent)] mt-2"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--violet) 85%, white 10%), color-mix(in oklab, var(--cyan) 85%, white 10%))",
                }}
              >
                <span className="relative inline-flex items-center justify-center gap-2">
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {mode === "signin"
                    ? busy
                      ? "Signing in…"
                      : "Sign in"
                    : mode === "signup"
                      ? busy
                        ? "Creating account…"
                        : "Create account"
                      : busy
                        ? "Sending link…"
                        : "Send reset link"}
                </span>
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
              </button>
            </form>

            <footer className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/55">
                {mode === "forgot" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setErrors({});
                      setNotice(null);
                      setMode("signin");
                    }}
                    className="inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="size-3" /> Back to sign in
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setErrors({});
                      setNotice(null);
                      setMode(mode === "signin" ? "signup" : "signin");
                    }}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    {mode === "signin" ? (
                      <>
                        New to Orbita? <span className="text-cyan font-medium ml-1">Create account</span>
                      </>
                    ) : (
                      <>
                        Already have an account? <span className="text-cyan font-medium ml-1">Sign in</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {mode !== "forgot" && (
                <>
                  <div className="flex items-center gap-3 text-[10px] uppercase font-mono tracking-[0.2em] text-white/30">
                    <span className="h-px flex-1 bg-white/10" />
                    or
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="p-3 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col items-center gap-2 text-center">
                    <Link
                      to="/"
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-white/80 hover:border-white/20 hover:bg-white/[0.08] hover:text-white transition-all active:scale-[0.99]"
                    >
                      Continue as guest
                    </Link>
                    <span className="text-[11px] text-white/40 leading-snug">
                      Your progress stays safely on this device without creating an account.
                    </span>
                  </div>
                </>
              )}
            </footer>

            {mode === "signup" && (
              <p className="mt-5 text-center text-[11px] leading-relaxed text-white/40">
                By creating an account you agree to Orbita's terms. Your email is only used for syncing and account recovery.
              </p>
            )}
          </>
        )}
      </motion.section>
    </main>
  );
}

function AuthNotice({ notice }: { notice: NonNullable<Notice> }) {
  const toneClass =
    notice.tone === "error"
      ? "border-coral/40 bg-coral/10 text-coral"
      : notice.tone === "success"
        ? "border-neon/30 bg-neon/10 text-neon"
        : "border-cyan/30 bg-cyan/10 text-cyan";
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-5 rounded-2xl border p-3.5 text-xs leading-relaxed ${toneClass}`}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {notice.message}
    </motion.div>
  );
}

function CheckEmailPanel({
  email,
  busy,
  onResend,
  onBack,
}: {
  email: string;
  busy: boolean;
  onResend: () => Promise<void>;
  onBack: () => void;
}) {
  return (
    <div className="mt-7 space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full border border-cyan/30 bg-cyan/10 text-cyan">
          <Mail className="size-5" aria-hidden />
        </div>
        <p className="mt-4 text-base font-display font-semibold text-white">Confirmation email sent</p>
        <p className="mt-2 text-xs leading-relaxed text-white/60">
          We sent a verification link to <span className="text-white font-medium">{email}</span>. Please click the link to activate Orbita cloud sync.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void onResend()}
        disabled={busy}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.99] transition-all disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="inline-flex items-center justify-center gap-2">
          {busy && <Loader2 className="size-4 animate-spin text-cyan" aria-hidden />}
          Resend confirmation email
        </span>
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-white/50 hover:text-white transition-colors"
      >
        ← Back to sign in
      </button>
    </div>
  );
}

function Field({
  id,
  label,
  hideLabel = false,
  icon,
  error,
  trailing,
  children,
}: {
  id: string;
  label: string;
  hideLabel?: boolean;
  icon: React.ReactNode;
  error?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {!hideLabel && (
        <label htmlFor={id} className="block text-xs font-mono uppercase tracking-wider text-white/50">
          {label}
        </label>
      )}
      <div
        className={`relative rounded-2xl border bg-white/[0.03] transition-all duration-200 focus-within:border-cyan/70 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_20px_-4px_color-mix(in_oklab,var(--cyan)_25%,transparent)] ${
          error ? "border-coral/60 bg-coral/5" : "border-white/10 hover:border-white/20"
        }`}
      >
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
          {icon}
        </span>
        {children}
        {trailing}
      </div>
      <div className="min-h-[18px]">
        <AnimatePresence>
          {error && (
            <motion.p
              id={`${id}-err`}
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              className="text-xs text-coral font-medium"
              role="alert"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StrengthBar({ score, label, password }: { score: number; label: string; password?: string }) {
  const pct = Math.min(100, (score / 5) * 100);
  const color =
    score <= 1
      ? "var(--coral)"
      : score <= 2
        ? "#f5a524"
        : score <= 3
          ? "var(--cyan)"
          : "var(--neon)";

  const hasLength = (password?.length ?? 0) >= 8;
  const hasMixed = /[A-Z]/.test(password ?? "") && /[a-z]/.test(password ?? "");
  const hasNumberOrSpecial = /[\d\W]/.test(password ?? "");

  return (
    <div className="p-3 rounded-2xl border border-white/5 bg-white/[0.02] space-y-2" aria-live="polite">
      <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-white/50">
        <span>Password strength</span>
        <span className="font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={false}
          animate={{ width: `${pct}%`, backgroundColor: color }}
          transition={{ duration: 0.3 }}
          className="h-full rounded-full"
        />
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] text-white/45 pt-1">
        <span className={cn("inline-flex items-center gap-1", hasLength && "text-neon")}>
          <Check className={cn("size-2.5", hasLength ? "text-neon" : "opacity-30")} /> 8+ chars
        </span>
        <span className={cn("inline-flex items-center gap-1", hasMixed && "text-neon")}>
          <Check className={cn("size-2.5", hasMixed ? "text-neon" : "opacity-30")} /> Upper & lowercase
        </span>
        <span className={cn("inline-flex items-center gap-1", hasNumberOrSpecial && "text-neon")}>
          <Check className={cn("size-2.5", hasNumberOrSpecial ? "text-neon" : "opacity-30")} /> Number or symbol
        </span>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.45-1.7 4.25-5.5 4.25-3.31 0-6.02-2.74-6.02-6.13S8.69 6.1 12 6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.86 3.5 14.66 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12S6.76 21.5 12 21.5c6.92 0 9.5-4.86 9.5-7.4 0-.5-.05-.88-.12-1.27H12z"
      />
    </svg>
  );
}

