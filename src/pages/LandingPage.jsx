import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  MapPinned,
  RadioTower,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const featureCards = [
  {
    icon: ShieldCheck,
    title: "Secure identity flow",
    copy: "JWT session control, protected routes, and hashed local credentials keep every shift access point locked down."
  },
  {
    icon: UserCheck,
    title: "Attendance with proof",
    copy: "Start each patrol with a selfie capture, a location stamp, and a durable attendance timeline."
  },
  {
    icon: RadioTower,
    title: "Live activity pulse",
    copy: "Track patrol notes, alerts, and safe-check events in a realtime command feed for managers."
  },
  {
    icon: MapPinned,
    title: "Mobile location tracking",
    copy: "Field devices can sync geolocation updates to show where guards are operating and when they last moved."
  },
  {
    icon: Camera,
    title: "Local selfie storage",
    copy: "Selfie uploads are stored locally on the server with each attendance checkpoint for easy verification."
  }
];

export default function LandingPage() {
  const { user } = useAuth();
  const dashboardLink = user?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <div className="mesh-background min-h-screen overflow-hidden text-white">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 lg:px-8">
        <header className="glass-panel rounded-[30px] border border-white/10 px-5 py-4 shadow-glow">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-gradient-to-br from-gold-400/25 to-jade-400/20">
                <img src="/brand-shield.svg" alt="Sentinel Grid" className="h-9 w-9" />
              </div>
              <div>
                <p className="font-display text-2xl font-semibold">Sentinel Grid</p>
                <p className="text-sm text-slate-300">Security Guard Tracking System</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={user ? dashboardLink : "/auth"}
                className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
              >
                {user ? "Open Dashboard" : "Sign In"}
              </Link>
              <Link
                to="/auth"
                className="rounded-2xl bg-gradient-to-r from-gold-400 to-jade-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-accent transition hover:scale-[1.01]"
              >
                Launch System
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-2 text-xs uppercase tracking-[0.32em] text-gold-200">
              Premium local-first operations
            </div>
            <h1 className="mt-6 max-w-3xl font-display text-5xl font-semibold leading-[1.02] sm:text-6xl">
              Modern guard tracking built for reliable field execution.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Manage secure sign-in, shift attendance, selfie verification, live patrol activity, and location telemetry from one polished React and Node.js platform.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to={user ? dashboardLink : "/auth"}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 to-jade-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-accent"
              >
                Enter Mission Control
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                Explore features
              </a>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ["Attendance proof", "Selfie + location check-in"],
                ["Session security", "JWT auth and route locking"],
                ["Admin command", "Guard roster and live feed"]
              ].map(([title, detail]) => (
                <div key={title} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="font-medium text-white">{title}</p>
                  <p className="mt-2 text-sm text-slate-300">{detail}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="relative"
          >
            <div className="absolute -left-8 top-8 h-24 w-24 rounded-full bg-gold-400/25 blur-3xl" />
            <div className="absolute -right-8 bottom-4 h-28 w-28 rounded-full bg-jade-400/20 blur-3xl" />

            <div className="glass-panel relative overflow-hidden rounded-[34px] border border-white/10 p-6 shadow-glow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-gold-200">Operations view</p>
                  <p className="mt-2 font-display text-3xl font-semibold">Live Security Pulse</p>
                </div>
                <StatusPill />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <MockCard title="Guards on duty" value="12" detail="3 zones actively patrolled" tone="gold" />
                <MockCard title="Selfie verification" value="98%" detail="All active shifts verified" tone="jade" />
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/45 p-5">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">Recent activity stream</p>
                  <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Live</span>
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    ["North Gate", "Shift check-in verified with selfie capture", "1 min ago"],
                    ["Warehouse Ring", "Location sync received from field device", "4 min ago"],
                    ["Command Center", "Roster updated for overnight coverage", "11 min ago"]
                  ].map(([title, detail, time]) => (
                    <div key={title} className="flex gap-3">
                      <div className="mt-1 h-3 w-3 rounded-full bg-gradient-to-r from-gold-400 to-jade-400" />
                      <div>
                        <p className="font-medium text-white">{title}</p>
                        <p className="text-sm text-slate-300">{detail}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">{time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="features" className="py-10">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-gold-200">System pillars</p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-white">
              Everything needed for trustworthy field accountability.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map(({ icon: Icon, title, copy }, index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="glass-panel rounded-[28px] border border-white/10 p-6 shadow-glow"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Icon className="h-5 w-5 text-gold-200" />
                </div>
                <h3 className="mt-5 font-display text-2xl font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{copy}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 py-12 lg:grid-cols-3">
          {[
            ["1", "Landing page and premium auth flow"],
            ["2", "Guard dashboard for attendance, patrol logs, and live location"],
            ["3", "Admin dashboard for roster control and live operations"]
          ].map(([number, text]) => (
            <div key={number} className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-jade-400 font-display text-xl font-semibold text-slate-950">
                {number}
              </div>
              <p className="mt-5 text-lg font-medium text-white">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function MockCard({ title, value, detail, tone }) {
  const classes =
    tone === "jade"
      ? "from-jade-400/25 to-jade-400/5"
      : "from-gold-400/25 to-gold-400/5";

  return (
    <div className={`rounded-[26px] border border-white/10 bg-gradient-to-br p-5 ${classes}`}>
      <p className="text-sm text-slate-300">{title}</p>
      <p className="mt-3 font-display text-4xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{detail}</p>
    </div>
  );
}

function StatusPill() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-jade-400/30 bg-jade-400/15 px-3 py-2 text-xs uppercase tracking-[0.28em] text-jade-100">
      <span className="h-2 w-2 rounded-full bg-jade-300" />
      All systems armed
    </div>
  );
}
