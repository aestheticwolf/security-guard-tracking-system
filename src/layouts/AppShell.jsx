import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  History,
  LogOut,
  MoonStar,
  ShieldCheck,
  SunMedium,
  Users
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { pageShift } from "../animations/transitions";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { initials } from "../utils/format";
import { isNativeApp } from "../utils/nativeApp";

export default function AppShell({
  title,
  subtitle,
  children,
  mobileQuickLinks = [],
  sectionLinks = []
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileQuickLinksCollapsed, setMobileQuickLinksCollapsed] = useState(true);
  const mobileQuickLinksRef = useRef(null);
  const nativeApp = isNativeApp();

  const navigation =
    user?.role === "super_admin"
      ? [
          { to: "/super-admin", label: "Organizations", icon: Building2 }
        ]
      : user?.role === "admin"
      ? [
          { to: "/admin", label: "Operations", icon: ShieldCheck },
          { to: "/admin/history", label: "Guard History", icon: History }
        ]
      : [
          { to: "/dashboard", label: "Shift Hub", icon: ShieldCheck }
        ];

  function jumpToSection(target) {
    if (!target) {
      return;
    }

    if (target.startsWith("/")) {
      navigate(target);
      setMobileQuickLinksCollapsed(true);
      return;
    }

    const element = document.getElementById(target);

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    setMobileQuickLinksCollapsed(true);
  }

  useEffect(() => {
    if (mobileQuickLinksCollapsed) {
      return undefined;
    }

    function collapseMobileQuickLinks() {
      setMobileQuickLinksCollapsed(true);
    }

    function handleOutsidePointerDown(event) {
      if (mobileQuickLinksRef.current?.contains(event.target)) {
        return;
      }

      collapseMobileQuickLinks();
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    window.addEventListener("scroll", collapseMobileQuickLinks, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      window.removeEventListener("scroll", collapseMobileQuickLinks);
    };
  }, [mobileQuickLinksCollapsed]);

  return (
    <div className={`mesh-background min-h-screen app-copy-primary ${nativeApp ? "native-app-shell" : ""}`}>
      <div className="flex min-h-screen w-full gap-3 px-3 py-3 sm:gap-5 sm:px-6 sm:py-4 xl:px-8 2xl:px-10">
        <aside className="app-sidebar hidden w-72 shrink-0 flex-col overflow-y-auto rounded-[32px] p-5 lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-2rem)]">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-gradient-to-br from-gold-400/30 to-jade-400/20">
              <img src="/brand-shield.svg" alt="Sentinel Grid" className="h-8 w-8" />
            </div>
            <div>
              <p className="font-display text-xl font-semibold app-copy-primary">Sentinel Grid</p>
              <p className="text-sm app-copy-muted">Security operations console</p>
            </div>
          </div>

          <div className="app-surface-soft mt-8 rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.28em] app-copy-soft">Session</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-jade-400 font-semibold text-slate-950">
                {initials(user?.fullName)}
              </div>
              <div>
                <p className="font-medium app-copy-primary">{user?.fullName}</p>
                <p className="text-sm app-copy-muted">{user?.shiftLabel}</p>
              </div>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/admin" || to === "/dashboard"}
                className={({ isActive }) =>
                  `app-nav-link flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${
                    isActive
                      ? "app-nav-link-active"
                      : ""
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {sectionLinks.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="px-4 text-xs uppercase tracking-[0.28em] app-copy-soft">
                Sections
              </p>
              <div className="mt-3 space-y-2">
                {sectionLinks.map(({ id, label, icon: Icon, to }) => (
                  <button
                    key={to || id}
                    type="button"
                    onClick={() => jumpToSection(to || id)}
                    className="app-nav-link flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium"
                  >
                    {Icon ? <Icon className="h-4 w-4" /> : null}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto rounded-[26px] border border-white/10 bg-gradient-to-br from-gold-400/15 to-jade-400/10 p-4">
            <p className="font-display text-lg font-semibold app-copy-primary">Always-on visibility</p>
            <p className="mt-2 text-sm app-copy-muted">
              Live attendance, selfie proof, and patrol telemetry stay synced from one secure local stack.
            </p>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="app-outline-button mt-4 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="glass-panel mb-4 rounded-[24px] border px-4 py-4 sm:mb-5 sm:rounded-[28px] sm:px-6"
            style={{ boxShadow: "var(--app-shadow-glow)" }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-gold-200 sm:text-xs">Secure workspace</p>
                <h1 className="mt-2 font-display text-[2.15rem] font-semibold leading-[1.02] app-copy-primary sm:text-3xl">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-2 max-w-none text-[13px] leading-6 app-copy-muted sm:max-w-2xl sm:text-sm">
                    {subtitle}
                  </p>
                )}
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="app-outline-button inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium sm:w-auto"
                  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                >
                  {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <div className="app-surface-soft flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-3 sm:w-auto sm:justify-start">
                  <Users className="h-4 w-4 text-jade-200" />
                  <div>
                    <p className="text-sm font-medium app-copy-primary">
                      {user?.role === "super_admin"
                        ? "Super admin"
                        : user?.role === "admin"
                          ? "Admin control"
                          : "Field guard"}
                    </p>
                    <p className="text-xs app-copy-muted">{user?.email}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.main key={title} {...pageShift} className="pb-40 lg:pb-6">
              {children}
            </motion.main>
          </AnimatePresence>

          {mobileQuickLinks.length > 0 && (
            <div className="fixed bottom-24 right-3 z-20 lg:hidden">
              <div
                ref={mobileQuickLinksRef}
                className={`app-sidebar flex flex-col gap-2 transition-all duration-200 ${
                  mobileQuickLinksCollapsed
                    ? "rounded-full p-1.5"
                    : "max-h-[calc(100vh-11rem)] overflow-y-auto rounded-[22px] p-2"
                }`}
                style={{ backdropFilter: "blur(18px)" }}
              >
                <button
                  type="button"
                  onClick={() => setMobileQuickLinksCollapsed((current) => !current)}
                  className={`app-outline-button inline-flex items-center gap-2 ${
                    mobileQuickLinksCollapsed
                      ? "h-12 w-12 justify-center rounded-full"
                      : "mobile-quick-link min-h-[2.85rem] w-full justify-between rounded-[18px] px-3 py-2.5 text-[11px] font-medium"
                  }`}
                  aria-label={
                    mobileQuickLinksCollapsed
                      ? "Expand section shortcuts"
                      : "Collapse section shortcuts"
                  }
                  aria-expanded={!mobileQuickLinksCollapsed}
                >
                  {!mobileQuickLinksCollapsed && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.24em] app-copy-soft">
                      Sections
                    </span>
                  )}
                  {mobileQuickLinksCollapsed ? (
                    <ChevronLeft className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {!mobileQuickLinksCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: 10, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 10, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="flex flex-col gap-2"
                    >
                      {mobileQuickLinks.map(({ id, label, icon: Icon, to }) => (
                        <button
                          key={to || id}
                          type="button"
                          onClick={() => jumpToSection(to || id)}
                          className="app-outline-button mobile-quick-link flex w-[4.55rem] flex-col items-center gap-1.5 rounded-[18px] px-2 py-2.5 text-[11px] font-medium"
                          aria-label={`Jump to ${label}`}
                        >
                          {Icon ? <Icon className="h-4 w-4" /> : null}
                          <span className="text-center leading-4">{label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          <div className="fixed inset-x-3 bottom-3 z-20 lg:hidden">
            <div className="space-y-2.5">
              <div
                className="app-sidebar flex items-center justify-between gap-2 rounded-[22px] p-2.5"
                style={{ backdropFilter: "blur(18px)" }}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-gold-400 to-jade-400 text-sm font-semibold text-slate-950">
                    {initials(user?.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="max-w-[6.75rem] truncate text-sm font-medium app-copy-primary">
                      {user?.fullName}
                    </p>
                    <p className="max-w-[6.75rem] truncate text-[11px] app-copy-muted">
                      {user?.role === "super_admin"
                        ? "Owner session"
                        : user?.role === "admin"
                          ? "Admin session"
                          : "Guard session"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {navigation.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === "/admin" || to === "/dashboard"}
                      className={({ isActive }) =>
                        `app-nav-link flex h-10 w-10 items-center justify-center rounded-[18px] ${
                          isActive ? "app-nav-link-active" : ""
                        }`
                      }
                      aria-label={label}
                    >
                      <Icon className="h-4 w-4" />
                    </NavLink>
                  ))}
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="app-outline-button flex h-10 w-10 items-center justify-center rounded-[18px]"
                    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                  >
                    {theme === "dark" ? (
                      <SunMedium className="h-4 w-4" />
                    ) : (
                      <MoonStar className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="app-outline-button flex h-10 w-10 items-center justify-center rounded-[18px]"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
