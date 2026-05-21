import { Activity, Camera, Clock3, MapPinned } from "lucide-react";
import StatusBadge from "../StatusBadge";
import { buildAssetUrl } from "../../services/apiClient";
import { formatCoordinates, formatDateTime, formatRelative } from "../../utils/format";

function buildSelfieImageUrl(selfie) {
  const assetUrl = buildAssetUrl(selfie?.imagePath);

  if (!assetUrl) {
    return null;
  }

  const version = encodeURIComponent(selfie.capturedAt || selfie.id || selfie.imagePath);
  const separator = assetUrl.includes("?") ? "&" : "?";
  return `${assetUrl}${separator}v=${version}`;
}

function EmptyState({ children, className = "" }) {
  return (
    <div className={`rounded-[20px] border border-dashed px-4 py-5 text-sm app-copy-soft ${className || "app-surface-soft"}`}>
      {children}
    </div>
  );
}

function getLatestSelfie(owner) {
  return owner?.selfieHistory?.[0] || owner?.lastSelfie || null;
}

export default function GuardHistoryPanel({ guard, guards = [] }) {
  if (!guard) {
    return (
      <EmptyState>
        Select a guard to review previous selfies, attendance records, location pings, and activity history.
      </EmptyState>
    );
  }

  const locations = guard.locationHistory?.length ? guard.locationHistory : guard.recentLocations || [];
  const attendance = guard.attendanceHistory?.length ? guard.attendanceHistory : guard.recentAttendance || [];
  const activities = guard.activityHistory?.length ? guard.activityHistory : guard.recentActivities || [];
  const selfieCards = (guards.length ? guards : [guard]).map((owner) => ({
    owner,
    selfie: getLatestSelfie(owner)
  }));

  return (
    <div className="space-y-4">
      <div className="app-surface-soft rounded-[22px] p-4">
        <p className="text-xs uppercase tracking-[0.24em] app-copy-soft">Selected record owner</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-display text-2xl font-semibold app-copy-primary">{guard.fullName}</h3>
            <p className="mt-1 text-sm app-copy-muted">{guard.email}</p>
          </div>
          <p className="text-xs uppercase tracking-[0.24em] app-copy-soft">
            {guard.lastSeenAt ? `Last seen ${formatRelative(guard.lastSeenAt)}` : "No previous sync"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="app-surface-soft scroll-mt-6 rounded-[22px] p-4">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium app-copy-primary">
              <MapPinned className="h-4 w-4 text-jade-400" />
              Previous location pings
            </div>
            <span className="text-xs uppercase tracking-[0.2em] app-copy-soft">
              {locations.length} saved point{locations.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="max-h-[31rem] space-y-3 overflow-y-auto pr-1">
            {locations.length ? (
              locations.map((entry) => (
                <div key={entry.id} className="app-surface-soft rounded-[20px] p-3.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium app-copy-primary">
                        {entry.address || "Live field position"}
                      </p>
                      <p className="mt-1 text-xs app-copy-muted">
                        {entry.zoneDetail || "GPS zone detail unavailable"}
                      </p>
                    </div>
                    <span className="rounded-full border border-jade-300/30 bg-jade-300/10 px-3 py-1 text-xs font-semibold text-jade-300">
                      {entry.accuracy ? `${Math.round(entry.accuracy)} m` : "GPS"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm app-copy-muted">{formatCoordinates(entry)}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] app-copy-soft">
                    Duty label: {entry.dutyLabel || guard.shiftLabel || "No duty label"}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] app-copy-soft">
                    {formatDateTime(entry.trackedAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState>No previous location pings are stored for this guard yet.</EmptyState>
            )}
          </div>
        </div>

        <div id="history-selfies" className="app-surface-soft scroll-mt-6 rounded-[22px] p-4">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium app-copy-primary">
              <Camera className="h-4 w-4 text-gold-400" />
              Selfie proof history
            </div>
            <span className="text-xs uppercase tracking-[0.2em] app-copy-soft">
              {selfieCards.filter(({ selfie }) => selfie).length}/{selfieCards.length} captured
            </span>
          </div>
          {selfieCards.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {selfieCards.map(({ owner, selfie }) => {
                const selfieUrl = buildSelfieImageUrl(selfie);

                return (
                  <div key={owner.id} className="app-surface-soft overflow-hidden rounded-[20px]">
                    {selfieUrl ? (
                      <img
                        src={selfieUrl}
                        alt={`${owner.fullName} latest selfie from ${formatDateTime(selfie.capturedAt)}`}
                        className="h-28 w-full bg-slate-950/60 object-contain object-center sm:h-32"
                      />
                    ) : (
                      <div className="flex h-28 flex-col items-center justify-center gap-2 bg-gradient-to-br from-gold-400/10 to-jade-400/10 px-4 text-center text-xs app-copy-soft sm:h-32">
                        <Camera className="h-5 w-5 text-jade-400" />
                        No selfie captured yet
                      </div>
                    )}
                    <div className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium app-copy-primary">
                            {owner.fullName}
                          </p>
                          <p className="mt-1 text-xs app-copy-muted">
                            {owner.employeeCode || "No code"}
                          </p>
                        </div>
                        <StatusBadge status={selfie?.verified ? "Verified" : "Pending"} />
                      </div>
                      <p className="text-xs uppercase tracking-[0.2em] app-copy-soft">
                        {selfie?.capturedAt
                          ? formatDateTime(selfie.capturedAt)
                          : "Awaiting first capture"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState>No previous selfie captures are stored for this guard yet.</EmptyState>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="app-surface-soft rounded-[22px] p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium app-copy-primary">
            <Clock3 className="h-4 w-4 text-jade-400" />
            Previous attendance
          </div>
          <div className="space-y-3">
            {attendance.length ? (
              attendance.map((entry) => (
                <div key={entry.id} className="app-surface-soft rounded-[20px] p-3.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium app-copy-primary">
                        {entry.checkOutAt ? "Completed shift" : "Open shift"}
                      </p>
                      <p className="mt-1 text-sm app-copy-muted">
                        {entry.locationLabel || "Field checkpoint"}
                      </p>
                    </div>
                    <StatusBadge status={entry.status || (entry.checkOutAt ? "Completed" : "On Duty")} />
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] app-copy-soft">
                    In {formatDateTime(entry.checkInAt)}
                    {entry.checkOutAt ? ` - Out ${formatDateTime(entry.checkOutAt)}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState>No previous attendance records are available yet.</EmptyState>
            )}
          </div>
        </div>

        <div className="app-surface-soft rounded-[22px] p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium app-copy-primary">
            <Activity className="h-4 w-4 text-gold-400" />
            Previous activity
          </div>
          <div className="space-y-3">
            {activities.length ? (
              activities.map((entry) => (
                <div key={entry.id} className="app-surface-soft rounded-[20px] p-3.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium app-copy-primary">{entry.title}</p>
                      <p className="mt-1 text-sm app-copy-muted">
                        {entry.description || "No extra field note was supplied."}
                      </p>
                    </div>
                    <StatusBadge status={entry.priority || entry.type} />
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] app-copy-soft">
                    {entry.type} - {formatDateTime(entry.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState>No previous activity records are available yet.</EmptyState>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
