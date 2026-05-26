import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Eye,
  EyeOff
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { heroReveal } from "../animations/transitions";
import FormField from "../components/FormField";
import { useAuth } from "../context/AuthContext";

// ── Floating particle component ───────────────────────────────────────────────
function Particle({ delay, duration, x, y, size, opacity }) {
  return (
    <motion.div
      className="auth-particle"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, opacity }}
      animate={{
        y: [0, -40, -80, -40, 0],
        x: [0, 12, -8, 16, 0],
        opacity: [opacity, opacity * 1.6, opacity * 0.4, opacity * 1.2, opacity],
        scale: [1, 1.3, 0.8, 1.1, 1],
      }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ── Animated radar ring ───────────────────────────────────────────────────────
function RadarRings() {
  return (
    <div className="auth-radar" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="auth-radar__ring"
          animate={{ scale: [0.4, 1.8], opacity: [0.7, 0] }}
          transition={{
            duration: 3.2,
            delay: i * 0.8,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
      <div className="auth-radar__core" />
    </div>
  );
}

// ── Scanning line animation ───────────────────────────────────────────────────
function ScanLine() {
  return (
    <motion.div
      className="auth-scan-line"
      aria-hidden="true"
      animate={{ y: ["0%", "100%", "0%"] }}
      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
    />
  );
}

// ── Live stats ticker ─────────────────────────────────────────────────────────
function LiveTicker() {
  const [index, setIndex] = useState(0);
  const items = [
    "Sentinel Grid online — all systems operational",
    "3 guards on active duty — last sync 2 min ago",
    "Secure access verified — command workspace ready",
    "Live route telemetry prepared for active patrols",
  ];
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="auth-ticker">
      <span className="auth-ticker__dot" />
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className="auth-ticker__text"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
        >
          {items[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ── Credential card ───────────────────────────────────────────────────────────
function CredentialCard({ title, email, password, accent = "jade" }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard?.writeText(`${email} / ${password}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={`auth-cred-card auth-cred-card--${accent}`}
      onClick={handleCopy}
      style={{ cursor: "pointer" }}
      title="Click to copy credentials"
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold text-white text-sm">{title}</p>
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.span
              key="copied"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="auth-cred-copied"
            >
              Copied!
            </motion.span>
          ) : (
            <motion.span
              key="role"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`auth-role-badge auth-role-badge--${accent}`}
            >
              {title}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-2.5 text-xs font-mono text-slate-300">{email}</p>
      <p className="mt-1 text-xs font-mono text-slate-400">{password}</p>
    </motion.div>
  );
}

// ── Route visual with animated nodes ─────────────────────────────────────────
function AuthRouteVisual() {
  const nodes = [
    { label: "Access", x: "13%", y: "65%", delay: 0 },
    { label: "Selfie", x: "41%", y: "45%", delay: 0.5 },
    { label: "Route", x: "67%", y: "31%", delay: 1.0 },
    { label: "Admin", x: "86%", y: "52%", delay: 1.5 },
  ];
  const routePath = "M72 112 C142 50 204 118 250 76 C306 30 365 30 406 47 C446 66 476 83 510 82";

  return (
    <div className="auth-route-visual mt-7 hidden rounded-[28px] border border-white/10 p-5 sm:block">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Live field flow</p>
          <p className="mt-1.5 text-sm text-slate-300">Authenticate → verify presence → sync route → command visibility</p>
        </div>
        <motion.div
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-jade-300/20 bg-jade-300/10"
          animate={{ boxShadow: ["0 0 0px rgba(56,200,155,0)", "0 0 20px rgba(56,200,155,0.28)", "0 0 0px rgba(56,200,155,0)"] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          <Activity className="h-5 w-5 text-jade-200" />
        </motion.div>
      </div>

      <div className="auth-route-canvas relative mt-5 h-36 overflow-hidden rounded-[22px] border border-white/10">
        <div className="auth-route-grid" />
        <ScanLine />
        {/* path */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 560 160" fill="none" aria-hidden="true">
          {/* ghost path */}
          <path
            d={routePath}
            stroke="rgba(148,163,184,0.18)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* animated glow path */}
          <motion.path
            d={routePath}
            stroke="url(#rg1)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="60 300"
            animate={{ strokeDashoffset: [0, -360] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d={routePath}
            stroke="url(#rg2)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="30 330"
            style={{ filter: "blur(3px)" }}
            animate={{ strokeDashoffset: [0, -360] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 0.15 }}
          />
          <defs>
            <linearGradient id="rg1" x1="72" y1="112" x2="510" y2="82" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f3bc52" />
              <stop offset="0.5" stopColor="#8fd17e" />
              <stop offset="1" stopColor="#38c89b" />
            </linearGradient>
            <linearGradient id="rg2" x1="72" y1="112" x2="510" y2="82" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f3bc52" stopOpacity="0.6" />
              <stop offset="1" stopColor="#38c89b" stopOpacity="0.6" />
            </linearGradient>
          </defs>
        </svg>
        {/* nodes */}
        {nodes.map((node) => (
          <div
            key={node.label}
            className="auth-route-node-anchor absolute"
            style={{ left: node.x, top: node.y }}
          >
            <motion.div
              className="auth-route-node flex items-center gap-2 rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold text-white shadow-glow backdrop-blur"
              animate={{ y: [0, -5, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 2.6, delay: node.delay, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.span
                className="h-2 w-2 rounded-full bg-jade-300"
                style={{ boxShadow: "0 0 0 5px rgba(52,211,153,0.18)" }}
                animate={{ boxShadow: ["0 0 0 4px rgba(52,211,153,0.18)", "0 0 0 8px rgba(52,211,153,0)", "0 0 0 4px rgba(52,211,153,0.18)"] }}
                transition={{ duration: 1.8, delay: node.delay, repeat: Infinity }}
              />
              {node.label}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDashboardPathForRole(role) {
  if (role === "super_admin") return "/super-admin";
  if (role === "admin") return "/admin";
  return "/dashboard";
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loginStage, setLoginStage] = useState("idle"); // idle | loading | success

  // Mouse parallax for left card
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 20 });
  const cardRotateX = useTransform(springY, [-300, 300], [3, -3]);
  const cardRotateY = useTransform(springX, [-300, 300], [-3, 3]);

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  }
  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  // Particles config
  const particles = [
    { x: 12, y: 18, size: 3, opacity: 0.28, duration: 7, delay: 0 },
    { x: 28, y: 72, size: 2, opacity: 0.2, duration: 9, delay: 1.2 },
    { x: 55, y: 35, size: 4, opacity: 0.18, duration: 8, delay: 0.6 },
    { x: 76, y: 60, size: 2.5, opacity: 0.24, duration: 6.5, delay: 2 },
    { x: 88, y: 24, size: 3, opacity: 0.22, duration: 10, delay: 0.4 },
    { x: 42, y: 85, size: 2, opacity: 0.16, duration: 7.5, delay: 1.8 },
    { x: 64, y: 12, size: 3.5, opacity: 0.2, duration: 8.5, delay: 0.9 },
    { x: 8, y: 52, size: 2, opacity: 0.18, duration: 9.5, delay: 3 },
  ];

  function getFriendlyAuthError(rawMessage) {
    const message = rawMessage?.trim();
    if (!message) return "Unable to sign in right now. Please try again.";
    if (/network error/i.test(message)) return "Cannot reach the local backend. Please restart the app server and try again.";
    if (/bcrypt/i.test(message)) return "Authentication service was updated. Please restart the app server and sign in again.";
    return message;
  }

  useEffect(() => {
    if (user) {
      navigate(getDashboardPathForRole(user.role), { replace: true });
    }
  }, [navigate, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedEmail = form.email.trim();
    const password = form.password;

    if (!trimmedEmail || !password.trim()) {
      const msg = "Enter both your email address and password to continue.";
      setError(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    setLoginStage("loading");
    setError("");

    try {
      const nextUser = await login({ email: trimmedEmail, password });
      setLoginStage("success");
      setTimeout(() => {
        navigate(location.state?.from || getDashboardPathForRole(nextUser.role), { replace: true });
        toast.success("Secure session started.");
      }, 600);
    } catch (submitError) {
      const nextError = getFriendlyAuthError(submitError?.message);
      setError(nextError);
      toast.error(nextError);
      setLoginStage("idle");
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(key, value) {
    if (error) setError("");
    setForm((c) => ({ ...c, [key]: value }));
  }

  return (
    <div
      className="auth-scene mesh-background relative isolate min-h-screen overflow-hidden px-3 py-3 text-white sm:px-5 sm:py-5 lg:px-6 lg:py-6"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background orbs */}
      <motion.div aria-hidden="true" className="auth-orb auth-orb--gold"
        animate={{ x: [0, 28, -14, 0], y: [0, -24, 18, 0], scale: [1, 1.1, 0.94, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div aria-hidden="true" className="auth-orb auth-orb--jade"
        animate={{ x: [0, -22, 26, 0], y: [0, 28, -20, 0], scale: [1, 0.93, 1.12, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Third accent orb */}
      <motion.div aria-hidden="true" className="auth-orb auth-orb--violet"
        animate={{ x: [0, 16, -20, 0], y: [0, -18, 12, 0], scale: [1, 1.06, 0.98, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      <div aria-hidden="true" className="auth-grid-lines" />

      {/* Floating particles */}
      {particles.map((p, i) => <Particle key={i} {...p} />)}

      {/* Main grid */}
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1440px] gap-4 sm:gap-5 lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.1fr_0.9fr]">

        {/* ── LEFT: Story card ──────────────────────────────────────────── */}
        <motion.section
          {...heroReveal}
          style={{ rotateX: cardRotateX, rotateY: cardRotateY, transformPerspective: 1200 }}
          className="auth-card auth-story-card glass-panel order-2 flex flex-col justify-between rounded-[24px] border border-white/10 p-5 shadow-glow sm:rounded-[32px] sm:p-8 lg:order-1"
        >
          <div>
            {/* Logo */}
            <Link to="/" className="inline-flex items-center gap-3 group">
              <motion.div
                className="auth-logo-glow flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-gradient-to-br from-gold-400/25 to-jade-400/20 sm:h-14 sm:w-14 sm:rounded-[20px]"
                whileHover={{ scale: 1.08, rotate: 5 }}
                animate={{ boxShadow: [
                  "0 0 0 rgba(56,200,155,0)",
                  "0 0 36px rgba(56,200,155,0.28)",
                  "0 0 0 rgba(56,200,155,0)"
                ] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <img src="/brand-shield.svg" alt="Sentinel Grid" className="h-7 w-7 sm:h-8 sm:w-8" />
              </motion.div>
              <div>
                <p className="font-display text-xl font-semibold tracking-tight sm:text-2xl group-hover:text-jade-200 transition-colors duration-200">
                  Sentinel Grid
                </p>
                <p className="text-xs text-slate-400 sm:text-sm">Premium security control</p>
              </div>
            </Link>

            {/* Headline */}
            <div className="mt-8 max-w-xl sm:mt-10">
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2 rounded-full border border-gold-300/22 bg-gold-300/10 px-3 py-1.5 text-xs uppercase tracking-[0.28em] text-gold-200"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </motion.div>
                Protected access
              </motion.div>

              <motion.h1
                className="mt-3 font-display text-[2.2rem] font-semibold leading-[1.06] sm:mt-4 sm:text-[2.8rem] lg:text-5xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.18 }}
              >
                Secure every shift{" "}
                <span className="auth-gradient-text">from one smooth</span>{" "}
                login experience.
              </motion.h1>

              <motion.p
                className="mt-4 text-sm leading-7 text-slate-300 sm:mt-5 sm:text-base sm:leading-8"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.26 }}
              >
                Guards clock in with selfie verification and live location updates, while admins manage rosters and monitor operations in realtime.
              </motion.p>
            </div>

            {/* Live ticker */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-5"
            >
              <LiveTicker />
            </motion.div>

            {/* Radar + route visual */}
            <div className="mt-6 flex items-start gap-5">
              <div className="hidden sm:block">
                <RadarRings />
              </div>
              <div className="flex-1">
                <AuthRouteVisual />
              </div>
            </div>
          </div>

          {/* Demo credentials */}
          <motion.div
            className="auth-credentials-card mt-8 rounded-[22px] border border-white/10 bg-slate-950/45 p-4 sm:rounded-[26px] sm:p-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-jade-200" />
              <p className="font-semibold text-white">Demo credentials</p>
              <span className="ml-auto text-xs text-slate-500">Click any card to copy</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <CredentialCard title="Super Admin" email="super@sentinel.local" password="Super@123" accent="jade" />
              <CredentialCard title="Admin" email="admin@sentinel.local" password="Admin@123" accent="gold" />
              <CredentialCard title="Guard" email="guard@sentinel.local" password="Guard@123" accent="jade" />
            </div>
          </motion.div>
        </motion.section>

        {/* ── RIGHT: Login card ─────────────────────────────────────────── */}
        <motion.section
          {...heroReveal}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="auth-card auth-login-card glass-panel order-1 flex items-start rounded-[24px] border border-white/10 p-5 pb-6 shadow-glow sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[32px] sm:p-8 lg:order-2 lg:min-h-0 lg:items-center"
        >
          <div className="auth-login-inner mx-auto mt-3 w-full max-w-md sm:mt-10 lg:mt-0">

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-jade-300/22 bg-jade-300/10 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-jade-200">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Fingerprint className="h-3.5 w-3.5" />
                </motion.div>
                Welcome back
              </div>
              <h2 className="mt-3 font-display text-[1.9rem] font-semibold leading-[1.08] sm:text-[2.4rem]">
                Sign in to your{" "}
                <span className="auth-gradient-text">security workspace.</span>
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
                A protected local session starts after your credentials are verified.
              </p>
            </motion.div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-7 space-y-4 sm:mt-8">

              {/* Email */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.38, delay: 0.2 }}
              >
                <FormField
                  label="Email address"
                  type="email"
                  value={form.email}
                  onChange={(value) => updateField("email", value)}
                  placeholder="guard@sentinel.local"
                />
              </motion.div>

              {/* Password */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.38, delay: 0.28 }}
                className="relative"
              >
                <FormField
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(value) => updateField("password", value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-eye-toggle"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </motion.div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="app-banner app-banner-error flex items-start gap-3"
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={submitting}
                className="auth-primary-action relative inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-slate-950 shadow-accent disabled:cursor-not-allowed disabled:opacity-70 overflow-hidden"
                whileHover={!submitting ? { scale: 1.015, y: -1 } : {}}
                whileTap={!submitting ? { scale: 0.985 } : {}}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.34 }}
              >
                <AnimatePresence mode="wait">
                  {loginStage === "success" ? (
                    <motion.span
                      key="success"
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Session secured!
                    </motion.span>
                  ) : submitting ? (
                    <motion.span
                      key="loading"
                      className="flex items-center gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div
                        className="h-4 w-4 rounded-full border-2 border-slate-800/40 border-t-slate-900"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                      Securing session...
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      className="flex items-center gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <LockKeyhole className="h-4 w-4" />
                      Enter dashboard
                      <motion.div
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </motion.div>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </form>

            {/* Security note */}
            <motion.p
              className="mt-5 text-center text-[0.7rem] text-slate-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <ShieldCheck className="inline h-3 w-3 mr-1 opacity-60" />
              Encrypted workspace access for verified security operations.
            </motion.p>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
