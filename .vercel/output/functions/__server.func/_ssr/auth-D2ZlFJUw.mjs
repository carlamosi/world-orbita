import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { u as useRouter, L as Link } from '../_libs/tanstack__react-router.mjs';
import { supabase } from './client-CnjuyyaV.mjs';
import { R as Route$4, u as useAuth, a as authDebug, e as ensureUserProfile } from './router-T2jDQtma.mjs';
import { toast } from '../_libs/sonner.mjs';
import { m as motion, A as AnimatePresence } from '../_libs/framer-motion.mjs';
import { A as ArrowLeft, g as LoaderCircle, U as User, M as Mail, E as EyeOff, f as Eye, L as Lock, c as Check } from '../_libs/lucide-react.mjs';
import { s as stringType } from '../_libs/zod.mjs';
import '../_libs/tanstack__router-core.mjs';
import '../_libs/tanstack__history.mjs';
import '../_libs/cookie-es.mjs';
import '../_libs/seroval.mjs';
import '../_libs/seroval-plugins.mjs';
import 'node:stream/web';
import 'node:stream';
import '../_libs/react-dom.mjs';
import 'util';
import 'crypto';
import 'async_hooks';
import 'stream';
import '../_libs/isbot.mjs';
import '../_libs/supabase__supabase-js.mjs';
import '../_libs/supabase__postgrest-js.mjs';
import '../_libs/supabase__realtime-js.mjs';
import '../_libs/supabase__phoenix.mjs';
import '../_libs/supabase__storage-js.mjs';
import '../_libs/iceberg-js.mjs';
import '../_libs/supabase__auth-js.mjs';
import 'tslib';
import '../_libs/supabase__functions-js.mjs';
import '../_libs/tanstack__query-core.mjs';
import '../_libs/tanstack__react-query.mjs';
import '../_libs/clsx.mjs';
import '../_libs/tailwind-merge.mjs';
import '../_libs/radix-ui__react-dropdown-menu.mjs';
import '../_libs/radix-ui__primitive.mjs';
import '../_libs/radix-ui__react-compose-refs.mjs';
import '../_libs/radix-ui__react-context.mjs';
import '../_libs/@radix-ui/react-use-controllable-state+[...].mjs';
import '../_libs/@radix-ui/react-use-layout-effect+[...].mjs';
import '../_libs/radix-ui__react-primitive.mjs';
import '../_libs/radix-ui__react-slot.mjs';
import '../_libs/radix-ui__react-menu.mjs';
import '../_libs/radix-ui__react-collection.mjs';
import '../_libs/radix-ui__react-direction.mjs';
import '../_libs/@radix-ui/react-dismissable-layer+[...].mjs';
import '../_libs/@radix-ui/react-use-callback-ref+[...].mjs';
import '../_libs/@radix-ui/react-use-escape-keydown+[...].mjs';
import '../_libs/radix-ui__react-focus-guards.mjs';
import '../_libs/radix-ui__react-focus-scope.mjs';
import '../_libs/radix-ui__react-popper.mjs';
import '../_libs/floating-ui__react-dom.mjs';
import '../_libs/floating-ui__dom.mjs';
import '../_libs/floating-ui__core.mjs';
import '../_libs/floating-ui__utils.mjs';
import '../_libs/radix-ui__react-arrow.mjs';
import '../_libs/radix-ui__react-use-size.mjs';
import '../_libs/radix-ui__react-portal.mjs';
import '../_libs/radix-ui__react-presence.mjs';
import '../_libs/radix-ui__react-roving-focus.mjs';
import '../_libs/radix-ui__react-id.mjs';
import '../_libs/aria-hidden.mjs';
import '../_libs/react-remove-scroll.mjs';
import '../_libs/react-remove-scroll-bar.mjs';
import '../_libs/react-style-singleton.mjs';
import '../_libs/get-nonce.mjs';
import '../_libs/use-sidecar.mjs';
import '../_libs/use-callback-ref.mjs';
import '../_libs/zustand.mjs';
import '../_libs/motion-dom.mjs';
import '../_libs/motion-utils.mjs';

const orbitaAuth = {
  auth: {
    signInWithOAuth: async (provider, opts) => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: opts?.redirect_uri ?? window.location.origin,
          queryParams: opts?.extraParams
        }
      });
      if (error) return { error };
      if (data.url) {
        window.location.href = data.url;
        return { redirected: true };
      }
      return { redirected: false };
    }
  }
};

const emailSchema = stringType().trim().min(1, "Email is required").email("Enter a valid email").max(255);
const passwordSchema = stringType().min(8, "At least 8 characters").max(72, "Too long");
const nameSchema = stringType().trim().min(2, "Enter at least 2 characters").max(60, "Too long");
function scorePassword(p) {
  if (!p) return {
    score: 0,
    label: ""
  };
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const label = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"][s] ?? "";
  return {
    score: s,
    label
  };
}
function friendlyAuthMessage(error) {
  const message = error instanceof Error ? error.message : String(error || "Authentication failed");
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirm your email before signing in.";
  if (/already registered|already been registered|user already/i.test(message)) return "This email already has an account. Try signing in instead.";
  if (/password/i.test(message) && /weak|pwned|compromised/i.test(message)) return "Choose a stronger password that has not appeared in a data breach.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a moment and try again.";
  return message;
}
function AuthPage() {
  const router = useRouter();
  const {
    mode: urlMode
  } = Route$4.useSearch();
  const {
    user,
    loading: authLoading
  } = useAuth();
  const [mode, setMode] = reactExports.useState("signin");
  const [name, setName] = reactExports.useState("");
  const [email, setEmail] = reactExports.useState("");
  const [password, setPassword] = reactExports.useState("");
  const [showPwd, setShowPwd] = reactExports.useState(false);
  const [busy, setBusy] = reactExports.useState(false);
  const [googleBusy, setGoogleBusy] = reactExports.useState(false);
  const [errors, setErrors] = reactExports.useState({});
  const [notice, setNotice] = reactExports.useState(null);
  const [submittedEmail, setSubmittedEmail] = reactExports.useState("");
  reactExports.useEffect(() => {
    if (urlMode === "signup") setMode("signup");
    else if (urlMode === "signin") setMode("signin");
  }, [urlMode]);
  reactExports.useEffect(() => {
    if (!authLoading && user) router.navigate({
      to: "/"
    });
  }, [user, authLoading, router]);
  reactExports.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const authError = params.get("error_description") || hashParams.get("error_description");
    if (authError) {
      const message = friendlyAuthMessage(new Error(authError));
      authDebug("url auth error", {
        message
      });
      setNotice({
        tone: "error",
        message
      });
      toast.error(message);
    }
  }, []);
  const strength = reactExports.useMemo(() => scorePassword(password), [password]);
  const validate = () => {
    const next = {};
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
  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        authDebug("signin:start", {
          emailDomain: email.split("@")[1] ?? null
        });
        const {
          data,
          error
        } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
        authDebug("signin:success", {
          userId: data.user?.id,
          hasSession: !!data.session
        });
        if (data.user) await ensureUserProfile(data.user);
        toast.success("Welcome back");
        await router.navigate({
          to: "/"
        });
      } else if (mode === "signup") {
        authDebug("signup:start", {
          emailDomain: email.split("@")[1] ?? null,
          hasName: !!name.trim()
        });
        const {
          data,
          error
        } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              display_name: name.trim()
            }
          }
        });
        if (error) throw error;
        authDebug("signup:success", {
          userId: data.user?.id,
          hasSession: !!data.session,
          identities: data.user?.identities?.length ?? null
        });
        if (data.session && data.user) {
          await ensureUserProfile(data.user, name);
          toast.success("Account created");
          await router.navigate({
            to: "/"
          });
          return;
        }
        setSubmittedEmail(email.trim());
        setNotice({
          tone: "success",
          message: "Account created. Check your inbox and spam folder to confirm your email."
        });
        toast.success("Account created — check your email to confirm");
        setMode("check-email");
      } else {
        authDebug("password reset:start", {
          emailDomain: email.split("@")[1] ?? null
        });
        const {
          error
        } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (error) throw error;
        authDebug("password reset:sent", {
          emailDomain: email.split("@")[1] ?? null
        });
        setNotice({
          tone: "success",
          message: "Reset link sent. Check your inbox and spam folder."
        });
        toast.success("Reset link sent — check your inbox");
        setMode("signin");
      }
    } catch (err) {
      const message = friendlyAuthMessage(err);
      authDebug("submit:failed", {
        mode,
        error: message
      });
      setNotice({
        tone: "error",
        message
      });
      toast.error(message);
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
        redirect_uri: window.location.origin,
        extraParams: {
          prompt: "select_account"
        }
      });
      if (result.error) {
        const message = friendlyAuthMessage(result.error);
        authDebug("oauth google:failed", {
          error: message
        });
        setNotice({
          tone: "error",
          message
        });
        toast.error(message);
        return;
      }
      if (result.redirected) return;
      const {
        data
      } = await supabase.auth.getUser();
      authDebug("oauth google:session set", {
        userId: data.user?.id
      });
      if (data.user) await ensureUserProfile(data.user);
      await router.navigate({
        to: "/"
      });
    } catch (err) {
      const message = friendlyAuthMessage(err);
      authDebug("oauth google:exception", {
        error: message
      });
      setNotice({
        tone: "error",
        message
      });
      toast.error(message);
    } finally {
      setGoogleBusy(false);
    }
  };
  const title = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : mode === "check-email" ? "Check your email" : "Reset your password";
  const subtitle = mode === "signin" ? "Continue your journey through every corner of the world." : mode === "signup" ? "Sync your progress, streaks and unlocks across every device." : mode === "check-email" ? "Confirm your address to activate ORBITA sync." : "We'll email you a secure link to set a new password.";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { className: "relative min-h-dvh flex items-center justify-center px-4 pt-24 pb-12", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "aria-hidden": true, className: "pointer-events-none absolute inset-0 overflow-hidden", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { initial: {
        opacity: 0,
        scale: 0.9
      }, animate: {
        opacity: 1,
        scale: 1
      }, transition: {
        duration: 1.6,
        ease: "easeOut"
      }, className: "absolute left-1/2 top-[18%] -translate-x-1/2 size-[640px] rounded-full", style: {
        background: "radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--violet) 40%, transparent), transparent 60%)",
        filter: "blur(40px)"
      } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { animate: {
        rotate: 360
      }, transition: {
        duration: 80,
        ease: "linear",
        repeat: Infinity
      }, className: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[820px] rounded-full border border-white/5" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { animate: {
        rotate: -360
      }, transition: {
        duration: 120,
        ease: "linear",
        repeat: Infinity
      }, className: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[1100px] rounded-full border border-white/[0.03]" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(motion.section, { initial: {
      opacity: 0,
      y: 16
    }, animate: {
      opacity: 1,
      y: 0
    }, transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1]
    }, className: "glass-strong relative w-full max-w-md rounded-3xl p-7 sm:p-9", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/", className: "inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowLeft, { className: "size-3.5", "aria-hidden": true }),
        "Back to Orbita"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "mt-5", children: /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { mode: "wait", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(motion.div, { initial: {
        opacity: 0,
        y: 6
      }, animate: {
        opacity: 1,
        y: 0
      }, exit: {
        opacity: 0,
        y: -6
      }, transition: {
        duration: 0.25
      }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "font-display text-[28px] leading-tight font-semibold text-foreground", children: title }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1.5 text-sm text-muted-foreground", children: subtitle })
      ] }, mode) }) }),
      notice && /* @__PURE__ */ jsxRuntimeExports.jsx(AuthNotice, { notice }),
      mode === "check-email" ? /* @__PURE__ */ jsxRuntimeExports.jsx(CheckEmailPanel, { email: submittedEmail || email, busy, onResend: async () => {
        if (!password || !email) {
          setMode("signup");
          return;
        }
        setBusy(true);
        setNotice(null);
        try {
          authDebug("signup resend:start", {
            emailDomain: email.split("@")[1] ?? null
          });
          const {
            error
          } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth`,
              data: {
                display_name: name.trim()
              }
            }
          });
          if (error) throw error;
          setNotice({
            tone: "success",
            message: "Confirmation email sent again. Check your inbox and spam folder."
          });
          toast.success("Confirmation email sent");
        } catch (err) {
          const message = friendlyAuthMessage(err);
          setNotice({
            tone: "error",
            message
          });
          toast.error(message);
        } finally {
          setBusy(false);
        }
      }, onBack: () => {
        setErrors({});
        setMode("signin");
      } }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        mode !== "forgot" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: onGoogle, disabled: googleBusy || busy, className: "mt-7 w-full inline-flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-foreground hover:bg-white/[0.08] hover:border-white/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60", children: [
            googleBusy ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "size-4 animate-spin", "aria-hidden": true }) : /* @__PURE__ */ jsxRuntimeExports.jsx(GoogleIcon, {}),
            "Continue with Google"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "h-px flex-1 bg-white/10" }),
            "or with email",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "h-px flex-1 bg-white/10" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit, className: mode === "forgot" ? "mt-7 space-y-4" : "space-y-4", noValidate: true, children: [
          mode === "signup" && /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { id: "name", label: "Name", icon: /* @__PURE__ */ jsxRuntimeExports.jsx(User, { className: "size-4", "aria-hidden": true }), error: errors.name, children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "name", type: "text", autoComplete: "name", placeholder: "Your name", value: name, onChange: (e) => setName(e.target.value), onBlur: () => name && validate(), required: true, maxLength: 60, className: "w-full bg-transparent pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none", "aria-invalid": !!errors.name, "aria-describedby": errors.name ? "name-err" : void 0 }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { id: "email", label: "Email", icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Mail, { className: "size-4", "aria-hidden": true }), error: errors.email, children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "email", type: "email", autoComplete: "email", inputMode: "email", placeholder: "you@orbit.com", value: email, onChange: (e) => setEmail(e.target.value), onBlur: () => email && validate(), required: true, className: "w-full bg-transparent pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none", "aria-invalid": !!errors.email, "aria-describedby": errors.email ? "email-err" : void 0 }) }),
          mode !== "forgot" && /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { id: "password", label: "Password", icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "size-4", "aria-hidden": true }), error: errors.password, trailing: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => setShowPwd((s) => !s), className: "absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition", "aria-label": showPwd ? "Hide password" : "Show password", tabIndex: -1, children: showPwd ? /* @__PURE__ */ jsxRuntimeExports.jsx(EyeOff, { className: "size-4" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Eye, { className: "size-4" }) }), children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "password", type: showPwd ? "text" : "password", autoComplete: mode === "signin" ? "current-password" : "new-password", placeholder: mode === "signin" ? "Your password" : "At least 8 characters", value: password, onChange: (e) => setPassword(e.target.value), onBlur: () => password && validate(), required: true, minLength: 8, maxLength: 72, className: "w-full bg-transparent pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none", "aria-invalid": !!errors.password, "aria-describedby": errors.password ? "password-err" : void 0 }) }),
          mode === "signup" && password.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(StrengthBar, { score: strength.score, label: strength.label }),
          mode === "signin" && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-end -mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => setMode("forgot"), className: "text-xs text-muted-foreground hover:text-cyan transition-colors", children: "Forgot password?" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "submit", disabled: busy || googleBusy, className: "group relative w-full overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70", style: {
            background: "linear-gradient(135deg, color-mix(in oklab, var(--violet) 90%, white 0%), color-mix(in oklab, var(--cyan) 90%, white 0%))",
            boxShadow: "0 10px 40px -10px color-mix(in oklab, var(--violet) 60%, transparent), inset 0 1px 0 rgba(255,255,255,0.18)"
          }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "relative inline-flex items-center justify-center gap-2", children: [
              busy && /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "size-4 animate-spin", "aria-hidden": true }),
              mode === "signin" ? busy ? "Signing in…" : "Sign in" : mode === "signup" ? busy ? "Creating account…" : "Create account" : busy ? "Sending link…" : "Send reset link"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": true, className: "absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("footer", { className: "mt-6 space-y-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground", children: mode === "forgot" ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => setMode("signin"), className: "hover:text-foreground transition-colors", children: "← Back to sign in" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => {
            setErrors({});
            setNotice(null);
            setMode(mode === "signin" ? "signup" : "signin");
          }, className: "hover:text-foreground transition-colors", children: mode === "signin" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            "New to Orbita? ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-cyan", children: "Create account" })
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            "Already have an account? ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-cyan", children: "Sign in" })
          ] }) }) }),
          mode !== "forgot" && mode !== "check-email" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "h-px flex-1 bg-white/10" }),
              "or",
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "h-px flex-1 bg-white/10" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/", className: "flex w-full items-center justify-center rounded-xl border border-white/8 bg-white/[0.02] px-4 py-2.5 text-xs text-muted-foreground hover:border-white/15 hover:bg-white/[0.05] hover:text-foreground transition-all", children: "Continue as guest — progress stays on this device" })
          ] })
        ] }),
        mode === "signup" && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-5 text-[11px] leading-relaxed text-muted-foreground/70", children: "By creating an account you agree to our terms and acknowledge our privacy practices. We use your email only to sync your progress." })
      ] })
    ] })
  ] });
}
function AuthNotice({
  notice
}) {
  const toneClass = notice.tone === "error" ? "border-coral/40 bg-coral/10 text-coral" : notice.tone === "success" ? "border-neon/30 bg-neon/10 text-neon" : "border-cyan/30 bg-cyan/10 text-cyan";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { initial: {
    opacity: 0,
    y: -4
  }, animate: {
    opacity: 1,
    y: 0
  }, className: `mt-5 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${toneClass}`, role: notice.tone === "error" ? "alert" : "status", "aria-live": "polite", children: notice.message });
}
function CheckEmailPanel({
  email,
  busy,
  onResend,
  onBack
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-7 space-y-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-center", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mx-auto grid size-12 place-items-center rounded-full border border-cyan/30 bg-cyan/10 text-cyan", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Mail, { className: "size-5", "aria-hidden": true }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-4 text-sm font-medium text-foreground", children: "Confirmation sent" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-2 text-sm leading-relaxed text-muted-foreground", children: [
        "We sent a confirmation link to ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-foreground", children: email }),
        ". Check your inbox and spam folder."
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => void onResend(), disabled: busy, className: "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-foreground hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center justify-center gap-2", children: [
      busy && /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "size-4 animate-spin", "aria-hidden": true }),
      "Resend confirmation email"
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onBack, className: "w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors", children: "Back to sign in" })
  ] });
}
function Field({
  id,
  label,
  icon,
  error,
  trailing,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: id, className: "sr-only", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `relative rounded-xl border bg-white/[0.03] transition-colors focus-within:border-cyan/60 focus-within:bg-white/[0.05] ${error ? "border-coral/60" : "border-white/10"}`, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground", children: icon }),
      children,
      trailing
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { children: error && /* @__PURE__ */ jsxRuntimeExports.jsx(motion.p, { id: `${id}-err`, initial: {
      opacity: 0,
      height: 0
    }, animate: {
      opacity: 1,
      height: "auto"
    }, exit: {
      opacity: 0,
      height: 0
    }, className: "mt-1.5 text-xs text-coral", role: "alert", children: error }) })
  ] });
}
function StrengthBar({
  score,
  label
}) {
  const pct = Math.min(100, score / 5 * 100);
  const color = score <= 1 ? "var(--coral)" : score <= 2 ? "#f5a524" : score <= 3 ? "var(--cyan)" : "var(--neon)";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "aria-live": "polite", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-1.5 w-full overflow-hidden rounded-full bg-white/5", children: /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { initial: false, animate: {
      width: `${pct}%`,
      backgroundColor: color
    }, transition: {
      duration: 0.3
    }, className: "h-full rounded-full" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Password strength" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1", style: {
        color
      }, children: [
        score >= 4 && /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { className: "size-3" }),
        label
      ] })
    ] })
  ] });
}
function GoogleIcon() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { viewBox: "0 0 24 24", className: "size-4", "aria-hidden": true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { fill: "#EA4335", d: "M12 10.2v3.9h5.5c-.24 1.45-1.7 4.25-5.5 4.25-3.31 0-6.02-2.74-6.02-6.13S8.69 6.1 12 6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.86 3.5 14.66 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12S6.76 21.5 12 21.5c6.92 0 9.5-4.86 9.5-7.4 0-.5-.05-.88-.12-1.27H12z" }) });
}

export { AuthPage as component };
