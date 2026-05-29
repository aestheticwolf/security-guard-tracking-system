import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutDashboard,
  LogOut,
  MapPinned,
  MoonStar,
  Settings,
  ShieldCheck,
  SunMedium,
  UserPlus,
  Users
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { pageShift } from "../animations/transitions";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { buildAssetUrl } from "../services/apiClient";
import { initials } from "../utils/format";
import { isNativeApp } from "../utils/nativeApp";

function getUserAvatarUrl(user) {
  return buildAssetUrl(user?.identityPhotoPath || user?.avatarUrl || user?.identitySelfiePath);
}

function UserAvatar({ user, className = "" }) {
  const avatarUrl = getUserAvatarUrl(user);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-gold-400 to-jade-400 font-semibold text-slate-950 ${className}`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${user?.fullName || "User"} profile`}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(user?.fullName)
      )}
    </div>
  );
}

function getRoleLabel(role) {
  if (role === "super_admin") {
    return "Owner session";
  }

  if (role === "admin") {
    return "Admin session";
  }

  return "Guard session";
}

function getNativeTabs(role) {
  if (role === "super_admin") {
    return [
      { id: "home", label: "Home", icon: LayoutDashboard, to: "/super-admin", target: "platform-overview" },
      { id: "orgs", label: "Orgs", icon: Building2, to: "/super-admin", target: "organizations" },
      { id: "add", label: "Add", icon: Activity, to: "/super-admin", target: "new-organization" },
      { id: "admins", label: "Admins", icon: ShieldCheck, to: "/super-admin", target: "organization-admins" },
      { id: "account", label: "Account", icon: Users, account: true }
    ];
  }

  if (role === "admin") {
    return [
      { id: "home", label: "Home", icon: LayoutDashboard, to: "/admin", target: "admin-overview" },
      { id: "map", label: "Map", icon: MapPinned, to: "/admin", target: "admin-map" },
      { id: "guards", label: "Guards", icon: ShieldCheck, to: "/admin", target: "admin-guard-detail" },
      { id: "add", label: "Add", icon: UserPlus, to: "/admin", target: "admin-create-guard" },
      { id: "account", label: "Account", icon: Users, account: true }
    ];
  }

  return [
    { id: "home", label: "Home", icon: LayoutDashboard, to: "/dashboard", target: "guard-overview" },
    { id: "shift", label: "Shift", icon: Camera, to: "/dashboard", target: "guard-attendance" },
    { id: "route", label: "Route", icon: MapPinned, to: "/dashboard", target: "guard-map" },
    { id: "history", label: "History", icon: History, to: "/dashboard", target: "guard-history-page" },
    { id: "account", label: "Account", icon: Users, account: true }
  ];
}

function getScreenForTarget(role, target) {
  if (!target || target.startsWith?.("/")) {
    return "";
  }

  if (role === "super_admin") {
    const superAdminScreens = {
      "platform-overview": "home",
      organizations: "orgs",
      "new-organization": "add",
      "organization-admins": "admins"
    };

    return superAdminScreens[target] || "";
  }

  if (role === "admin") {
    const adminScreens = {
      "admin-overview": "home",
      "admin-duty-sites": "home",
      "admin-feed": "home",
      "admin-map": "map",
      "admin-guard-detail": "guards",
      "admin-roster": "guards",
      "admin-create-guard": "add",
      "admin-duty-site-management": "add"
    };

    return adminScreens[target] || "";
  }

  const guardScreens = {
    "guard-overview": "home",
    "guard-attendance": "shift",
    "guard-map": "route",
    "guard-history": "history",
    "guard-history-page": "history"
  };

  return guardScreens[target] || "";
}

function getFirstContentTabId(role) {
  return getNativeTabs(role).find((tab) => !tab.account)?.id || "home";
}

function notifyNativeLayoutReady() {
  [0, 160, 320].forEach((delay) => {
    window.setTimeout(() => {
      window.dispatchEvent(new Event("sentinel:layout-ready"));
    }, delay);
  });
}

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
  const location = useLocation();
  const [mobileQuickLinksCollapsed, setMobileQuickLinksCollapsed] = useState(true);
  const [nativeAccountOpen, setNativeAccountOpen] = useState(false);
  const [nativeActiveTab, setNativeActiveTab] = useState("home");
  const mobileQuickLinksRef = useRef(null);
  const lastNativeContentTabRef = useRef("home");
  const pendingNativeTargetRef = useRef(null);
  const nativeApp = isNativeApp();
  const nativeTabs = getNativeTabs(user?.role);
  const hasAppTabs = nativeTabs.length > 0;

  function confirmSignOut() {
    const confirmed = window.confirm("Are you sure you want to sign out? You will need to sign in again to continue.");

    if (!confirmed) {
      return;
    }

    logout();
  }

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

  function activateScreenForTarget(target, { scrollToTop = true } = {}) {
    const nextScreen = getScreenForTarget(user?.role, target);

    if (!nextScreen) {
      return false;
    }

    setNativeAccountOpen(false);
    lastNativeContentTabRef.current = nextScreen;
    setNativeActiveTab(nextScreen);
    setMobileQuickLinksCollapsed(true);

    if (scrollToTop) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        notifyNativeLayoutReady();
      });
    }

    return true;
  }

  function jumpToSection(target) {
    if (!target) {
      return;
    }

    if (target.startsWith("/")) {
      navigate(target);
      setMobileQuickLinksCollapsed(true);
      return;
    }

    if (activateScreenForTarget(target)) {
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

  function goToNativeTab(tab) {
    if (tab.account) {
      setNativeAccountOpen((current) => !current);
      return;
    }

    setNativeAccountOpen(false);
    lastNativeContentTabRef.current = tab.id;
    setNativeActiveTab(tab.id);

    if (tab.to && location.pathname !== tab.to) {
      pendingNativeTargetRef.current = tab.target || "__native_top__";
      navigate(tab.to);
      setMobileQuickLinksCollapsed(true);
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    notifyNativeLayoutReady();
  }

  function jumpToNativeAction(target) {
    setNativeAccountOpen(false);
    setNativeActiveTab(lastNativeContentTabRef.current);

    if (!target) {
      return;
    }

    if (target.startsWith("/")) {
      navigate(target);
      return;
    }

    if (activateScreenForTarget(target)) {
      return;
    }

    jumpToSection(target);
  }

  useEffect(() => {
    if (!pendingNativeTargetRef.current) {
      return undefined;
    }

    const target = pendingNativeTargetRef.current;
    pendingNativeTargetRef.current = null;

    const timer = window.setTimeout(() => {
      if (target === "__native_top__") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        notifyNativeLayoutReady();
        return;
      }

      if (activateScreenForTarget(target)) {
        return;
      }

      jumpToSection(target);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [location.pathname]);

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

  useEffect(() => {
    const nextTabs = getNativeTabs(user?.role).filter((tab) => !tab.account);

    if (nextTabs.some((tab) => tab.id === nativeActiveTab)) {
      return;
    }

    const nextTabId = getFirstContentTabId(user?.role);
    lastNativeContentTabRef.current = nextTabId;
    setNativeActiveTab(nextTabId);
  }, [nativeActiveTab, user?.role]);

  return (
    <div
      className={`mesh-background min-h-screen app-screen-shell app-copy-primary ${nativeApp ? "native-app-shell" : ""}`}
      data-app-role={user?.role}
      data-app-screen={nativeActiveTab}
      data-native-role={nativeApp ? user?.role : undefined}
      data-native-tab={nativeApp ? nativeActiveTab : undefined}
    >
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
              <UserAvatar user={user} className="h-12 w-12 rounded-2xl" />
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
                Pages
              </p>
              <div className="mt-3 space-y-2">
                {sectionLinks.map(({ id, label, icon: Icon, to }) => {
                  const target = to || id;
                  const screen = getScreenForTarget(user?.role, target);
                  const active = screen && nativeActiveTab === screen;

                  return (
                    <button
                      key={target}
                      type="button"
                      onClick={() => jumpToSection(target)}
                      className={`app-nav-link flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium ${
                        active ? "app-nav-link-active" : ""
                      }`}
                    >
                      {Icon ? <Icon className="h-4 w-4" /> : null}
                      {label}
                    </button>
                  );
                })}
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
            onClick={confirmSignOut}
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
              {!nativeApp && (
              <div className="app-header-actions flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
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
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.main key={title} {...pageShift} className="pb-40 lg:pb-6">
              {children}
            </motion.main>
          </AnimatePresence>

          {!nativeApp && !hasAppTabs && mobileQuickLinks.length > 0 && (
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

          {nativeAccountOpen && (
            <div
              className="native-account-backdrop fixed inset-0 z-30 lg:hidden"
              onClick={() => {
                setNativeAccountOpen(false);
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="native-account-sheet app-sidebar"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] app-copy-soft">Account</p>
                    <p className="mt-1 font-display text-xl font-semibold app-copy-primary">
                      {user?.fullName}
                    </p>
                    <p className="mt-0.5 text-sm app-copy-muted">{getRoleLabel(user?.role)}</p>
                  </div>
                  <UserAvatar user={user} className="h-11 w-11 rounded-[18px] text-sm" />
                </div>

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="native-account-action"
                  >
                    {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
                    {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  </button>

                  {user?.role === "admin" && (
                    <>
                      <button
                        type="button"
                        onClick={() => jumpToNativeAction("admin-duty-site-management")}
                        className="native-account-action"
                      >
                        <Building2 className="h-4 w-4" />
                        Duty Site Management
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpToNativeAction("admin-roster")}
                        className="native-account-action"
                      >
                        <Users className="h-4 w-4" />
                        Field Guard Directory
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpToNativeAction("/admin/history")}
                        className="native-account-action"
                      >
                        <History className="h-4 w-4" />
                        Guard History
                      </button>
                    </>
                  )}

                  {user?.role === "super_admin" && (
                    <>
                      <button
                        type="button"
                        onClick={() => jumpToNativeAction("organizations")}
                        className="native-account-action"
                      >
                        <Building2 className="h-4 w-4" />
                        Organizations
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpToNativeAction("new-organization")}
                        className="native-account-action"
                      >
                        <Activity className="h-4 w-4" />
                        Add Organization
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpToNativeAction("organization-admins")}
                        className="native-account-action"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Organization Admins
                      </button>
                    </>
                  )}

                  {user?.role === "guard" && (
                    <>
                      <button
                        type="button"
                        onClick={() => jumpToNativeAction("guard-attendance")}
                        className="native-account-action"
                      >
                        <Camera className="h-4 w-4" />
                        Shift Verification
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpToNativeAction("guard-map")}
                        className="native-account-action"
                      >
                        <MapPinned className="h-4 w-4" />
                        Live Route
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setNativeAccountOpen(false);
                    }}
                    className="native-account-action"
                  >
                    <Settings className="h-4 w-4" />
                    Close settings
                  </button>
                  <button
                    type="button"
                    onClick={confirmSignOut}
                    className="native-account-action native-account-action-danger"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {hasAppTabs && (
            <div className="native-bottom-shell fixed inset-x-3 bottom-3 z-40 lg:hidden">
              <nav className="native-bottom-tabs" aria-label="Mobile app navigation">
                {nativeTabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = tab.account ? nativeAccountOpen : nativeActiveTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => goToNativeTab(tab)}
                      className={`native-bottom-tab ${active ? "native-bottom-tab--active" : ""}`}
                      aria-label={tab.label}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {!nativeApp && !hasAppTabs && (
            <div className="fixed inset-x-3 bottom-3 z-20 lg:hidden">
            <div className="space-y-2.5">
              <div
                className="app-sidebar flex items-center justify-between gap-2 rounded-[22px] p-2.5"
                style={{ backdropFilter: "blur(18px)" }}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <UserAvatar user={user} className="h-10 w-10 rounded-[18px] text-sm" />
                  <div className="min-w-0">
                    <p className="max-w-[6.75rem] truncate text-sm font-medium app-copy-primary">
                      {user?.fullName}
                    </p>
                    <p className="max-w-[6.75rem] truncate text-[11px] app-copy-muted">
                      {getRoleLabel(user?.role)}
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
                    onClick={confirmSignOut}
                    className="app-outline-button flex h-10 w-10 items-center justify-center rounded-[18px]"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
