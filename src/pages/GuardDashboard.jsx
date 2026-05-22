import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  Clock3,
  LayoutDashboard,
  MapPinned,
  RadioTower,
  ShieldCheck
} from "lucide-react";
import toast from "react-hot-toast";
import LiveRouteMap from "../components/maps/LiveRouteMap";
import MobileCollapseSection from "../components/MobileCollapseSection";
import Panel from "../components/Panel";
import SelfieImageFrame from "../components/SelfieImageFrame";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import DashboardSkeleton from "../components/skeletons/DashboardSkeleton";
import { useAuth } from "../context/AuthContext";
import { useLiveLocation } from "../hooks/useLiveLocation";
import AppShell from "../layouts/AppShell";
import { buildAssetUrl } from "../services/apiClient";
import {
  checkInGuard,
  checkOutGuard,
  getGuardOverview,
  syncGuardLocation
} from "../services/guardService";
import {
  formatDateTime,
  formatDurationMinutes,
  formatRelative,
  formatTime
} from "../utils/format";
import { getDistanceMeters, hasCoordinates } from "../utils/geo";
import { publishGuardAdminSignal } from "../utils/guardAdminSignal";
import {
  clearQueuedGuardLocationSync,
  getQueuedGuardLocationSync,
  queueGuardLocationSync,
  shouldRetryGuardLocationSync
} from "../utils/guardLocationSyncQueue";
import {
  getSelfieVerificationLabel,
  isSelfieVerificationPassed
} from "../utils/selfieVerification";

const autoSyncDistanceMeters = 25;
const autoSyncStaleMs = 10 * 60_000;
const autoSyncIntervalMs = 10 * 60_000;
const queuedSyncRetryIntervalMs = 20_000;
const manualSyncFreshTimeoutMs = 10_000;
const storedLocationFallbackWindowMs = 6 * 60 * 60_000;

function mergeLocationIntoRecentLocations(recentLocations = [], nextLocation) {
  if (!nextLocation) {
    return recentLocations;
  }

  const dedupedLocations = [nextLocation, ...recentLocations].filter(
    (entry, index, collection) =>
      index ===
      collection.findIndex(
        (candidate) =>
          candidate?.id === entry?.id ||
          (candidate?.trackedAt === entry?.trackedAt &&
            candidate?.latitude === entry?.latitude &&
            candidate?.longitude === entry?.longitude)
      )
  );

  return dedupedLocations.slice(0, 12);
}

function getLocationTimestamp(location) {
  return location?.capturedAt || location?.trackedAt || null;
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

function getBestAvailableLocation(...candidates) {
  return candidates.find((entry) => hasCoordinates(entry)) || null;
}

function buildSyncSuccessMessage(location) {
  switch (location?.source) {
    case "watch":
      return "Live location synced after the device delivered a fresh GPS fix.";
    case "relaxed":
      return "Live location synced using the latest available browser location fix.";
    case "stored":
      return "Live location synced using the latest saved device location.";
    default:
      return "Live location synced successfully.";
  }
}

function publishGuardUpdateToAdmin(type, payload = {}) {
  publishGuardAdminSignal({
    type,
    source: "guard-dashboard",
    ...payload
  });
}

export default function GuardDashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncingLocation, setSyncingLocation] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attendanceNote, setAttendanceNote] = useState("");
  const [locationLabel, setLocationLabel] = useState(user?.shiftLabel || "Field checkpoint");
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState("");
  const [mapFocusSequence, setMapFocusSequence] = useState(0);
  const { deviceLocation, setDeviceLocation, locationStatus, setLocationStatus, refreshLocation } =
    useLiveLocation();
  const lastSyncedLocationRef = useRef(null);
  const lastSyncedAtRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const queuedSyncFlushInFlightRef = useRef(false);
  const locationLabelRef = useRef(locationLabel);
  const syncLocationRef = useRef(null);
  const flushQueuedLocationSyncRef = useRef(null);
  const shouldAutoSyncRef = useRef(false);
  const cameraSelfieInputRef = useRef(null);

  useEffect(() => {
    locationLabelRef.current = locationLabel;
  }, [locationLabel]);

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      try {
        const response = await getGuardOverview();

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

    loadOverview();
    const interval = window.setInterval(loadOverview, 20_000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!selfieFile) {
      setSelfiePreview("");
      return undefined;
    }

    const preview = URL.createObjectURL(selfieFile);
    setSelfiePreview(preview);

    return () => URL.revokeObjectURL(preview);
  }, [selfieFile]);

  useEffect(() => {
    if (!overview?.lastLocation?.trackedAt) {
      return;
    }

    lastSyncedLocationRef.current = overview.lastLocation;
    lastSyncedAtRef.current = new Date(overview.lastLocation.trackedAt).getTime();
  }, [overview?.lastLocation]);

  const routeLocations = useMemo(() => overview?.recentLocations || [], [overview?.recentLocations]);
  const lastStoredLocation = overview?.lastLocation || null;
  const hasSavedMapSync = Boolean(lastStoredLocation?.trackedAt);
  const hasFreshSavedMapSync =
    Boolean(lastStoredLocation?.trackedAt) &&
    Date.now() - new Date(lastStoredLocation.trackedAt).getTime() <= autoSyncIntervalMs + 60_000;
  const liveMapLocation = lastStoredLocation || deviceLocation;
  const latestSelfie = overview?.lastSelfie || null;
  const latestSelfieVerified = isSelfieVerificationPassed(latestSelfie);

  function applySyncedLocation(responseLocation, liveLocation, options = {}) {
    if (!responseLocation) {
      return;
    }

    const {
      focusMap = true,
      statusCopy = null,
      publishSignal = true
    } = options;

    clearQueuedGuardLocationSync();
    lastSyncedLocationRef.current = responseLocation;
    lastSyncedAtRef.current = Date.now();
    setDeviceLocation((currentDeviceLocation) => ({
      ...currentDeviceLocation,
      ...liveLocation,
      ...responseLocation,
      capturedAt: liveLocation?.capturedAt || responseLocation.trackedAt
    }));
    setLocationStatus(statusCopy || `Live map synced ${formatTime(responseLocation.trackedAt)}`);
    startTransition(() => {
      setOverview((currentOverview) => {
        if (!currentOverview) {
          return currentOverview;
        }

        const nextRecentLocations = mergeLocationIntoRecentLocations(
          currentOverview.recentLocations,
          responseLocation
        );
        const wasAlreadyTracked = (currentOverview.recentLocations || []).some(
          (entry) => entry?.id === responseLocation.id
        );

        return {
          ...currentOverview,
          lastLocation: responseLocation,
          recentLocations: nextRecentLocations,
          stats: {
            ...currentOverview.stats,
            locationPings: wasAlreadyTracked
              ? currentOverview.stats?.locationPings ?? nextRecentLocations.length
              : (currentOverview.stats?.locationPings ?? 0) + 1
          }
        };
      });
    });

    if (focusMap) {
      setMapFocusSequence((currentValue) => currentValue + 1);
    }

    if (publishSignal) {
      publishGuardUpdateToAdmin("location", {
        userId: user?.id,
        locationId: responseLocation.id,
        trackedAt: responseLocation.trackedAt,
        latitude: responseLocation.latitude,
        longitude: responseLocation.longitude
      });
    }
  }

  const syncStatusCopy = syncingLocation
    ? "Syncing your current position now..."
    : hasFreshSavedMapSync
      ? `Synced and pinned at ${formatTime(lastStoredLocation.trackedAt)}`
      : locationStatus;

  async function flushQueuedLocationSync({ showMessage = false } = {}) {
    const queuedLocation = getQueuedGuardLocationSync();

    if (!queuedLocation || queuedSyncFlushInFlightRef.current) {
      return null;
    }

    queuedSyncFlushInFlightRef.current = true;

    try {
      const response = await syncGuardLocation(queuedLocation, {
        retries: 2,
        retryDelayMs: 1200
      });

      applySyncedLocation(response.location, queuedLocation, {
        focusMap: false,
        statusCopy: `Recovered a saved location sync at ${formatTime(response.location.trackedAt)}.`
      });

      if (showMessage) {
        const recoveryMessage = "A saved guard location was delivered to admin successfully.";
        setMessage(recoveryMessage);
        toast.success(recoveryMessage);
      }

      return response.location;
    } catch (flushError) {
      if (!shouldRetryGuardLocationSync(flushError)) {
        clearQueuedGuardLocationSync();
      }

      if (showMessage) {
        setError(flushError.message);
        toast.error(flushError.message);
      }

      return null;
    } finally {
      queuedSyncFlushInFlightRef.current = false;
    }
  }

  async function syncLocation({
    showMessage = true,
    sourceLocation = null,
    statusLabel = "Auto-syncing live route...",
    forceFresh = false
  } = {}) {
    if (syncInFlightRef.current) {
      return null;
    }

    syncInFlightRef.current = true;
    setSyncingLocation(true);

    let liveLocation = sourceLocation;

    try {
      const fallbackLocation = getBestAvailableLocation(
        sourceLocation,
        deviceLocation,
        lastStoredLocation,
        lastSyncedLocationRef.current
      );
      let successMessage = "Live location synced successfully.";

      if (!hasCoordinates(liveLocation)) {
        try {
          liveLocation = await refreshLocation(statusLabel, {
            forceFresh,
            timeout: forceFresh ? manualSyncFreshTimeoutMs : 12_000,
            storedMaxAgeMs: storedLocationFallbackWindowMs
          });
        } catch (refreshError) {
          if (!hasCoordinates(fallbackLocation)) {
            throw refreshError;
          }

          liveLocation = {
            ...fallbackLocation,
            source: fallbackLocation?.source || "stored",
            fallbackUsed: true
          };
          successMessage = buildSyncSuccessMessage(liveLocation);
          setLocationStatus(
            `GPS was slow, so the latest available location from ${formatTime(
              getLocationTimestamp(fallbackLocation)
            )} was used.`
          );
        }
      }

      successMessage = buildSyncSuccessMessage(liveLocation);

      const response = await syncGuardLocation({
        ...liveLocation,
        dutyLabel: locationLabelRef.current || user?.shiftLabel || "Field checkpoint"
      }, {
        retries: 2,
        retryDelayMs: 1200
      });

      if (response.location) {
        applySyncedLocation(response.location, liveLocation, {
          statusCopy:
          liveLocation?.source === "stored"
            ? `Latest saved device location synced ${formatTime(response.location.trackedAt)}`
            : `Live map synced ${formatTime(response.location.trackedAt)}`
        });
      }

      if (showMessage) {
        setMessage(successMessage);
        toast.success(successMessage);
      }

      return response.location;
    } catch (syncError) {
      if (hasCoordinates(liveLocation) && shouldRetryGuardLocationSync(syncError)) {
        const queuedLocation = queueGuardLocationSync({
          ...liveLocation,
          dutyLabel: locationLabelRef.current || user?.shiftLabel || "Field checkpoint"
        });

        const queuedMessage = queuedLocation
          ? "Location was saved locally and will retry automatically for admin."
          : "Location sync is waiting for the next stable connection.";

        setLocationStatus(queuedMessage);

        if (showMessage) {
          setMessage(queuedMessage);
          toast.success(queuedMessage);
        }

        return queuedLocation;
      }

      setLocationStatus(syncError.message);
      if (showMessage) {
        setError(syncError.message);
        toast.error(syncError.message);
      }
      throw syncError;
    } finally {
      syncInFlightRef.current = false;
      setSyncingLocation(false);
    }
  }

  useEffect(() => {
    syncLocationRef.current = syncLocation;
  }, [syncLocation]);

  useEffect(() => {
    flushQueuedLocationSyncRef.current = flushQueuedLocationSync;
  }, [flushQueuedLocationSync]);

  useEffect(() => {
    shouldAutoSyncRef.current = Boolean(overview?.currentAttendance);
  }, [overview?.currentAttendance]);

  useEffect(() => {
    const retryQueuedSync = () => {
      if (syncInFlightRef.current) {
        return;
      }

      flushQueuedLocationSyncRef.current?.().catch(() => {});
    };

    retryQueuedSync();

    const handleOnline = () => retryQueuedSync();
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        retryQueuedSync();
      }
    };

    const interval = window.setInterval(retryQueuedSync, queuedSyncRetryIntervalMs);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!shouldAutoSyncRef.current || syncInFlightRef.current) {
        return;
      }

      const scheduledSync = syncLocationRef.current?.({
        showMessage: false,
        statusLabel: "10-minute live shift sync in progress..."
      });
      scheduledSync?.catch(() => {});
    }, autoSyncIntervalMs);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!deviceLocation) {
      return;
    }

    const shouldPrepareCheckIn = Boolean(selfieFile);
    const shouldTrackActiveShift = Boolean(overview?.currentAttendance);

    if (!shouldPrepareCheckIn && !shouldTrackActiveShift) {
      setLocationStatus("Live tracking active. Waiting for shift start.");
      return;
    }

    const lastSyncedLocation = lastSyncedLocationRef.current;
    const lastSyncedAt = lastSyncedAtRef.current;
    const movedDistance = getDistanceMeters(lastSyncedLocation, deviceLocation);
    const isStale = !lastSyncedAt || Date.now() - lastSyncedAt >= autoSyncStaleMs;

    if (!lastSyncedLocation || movedDistance >= autoSyncDistanceMeters || isStale) {
      syncLocation({
        showMessage: false,
        sourceLocation: deviceLocation,
        statusLabel: shouldTrackActiveShift
          ? "Auto-syncing live route..."
          : "Preparing map position for shift check-in..."
      }).catch(() => {});
      return;
    }

    setLocationStatus(`Tracking live route • updated ${formatTime(deviceLocation.capturedAt)}`);
  }, [deviceLocation, overview?.currentAttendance, selfieFile]);

  async function handleSelfieSelection(event) {
    const file = event.target.files?.[0] || null;
    const captureSource = event.currentTarget.dataset.captureSource;
    setSelfieFile(file);

    if (!file) {
      return;
    }

    try {
      await refreshLocation("Locking map position for selfie check-in...", {
        forceFresh: true,
        timeout: manualSyncFreshTimeoutMs,
        storedMaxAgeMs: storedLocationFallbackWindowMs
      });
      setLocationStatus("Map position is ready for secure shift check-in.");
      setMessage(
        captureSource === "camera"
          ? "Live selfie captured and map position prepared for shift check-in."
          : "Selfie file attached and map position prepared for shift check-in."
      );
      toast.success(
        captureSource === "camera"
          ? "Live selfie captured. Map position is ready."
          : "Selfie attached. Map position is ready."
      );
    } catch (locationError) {
      setLocationStatus(locationError.message);
      setError(locationError.message);
      toast.error("Selfie is ready, but location permission is still needed for the full map sync.");
    }
  }

  async function handleCheckIn(event) {
    event.preventDefault();

    if (!selfieFile) {
      setError("Please attach a selfie before starting your shift.");
      toast.error("Please attach a selfie before starting your shift.");
      return;
    }

    setBusy(true);
    setError("");
    setLocationStatus("Syncing current location before shift start...");

    try {
      let activeLocation = getBestAvailableLocation(
        deviceLocation,
        lastStoredLocation,
        lastSyncedLocationRef.current
      );

      if (!activeLocation) {
        try {
          activeLocation = await refreshLocation("Capturing map position for shift check-in...", {
            forceFresh: true,
            timeout: manualSyncFreshTimeoutMs,
            storedMaxAgeMs: storedLocationFallbackWindowMs
          });
        } catch {
          activeLocation = getBestAvailableLocation(
            deviceLocation,
            lastStoredLocation,
            lastSyncedLocationRef.current
          );
        }
      }

      if (!hasCoordinates(activeLocation)) {
        throw new Error("Location is required to start a shift. Please allow location access and try again.");
      }

      const formData = new FormData();
      formData.append("selfie", selfieFile);
      formData.append("note", attendanceNote);
      formData.append("locationLabel", locationLabel);

      if (activeLocation) {
        formData.append("latitude", String(activeLocation.latitude));
        formData.append("longitude", String(activeLocation.longitude));
        formData.append("accuracy", String(activeLocation.accuracy));
        if (activeLocation.battery !== null && activeLocation.battery !== undefined) {
          formData.append("battery", String(activeLocation.battery));
        }
      }

      const response = await checkInGuard(formData);
      clearQueuedGuardLocationSync();
      startTransition(() => setOverview(response));
      setSelfieFile(null);
      setAttendanceNote("");
      if (response?.lastLocation) {
        lastSyncedLocationRef.current = response.lastLocation;
        lastSyncedAtRef.current = new Date(response.lastLocation.trackedAt).getTime();
        setDeviceLocation((currentDeviceLocation) => ({
          ...currentDeviceLocation,
          ...(activeLocation || response.lastLocation),
          ...response.lastLocation,
          capturedAt:
            activeLocation?.capturedAt || response.lastLocation.trackedAt
        }));
        setLocationStatus(`Shift check-in synced ${formatTime(response.lastLocation.trackedAt)}.`);
        setMapFocusSequence((currentValue) => currentValue + 1);
      }
      publishGuardUpdateToAdmin("attendance", {
        userId: user?.id,
        action: "check-in"
      });
      setMessage("Shift check-in verified and saved.");
      toast.success("Shift check-in verified and saved.");
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    setBusy(true);
    setError("");

    try {
      let activeLocation = getBestAvailableLocation(
        deviceLocation,
        lastStoredLocation,
        lastSyncedLocationRef.current
      );

      if (!activeLocation) {
        try {
          activeLocation = await refreshLocation("Capturing final map position for shift check-out...", {
            forceFresh: true,
            timeout: manualSyncFreshTimeoutMs,
            storedMaxAgeMs: storedLocationFallbackWindowMs
          });
        } catch {
          activeLocation = getBestAvailableLocation(
            deviceLocation,
            lastStoredLocation,
            lastSyncedLocationRef.current
          );
        }
      }

      const response = await checkOutGuard({
        note: attendanceNote,
        latitude: activeLocation?.latitude,
        longitude: activeLocation?.longitude,
        accuracy: activeLocation?.accuracy,
        dutyLabel: locationLabel || user?.shiftLabel || "Field checkpoint",
        battery: activeLocation?.battery ?? null
      });

      clearQueuedGuardLocationSync();
      startTransition(() => setOverview(response));
      setAttendanceNote("");
      if (response?.lastLocation) {
        lastSyncedLocationRef.current = response.lastLocation;
        lastSyncedAtRef.current = new Date(response.lastLocation.trackedAt).getTime();
        setDeviceLocation((currentDeviceLocation) => ({
          ...currentDeviceLocation,
          ...(activeLocation || response.lastLocation),
          ...response.lastLocation,
          capturedAt:
            activeLocation?.capturedAt || response.lastLocation.trackedAt
        }));
        setLocationStatus(`Shift check-out synced ${formatTime(response.lastLocation.trackedAt)}.`);
        setMapFocusSequence((currentValue) => currentValue + 1);
      }
      publishGuardUpdateToAdmin("attendance", {
        userId: user?.id,
        action: "check-out"
      });
      setMessage("Shift check-out completed.");
      toast.success("Shift check-out completed.");
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Guard Command Hub"
        subtitle="Track attendance, verify duty presence with a selfie, and keep your live map route synced automatically during each shift."
      >
        <DashboardSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Guard Command Hub"
      subtitle="Track attendance, verify duty presence with a selfie, and keep your live map route synced automatically during each shift."
      mobileQuickLinks={[
        { id: "guard-overview", label: "Overview", icon: LayoutDashboard },
        { id: "guard-attendance", label: "Check-In", icon: Camera },
        { id: "guard-map", label: "Live Map", icon: MapPinned },
        { id: "guard-timeline", label: "Timeline", icon: RadioTower }
      ]}
    >
      <div className="space-y-5">
        {(error || message) && (
          <div className={`app-banner ${error ? "app-banner-error" : "app-banner-success"}`}>
            {error || message}
          </div>
        )}

        <MobileCollapseSection
          id="guard-overview"
          title="Shift Overview"
          subtitle="Key duty, selfie, route, and activity numbers for this current guard session."
        >
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              icon={ShieldCheck}
              label="Shift state"
              value={overview?.currentAttendance ? "On Duty" : "Standby"}
              detail={
                overview?.currentAttendance
                  ? `Started ${formatTime(overview.currentAttendance.checkInAt)}`
                  : "Not checked in yet"
              }
            />
            <StatCard
              icon={Camera}
              label="Selfie proof"
              value={
                latestSelfie?.verificationScore
                  ? `${Math.round(latestSelfie.verificationScore * 100)}%`
                  : "Pending"
              }
              detail={
                latestSelfie
                  ? `${latestSelfieVerified ? "Verified" : "Captured"} ${formatRelative(latestSelfie.capturedAt)}`
                  : "Upload a new selfie to verify"
              }
              tone="jade"
            />
            <StatCard
              icon={MapPinned}
              label="Live route"
              value={overview?.stats?.locationPings ?? 0}
              detail={syncStatusCopy}
              tone={hasFreshSavedMapSync ? "jade" : "slate"}
            />
            <StatCard
              icon={Clock3}
              label="Hours today"
              value={formatDurationMinutes(
                overview?.stats?.dutyMinutesToday ?? overview?.stats?.onDutyMinutes ?? 0
              )}
              detail={
                overview?.currentAttendance
                  ? "Includes the active shift"
                  : `${overview?.stats?.attendanceRecordsToday ?? 0} attendance record${
                      overview?.stats?.attendanceRecordsToday === 1 ? "" : "s"
                    } today`
              }
              tone="gold"
            />
          </section>
        </MobileCollapseSection>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel
            id="guard-attendance"
            title="Attendance & Selfie Verification"
            subtitle="Start or end your shift with a verified selfie, a location tag, and an optional note."
            collapsibleOnMobile
            action={
              overview?.currentAttendance ? (
                <StatusBadge status="On Duty" />
              ) : (
                <StatusBadge status="Standby" />
              )
            }
          >
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4 sm:rounded-[24px]">
                <label className="block">
                  <span className="app-label">Duty zone label</span>
                  <input
                    value={locationLabel}
                    onChange={(event) => setLocationLabel(event.target.value)}
                    className="app-input"
                    placeholder="North Perimeter"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="app-label">Shift note</span>
                  <textarea
                    rows="4"
                    value={attendanceNote}
                    onChange={(event) => setAttendanceNote(event.target.value)}
                    className="app-input"
                    placeholder="Add anything the control room should know before shift start."
                  />
                </label>

                {!overview?.currentAttendance && (
                  <div className="mt-4">
                    <label className="block">
                      <span className="app-label">Front-camera selfie</span>
                      <input
                        type="file"
                        accept="image/*"
                        data-capture-source="upload"
                        onChange={handleSelfieSelection}
                        className="app-input file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                      />
                    </label>
                    <input
                      ref={cameraSelfieInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      data-capture-source="camera"
                      onChange={handleSelfieSelection}
                      className="sr-only"
                      aria-label="Capture selfie with device camera"
                    />
                    <button
                      type="button"
                      onClick={() => cameraSelfieInputRef.current?.click()}
                      className="app-outline-button mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold sm:w-auto"
                    >
                      <Camera className="h-4 w-4" />
                      Capture selfie now
                    </button>
                    <p className="mt-2 text-xs leading-5 app-copy-soft">
                      Choose File lets you attach an existing image. Capture selfie now opens the
                      device camera when available.
                    </p>
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {!overview?.currentAttendance ? (
                    <button
                      type="button"
                      onClick={handleCheckIn}
                      disabled={busy}
                      className="app-primary-button w-full rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                    >
                      {busy ? "Verifying..." : "Start Shift"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCheckOut}
                      disabled={busy}
                      className="app-outline-button w-full rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                    >
                      {busy ? "Completing..." : "End Shift"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      syncLocation({
                        showMessage: true,
                        sourceLocation: getBestAvailableLocation(
                          deviceLocation,
                          lastStoredLocation,
                          lastSyncedLocationRef.current
                        ),
                        statusLabel: "Syncing live route now...",
                        forceFresh: !hasCoordinates(
                          getBestAvailableLocation(
                            deviceLocation,
                            lastStoredLocation,
                            lastSyncedLocationRef.current
                          )
                        )
                      })
                    }
                    disabled={syncingLocation}
                    className={`w-full rounded-2xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto ${
                      hasFreshSavedMapSync && !syncingLocation
                        ? "app-success-button"
                        : "app-outline-button"
                    }`}
                  >
                    {syncingLocation ? "Syncing..." : "Sync now"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 sm:rounded-[24px]">
                  <p className="text-sm font-medium text-white">Latest verification snapshot</p>
                  <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/55">
                    {selfiePreview || latestSelfie?.imagePath ? (
                      <SelfieImageFrame
                        key={selfiePreview || latestSelfie?.id || latestSelfie?.capturedAt}
                        src={
                          selfiePreview ||
                          buildVersionedAssetUrl(
                            latestSelfie?.imagePath,
                            latestSelfie?.capturedAt || latestSelfie?.id
                          )
                        }
                        alt="Guard verification"
                        className="h-52 w-full sm:h-72"
                      />
                    ) : (
                      <div className="flex h-52 items-center justify-center px-8 text-center text-sm text-slate-400 sm:h-72">
                        Attach a selfie during check-in to create a verification trail.
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-slate-300">
                        {getSelfieVerificationLabel(latestSelfie)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                        {latestSelfie
                          ? formatDateTime(latestSelfie.capturedAt)
                          : "Awaiting first shift"}
                      </p>
                    </div>
                    {latestSelfie && (
                      <StatusBadge status={latestSelfieVerified ? "Verified" : "Review"} />
                    )}
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4 sm:rounded-[24px]">
                  <p className="text-sm font-medium text-white">Recent attendance timeline</p>
                  <div className="mt-4 space-y-4">
                    {overview?.recentAttendance?.length ? (
                      overview.recentAttendance.map((entry) => (
                        <div key={entry.id} className="flex gap-3">
                          <div className="mt-1 h-3 w-3 rounded-full bg-gradient-to-r from-gold-400 to-jade-400" />
                          <div>
                            <p className="font-medium text-white">
                              {entry.checkOutAt ? "Completed shift" : "Active shift"}
                            </p>
                            <p className="text-sm text-slate-300">
                              {entry.locationLabel || "Field checkpoint"}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                              {formatDateTime(entry.checkInAt)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No attendance records have been logged today.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <div className="space-y-5">
            <Panel
              id="guard-map"
              title="Live Route Map"
              subtitle="Your device updates this map automatically while the dashboard is open and location permission is enabled."
              collapsibleOnMobile
              defaultCollapsed
            >
              <div className="space-y-4">
                <LiveRouteMap
                  key={`guard-live-map-${
                    liveMapLocation?.trackedAt || liveMapLocation?.capturedAt || "empty"
                  }`}
                  currentLocation={liveMapLocation}
                  recentLocations={routeLocations}
                  markerLabel="YOU"
                  markerTone={hasSavedMapSync || syncingLocation ? "jade" : "gold"}
                  title={`${user?.fullName || "Field guard"} • Current position`}
                  subtitle={lastStoredLocation?.zoneDetail || lastStoredLocation?.address || locationLabel || "Field location"}
                  focusSequence={mapFocusSequence}
                  followCurrentLocation
                  heightClass="h-[18rem] sm:h-[22rem]"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div
                    className={`rounded-[22px] border p-4 ${
                      hasFreshSavedMapSync
                        ? "border-emerald-300/35 bg-emerald-400/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Auto-sync status</p>
                    <p className="mt-2 text-sm text-white">{syncStatusCopy}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Live zone</p>
                    <p className="mt-2 text-sm text-white">
                      {lastStoredLocation?.address || "Waiting for GPS zone"}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {lastStoredLocation?.zoneDetail || "The GPS-based live zone will appear here after sync."}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">Duty label</p>
                    <p className="mt-1 text-sm text-white">
                      {lastStoredLocation?.dutyLabel || locationLabel || user?.shiftLabel || "Field checkpoint"}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Accuracy</p>
                    <p className="mt-2 text-sm text-white">
                      {liveMapLocation?.accuracy !== undefined && liveMapLocation?.accuracy !== null
                        ? `Approx. ${liveMapLocation.accuracy} meters`
                        : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Battery</p>
                    <p className="mt-2 text-sm text-white">
                      {liveMapLocation?.battery ?? "N/A"}%
                    </p>
                  </div>
                </div>

                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  {lastStoredLocation?.trackedAt
                    ? `Last tracked ${formatDateTime(lastStoredLocation.trackedAt)}`
                    : "No stored map location yet"}
                </p>
                {liveMapLocation?.accuracy !== undefined && liveMapLocation?.accuracy !== null && (
                  <p className="text-xs text-slate-400">
                    Blue radius shows approximate device accuracy around your current point.
                  </p>
                )}
              </div>
            </Panel>

            <Panel
              id="guard-timeline"
              title="Shift Event Timeline"
              subtitle="Attendance events and verified field updates appear here for you and the admin team."
              collapsibleOnMobile
              defaultCollapsed
            >
              <div className="space-y-4">
                {overview?.recentActivities?.length ? (
                  overview.recentActivities.map((entry) => (
                    <motion.div
                      key={entry.id}
                      layout
                      className="rounded-[22px] border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-white">{entry.title}</p>
                          <p className="mt-2 text-sm text-slate-300">
                            {entry.description || "No additional detail provided."}
                          </p>
                        </div>
                        <StatusBadge status={entry.priority} />
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                        <RadioTower className="h-3.5 w-3.5" />
                        {entry.type}
                        <span className="text-slate-600">•</span>
                        {formatRelative(entry.createdAt)}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No shift events have been logged yet.</p>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
