import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  History,
  LayoutDashboard,
  MapPinned,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";
import toast from "react-hot-toast";
import GuardDetailPanel from "../components/admin/GuardDetailPanel";
import GuardPositionMap from "../components/admin/GuardPositionMap";
import FormField from "../components/FormField";
import MobileCollapseSection from "../components/MobileCollapseSection";
import Panel from "../components/Panel";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import DashboardSkeleton from "../components/skeletons/DashboardSkeleton";
import { useAuth } from "../context/AuthContext";
import AppShell from "../layouts/AppShell";
import {
  createGuardAccount,
  deleteGuardAccount,
  getAdminOverview,
  updateGuardProfile,
  updateGuardAccess
} from "../services/adminService";
import { subscribeGuardAdminSignals } from "../utils/guardAdminSignal";
import {
  formatCoordinates,
  formatDateTime,
  formatDurationMinutes,
  formatRelative
} from "../utils/format";

const adminRefreshIntervalMs = 5_000;
const adminSignalRefreshDebounceMs = 800;
const initialLiveFeedVisibleCount = 5;
const initialRosterVisibleCount = 2;

const emptyGuardForm = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  shiftLabel: "",
  employeeCode: ""
};

function buildGuardEditForm(guard) {
  return {
    fullName: guard?.fullName || "",
    email: guard?.email || "",
    password: "",
    phone: guard?.phone || "",
    shiftLabel: guard?.shiftLabel || "",
    employeeCode: guard?.employeeCode || ""
  };
}

function getAttendanceDurationMinutes(entry) {
  if (!entry?.checkInAt) {
    return 0;
  }

  const checkInTime = new Date(entry.checkInAt).getTime();
  const checkOutTime = entry.checkOutAt ? new Date(entry.checkOutAt).getTime() : Date.now();

  if (Number.isNaN(checkInTime) || Number.isNaN(checkOutTime) || checkOutTime <= checkInTime) {
    return 0;
  }

  return Math.round((checkOutTime - checkInTime) / (1000 * 60));
}

const adminSectionLinks = [
  { id: "admin-overview", label: "Overview", icon: LayoutDashboard },
  { id: "admin-map", label: "Live Map", icon: MapPinned },
  { id: "admin-guard-detail", label: "Guard Detail", icon: ShieldCheck },
  { id: "/admin/history", label: "Guard History", icon: History, to: "/admin/history" },
  { id: "admin-feed", label: "Ops Feed", icon: Activity },
  { id: "admin-create-guard", label: "Add Guard", icon: UserPlus },
  { id: "admin-roster", label: "Roster", icon: Users }
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showAllLiveFeed, setShowAllLiveFeed] = useState(false);
  const [showAllRoster, setShowAllRoster] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const [selectedGuardId, setSelectedGuardId] = useState("");
  const [guardPendingEdit, setGuardPendingEdit] = useState(null);
  const [guardPendingDelete, setGuardPendingDelete] = useState(null);
  const [guardForm, setGuardForm] = useState(emptyGuardForm);
  const [guardEditForm, setGuardEditForm] = useState(emptyGuardForm);
  const refreshInFlightRef = useRef(false);
  const pendingRefreshReasonRef = useRef("");
  const refreshOverviewRef = useRef(null);

  async function refreshOverview(options = {}) {
    const {
      loadingCopy = false,
      reason = "",
      keepCurrentMessage = true
    } = options;

    if (refreshInFlightRef.current) {
      pendingRefreshReasonRef.current = reason || pendingRefreshReasonRef.current || "queued-refresh";
      return null;
    }

    refreshInFlightRef.current = true;

    try {
      const response = await getAdminOverview({
        retries: 2,
        retryDelayMs: 1200
      });
      startTransition(() => setOverview(response));
      setError("");

      if (!keepCurrentMessage && loadingCopy) {
        setMessage("");
      }

      return response;
    } catch (loadError) {
      setError(loadError.message);
      return null;
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);

      if (pendingRefreshReasonRef.current) {
        const nextReason = pendingRefreshReasonRef.current;
        pendingRefreshReasonRef.current = "";
        window.setTimeout(() => {
          refreshOverviewRef.current?.({
            reason: nextReason,
            keepCurrentMessage: true
          });
        }, 150);
      }
    }
  }

  useEffect(() => {
    refreshOverviewRef.current = refreshOverview;
  }, [refreshOverview]);

  useEffect(() => {
    let active = true;
    let signalTimer = null;

    const requestRefresh = (reason = "poll") => {
      if (!active) {
        return;
      }

      refreshOverviewRef.current?.({
        reason,
        keepCurrentMessage: true
      });
    };

    requestRefresh("initial");

    const interval = window.setInterval(() => requestRefresh("poll"), adminRefreshIntervalMs);
    const unsubscribeSignals = subscribeGuardAdminSignals(() => {
      window.clearTimeout(signalTimer);
      signalTimer = window.setTimeout(
        () => requestRefresh("guard-signal"),
        adminSignalRefreshDebounceMs
      );
    });
    const handleOnline = () => requestRefresh("online");
    const handleFocus = () => requestRefresh("focus");
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        requestRefresh("visibility");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.clearTimeout(signalTimer);
      unsubscribeSignals?.();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id]);

  async function reloadDashboard(successMessage = "") {
    const response = await refreshOverview({
      reason: "manual-reload",
      keepCurrentMessage: false
    });

    if (!response) {
      return;
    }

    if (successMessage) {
      setMessage(successMessage);
      toast.success(successMessage);
    }
  }

  async function handleCreateGuard(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await createGuardAccount(guardForm);

      setGuardForm(emptyGuardForm);
      await reloadDashboard("New guard profile added to the roster.");
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  function openEditGuard(guard) {
    setGuardPendingEdit(guard);
    setGuardEditForm(buildGuardEditForm(guard));
  }

  async function handleUpdateGuard(event) {
    event.preventDefault();

    if (!guardPendingEdit) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const payload = {
        ...guardEditForm,
        password: guardEditForm.password.trim()
      };

      await updateGuardProfile(guardPendingEdit.id, payload);
      const updatedName = guardEditForm.fullName.trim() || guardPendingEdit.fullName;
      setSelectedGuardId(guardPendingEdit.id);
      setGuardPendingEdit(null);
      setGuardEditForm(emptyGuardForm);
      await reloadDashboard(`${updatedName}'s guard profile was updated.`);
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleGuardStatus(guard) {
    setBusy(true);
    setError("");

    try {
      const nextStatus = guard.status === "active" ? "inactive" : "active";
      await updateGuardAccess(guard.id, { status: nextStatus });
      await reloadDashboard(`Guard status updated to ${nextStatus}.`);
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteGuard() {
    if (!guardPendingDelete) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await deleteGuardAccount(guardPendingDelete.id);
      const deletedName = guardPendingDelete.fullName;
      setGuardPendingDelete(null);
      await reloadDashboard(`${deletedName} was permanently removed from the guard roster.`);
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  const filteredGuards =
    overview?.guards?.filter((guard) => {
      const query = deferredSearch.trim().toLowerCase();

      if (!query) {
        return true;
      }

      return [guard.fullName, guard.email, guard.shiftLabel, guard.employeeCode]
        .join(" ")
        .toLowerCase()
        .includes(query);
    }) || [];

  const selectedGuard =
    filteredGuards.find((guard) => guard.id === selectedGuardId) ||
    filteredGuards.find((guard) => guard.latestLocation) ||
    filteredGuards[0] ||
    null;

  const liveFeedItems = overview?.liveFeed || [];
  const hasMoreLiveFeed = liveFeedItems.length > initialLiveFeedVisibleCount;
  const hiddenLiveFeedCount = Math.max(
    liveFeedItems.length - initialLiveFeedVisibleCount,
    0
  );
  const visibleLiveFeed = showAllLiveFeed
    ? liveFeedItems
    : liveFeedItems.slice(0, initialLiveFeedVisibleCount);
  const hasMoreRoster = filteredGuards.length > initialRosterVisibleCount;
  const hiddenRosterCount = Math.max(filteredGuards.length - initialRosterVisibleCount, 0);
  const visibleRosterGuards = showAllRoster
    ? filteredGuards
    : filteredGuards.slice(0, initialRosterVisibleCount);

  useEffect(() => {
    if (!filteredGuards.length) {
      if (selectedGuardId) {
        setSelectedGuardId("");
      }
      return;
    }

    if (!filteredGuards.some((guard) => guard.id === selectedGuardId)) {
      setSelectedGuardId(
        filteredGuards.find((guard) => guard.latestLocation)?.id || filteredGuards[0].id
      );
    }
  }, [filteredGuards, selectedGuardId]);

  if (loading) {
    return (
      <AppShell
        title="Admin Mission Control"
        subtitle="Monitor live guard operations, manage the roster, inspect attendance, and keep the field team coordinated from one premium dashboard."
      >
        <DashboardSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Admin Mission Control"
      subtitle="Monitor live guard operations, manage the roster, inspect attendance, and keep the field team coordinated from one premium dashboard."
      mobileQuickLinks={adminSectionLinks}
      sectionLinks={adminSectionLinks}
    >
      <div className="space-y-5">
        {(error || message) && (
          <div
            className={`rounded-[22px] border px-4 py-3 text-sm sm:rounded-[24px] ${
              error
                ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
                : "border-jade-400/30 bg-jade-400/10 text-jade-100"
            }`}
          >
            {error || message}
          </div>
        )}

        <MobileCollapseSection
          id="admin-overview"
          title="Operations Overview"
          subtitle="Quick command numbers for guards, attendance, alerts, and tracked patrol movement."
        >
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
            <StatCard
              icon={Users}
              label="Guards"
              value={overview?.metrics?.totalGuards ?? 0}
              detail="Total registered field users"
            />
            <StatCard
              icon={ShieldCheck}
              label="On duty"
              value={overview?.metrics?.onDuty ?? 0}
              detail="Active open shifts right now"
              tone="jade"
            />
            <StatCard
              icon={Activity}
              label="Attendance"
              value={`${overview?.metrics?.attendanceRate ?? 0}%`}
              detail="Today’s check-in coverage"
              tone="slate"
            />
            <StatCard
              icon={AlertTriangle}
              label="Incidents"
              value={overview?.metrics?.incidentCount ?? 0}
              detail="Alerts and incidents recorded today"
              tone="gold"
            />
            <StatCard
              icon={MapPinned}
              label="Tracked"
              value={overview?.metrics?.trackedGuards ?? 0}
              detail={`${overview?.metrics?.locationPingsToday ?? 0} location pings synced today`}
              tone="slate"
              className="col-span-2 xl:col-span-1"
            />
          </section>
        </MobileCollapseSection>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel
            id="admin-map"
            title="Operations Live Map"
            subtitle="Each marker reflects the latest saved guard location from selfie-linked attendance, automatic route pings, and field updates."
            collapsibleOnMobile
            defaultCollapsed
          >
            <GuardPositionMap
              guards={filteredGuards}
              selectedGuardId={selectedGuard?.id}
              onSelectGuard={setSelectedGuardId}
            />
          </Panel>

          <Panel
            id="admin-guard-detail"
            title="Selected Guard Detail"
            subtitle="A single operational view of the guard's latest selfie, shift state, live coordinates, and recent field activity."
            collapsibleOnMobile
            defaultCollapsed
          >
            <GuardDetailPanel guard={selectedGuard} />
          </Panel>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel
            id="admin-feed"
            title="Live Operations Feed"
            subtitle="A unified stream of attendance, activity, and location updates from across the team."
            collapsibleOnMobile
          >
            <div className="space-y-4">
              {liveFeedItems.length ? (
                visibleLiveFeed.map((event) => (
                  <motion.div
                    key={`${event.type}-${event.id}-${event.occurredAt}`}
                    layout
                    className="rounded-[22px] border border-white/10 bg-white/5 p-4 sm:rounded-[24px]"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-white">{event.title}</p>
                        <p className="mt-2 text-sm text-slate-300">
                          {event.detail || "No extra detail supplied."}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                          {event.userName} • {formatRelative(event.occurredAt)}
                        </p>
                      </div>
                      <StatusBadge status={event.type} />
                    </div>
                  </motion.div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No live events are currently available.</p>
              )}

              {hasMoreLiveFeed && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAllLiveFeed((current) => !current)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    {showAllLiveFeed
                      ? "Show fewer updates"
                      : `Show ${hiddenLiveFeedCount} more updates`}
                  </button>
                </div>
              )}
            </div>
          </Panel>

          <Panel
            id="admin-create-guard"
            title="Add Guard"
            subtitle="Create a new field account with a shift assignment and a login password."
            className="self-start"
            collapsibleOnMobile
            defaultCollapsed
          >
            <form onSubmit={handleCreateGuard} className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Full name"
                value={guardForm.fullName}
                onChange={(value) => setGuardForm((current) => ({ ...current, fullName: value }))}
                placeholder="Nadia Brooks"
              />
              <FormField
                label="Email"
                type="email"
                value={guardForm.email}
                onChange={(value) => setGuardForm((current) => ({ ...current, email: value }))}
                placeholder="guard@sentinel.local"
              />
              <FormField
                label="Password"
                type="password"
                value={guardForm.password}
                onChange={(value) => setGuardForm((current) => ({ ...current, password: value }))}
                placeholder="Temporary password"
              />
              <FormField
                label="Phone"
                value={guardForm.phone}
                onChange={(value) => setGuardForm((current) => ({ ...current, phone: value }))}
                placeholder="+1 202 555 0180"
              />
              <FormField
                label="Shift label"
                value={guardForm.shiftLabel}
                onChange={(value) => setGuardForm((current) => ({ ...current, shiftLabel: value }))}
                placeholder="Warehouse Ring"
              />
              <FormField
                label="Employee code"
                value={guardForm.employeeCode}
                onChange={(value) => setGuardForm((current) => ({ ...current, employeeCode: value }))}
                placeholder="GRD-205"
              />

              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 to-jade-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-accent disabled:cursor-not-allowed disabled:opacity-70 sm:col-span-2"
              >
                <UserPlus className="h-4 w-4" />
                {busy ? "Creating guard..." : "Create guard account"}
              </button>
            </form>
          </Panel>
        </div>

        <Panel
          id="admin-roster"
          title="Field Guard Directory"
          subtitle="Search the directory, inspect latest movement, and manage guard access."
          className="mx-auto w-full xl:max-w-[72rem]"
          collapsibleOnMobile
          defaultCollapsed
          action={
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, shift..."
              className="app-input w-full text-sm sm:w-64"
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {filteredGuards.length ? (
              visibleRosterGuards.map((guard) => (
                <div
                  key={guard.id}
                  className="rounded-[22px] border border-white/10 bg-slate-950/45 p-3.5 sm:p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-display text-[1.55rem] font-semibold text-white sm:text-[1.75rem]">
                        {guard.fullName}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">{guard.email}</p>
                    </div>
                    <StatusBadge status={guard.status} />
                  </div>

                  <div className="mt-4 space-y-2.5 text-sm text-slate-300">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Shift label</span>
                      <span className="text-right text-white">{guard.shiftLabel || "Unassigned"}</span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Duty state</span>
                      <span className="text-right text-white">{guard.shiftState}</span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Latest map zone</span>
                      <span className="text-right text-white">
                        {guard.latestLocation?.address || "No map sync yet"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Duty label</span>
                      <span className="text-right text-white">
                        {guard.latestLocation?.dutyLabel || guard.shiftLabel || "No duty label"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Exact sync point</span>
                      <span className="text-right text-white">
                        {formatCoordinates(guard.latestLocation)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Last activity</span>
                      <span className="text-right text-white">
                        {guard.latestActivity ? formatRelative(guard.latestActivity.createdAt) : "No activity"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Location freshness</span>
                      <span className="text-right text-white">
                        {guard.locationFreshnessMinutes ?? "N/A"} min
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 p-3.5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Latest zone</p>
                    <p className="mt-2 text-sm text-white">
                      {guard.latestLocation?.address || "No zone sync yet"}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {guard.latestLocation?.zoneDetail || "GPS live zone detail will appear here after sync."}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {formatCoordinates(guard.latestLocation)}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Duty label: {guard.latestLocation?.dutyLabel || guard.shiftLabel || "No duty label"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {guard.latestLocation?.trackedAt
                        ? formatDateTime(guard.latestLocation.trackedAt)
                        : "Awaiting first location sync"}
                    </p>
                    <p className="mt-3 text-sm text-slate-300">
                      {guard.latestActivity?.title || "No recent activity title"}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => openEditGuard(guard)}
                      disabled={busy}
                      className={`app-outline-button inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium ${
                        busy ? "app-button-disabled" : ""
                      }`}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit guard
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleGuardStatus(guard)}
                      disabled={busy}
                      className={`app-outline-button rounded-2xl px-3 py-2.5 text-sm font-medium ${
                        busy ? "app-button-disabled" : ""
                      }`}
                    >
                      {guard.status === "active" ? "Suspend access" : "Reactivate access"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuardPendingDelete(guard)}
                      disabled={busy}
                      className={`app-danger-soft-button inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium ${
                        busy ? "app-button-disabled" : ""
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete guard
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No guards matched your search.</p>
            )}
          </div>

          {hasMoreRoster && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllRoster((current) => !current)}
                className="app-outline-button rounded-2xl px-4 py-2.5 text-sm font-medium"
              >
                {showAllRoster
                  ? `Show first ${initialRosterVisibleCount} guards`
                  : `Show ${hiddenRosterCount} more guard${hiddenRosterCount === 1 ? "" : "s"}`}
              </button>
            </div>
          )}
        </Panel>

        <Panel
          title="Today’s Attendance Snapshot"
          subtitle="A quick operational list of who checked in, from where, and when they started."
          collapsibleOnMobile
          defaultCollapsed
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {overview?.attendance?.length ? (
              overview.attendance.map((entry) => (
                <div key={entry.id} className="rounded-[22px] border border-white/10 bg-white/5 p-4 sm:rounded-[24px]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{entry.userName}</p>
                      <p className="mt-2 text-sm text-slate-300">
                        {entry.locationLabel || "Field checkpoint"}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                        {formatDateTime(entry.checkInAt)}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        Hours completed: {formatDurationMinutes(getAttendanceDurationMinutes(entry))}
                      </p>
                      {entry.note && (
                        <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                          Shift note: {entry.note}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={entry.checkOutAt ? "Completed" : "On Duty"} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No attendance records have been logged today.</p>
            )}
          </div>
        </Panel>

        {guardPendingEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/52 px-4 py-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="glass-panel max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-y-auto rounded-[24px] border p-5 shadow-[0_28px_80px_rgba(2,6,23,0.45)] sm:rounded-[28px] sm:p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] app-copy-soft">Roster profile</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold app-copy-primary">
                    Edit guard details
                  </h3>
                  <p className="mt-2 text-sm app-copy-muted">
                    Update account, assignment, contact, and optional password details for{" "}
                    <span className="font-semibold app-copy-primary">{guardPendingEdit.fullName}</span>.
                  </p>
                </div>
                <StatusBadge status={guardPendingEdit.status} />
              </div>

              <form onSubmit={handleUpdateGuard} className="mt-5 grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Full name"
                  value={guardEditForm.fullName}
                  onChange={(value) => setGuardEditForm((current) => ({ ...current, fullName: value }))}
                  placeholder="Nadia Brooks"
                />
                <FormField
                  label="Email"
                  type="email"
                  value={guardEditForm.email}
                  onChange={(value) => setGuardEditForm((current) => ({ ...current, email: value }))}
                  placeholder="guard@sentinel.local"
                />
                <FormField
                  label="New password"
                  type="password"
                  value={guardEditForm.password}
                  onChange={(value) => setGuardEditForm((current) => ({ ...current, password: value }))}
                  placeholder="Leave blank to keep current password"
                />
                <FormField
                  label="Phone"
                  value={guardEditForm.phone}
                  onChange={(value) => setGuardEditForm((current) => ({ ...current, phone: value }))}
                  placeholder="+1 202 555 0180"
                />
                <FormField
                  label="Shift label"
                  value={guardEditForm.shiftLabel}
                  onChange={(value) => setGuardEditForm((current) => ({ ...current, shiftLabel: value }))}
                  placeholder="Warehouse Ring"
                />
                <FormField
                  label="Employee code"
                  value={guardEditForm.employeeCode}
                  onChange={(value) => setGuardEditForm((current) => ({ ...current, employeeCode: value }))}
                  placeholder="GRD-205"
                />

                <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm app-copy-muted sm:col-span-2">
                  Password is optional. If you enter a new password, the guard's active session
                  version is refreshed so the new login details take effect safely.
                </div>

                <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setGuardPendingEdit(null);
                      setGuardEditForm(emptyGuardForm);
                    }}
                    disabled={busy}
                    className={`app-outline-button rounded-2xl px-4 py-3 text-sm font-medium ${
                      busy ? "app-button-disabled" : ""
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 to-jade-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-accent disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Pencil className="h-4 w-4" />
                    {busy ? "Saving changes..." : "Save guard changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {guardPendingDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/52 px-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="glass-panel w-full max-w-xl rounded-[24px] border p-5 shadow-[0_28px_80px_rgba(2,6,23,0.45)] sm:rounded-[28px] sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div className="app-danger-icon-shell flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-2xl font-semibold app-copy-primary">
                    Delete guard account?
                  </h3>
                  <p className="mt-2 text-sm app-copy-muted">
                    You are about to permanently remove <span className="font-semibold app-copy-primary">{guardPendingDelete.fullName}</span> from
                    the guard roster. This will also remove linked attendance records, location
                    pings, activity history, and stored selfie evidence from the local system.
                  </p>
                  <p className="app-danger-copy mt-3 text-sm font-medium">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setGuardPendingDelete(null)}
                  disabled={busy}
                  className={`app-outline-button rounded-2xl px-4 py-3 text-sm font-medium ${
                    busy ? "app-button-disabled" : ""
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteGuard}
                  disabled={busy}
                  className={`app-danger-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                    busy ? "app-button-disabled" : ""
                  }`}
                >
                  <Trash2 className="h-4 w-4" />
                  {busy ? "Deleting guard..." : "Delete guard permanently"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
