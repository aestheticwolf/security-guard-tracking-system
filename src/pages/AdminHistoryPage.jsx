import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { ArrowLeft, Camera, History, Search } from "lucide-react";
import { Link } from "react-router-dom";
import GuardHistoryPanel from "../components/admin/GuardHistoryPanel";
import Panel from "../components/Panel";
import StatusBadge from "../components/StatusBadge";
import DashboardSkeleton from "../components/skeletons/DashboardSkeleton";
import AppShell from "../layouts/AppShell";
import { getAdminOverview } from "../services/adminService";
import { formatCoordinates, formatRelative } from "../utils/format";

const historyRefreshIntervalMs = 10_000;

const historyMobileSections = [
  { id: "history-search", label: "Search", icon: Search },
  { id: "history-records", label: "Records", icon: History },
  { id: "history-selfies", label: "Selfies", icon: Camera }
];

function guardMatchesSearch(guard, query) {
  if (!query) {
    return true;
  }

  return [
    guard.fullName,
    guard.email,
    guard.employeeCode,
    guard.shiftLabel,
    guard.shiftState,
    guard.status,
    guard.latestLocation?.address,
    guard.latestLocation?.zoneDetail,
    guard.latestLocation?.dutyLabel,
    formatCoordinates(guard.latestLocation)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export default function AdminHistoryPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedGuardId, setSelectedGuardId] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      try {
        const response = await getAdminOverview({
          retries: 2,
          retryDelayMs: 1000
        });

        if (!isMounted) {
          return;
        }

        startTransition(() => setOverview(response));
        setError("");
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadHistory();
    const interval = window.setInterval(loadHistory, historyRefreshIntervalMs);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const guards = overview?.guards || [];
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredGuards = guards.filter((guard) => guardMatchesSearch(guard, normalizedSearch));
  const selectedGuard =
    filteredGuards.find((guard) => guard.id === selectedGuardId) ||
    filteredGuards[0] ||
    guards[0] ||
    null;

  useEffect(() => {
    if (!filteredGuards.length) {
      return;
    }

    if (!filteredGuards.some((guard) => guard.id === selectedGuardId)) {
      setSelectedGuardId(filteredGuards[0].id);
    }
  }, [filteredGuards, selectedGuardId]);

  if (loading) {
    return (
      <AppShell
        title="Guard History Vault"
        subtitle="Search a guard and inspect stored selfie proof, attendance trail, location pings, and activity records."
      >
        <DashboardSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Guard History Vault"
      subtitle="Search a guard and inspect stored selfie proof, attendance trail, location pings, and activity records."
      mobileQuickLinks={historyMobileSections}
      sectionLinks={historyMobileSections}
    >
      <div className="space-y-5">
        <div className="lg:hidden">
          <Link
            to="/admin"
            className="app-outline-button inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Operations Dashboard
          </Link>
        </div>

        {error && (
          <div className="rounded-[22px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 sm:rounded-[24px]">
            {error}
          </div>
        )}

        <Panel
          id="history-search"
          title="Search Guard Records"
          subtitle="Select one guard to view their complete previous data and selfie verification history."
          action={
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 app-copy-soft" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, code, zone..."
                className="app-input w-full pl-11 text-sm"
              />
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredGuards.length ? (
              filteredGuards.map((guard) => {
                const isSelected = guard.id === selectedGuard?.id;

                return (
                  <button
                    key={guard.id}
                    type="button"
                    onClick={() => setSelectedGuardId(guard.id)}
                    className={`rounded-[22px] border p-4 text-left transition ${
                      isSelected
                        ? "border-gold-300/50 bg-gold-300/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-2xl font-semibold app-copy-primary">
                          {guard.fullName}
                        </p>
                        <p className="mt-1 truncate text-sm app-copy-muted">{guard.email}</p>
                      </div>
                      <StatusBadge status={guard.shiftState} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="app-surface-soft rounded-2xl p-3">
                        <p className="text-xs uppercase tracking-[0.2em] app-copy-soft">Selfies</p>
                        <p className="mt-2 font-semibold app-copy-primary">
                          {guard.selfieHistory?.length || (guard.lastSelfie ? 1 : 0)}
                        </p>
                      </div>
                      <div className="app-surface-soft rounded-2xl p-3">
                        <p className="text-xs uppercase tracking-[0.2em] app-copy-soft">Pings</p>
                        <p className="mt-2 font-semibold app-copy-primary">
                          {guard.locationHistory?.length || guard.recentLocations?.length || 0}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm app-copy-muted">
                      {guard.latestLocation?.address || "No previous location sync"}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] app-copy-soft">
                      {guard.lastSeenAt ? `Last seen ${formatRelative(guard.lastSeenAt)}` : "No prior activity"}
                    </p>
                  </button>
                );
              })
            ) : (
              <div className="app-surface-soft rounded-[22px] p-4 text-sm app-copy-soft md:col-span-2 xl:col-span-3">
                No guard history matched your search.
              </div>
            )}
          </div>
        </Panel>

        <Panel
          id="history-records"
          title="Selected Guard Previous Data"
          subtitle="Selfie proof, attendance records, activity notes, and saved GPS location history for the selected guard."
          action={
            selectedGuard ? (
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={selectedGuard.status} />
                <StatusBadge status={selectedGuard.shiftState} />
              </div>
            ) : null
          }
        >
          {selectedGuard ? (
            <GuardHistoryPanel guard={selectedGuard} guards={[selectedGuard]} />
          ) : (
            <div className="app-surface-soft rounded-[22px] p-4 text-sm app-copy-soft">
              Select a guard to inspect previous data.
            </div>
          )}
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="app-surface-soft rounded-[22px] p-4">
            <div className="flex items-center gap-2 text-sm font-medium app-copy-primary">
              <Camera className="h-4 w-4 text-gold-400" />
              Selfie Evidence
            </div>
            <p className="mt-2 text-sm app-copy-muted">
              Selfie cards show the latest stored verification image for the selected guard.
            </p>
          </div>
          <div className="app-surface-soft rounded-[22px] p-4">
            <div className="flex items-center gap-2 text-sm font-medium app-copy-primary">
              <History className="h-4 w-4 text-jade-400" />
              Previous Data
            </div>
            <p className="mt-2 text-sm app-copy-muted">
              Location, attendance, and activity records are pulled from the local SQLite history.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
