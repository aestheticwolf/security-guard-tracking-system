import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LiveOpsDemo from "../components/LiveOpsDemo";

export default function LandingPage() {
  const { user } = useAuth();
  const dashboardLink =
    user?.role === "super_admin"
      ? "/super-admin"
      : user?.role === "admin"
        ? "/admin"
        : "/dashboard";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between text-slate-900 antialiased selection:bg-[#E2E8F0] overflow-x-hidden w-full">
      {/* ── Compact Enterprise Navbar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-2xs">
              <img src="/brand-shield.svg" alt="Sentinel Grid" className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <span className="font-bold text-sm sm:text-lg tracking-tight text-slate-900 whitespace-nowrap">
              Sentinel Grid
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              to={user ? dashboardLink : "/auth"}
              className="px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              {user ? "Dashboard" : "Sign In"}
            </Link>
            <Link
              to={user ? dashboardLink : "/auth"}
              style={{ color: "#FFFFFF" }}
              className="btn-primary-dark inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-[#182B45] hover:bg-[#233B5D] rounded-lg transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
            >
              <span>Launch System</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Single Hero Section with 2-Column Layout ───────────────────────────── */}
      <main className="flex-1 flex items-center py-6 sm:py-12 lg:py-20 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 w-full">
          <div className="grid gap-6 sm:gap-10 lg:grid-cols-12 lg:items-center">
            
            {/* Left Column: Direct Value Proposition */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="lg:col-span-6 flex flex-col justify-center min-w-0"
            >
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                Security Guard Tracking System
              </span>

              <h1 className="mt-1.5 sm:mt-3 text-2xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-slate-900 leading-[1.2] sm:leading-[1.18] break-words">
                Modern guard tracking, made simple.
              </h1>

              <p className="mt-2 sm:mt-4 text-xs sm:text-base lg:text-lg text-slate-600 leading-relaxed max-w-lg font-normal">
                Manage guard attendance, verification and field activity from one place.
              </p>

              <div className="mt-4 sm:mt-8 flex flex-wrap items-center gap-2 sm:gap-3">
                <Link
                  to={user ? dashboardLink : "/auth"}
                  style={{ color: "#FFFFFF" }}
                  className="btn-primary-dark inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#182B45] hover:bg-[#233B5D] rounded-lg transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
                >
                  <span style={{ color: "#FFFFFF" }}>Launch System</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </Link>

                <Link
                  to={user ? dashboardLink : "/auth"}
                  className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
                >
                  <span>Sign In</span>
                </Link>
              </div>
            </motion.div>

            {/* Right Column: Structured Software Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="lg:col-span-6 min-w-0"
            >
              <div className="rounded-xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
                
                {/* Dashboard Top Bar */}
                <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3.5 border-b border-slate-100 bg-slate-50/70 gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                      Operations View
                    </span>
                    <h2 className="text-xs sm:text-base font-bold text-slate-900 leading-tight truncate">
                      Live Security Pulse
                    </h2>
                  </div>

                  <div className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] sm:text-[11px] font-medium text-emerald-800 shrink-0 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>All systems armed</span>
                  </div>
                </div>

                {/* Live Operations Demo Card Body */}
                <LiveOpsDemo />

              </div>
            </motion.div>

          </div>
        </div>
      </main>

      {/* ── Minimal Enterprise Footer ────────────────────────────────────────── */}
      <footer className="border-t border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <img src="/brand-shield.svg" alt="Sentinel Grid" className="h-4 w-4" />
            <span className="font-semibold text-slate-800">Sentinel Grid</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 font-medium">Security Guard Tracking</span>
          </div>

          <p className="text-slate-400 text-[11px] sm:text-xs">© 2026 Sentinel Grid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
