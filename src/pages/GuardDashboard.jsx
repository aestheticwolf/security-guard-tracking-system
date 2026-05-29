import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Clock3,
  History,
  LayoutDashboard,
  MapPinned,
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
  formatPositionFreshness,
  formatRelative,
  formatTime,
  getLocationDisplayLines,
  initials
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
import {
  buildCameraConstraints,
  cameraSelectionModes,
  createDeviceCameraSelection,
  getCameraLabel,
  getCameraSelectionLabel,
  getDefaultCameraSelection,
  getVideoInputDevices,
  hasOnlyVirtualCameras,
  isLikelyMobileDevice,
  isVirtualCameraDevice,
  normalizeCameraSelection
} from "../utils/cameraCapture";

const selfieCaptureMaxDimension = 960;
const selfieMatchRefreshDelaysMs = [1_200, 2_500, 5_000, 8_000];
const autoSyncDistanceMeters = 25;
const autoSyncStaleMs = 10 * 60_000;
const autoSyncIntervalMs = 10 * 60_000;
const queuedSyncRetryIntervalMs = 20_000;
const manualSyncFreshTimeoutMs = 25_000;
const strictGpsMaxAgeMs = 2 * 60_000;
const storedLocationFallbackWindowMs = 2 * 60_000;

const guardSectionLinks = [
  { id: "guard-overview", label: "Overview", icon: LayoutDashboard },
  { id: "guard-attendance", label: "Shift", icon: Camera },
  { id: "guard-map", label: "Route", icon: MapPinned },
  { id: "guard-history-page", label: "History", icon: History }
];

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

function getLocationTimestampMs(location) {
  const timestamp = getLocationTimestamp(location);

  if (!timestamp) {
    return Number.NaN;
  }

  return new Date(timestamp).getTime();
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

function getGuardProfileImageUrl(profile) {
  const profilePath = profile?.identityPhotoPath || profile?.avatarUrl || profile?.identitySelfiePath;

  return buildVersionedAssetUrl(
    profilePath,
    profile?.identityEnrolledAt || profile?.updatedAt || profilePath
  );
}

function getMostRecentLocation(...candidates) {
  return candidates
    .map((location, index) => ({
      location,
      index,
      timestamp: getLocationTimestampMs(location)
    }))
    .filter((entry) => hasCoordinates(entry.location))
    .sort((left, right) => {
      const leftHasTimestamp = Number.isFinite(left.timestamp);
      const rightHasTimestamp = Number.isFinite(right.timestamp);

      if (leftHasTimestamp && rightHasTimestamp && left.timestamp !== right.timestamp) {
        return right.timestamp - left.timestamp;
      }

      if (leftHasTimestamp !== rightHasTimestamp) {
        return leftHasTimestamp ? -1 : 1;
      }

      return left.index - right.index;
    })[0]?.location || null;
}

function isRecentLocation(location, maxAgeMs) {
  const timestamp = getLocationTimestampMs(location);
  return hasCoordinates(location) && Number.isFinite(timestamp) && Date.now() - timestamp <= maxAgeMs;
}

function buildSyncSuccessMessage(location) {
  if (location?.fallbackUsed) {
    return "Location synced using a recent device location fix.";
  }

  switch (location?.source) {
    case "recent":
      return "Live location synced using a recent browser location fix.";
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

function isSelfieIdentityProcessing(selfie) {
  return selfie?.identityStatus === "identity_processing";
}

function getSelfieProofValue(selfie) {
  if (!selfie) {
    return "Pending";
  }

  if (isSelfieIdentityProcessing(selfie)) {
    return "Reviewing";
  }

  return isSelfieVerificationPassed(selfie) ? "Verified" : "Captured";
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
  const [selfieCaptureSource, setSelfieCaptureSource] = useState("");
  const [selfiePreview, setSelfiePreview] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraSelection, setSelectedCameraSelection] = useState("");
  const [activeCameraLabel, setActiveCameraLabel] = useState("");
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
  const selfieVideoRef = useRef(null);
  const selfieCameraStreamRef = useRef(null);

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

  function stopSelfieCamera({ updateState = true } = {}) {
    selfieCameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    selfieCameraStreamRef.current = null;

    if (updateState) {
      setCameraActive(false);
      setActiveCameraLabel("");
    }
  }

  useEffect(() => {
    if (cameraActive && selfieVideoRef.current && selfieCameraStreamRef.current) {
      selfieVideoRef.current.srcObject = selfieCameraStreamRef.current;
    }
  }, [cameraActive]);

  useEffect(() => () => stopSelfieCamera({ updateState: false }), []);

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
  const liveMapLocation = getMostRecentLocation(deviceLocation, lastStoredLocation);
  const isShowingUnsyncedDeviceLocation =
    liveMapLocation === deviceLocation &&
    getLocationTimestampMs(deviceLocation) > getLocationTimestampMs(lastStoredLocation);
  const liveZoneLines = getLocationDisplayLines(
    liveMapLocation?.address || liveMapLocation?.zoneDetail ? liveMapLocation : lastStoredLocation
  );
  const liveZoneTitle =
    liveZoneLines[0] ||
    (isShowingUnsyncedDeviceLocation ? "Current device position" : "Waiting for GPS zone");
  const liveZoneDetail = liveZoneLines[1] || null;
  const latestSelfie = overview?.lastSelfie || null;
  const latestSelfieVerified = isSelfieVerificationPassed(latestSelfie);
  const guardProfile = overview?.user || user;
  const guardProfileImageUrl = getGuardProfileImageUrl(guardProfile);

  useEffect(() => {
    const selfieId = latestSelfie?.id;

    if (!selfieId || !isSelfieIdentityProcessing(latestSelfie)) {
      return undefined;
    }

    let cancelled = false;
    const refreshTimers = selfieMatchRefreshDelaysMs.map((delayMs) =>
      window.setTimeout(async () => {
        if (cancelled) {
          return;
        }

        try {
          const response = await getGuardOverview();
          const nextSelfie = response?.lastSelfie || null;

          if (cancelled) {
            return;
          }

          startTransition(() => setOverview(response));

          if (nextSelfie?.id === selfieId && !isSelfieIdentityProcessing(nextSelfie)) {
            cancelled = true;
            publishGuardUpdateToAdmin("selfie-match", {
              userId: user?.id,
              selfieId,
              identityStatus: nextSelfie.identityStatus
            });
          }
        } catch {
          // Normal polling will recover if this short verification refresh fails.
        }
      }, delayMs)
    );

    return () => {
      cancelled = true;
      refreshTimers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [latestSelfie?.id, latestSelfie?.identityStatus, user?.id]);

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
    : hasFreshSavedMapSync && !isShowingUnsyncedDeviceLocation
      ? `Synced and pinned at ${formatTime(lastStoredLocation.trackedAt)}`
      : locationStatus;
  const isMobileCamera = isLikelyMobileDevice();
  const cameraSelectionOptions = [
    {
      value: cameraSelectionModes.front,
      label: isMobileCamera ? "Front selfie camera" : "Laptop / webcam camera"
    },
    ...(isMobileCamera
      ? [
          {
            value: cameraSelectionModes.rear,
            label: "Back camera"
          }
        ]
      : []),
    {
      value: cameraSelectionModes.default,
      label: "Browser default camera"
    },
    ...cameraDevices
      .filter((device) => device.deviceId)
      .map((device, index) => ({
        value: createDeviceCameraSelection(device.deviceId),
        label: `${getCameraLabel(device, index)}${isVirtualCameraDevice(device) ? " (virtual)" : ""}`
      }))
  ];
  const cameraAvailabilityNote = hasOnlyVirtualCameras(cameraDevices)
    ? "Only virtual cameras are visible to this browser. To use the laptop webcam directly, enable the MSI camera/privacy setting or disable virtual camera apps, then reopen capture."
    : "";
  const recentAttendanceTimeline = (
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
  );

  async function readFreshLocationWithFallback(statusLabel, { allowFallback = false } = {}) {
    try {
      return await refreshLocation(statusLabel, {
        forceFresh: true,
        timeout: manualSyncFreshTimeoutMs,
        storedMaxAgeMs: allowFallback ? storedLocationFallbackWindowMs : 0,
        maxPositionAgeMs: strictGpsMaxAgeMs
      });
    } catch (locationError) {
      if (!allowFallback) {
        throw locationError;
      }

      const fallbackLocation = getMostRecentLocation(deviceLocation);

      if (!isRecentLocation(fallbackLocation, storedLocationFallbackWindowMs)) {
        throw locationError;
      }

      return {
        ...fallbackLocation,
        source: fallbackLocation?.source || "stored",
        fallbackUsed: true
      };
    }
  }

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
    forceFresh = false,
    allowRecentFallback = false
  } = {}) {
    if (syncInFlightRef.current) {
      return null;
    }

    syncInFlightRef.current = true;
    setSyncingLocation(true);

    let liveLocation = sourceLocation;

    try {
      const fallbackLocation = forceFresh
        ? getMostRecentLocation(sourceLocation, deviceLocation)
        : getMostRecentLocation(
            sourceLocation,
            deviceLocation,
            lastStoredLocation,
            lastSyncedLocationRef.current
          );
      const usableFallbackLocation = isRecentLocation(fallbackLocation, storedLocationFallbackWindowMs)
        ? fallbackLocation
        : null;
      let successMessage = "Live location synced successfully.";

      if (forceFresh || !hasCoordinates(liveLocation)) {
        try {
          liveLocation = await refreshLocation(statusLabel, {
            forceFresh,
            timeout: forceFresh ? manualSyncFreshTimeoutMs : 12_000,
            storedMaxAgeMs: forceFresh ? 0 : storedLocationFallbackWindowMs,
            maxPositionAgeMs: forceFresh ? strictGpsMaxAgeMs : Number.POSITIVE_INFINITY
          });
        } catch (refreshError) {
          const canUseRecentFallback = allowRecentFallback || !forceFresh;

          if (!canUseRecentFallback || !hasCoordinates(usableFallbackLocation)) {
            throw refreshError;
          }

          liveLocation = {
            ...usableFallbackLocation,
            source: usableFallbackLocation?.source || "stored",
            fallbackUsed: true
          };
          successMessage = buildSyncSuccessMessage(liveLocation);
          setLocationStatus(
            `GPS was slow, so the latest available location from ${formatTime(
              getLocationTimestamp(usableFallbackLocation)
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
    const isCheckoutSelfie = Boolean(overview?.currentAttendance);
    setSelfieFile(file);
    setSelfieCaptureSource(file ? "upload" : "");
    setError("");

    if (!file) {
      return;
    }

    const nextMessage = isCheckoutSelfie
      ? "Check-out selfie is ready. GPS will be verified when you end the shift."
      : "Check-in selfie is ready. GPS will be verified when you start the shift.";
    setMessage(nextMessage);
    toast.success(nextMessage);
    event.target.value = "";
  }

  async function openSelfieCamera(selectionOverride = null) {
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
      cameraSelfieInputRef.current?.click();
      return;
    }

    try {
      stopSelfieCamera();
      let devices = await getVideoInputDevices();

      if (!devices.length || devices.every((device) => !device.label)) {
        const permissionStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: buildCameraConstraints(cameraSelectionModes.front, [])
        });
        permissionStream.getTracks().forEach((track) => track.stop());
        devices = await getVideoInputDevices();
      }

      const requestedSelection =
        typeof selectionOverride === "string" ? selectionOverride : selectedCameraSelection;
      const nextSelection = normalizeCameraSelection(
        requestedSelection || getDefaultCameraSelection(devices),
        devices
      );
      setCameraDevices(devices);

      if (!devices.length && nextSelection === cameraSelectionModes.default) {
        throw new Error("No camera devices were found.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: buildCameraConstraints(nextSelection, devices)
      });
      const activeTrackLabel = stream.getVideoTracks()[0]?.label || "";
      selfieCameraStreamRef.current = stream;
      setSelectedCameraSelection(nextSelection);
      setActiveCameraLabel(activeTrackLabel || getCameraSelectionLabel(nextSelection, devices));
      setCameraActive(true);
    } catch (cameraAccessError) {
      const nextError =
        cameraAccessError?.message === "No camera devices were found."
          ? "No camera device was found. Check Windows camera privacy settings and MSI webcam hotkey/utility controls."
          : "Live camera is not available. Check browser permission, Windows camera privacy settings, or choose another camera mode.";
      setCameraError(nextError);
      toast.error(nextError);
    }
  }

  function handleCameraSelectionChange(selection) {
    setSelectedCameraSelection(selection);

    if (cameraActive) {
      window.setTimeout(() => {
        openSelfieCamera(selection);
      }, 0);
    }
  }

  function switchMobileCamera() {
    const nextSelection =
      selectedCameraSelection === cameraSelectionModes.rear
        ? cameraSelectionModes.front
        : cameraSelectionModes.rear;
    handleCameraSelectionChange(nextSelection);
  }

  function captureLiveSelfie() {
    const video = selfieVideoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      const nextError = "Camera preview is still loading. Please wait a moment and try again.";
      setCameraError(nextError);
      toast.error(nextError);
      return;
    }

    const scale = Math.min(
      1,
      selfieCaptureMaxDimension / Math.max(video.videoWidth, video.videoHeight)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");

    if (!context) {
      const nextError = "Camera capture is not supported in this browser.";
      setCameraError(nextError);
      toast.error(nextError);
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          const nextError = "Could not capture the selfie image. Please try again.";
          setCameraError(nextError);
          toast.error(nextError);
          return;
        }

        const isCheckoutSelfie = Boolean(overview?.currentAttendance);
        const file = new File([blob], `shift-selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
        setSelfieFile(file);
        setSelfieCaptureSource("camera");
        setCameraError("");
        stopSelfieCamera();

        const nextMessage = isCheckoutSelfie
          ? "Check-out selfie captured from live camera. GPS will be verified when you end the shift."
          : "Check-in selfie captured from live camera. GPS will be verified when you start the shift.";
        setMessage(nextMessage);
        toast.success(nextMessage);
      },
      "image/jpeg",
      0.82
    );
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
      const activeLocation = await readFreshLocationWithFallback(
        "Capturing map position for shift check-in...",
        { allowFallback: true }
      );

      if (!hasCoordinates(activeLocation)) {
        throw new Error("Location is required to start a shift. Please allow location access and try again.");
      }

      const formData = new FormData();
      formData.append("selfie", selfieFile);
      formData.append("captureSource", selfieCaptureSource || "upload");
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
      setSelfieCaptureSource("");
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
    if (!selfieFile) {
      setError("Please capture a checkout selfie before ending your shift.");
      toast.error("Please capture a checkout selfie before ending your shift.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const activeLocation = await readFreshLocationWithFallback(
        "Capturing final map position for shift check-out...",
        { allowFallback: true }
      );

      const formData = new FormData();
      formData.append("selfie", selfieFile);
      formData.append("captureSource", selfieCaptureSource || "upload");
      formData.append("note", attendanceNote);
      formData.append("dutyLabel", locationLabel || user?.shiftLabel || "Field checkpoint");

      if (activeLocation) {
        formData.append("latitude", String(activeLocation.latitude));
        formData.append("longitude", String(activeLocation.longitude));
        formData.append("accuracy", String(activeLocation.accuracy));
        if (activeLocation.battery !== null && activeLocation.battery !== undefined) {
          formData.append("battery", String(activeLocation.battery));
        }
      }

      const response = await checkOutGuard(formData);

      clearQueuedGuardLocationSync();
      startTransition(() => setOverview(response));
      setSelfieFile(null);
      setSelfieCaptureSource("");
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
      setMessage("Shift check-out completed with selfie confirmation.");
      toast.success("Shift check-out completed with selfie confirmation.");
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
      mobileQuickLinks={guardSectionLinks}
      sectionLinks={guardSectionLinks}
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
          <div className="mb-4 flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-gradient-to-br from-gold-400 to-jade-400 text-xl font-semibold text-slate-950 shadow-accent">
              {guardProfileImageUrl ? (
                <img
                  src={guardProfileImageUrl}
                  alt={`${guardProfile?.fullName || "Guard"} profile`}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(guardProfile?.fullName || user?.fullName)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.24em] app-copy-soft">Guard profile</p>
              <p className="truncate font-display text-xl font-semibold app-copy-primary">
                {guardProfile?.fullName || user?.fullName || "Guard"}
              </p>
              <p className="mt-1 truncate text-sm app-copy-muted">
                {guardProfile?.employeeCode || guardProfile?.shiftLabel || user?.email}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={overview?.currentAttendance ? "On Duty" : "Standby"} />
                <StatusBadge status={guardProfileImageUrl ? "Photo enrolled" : "No profile photo"} />
              </div>
            </div>
          </div>

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
              value={getSelfieProofValue(latestSelfie)}
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
                    placeholder={
                      overview?.currentAttendance
                        ? "Add anything the control room should know before shift end."
                        : "Add anything the control room should know before shift start."
                    }
                  />
                </label>

                <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-medium text-white">
                    {overview?.currentAttendance ? "Check-out selfie confirmation" : "Check-in selfie verification"}
                  </p>
                  <p className="mt-2 text-xs leading-5 app-copy-soft">
                    Capture a live camera selfie. On mobile, use front camera for identity proof or switch to back camera when the duty site needs context. This proof is required before{" "}
                    {overview?.currentAttendance ? "ending" : "starting"} the shift.
                  </p>
                  <input
                    ref={cameraSelfieInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleSelfieSelection}
                    className="sr-only"
                    aria-label={
                      overview?.currentAttendance
                        ? "Capture checkout selfie with device camera"
                        : "Capture check-in selfie with device camera"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => openSelfieCamera()}
                    className="app-outline-button mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold sm:w-auto"
                  >
                    <Camera className="h-4 w-4" />
                    {overview?.currentAttendance ? "Capture check-out selfie" : "Capture check-in selfie"}
                  </button>
                  {(cameraDevices.length > 0 || cameraActive) && (
                    <label className="mt-3 block">
                      <span className="app-label">Camera mode</span>
                      <select
                        value={selectedCameraSelection}
                        onChange={(event) => handleCameraSelectionChange(event.target.value)}
                        className="app-input"
                      >
                        {cameraSelectionOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {cameraAvailabilityNote && (
                    <p className="mt-2 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
                      {cameraAvailabilityNote}
                    </p>
                  )}
                  {cameraActive && (
                    <div className="mt-4 rounded-[20px] border border-white/10 bg-slate-950/45 p-3">
                      {activeCameraLabel && (
                        <p className="mb-2 text-xs uppercase tracking-[0.2em] app-copy-soft">
                          Active camera: {activeCameraLabel}
                        </p>
                      )}
                      <video
                        ref={selfieVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={`h-[340px] w-full rounded-2xl bg-black sm:h-56 ${
                          selectedCameraSelection === cameraSelectionModes.rear
                            ? "object-contain"
                            : "object-cover"
                        }`}
                      />
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={captureLiveSelfie}
                          className="app-primary-button rounded-2xl px-4 py-2.5 text-sm font-semibold"
                        >
                          Use live selfie
                        </button>
                        <button
                          type="button"
                          onClick={stopSelfieCamera}
                          className="app-outline-button rounded-2xl px-4 py-2.5 text-sm font-medium"
                        >
                          Cancel camera
                        </button>
                        {isMobileCamera && (
                          <button
                            type="button"
                            onClick={switchMobileCamera}
                            className="app-outline-button rounded-2xl px-4 py-2.5 text-sm font-medium"
                          >
                            {selectedCameraSelection === cameraSelectionModes.rear
                              ? "Switch to front camera"
                              : "Switch to back camera"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {cameraError && (
                    <p className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-5 app-error-copy">
                      {cameraError}
                    </p>
                  )}
                  {selfieFile && (
                    <p className="mt-3 text-xs uppercase tracking-[0.2em] text-jade-200">
                      Selfie ready for {overview?.currentAttendance ? "check-out" : "check-in"} •{" "}
                      {selfieCaptureSource === "camera" ? "live camera" : "upload review"}
                    </p>
                  )}
                </div>

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
                        statusLabel: "Syncing live route now...",
                        forceFresh: true,
                        allowRecentFallback: true
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
                      {latestSelfie && (
                        <p className="mt-1 text-xs app-copy-soft">
                          Identity review is visible to the control room.
                        </p>
                      )}
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

                <div id="guard-history" className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4 sm:rounded-[24px]">
                  <p className="text-sm font-medium text-white">Recent attendance timeline</p>
                  {recentAttendanceTimeline}
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
              defaultCollapsed={false}
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
                  subtitle={liveZoneLines[0] || locationLabel || "Field location"}
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
                      {liveZoneTitle}
                    </p>
                    {liveZoneDetail ? (
                      <p className="mt-2 text-xs text-slate-400">{liveZoneDetail}</p>
                    ) : (
                      !lastStoredLocation && (
                        <p className="mt-2 text-xs text-slate-400">
                          The GPS-based live zone will appear here after sync.
                        </p>
                      )
                    )}
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
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Position Freshness</p>
                    <p className="mt-2 text-sm text-white">
                      {formatPositionFreshness(
                        liveMapLocation?.capturedAt || liveMapLocation?.trackedAt
                      )}
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
              id="guard-history-page"
              title="Shift History"
              subtitle="Recent check-in and check-out records for this guard session."
            >
              {recentAttendanceTimeline}
            </Panel>

          </div>
        </div>
      </div>
    </AppShell>
  );
}
