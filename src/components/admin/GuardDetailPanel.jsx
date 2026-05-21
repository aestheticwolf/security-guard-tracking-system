import { Camera, Clock3, MapPinned, RadioTower, ShieldCheck } from "lucide-react";
import StatusBadge from "../StatusBadge";
import LiveRouteMap from "../maps/LiveRouteMap";
import { buildAssetUrl } from "../../services/apiClient";
import { formatCoordinates, formatDateTime, formatRelative, initials } from "../../utils/format";

function formatVerificationScore(score) {
  if (score === undefined || score === null) {
    return "Pending";
  }

  return `${Math.round(Number(score) * 100)}%`;
}

export default function GuardDetailPanel({ guard }) {
  if (!guard) {
    return (
      <div className="flex h-full min-h-[28rem] items-center justify-center rounded-[26px] border border-dashed border-white/10 bg-white/5 px-8 text-center text-sm app-copy-soft">
        Select a guard from the live map or roster to inspect their route, selfie verification, and shift events.
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 sm:rounded-[26px] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected guard</p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">{guard.fullName}</h3>
            <p className="mt-2 text-sm text-slate-300">{guard.email}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge status={guard.status} />
              <StatusBadge status={guard.shiftState} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3.5 sm:p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Shift label</p>
              <p className="mt-2 text-sm text-white">{guard.shiftLabel || "Unassigned"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3.5 sm:p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Employee code</p>
              <p className="mt-2 text-sm text-white">{guard.employeeCode || "Not assigned"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3.5 sm:p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Last seen</p>
              <p className="mt-2 text-sm text-white">
                {guard.lastSeenAt ? formatRelative(guard.lastSeenAt) : "No recent sync"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3.5 sm:p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Duty minutes</p>
              <p className="mt-2 text-sm text-white">{guard.onDutyMinutes ?? 0} min</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4 sm:rounded-[24px]">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <MapPinned className="h-4 w-4 text-gold-200" />
              Live route view
            </div>
            <LiveRouteMap
              key={`${guard.id}-${guard.latestLocation?.trackedAt || guard.latestLocation?.capturedAt || "empty"}`}
              currentLocation={guard.latestLocation}
              recentLocations={guard.recentLocations}
              markerLabel={initials(guard.fullName)}
              markerTone={guard.shiftState === "On Duty" ? "jade" : "gold"}
              title={guard.fullName}
              subtitle={guard.latestLocation?.zoneDetail || guard.latestLocation?.address || "Field zone"}
              heightClass="h-[15rem] sm:h-[19rem]"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Accuracy</p>
                <p className="mt-2 text-sm text-white">
                  {guard.latestLocation?.accuracy ?? "N/A"} meters
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Battery</p>
                <p className="mt-2 text-sm text-white">
                  {guard.latestLocation?.battery ?? "N/A"}%
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Live zone</p>
              <p className="mt-2 text-sm text-white">
                {guard.latestLocation?.address || "No field zone synced yet"}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {guard.latestLocation?.zoneDetail || "GPS live zone detail will appear here after sync."}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">Duty label</p>
              <p className="mt-1 text-sm text-white">
                {guard.latestLocation?.dutyLabel || guard.shiftLabel || "No duty label"}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">Exact sync point</p>
              <p className="mt-1 text-sm text-white">{formatCoordinates(guard.latestLocation)}</p>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
              {guard.latestLocation?.trackedAt
                ? `Tracked ${formatDateTime(guard.latestLocation.trackedAt)}`
                : "Awaiting first location sync"}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4 sm:rounded-[24px]">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Camera className="h-4 w-4 text-jade-200" />
              Latest selfie verification
            </div>
            <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/60">
              {guard.lastSelfie?.imagePath ? (
                <img
                  src={buildAssetUrl(guard.lastSelfie.imagePath)}
                  alt={`${guard.fullName} latest selfie`}
                  className="h-44 w-full object-cover sm:h-52"
                />
              ) : (
                <div className="flex h-44 items-center justify-center px-6 text-center text-sm text-slate-400 sm:h-52">
                  No verification selfie has been recorded for this guard yet.
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-slate-300">
                  {guard.lastSelfie?.verified ? "Verification passed" : "Verification pending"}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                  {guard.lastSelfie?.capturedAt
                    ? formatDateTime(guard.lastSelfie.capturedAt)
                    : "Awaiting first capture"}
                </p>
              </div>
              <StatusBadge
                status={
                  guard.lastSelfie?.verified
                    ? "Verified"
                    : formatVerificationScore(guard.lastSelfie?.verificationScore)
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                <RadioTower className="h-3.5 w-3.5" />
                Events today
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">{guard.activityCountToday ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                <MapPinned className="h-3.5 w-3.5" />
                Location pings
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">{guard.locationPingsToday ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified selfies
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">{guard.verifiedSelfiesToday ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                Freshness
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">
                {guard.locationFreshnessMinutes ?? "--"} min
              </p>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 sm:rounded-[24px]">
            <p className="text-sm font-medium text-white">Recent activity log</p>
            <div className="mt-4 space-y-4">
              {guard.recentActivities?.length ? (
                guard.recentActivities.map((entry) => (
                  <div key={entry.id} className="rounded-[20px] border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-white">{entry.title}</p>
                        <p className="mt-2 text-sm text-slate-300">
                          {entry.description || "No extra field detail was supplied."}
                        </p>
                      </div>
                      <StatusBadge status={entry.priority} />
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">
                      {entry.type} • {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No guard activity has been logged yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 sm:rounded-[24px]">
            <p className="text-sm font-medium text-white">Recent attendance trail</p>
            <div className="mt-4 space-y-4">
              {guard.recentAttendance?.length ? (
                guard.recentAttendance.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <span className="mt-1 h-3 w-3 rounded-full bg-gradient-to-r from-gold-400 to-jade-400" />
                    <div>
                      <p className="font-medium text-white">
                        {entry.checkOutAt ? "Completed shift" : "Open shift"}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {entry.locationLabel || "Field checkpoint"}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                        In {formatDateTime(entry.checkInAt)}
                        {entry.checkOutAt ? ` • Out ${formatDateTime(entry.checkOutAt)}` : ""}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No attendance trail is available yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
