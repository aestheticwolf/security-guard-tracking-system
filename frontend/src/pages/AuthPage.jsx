import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const DEMO_ACCOUNTS = [
  {
    roleKey: "guard",
    title: "Guard",
    email: "guard@sentinel.local",
    password: "Guard@123",
    badge: "GUARD",
    badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  {
    roleKey: "admin",
    title: "Admin",
    email: "admin@sentinel.local",
    password: "Admin@123",
    badge: "ADMIN",
    badgeStyle: "bg-blue-50 text-blue-800 border-blue-200",
  },
  {
    roleKey: "super_admin",
    title: "Super Admin",
    email: "super@sentinel.local",
    password: "Super@123",
    badge: "SUPER",
    badgeStyle: "bg-slate-100 text-slate-800 border-slate-200",
  },
];

function getDashboardPathForRole(role) {
  if (role === "super_admin") return "/super-admin";
  if (role === "admin") return "/admin";
  return "/dashboard";
}

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [loginStage, setLoginStage] = useState("idle"); // idle | loading | success

  function getFriendlyAuthError(rawMessage) {
    const message = rawMessage?.trim();
    if (!message) return "Unable to sign in right now. Please try again.";
    if (/network error/i.test(message)) {
      return "Cannot reach the security backend. Check the API deployment and try again.";
    }
    if (/bcrypt/i.test(message)) {
      return "Authentication service was updated. Please restart the app server and sign in again.";
    }
    return message;
  }

  useEffect(() => {
    if (user) {
      navigate(getDashboardPathForRole(user.role), { replace: true });
    }
  }, [navigate, user]);

  function handlePickDemo(account) {
    setSelectedDemo(account.roleKey);
    setForm({ email: account.email, password: account.password });
    setError("");

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(`${account.email} / ${account.password}`).catch(() => {});
      }
    } catch {
      // Ignore clipboard restrictions
    }

    toast.success(`${account.title} credentials loaded & copied!`, { duration: 1800 });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedEmail = form.email.trim();
    const password = form.password;

    if (!trimmedEmail || !password.trim()) {
      const msg = "Enter both email and password or pick a demo profile.";
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
      }, 500);
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
    setSelectedDemo(null);
    setForm((c) => ({ ...c, [key]: value }));
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between overflow-x-hidden w-full antialiased selection:bg-[#182B45] selection:text-white">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-2 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 group shrink-0">
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-hover:border-slate-300 transition-colors">
            <img src="/brand-shield.svg" alt="Sentinel Grid" className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight">
              Sentinel Grid
            </span>
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full">
              Workspace
            </span>
          </div>
        </Link>
        <Link
          to="/"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors shrink-0"
        >
          <span>← Back to home</span>
        </Link>
      </header>

      {/* ── Unified Single-Card Sign In Page ─────────────────────────────────── */}
      <main className="w-full max-w-[460px] mx-auto px-3.5 sm:px-4 py-4 sm:py-8 flex-1 flex flex-col justify-center">
        <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-7">
          {/* Header Info */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
              Secure Access
            </span>
            <h1 className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Sign in to your account
            </h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500">
              Select a demo profile below or enter credentials.
            </p>
          </div>

          {/* ── Integrated One-Click Demo Role Selector (No separate card!) ── */}
          <div className="mt-3.5 sm:mt-4 p-2.5 sm:p-3 rounded-lg bg-slate-50/80 border border-slate-200/90">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E]" />
                <span>Instant Demo Login</span>
              </span>
              <span className="text-[10px] text-slate-600">Tap to autofill & copy</span>
            </div>

            {/* 3 Role Buttons side-by-side */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = selectedDemo === acc.roleKey;
                return (
                  <button
                    key={acc.roleKey}
                    type="button"
                    onClick={() => handlePickDemo(acc)}
                    className={`py-1.5 sm:py-2 px-1 rounded-md transition-all border text-center flex flex-col items-center justify-center cursor-pointer ${
                      isSelected
                        ? "bg-[#182B45] text-white border-[#182B45] shadow-xs"
                        : "bg-white hover:bg-slate-100/80 text-slate-800 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1 rounded ${
                        isSelected ? "bg-white/20 text-white" : acc.badgeStyle
                      }`}
                    >
                      {acc.badge}
                    </span>
                    <span
                      className={`mt-1 text-xs font-semibold leading-none truncate ${
                        isSelected ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {acc.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Demo Profile Details Helper */}
            {selectedDemo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600 font-mono"
              >
                <span className="truncate text-slate-700">
                  {DEMO_ACCOUNTS.find((a) => a.roleKey === selectedDemo)?.email}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 shrink-0">
                  <Check className="h-3 w-3" /> Copied
                </span>
              </motion.div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-3.5 sm:mt-4 space-y-3 sm:space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="name@sentinel.local"
                autoComplete="email"
                className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#182B45] focus:ring-1 focus:ring-[#182B45] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 pr-10 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#182B45] focus:ring-1 focus:ring-[#182B45] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error notice */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 6 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs overflow-hidden"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary-dark w-full mt-1.5 bg-[#182B45] hover:bg-[#233B5D] text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              style={{ color: "#FFFFFF" }}
            >
              {loginStage === "success" ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Session secured!</span>
                </>
              ) : submitting ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Securing session...</span>
                </>
              ) : (
                <>
                  <LockKeyhole className="h-4 w-4" />
                  <span>Enter dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-3.5 sm:mt-4 text-center text-[11px] sm:text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>Encrypted workspace access for verified operations.</span>
          </p>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 text-center text-[11px] sm:text-xs text-slate-400">
        © 2026 Sentinel Grid. Enterprise Guard Tracking & Security Operations.
      </footer>
    </div>
  );
}
