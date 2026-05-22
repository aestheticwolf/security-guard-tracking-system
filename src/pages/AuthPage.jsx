import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Fingerprint,
  LockKeyhole,
  MapPinned,
  RadioTower,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { heroReveal } from "../animations/transitions";
import FormField from "../components/FormField";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  function getFriendlyAuthError(rawMessage) {
    const message = rawMessage?.trim();

    if (!message) {
      return "Unable to sign in right now. Please try again.";
    }

    if (/network error/i.test(message)) {
      return "Cannot reach the local backend. Please restart the app server and try again.";
    }

    if (/bcrypt/i.test(message)) {
      return "Authentication service was updated. Please restart the app server and sign in again.";
    }

    return message;
  }

  useEffect(() => {
    if (user) {
      navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    }
  }, [navigate, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedEmail = form.email.trim();
    const password = form.password;

    if (!trimmedEmail || !password.trim()) {
      const validationMessage = "Enter both your email address and password to continue.";
      setError(validationMessage);
      toast.error(validationMessage);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const nextUser = await login({
        email: trimmedEmail,
        password
      });
      navigate(location.state?.from || (nextUser.role === "admin" ? "/admin" : "/dashboard"), {
        replace: true
      });
      toast.success("Secure session started.");
    } catch (submitError) {
      const nextError = getFriendlyAuthError(submitError?.message);
      setError(nextError);
      toast.error(nextError);
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(key, value) {
    if (error) {
      setError("");
    }
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="auth-scene mesh-background relative isolate min-h-screen overflow-hidden px-3 py-3 text-white sm:px-6 sm:py-5 lg:px-8">
      <motion.div
        aria-hidden="true"
        className="auth-orb auth-orb--gold"
        animate={{ x: [0, 24, -12, 0], y: [0, -20, 14, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="auth-orb auth-orb--jade"
        animate={{ x: [0, -18, 22, 0], y: [0, 24, -16, 0], scale: [1, 0.95, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <div aria-hidden="true" className="auth-grid-lines" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-7xl gap-4 sm:gap-6 lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <motion.section
          {...heroReveal}
          className="auth-card auth-story-card glass-panel order-2 flex flex-col justify-between rounded-[26px] border border-white/10 p-5 shadow-glow sm:rounded-[34px] sm:p-8 lg:order-1"
        >
          <div>
            <Link to="/" className="inline-flex items-center gap-3">
              <motion.div
                className="auth-logo-glow flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-gradient-to-br from-gold-400/25 to-jade-400/20 sm:h-14 sm:w-14 sm:rounded-[20px]"
                animate={{ boxShadow: [
                  "0 0 0 rgba(56, 200, 155, 0)",
                  "0 0 34px rgba(56, 200, 155, 0.24)",
                  "0 0 0 rgba(56, 200, 155, 0)"
                ] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <img src="/brand-shield.svg" alt="Sentinel Grid" className="h-7 w-7 sm:h-8 sm:w-8" />
              </motion.div>
              <div>
                <p className="font-display text-xl font-semibold sm:text-2xl">Sentinel Grid</p>
                <p className="text-xs text-slate-300 sm:text-sm">Premium security control</p>
              </div>
            </Link>

            <div className="mt-8 max-w-xl sm:mt-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold-300/20 bg-gold-300/10 px-3 py-1.5 text-xs uppercase tracking-[0.28em] text-gold-200">
                <Sparkles className="h-3.5 w-3.5" />
                Protected access
              </div>
              <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-[1.06] sm:mt-4 sm:text-5xl">
                Secure every shift from one smooth login experience.
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-300 sm:mt-6 sm:text-lg sm:leading-8">
                Guards can clock in with selfie verification and live location updates, while admins manage rosters and monitor operations in realtime.
              </p>
            </div>

            <AuthRouteVisual />
          </div>

          <div className="auth-credentials-card mt-8 rounded-[24px] border border-white/10 bg-slate-950/45 p-4 sm:rounded-[28px] sm:p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-jade-200" />
              <p className="font-medium text-white">Demo credentials</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <CredentialCard
                title="Admin"
                email="admin@sentinel.local"
                password="Admin@123"
              />
              <CredentialCard
                title="Guard"
                email="guard@sentinel.local"
                password="Guard@123"
              />
            </div>
          </div>
        </motion.section>

        <motion.section
          {...heroReveal}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="auth-card auth-login-card glass-panel order-1 flex items-start rounded-[26px] border border-white/10 p-5 pb-6 shadow-glow sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[34px] sm:p-8 lg:order-2 lg:min-h-0 lg:items-center"
        >
          <div className="auth-login-inner mx-auto mt-3 w-full max-w-lg sm:mt-10 lg:mt-0">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-jade-300/20 bg-jade-300/10 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-jade-200">
                <Fingerprint className="h-3.5 w-3.5" />
                Welcome back
              </div>
              <h2 className="mt-3 font-display text-[2rem] font-semibold leading-[1.08] sm:text-4xl">
                Sign in to your security workspace.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
                A protected local session starts after your credentials are verified.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3.5 sm:mt-8 sm:space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.18 }}
              >
                <FormField
                  label="Email address"
                  type="email"
                  value={form.email}
                  onChange={(value) => updateField("email", value)}
                  placeholder="guard@sentinel.local"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.24 }}
              >
                <FormField
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={(value) => updateField("password", value)}
                  placeholder="Enter a strong password"
                />
              </motion.div>

              {error && (
                <div className="app-banner app-banner-error flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="auth-primary-action inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-slate-950 shadow-accent transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LockKeyhole className="h-4 w-4" />
                {submitting ? "Securing session..." : "Enter dashboard"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-5 grid grid-cols-3 gap-2 text-xs sm:mt-6">
              <AuthSignal icon={ShieldCheck} label="JWT" value="Protected" />
              <AuthSignal icon={MapPinned} label="GPS" value="Ready" />
              <AuthSignal icon={RadioTower} label="Sync" value="Live" />
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function AuthRouteVisual() {
  return (
    <div className="auth-route-visual mt-7 hidden rounded-[28px] border border-white/10 bg-slate-950/35 p-5 sm:block">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Live field flow</p>
          <p className="mt-2 text-sm text-slate-300">Login, selfie proof, GPS sync, admin visibility.</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-jade-300/20 bg-jade-300/10">
          <Activity className="h-5 w-5 text-jade-200" />
        </div>
      </div>

      <div className="relative mt-6 h-32 overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-slate-950/65 to-slate-900/20">
        <div className="auth-route-grid" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 150" fill="none" role="img" aria-label="Animated secure route">
          <path
            d="M25 105 C110 25 185 130 260 70 C330 15 405 52 495 34"
            stroke="rgba(148,163,184,0.24)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <motion.path
            d="M25 105 C110 25 185 130 260 70 C330 15 405 52 495 34"
            stroke="url(#authRouteGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="56 260"
            animate={{ strokeDashoffset: [0, -316] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "linear" }}
          />
          <defs>
            <linearGradient id="authRouteGradient" x1="25" y1="105" x2="495" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f3bc52" />
              <stop offset="1" stopColor="#38c89b" />
            </linearGradient>
          </defs>
        </svg>
        <Checkpoint className="left-[7%] top-[62%]" label="Auth" />
        <Checkpoint className="left-[43%] top-[42%]" label="Selfie" delay={0.6} />
        <Checkpoint className="left-[78%] top-[23%]" label="Map" delay={1.2} />
      </div>
    </div>
  );
}

function Checkpoint({ className = "", label, delay = 0 }) {
  return (
    <motion.div
      className={`absolute flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-white shadow-glow backdrop-blur ${className}`}
      animate={{ y: [0, -4, 0], scale: [1, 1.04, 1] }}
      transition={{ duration: 2.8, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      <span className="h-2 w-2 rounded-full bg-jade-300 shadow-[0_0_0_6px_rgba(52,211,153,0.16)]" />
      {label}
    </motion.div>
  );
}

function AuthSignal({ icon: Icon, label, value }) {
  return (
    <motion.div
      className="auth-signal-card rounded-2xl border border-white/10 bg-white/5 p-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.32 }}
    >
      <Icon className="h-4 w-4 text-jade-200" />
      <p className="mt-2 text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-white">{value}</p>
    </motion.div>
  );
}

function CredentialCard({ title, email, password }) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.18 }}
      className="rounded-[20px] border border-white/10 bg-white/5 p-3.5 sm:rounded-[22px] sm:p-4"
    >
      <p className="font-medium text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{email}</p>
      <p className="mt-1 text-sm text-slate-400">{password}</p>
    </motion.div>
  );
}
