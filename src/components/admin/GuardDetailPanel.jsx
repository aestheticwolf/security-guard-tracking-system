import { useState } from "react";
import { Building2, Camera, Clock3, MapPinned, RadioTower, ShieldCheck } from "lucide-react";
import StatusBadge from "../StatusBadge";
import LiveRouteMap from "../maps/LiveRouteMap";
import SelfieImageFrame from "../SelfieImageFrame";
import { buildAssetUrl } from "../../services/apiClient";
import {
  formatCoordinates,
  formatDateTime,
  formatDistanceMeters,
  formatDurationMinutes,
  formatPositionFreshness,
  formatRelative,
  getLocationDisplayLines,
  initials
} from "../../utils/format";
import { getDistanceMeters, hasCoordinates } from "../../utils/geo";
import { readBestAvailableDeviceContext } from "../../utils/device";
import {
  getGuardIdentityEnrollmentLabel,
  getSelfieCaptureLabel,
  getSelfieIdentityLabel,
  getSelfieVerificationLabel,
  hasGuardIdentityReference,
  isSelfieVerificationPassed
} from "../../utils/selfieVerification";

function formatVerificationScore(score) {
  if (score === undefined || score === null) {
    return "Pending";
  }

  return `${Math.round(Number(score) * 100)}%`;
}

function buildSelfieImageUrl(selfie) {
  return buildVersionedAssetUrl(selfie?.imagePath, selfie?.capturedAt || selfie?.id || selfie?.imagePath);
}

function buildVersionedAssetUrl(pathname, versionSeed) {
  const assetUrl = buildAssetUrl(pathname);

  if (!assetUrl) {
    return null;
  }

  const version = encodeURIComponent(versionSeed || pathname);
  const separator = assetUrl.includes("?") ? "&" : "?";
  return `${assetUrl}${separator}v=${version}`;
}

const operatorLocationRequestOptions = {
  forceFresh: false,
  timeout: 8_000,
  relaxedTimeout: 6_000,
  maxPositionAgeMs: 30 * 60_000,
  storedMaxAgeMs: 30 * 60_000
};

function getLocationTimestamp(location) {
  return location?.capturedAt || location?.trackedAt || null;
}

export default function GuardDetailPanel({ guard }) {
  const [adminLocation, setAdminLocation] = useState(null);
  const [adminLocationError, setAdminLocationError] = useState("");
  const [adminLocationLoading, setAdminLocationLoading] = useState(false);
  const [adminFocusSequence, setAdminFocusSequence] = useState(0);

  async function handleRequestAdminLocation() {
    if (adminLocationLoading) {
      return adminLocation;
    }

    setAdminLocationLoading(true);
    setAdminLocationError("");

    try {
      const nextLocation = await readBestAvailableDeviceContext(operatorLocationRequestOptions);
      setAdminLocation(nextLocation);
      setAdminFocusSequence((value) => value + 1);
      return nextLocation;
    } catch (error) {
      setAdminLocationError(
        error?.message ||
          "Unable to read this device location. Check browser and OS location permission."
      );
      return null;
    } finally {
      setAdminLocationLoading(false);
    }
  }

  if (!guard) {
    return (
      <div className="flex h-full min-h-[28rem] items-center justify-center rounded-[26px] border border-dashed border-white/10 bg-white/5 px-8 text-center text-sm app-copy-soft">
        Select a guard from the live map or roster to inspect their route, selfie verification, and shift events.
      </div>
    );
  }

  const latestSelfie = guard.selfieHistory?.[0] || guard.lastSelfie || null;
  const latestSelfieUrl = buildSelfieImageUrl(latestSelfie);
  const latestSelfieVerified = isSelfieVerificationPassed(latestSelfie);
  const identityReferencePath = guard.identitySelfiePath || guard.identityPhotoPath || null;
  const identityReferenceUrl = buildVersionedAssetUrl(
    identityReferencePath,
    guard.identityEnrolledAt || identityReferencePath
  );
  const displayLocation = guard.latestLocation || guard.mapLocation || null;
  const isLiveLocation = Boolean(guard.latestLocation);
  const liveZoneLines = getLocationDisplayLines(displayLocation);
  const liveZoneTitle = liveZoneLines[0] || "No field zone synced yet";
  const liveZoneDetail = liveZoneLines[1] || null;
  const locationContextMeta = [
    guard.dutySite?.name ? `Allotted site: ${guard.dutySite.name}` : null,
    guard.dutySite?.area ? `Assigned area: ${guard.dutySite.area}` : null,
    guard.dutySite?.address ? `Site address: ${guard.dutySite.address}` : null
  ];
  const adminDistanceMeters =
    hasCoordinates(adminLocation) && hasCoordinates(displayLocation)
      ? getDistanceMeters(adminLocation, displayLocation)
      : null;
  const adminDistanceLabel =
    Number.isFinite(adminDistanceMeters)
      ? `${formatDistanceMeters(adminDistanceMeters)} from ${guard.fullName}`
      : "";
  const adminLocationStatus = adminLocationError
    ? adminLocationError
    : adminLocation
      ? `Position updated ${formatRelative(getLocationTimestamp(adminLocation))}${
          adminLocation.fallbackUsed ? " using a recent device fix" : ""
        }`
      : "Click My Position on the map to compare your current distance.";

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
              <StatusBadge status={hasGuardIdentityReference(guard) ? "Identity enrolled" : "No reference"} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3.5 sm:p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Shift label</p>
              <p className="mt-2 text-sm text-white">{guard.shiftLabel || "Unassigned"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3.5 sm:p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Duty site</p>
              <p className="mt-2 text-sm text-white">
                {guard.dutySite?.name || "Unassigned"}
              </p>
              {guard.dutySite?.area && (
                <p className="mt-1 text-xs text-slate-400">{guard.dutySite.area}</p>
              )}
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
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Hours today</p>
              <p className="mt-2 text-sm text-white">
                {formatDurationMinutes(guard.dutyMinutesToday ?? guard.onDutyMinutes ?? 0)}
              </p>
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
              key={`${guard.id}-${displayLocation?.trackedAt || displayLocation?.capturedAt || displayLocation?.id || "empty"}`}
              currentLocation={displayLocation}
              recentLocations={isLiveLocation ? guard.recentLocations : []}
              markerLabel={initials(guard.fullName)}
              markerTone={guard.shiftState === "On Duty" ? "jade" : "gold"}
              title={guard.fullName}
              subtitle={isLiveLocation ? liveZoneLines[0] || "Field zone" : "Assigned duty site"}
              focusSequence={adminFocusSequence}
              heightClass="h-[15rem] sm:h-[19rem]"
              adminLocation={adminLocation}
              adminLocationLabel="Operations viewer location"
              adminDistanceLabel={adminDistanceLabel}
              adminLocationLoading={adminLocationLoading}
              onRequestAdminLocation={handleRequestAdminLocation}
              subjectMeta={locationContextMeta}
            />
            <p
              className={`mt-3 rounded-2xl border px-3 py-2 text-xs ${
                adminLocationError
                  ? "border-rose-300/40 bg-rose-400/10 app-error-copy"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              {adminLocationLoading ? "Requesting this device location..." : adminDistanceLabel || adminLocationStatus}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Accuracy</p>
                <p className="mt-2 text-sm text-white">
                  {isLiveLocation ? `${guard.latestLocation?.accuracy ?? "N/A"} meters` : "Awaiting GPS"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Position Freshness</p>
                <p className="mt-2 text-sm text-white">
                  {isLiveLocation
                    ? formatPositionFreshness(
                        guard.latestLocation?.capturedAt || guard.latestLocation?.trackedAt
                      )
                    : "Assigned site fallback"}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Live zone</p>
              <p className="mt-2 text-sm text-white">
                {liveZoneTitle}
              </p>
              {liveZoneDetail ? (
                <p className="mt-2 text-sm text-slate-300">{liveZoneDetail}</p>
              ) : (
                !displayLocation && (
                  <p className="mt-2 text-sm text-slate-300">
                    GPS live zone detail will appear here after sync.
                  </p>
                )
              )}
              {!isLiveLocation && displayLocation && (
                <p className="mt-2 rounded-2xl border border-gold-300/20 bg-gold-300/10 px-3 py-2 text-xs text-gold-100">
                  Showing assigned duty site coordinates until this guard sends the first live location sync.
                </p>
              )}
              <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">Duty label</p>
              <p className="mt-1 text-sm text-white">
                {displayLocation?.dutyLabel || guard.shiftLabel || "No duty label"}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">Assigned duty site</p>
              <div className="mt-1 flex items-start gap-2 text-sm text-white">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-jade-200" />
                <span>
                  {guard.dutySite?.name || "Unassigned"}
                  {guard.dutySite?.address ? ` - ${guard.dutySite.address}` : ""}
                </span>
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">Assigned area</p>
              <p className="mt-1 text-sm text-white">
                {guard.dutySite?.area || "Area not allotted"}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">Exact sync point</p>
              <p className="mt-1 text-sm text-white">{formatCoordinates(displayLocation)}</p>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
              {guard.latestLocation?.trackedAt
                ? `Tracked ${formatDateTime(guard.latestLocation.trackedAt)}`
                : displayLocation
                  ? "Assigned site shown until first location sync"
                  : "Awaiting first location sync"}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4 sm:rounded-[24px]">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Camera className="h-4 w-4 text-jade-200" />
              Latest selfie verification
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/60">
                {identityReferenceUrl ? (
                  <SelfieImageFrame
                    key={identityReferencePath}
                    src={identityReferenceUrl}
                    alt={`${guard.fullName} registered identity reference`}
                    className="h-44 w-full sm:h-52"
                  />
                ) : (
                  <div className="flex h-44 items-center justify-center px-6 text-center text-sm text-slate-400 sm:h-52">
                    No registered identity reference has been enrolled for this guard.
                  </div>
                )}
                <div className="border-t border-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Registered reference
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {getGuardIdentityEnrollmentLabel(guard)}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/60">
                {latestSelfieUrl ? (
                  <SelfieImageFrame
                    key={latestSelfie?.id || latestSelfie?.capturedAt || latestSelfie?.imagePath}
                    src={latestSelfieUrl}
                    alt={`${guard.fullName} latest selfie`}
                    className="h-44 w-full sm:h-52"
                  />
                ) : (
                  <div className="flex h-44 items-center justify-center px-6 text-center text-sm text-slate-400 sm:h-52">
                    No verification selfie has been recorded for this guard yet.
                  </div>
                )}
                <div className="border-t border-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Shift selfie proof
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {getSelfieCaptureLabel(latestSelfie)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-slate-300">
                  {getSelfieVerificationLabel(latestSelfie)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                  {latestSelfie?.capturedAt
                    ? formatDateTime(latestSelfie.capturedAt)
                    : "Awaiting first capture"}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Identity: {getSelfieIdentityLabel(latestSelfie)}
                </p>
                {latestSelfie?.identityNotes && (
                  <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-5 text-slate-300">
                    {latestSelfie.identityNotes}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <StatusBadge
                  status={
                    latestSelfieVerified
                      ? "Image verified"
                      : latestSelfie
                        ? "Image review"
                        : formatVerificationScore(latestSelfie?.verificationScore)
                  }
                />
                <StatusBadge status={getSelfieIdentityLabel(latestSelfie)} />
              </div>
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
                      {entry.note && (
                        <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                          Shift note: {entry.note}
                        </p>
                      )}
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
