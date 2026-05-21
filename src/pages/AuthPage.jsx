import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
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
    <div className="mesh-background min-h-screen px-3 py-3 text-white sm:px-6 sm:py-5 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-7xl gap-4 sm:gap-6 lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <motion.section
          {...heroReveal}
          className="glass-panel order-2 flex flex-col justify-between rounded-[26px] border border-white/10 p-5 shadow-glow sm:rounded-[34px] sm:p-8 lg:order-1"
        >
          <div>
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-gradient-to-br from-gold-400/25 to-jade-400/20 sm:h-14 sm:w-14 sm:rounded-[20px]">
                <img src="/brand-shield.svg" alt="Sentinel Grid" className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <div>
                <p className="font-display text-xl font-semibold sm:text-2xl">Sentinel Grid</p>
                <p className="text-xs text-slate-300 sm:text-sm">Premium security control</p>
              </div>
            </Link>

            <div className="mt-8 max-w-xl sm:mt-14">
              <p className="text-xs uppercase tracking-[0.32em] text-gold-200">Protected access</p>
              <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-[1.06] sm:mt-4 sm:text-5xl">
                Secure every shift from one smooth login experience.
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-300 sm:mt-6 sm:text-lg sm:leading-8">
                Guards can clock in with selfie verification and live location updates, while admins manage rosters and monitor operations in realtime.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-slate-950/45 p-4 sm:rounded-[28px] sm:p-5">
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
          className="glass-panel order-1 flex items-start rounded-[26px] border border-white/10 p-5 pb-6 shadow-glow sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[34px] sm:p-8 lg:order-2 lg:min-h-0 lg:items-center"
        >
          <div className="mx-auto mt-3 w-full max-w-lg sm:mt-10 lg:mt-0">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-gold-200">Welcome back</p>
              <h2 className="mt-3 font-display text-[2rem] font-semibold leading-[1.08] sm:text-4xl">
                Sign in to your security workspace.
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3.5 sm:mt-8 sm:space-y-4">
              <FormField
                label="Email address"
                type="email"
                value={form.email}
                onChange={(value) => updateField("email", value)}
                placeholder="guard@sentinel.local"
              />
              <FormField
                label="Password"
                type="password"
                value={form.password}
                onChange={(value) => updateField("password", value)}
                placeholder="Enter a strong password"
              />

              {error && (
                <div className="app-banner app-banner-error flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 to-jade-400 px-5 py-3.5 text-sm font-semibold text-slate-950 shadow-accent transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LockKeyhole className="h-4 w-4" />
                {submitting ? "Securing session..." : "Enter dashboard"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function CredentialCard({ title, email, password }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/5 p-3.5 sm:rounded-[22px] sm:p-4">
      <p className="font-medium text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{email}</p>
      <p className="mt-1 text-sm text-slate-400">{password}</p>
    </div>
  );
}
