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
  formatSelfieIdentityScore,
  getGuardIdentityReferenceType,
  getGuardIdentityEnrollmentLabel,
  getSelfieIdentityDecision,
  getSelfieCaptureLabel,
  getSelfieIdentityGuidance,
  getSelfieIdentityLabel,
  getSelfieIdentityScorePercent,
  getSelfieIdentityTone,
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

function getIdentityToneClasses(tone) {
  if (tone === "success") {
    return {
      panel: "border-jade-300/30 bg-jade-300/10",
      text: "text-jade-100",
      bar: "from-jade-400 to-emerald-300"
    };
  }

  if (tone === "danger") {
    return {
      panel: "border-rose-300/30 bg-rose-400/10",
      text: "app-error-copy",
      bar: "from-rose-400 to-orange-300"
    };
  }

  if (tone === "processing") {
    return {
      panel: "border-sky-300/25 bg-sky-300/10",
      text: "text-sky-100",
      bar: "from-sky-400 to-jade-300"
    };
  }

  return {
    panel: "border-gold-300/25 bg-gold-300/10",
    text: "text-gold-100",
    bar: "from-gold-400 to-jade-300"
  };
}

function buildSelfieImageUrl(selfie) {
  return buildVersionedAssetUrl(selfie?.imagePath, selfie?.capturedAt || selfie?.id || selfie?.imagePath);
}

function getSelfieHistoryKey(selfie) {
  if (!selfie) {
    return "";
  }

  return String(selfie.id || `${selfie.imagePath || ""}-${selfie.capturedAt || ""}`);
}

function getTodaySelfieKeys(evidence) {
  const keys = new Set();

  evidence.forEach((entry) => {
    [entry.checkInSelfie, entry.checkOutSelfie].forEach((selfie) => {
      const key = getSelfieHistoryKey(selfie);

      if (key) {
        keys.add(key);
      }
    });
  });

  return keys;
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

function buildGuardProfileImageUrl(guard) {
  const profilePath = guard?.identityPhotoPath || guard?.avatarUrl || guard?.identitySelfiePath;

  return buildVersionedAssetUrl(profilePath, guard?.identityEnrolledAt || guard?.updatedAt || profilePath);
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

function SelfieHistoryCard({ selfie, index, guardName }) {
  const selfieUrl = buildSelfieImageUrl(selfie);
  const identityScorePercent = getSelfieIdentityScorePercent(selfie);
  const verified = isSelfieVerificationPassed(selfie);

  return (
    <article className="overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/45">
      {selfieUrl ? (
        <SelfieImageFrame
          src={selfieUrl}
          alt={`${guardName} selfie capture from ${formatDateTime(selfie.capturedAt)}`}
          className="h-36 w-full sm:h-40"
        />
      ) : (
        <div className="flex h-36 items-center justify-center bg-gradient-to-br from-gold-400/10 to-jade-400/10 px-6 text-center text-sm text-slate-400 sm:h-40">
          Selfie image is not available.
        </div>
      )}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Capture {index + 1}
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              {selfie?.capturedAt ? formatDateTime(selfie.capturedAt) : "Time not recorded"}
            </p>
          </div>
          <StatusBadge status={verified ? "Verified" : "Review"} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Match score</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatSelfieIdentityScore(selfie)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Proof source</p>
            <p className="mt-1 text-sm text-white">{getSelfieCaptureLabel(selfie)}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Identity review</p>
            <p className="text-xs font-semibold text-slate-300">
              {identityScorePercent === null ? "No score" : `${identityScorePercent}%`}
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-400 to-jade-300"
              style={{ width: `${identityScorePercent ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-300">{getSelfieIdentityDecision(selfie)}</p>
          <p className="mt-1 text-xs text-slate-400">{getSelfieIdentityLabel(selfie)}</p>
        </div>
      </div>
    </article>
  );
}

function ShiftSelfieSlot({ title, selfie, timestamp, guardName, emptyCopy }) {
  const selfieUrl = buildSelfieImageUrl(selfie);
  const verified = isSelfieVerificationPassed(selfie);

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white/5">
      {selfieUrl ? (
        <SelfieImageFrame
          src={selfieUrl}
          alt={`${guardName} ${title.toLowerCase()} selfie from ${formatDateTime(selfie.capturedAt || timestamp)}`}
          className="h-36 w-full sm:h-40"
        />
      ) : (
        <div className="flex h-36 items-center justify-center bg-slate-950/45 px-5 text-center text-sm text-slate-400 sm:h-40">
          {emptyCopy}
        </div>
      )}
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
            <p className="mt-1 text-sm text-white">
              {timestamp ? formatDateTime(timestamp) : "Time not recorded"}
            </p>
          </div>
          {selfie && <StatusBadge status={verified ? "Verified" : "Review"} />}
        </div>
        {selfie && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Match score</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatSelfieIdentityScore(selfie)}
            </p>
            <p className="mt-1 text-xs text-slate-400">{getSelfieIdentityDecision(selfie)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TodaySelfieEvidence({ guard, evidence = [] }) {
  const [showAll, setShowAll] = useState(false);
  const sortedEvidence = [...evidence].sort((first, second) => {
    const firstTime = new Date(first.checkOutAt || first.checkInAt || 0).getTime();
    const secondTime = new Date(second.checkOutAt || second.checkInAt || 0).getTime();

    return secondTime - firstTime;
  });
  const visibleEvidence = showAll ? sortedEvidence : sortedEvidence.slice(0, 1);
  const hiddenCount = Math.max(sortedEvidence.length - visibleEvidence.length, 0);

  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4 sm:rounded-[24px]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Camera className="h-4 w-4 text-jade-200" />
            Today&apos;s check-in and check-out selfies
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Daily shift proof paired from saved attendance records.
          </p>
        </div>
        <StatusBadge status={`${evidence.length} shift${evidence.length === 1 ? "" : "s"} today`} />
      </div>

      <div className={`mt-4 space-y-4 ${showAll ? "max-h-[56rem] overflow-y-auto pr-1" : ""}`}>
        {sortedEvidence.length ? (
          visibleEvidence.map((entry) => (
            <article
              key={entry.attendanceId}
              className="rounded-[22px] border border-white/10 bg-white/5 p-3.5 sm:p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    {entry.checkOutAt ? "Completed shift proof" : "Open shift proof"}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                    {entry.locationLabel || guard.shiftLabel || "Field checkpoint"}
                  </p>
                </div>
                <StatusBadge status={entry.checkOutAt ? "In and out" : "Check-in only"} />
              </div>
              {entry.note && (
                <p className="mt-3 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2 text-sm text-slate-300">
                  Shift note: {entry.note}
                </p>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ShiftSelfieSlot
                  title="Check-in selfie"
                  selfie={entry.checkInSelfie}
                  timestamp={entry.checkInAt}
                  guardName={guard.fullName}
                  emptyCopy="No check-in selfie image is linked to this shift."
                />
                <ShiftSelfieSlot
                  title="Check-out selfie"
                  selfie={entry.checkOutSelfie}
                  timestamp={entry.checkOutAt}
                  guardName={guard.fullName}
                  emptyCopy={
                    entry.checkOutAt
                      ? "No check-out selfie image is linked to this shift."
                      : "This shift has not been checked out yet."
                  }
                />
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[20px] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-400">
            No check-in or check-out selfies have been recorded today.
          </div>
        )}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-jade-200/50 hover:bg-jade-300/10"
          >
            Show {hiddenCount} earlier shift proof{hiddenCount === 1 ? "" : "s"}
          </button>
        )}
        {showAll && sortedEvidence.length > 1 && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            Show latest shift proof only
          </button>
        )}
      </div>
    </div>
  );
}

function PreviousSelfieHistory({ guardName, selfieHistory = [] }) {
  const [expanded, setExpanded] = useState(false);
  const captureLabel = `${selfieHistory.length} older capture${selfieHistory.length === 1 ? "" : "s"}`;

  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4 sm:rounded-[24px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Camera className="h-4 w-4 text-gold-200" />
            More selfie history
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Older saved captures are kept available for audit without stretching the live detail view.
          </p>
        </div>
        <StatusBadge status={captureLabel} />
      </div>

      {selfieHistory.length ? (
        <div className="mt-4">
          {!expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-jade-200/50 hover:bg-jade-300/10"
            >
              Show older selfie captures
            </button>
          ) : (
            <>
              <div className="max-h-[34rem] overflow-y-auto pr-1">
                <div className="grid gap-4 xl:grid-cols-2">
                  {selfieHistory.map((selfie, index) => (
                    <SelfieHistoryCard
                      key={selfie.id || `${selfie.imagePath}-${selfie.capturedAt}`}
                      selfie={selfie}
                      index={index}
                      guardName={guardName}
                    />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                Hide older selfie captures
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-[20px] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-400">
          No older selfie captures are stored for this guard yet.
        </div>
      )}
    </div>
  );
}

export default function GuardDetailPanel({ guard, compact = false }) {
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
  const guardProfileImageUrl = buildGuardProfileImageUrl(guard);
  const selfieHistory = guard.selfieHistory?.length
    ? guard.selfieHistory
    : latestSelfie
      ? [latestSelfie]
      : [];
  const todaySelfieEvidence = guard.todaySelfieEvidence || [];
  const todaySelfieKeys = getTodaySelfieKeys(todaySelfieEvidence);
  const previousSelfieHistory = selfieHistory.filter((selfie) => {
    const key = getSelfieHistoryKey(selfie);

    return !key || !todaySelfieKeys.has(key);
  });
  const latestSelfieUrl = buildSelfieImageUrl(latestSelfie);
  const latestSelfieVerified = isSelfieVerificationPassed(latestSelfie);
  const selfieIdentityGuidance = getSelfieIdentityGuidance(latestSelfie);
  const identityScorePercent = getSelfieIdentityScorePercent(latestSelfie);
  const identityTone = getSelfieIdentityTone(latestSelfie);
  const identityToneClasses = getIdentityToneClasses(identityTone);
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
  const visibleRecentActivities = compact
    ? (guard.recentActivities || []).slice(0, 3)
    : guard.recentActivities || [];
  const hiddenRecentActivityCount = Math.max((guard.recentActivities || []).length - visibleRecentActivities.length, 0);
  const visibleRecentAttendance = compact
    ? (guard.recentAttendance || []).slice(0, 3)
    : guard.recentAttendance || [];
  const hiddenRecentAttendanceCount = Math.max((guard.recentAttendance || []).length - visibleRecentAttendance.length, 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 sm:rounded-[26px] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[26px] bg-gradient-to-br from-gold-400 to-jade-400 text-2xl font-semibold text-slate-950 shadow-accent">
              {guardProfileImageUrl ? (
                <img
                  src={guardProfileImageUrl}
                  alt={`${guard.fullName} profile`}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(guard.fullName)
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected guard</p>
              <h3 className="mt-2 truncate font-display text-2xl font-semibold text-white sm:text-3xl">
                {guard.fullName}
              </h3>
              <p className="mt-2 truncate text-sm text-slate-300">{guard.email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge status={guard.status} />
                <StatusBadge status={guard.shiftState} />
                <StatusBadge status={hasGuardIdentityReference(guard) ? "Identity enrolled" : "No reference"} />
              </div>
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
            {!compact && (
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3.5 sm:p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Hours today</p>
                <p className="mt-2 text-sm text-white">
                  {formatDurationMinutes(guard.dutyMinutesToday ?? guard.onDutyMinutes ?? 0)}
                </p>
              </div>
            )}
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
            <div className={`mt-4 rounded-[22px] border p-4 ${identityToneClasses.panel}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Automatic face match
                  </p>
                  <p className={`mt-2 text-lg font-semibold ${identityToneClasses.text}`}>
                    {getSelfieIdentityDecision(latestSelfie)}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {compact
                      ? "Compares the latest live selfie with the enrolled reference."
                      : "Reviews the live shift selfie against the enrolled identity reference and highlights whether supervisor action is needed."}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Match score</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {formatSelfieIdentityScore(latestSelfie)}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-950/55">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${identityToneClasses.bar}`}
                  style={{ width: `${identityScorePercent ?? 0}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reference used</p>
                  <p className="mt-1 text-sm text-white">{getGuardIdentityReferenceType(guard)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Shift proof</p>
                  <p className="mt-1 text-sm text-white">{getSelfieCaptureLabel(latestSelfie)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Captured</p>
                  <p className="mt-1 text-sm text-white">
                    {latestSelfie?.capturedAt ? formatRelative(latestSelfie.capturedAt) : "No capture yet"}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/60">
                {identityReferenceUrl ? (
                  <SelfieImageFrame
                    key={identityReferencePath}
                    src={identityReferenceUrl}
                    alt={`${guard.fullName} registered identity reference`}
                    className="h-36 w-full sm:h-40"
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center px-6 text-center text-sm text-slate-400 sm:h-40">
                    No registered identity reference has been enrolled for this guard.
                  </div>
                )}
                <div className="border-t border-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Registered reference image
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {getGuardIdentityReferenceType(guard)} - {getGuardIdentityEnrollmentLabel(guard)}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/60">
                {latestSelfieUrl ? (
                  <SelfieImageFrame
                    key={latestSelfie?.id || latestSelfie?.capturedAt || latestSelfie?.imagePath}
                    src={latestSelfieUrl}
                    alt={`${guard.fullName} latest selfie`}
                    className="h-36 w-full sm:h-40"
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center px-6 text-center text-sm text-slate-400 sm:h-40">
                    No verification selfie has been recorded for this guard yet.
                  </div>
                )}
                <div className="border-t border-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Today&apos;s shift selfie
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
                <p className="mt-2 text-sm text-slate-300">
                  Match score: {formatSelfieIdentityScore(latestSelfie)}
                </p>
                {selfieIdentityGuidance && (
                  <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-5 text-slate-300">
                    {selfieIdentityGuidance}
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
                <StatusBadge status={getSelfieIdentityDecision(latestSelfie)} />
              </div>
            </div>
          </div>

          <TodaySelfieEvidence guard={guard} evidence={todaySelfieEvidence} />

          <PreviousSelfieHistory guardName={guard.fullName} selfieHistory={previousSelfieHistory} />
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
              {visibleRecentActivities.length ? (
                visibleRecentActivities.map((entry) => (
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
              {hiddenRecentActivityCount > 0 && (
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  {hiddenRecentActivityCount} older event{hiddenRecentActivityCount === 1 ? "" : "s"} available in Guard History.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 sm:rounded-[24px]">
            <p className="text-sm font-medium text-white">Recent attendance trail</p>
            <div className="mt-4 space-y-4">
              {visibleRecentAttendance.length ? (
                visibleRecentAttendance.map((entry) => (
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
              {hiddenRecentAttendanceCount > 0 && (
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  {hiddenRecentAttendanceCount} older attendance record{hiddenRecentAttendanceCount === 1 ? "" : "s"} available in Guard History.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
