import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Building2,
  Camera,
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
  createDutySite,
  createGuardAccount,
  deleteGuardAccount,
  getAdminOverview,
  updateDutySite,
  updateGuardProfile,
  updateGuardAccess
} from "../services/adminService";
import { buildAssetUrl } from "../services/apiClient";
import { subscribeGuardAdminSignals } from "../utils/guardAdminSignal";
import {
  formatCoordinates,
  formatDateTime,
  formatDurationMinutes,
  formatRelative,
  getLocationDisplayLines
} from "../utils/format";
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

const adminRefreshIntervalMs = 5_000;
const adminSignalRefreshDebounceMs = 800;
const initialLiveFeedVisibleCount = 5;
const initialRosterVisibleCount = 2;
const identityCaptureMaxDimension = 960;

const emptyGuardForm = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  shiftLabel: "",
  dutySiteId: "",
  employeeCode: "",
  identityPhoto: null,
  identitySelfie: null
};

const emptyDutySiteForm = {
  name: "",
  area: "",
  address: "",
  latitude: "",
  longitude: "",
  status: "active"
};

function buildGuardEditForm(guard) {
  return {
    fullName: guard?.fullName || "",
    email: guard?.email || "",
    password: "",
    phone: guard?.phone || "",
    shiftLabel: guard?.shiftLabel || "",
    dutySiteId: guard?.dutySiteId || "",
    employeeCode: guard?.employeeCode || "",
    identityPhoto: null,
    identitySelfie: null
  };
}

function buildDutySiteEditForm(site) {
  return {
    name: site?.name || "",
    area: site?.area || "",
    address: site?.address || "",
    latitude: site?.latitude ?? "",
    longitude: site?.longitude ?? "",
    status: site?.status || "active"
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
  { id: "admin-duty-sites", label: "Duty Sites", icon: Building2 },
  { id: "admin-map", label: "Live Map", icon: MapPinned },
  { id: "admin-guard-detail", label: "Guard Detail", icon: ShieldCheck },
  { id: "/admin/history", label: "Guard History", icon: History, to: "/admin/history" },
  { id: "admin-feed", label: "Ops Feed", icon: Activity },
  { id: "admin-create-guard", label: "Add Guard", icon: UserPlus },
  { id: "admin-roster", label: "Roster", icon: Users }
];

function buildDutySiteOptions(dutySites) {
  return [
    { value: "", label: "Unassigned duty site" },
    ...dutySites
      .filter((site) => site.status === "active")
      .map((site) => ({
        value: site.id,
        label: site.area ? `${site.name} - ${site.area}` : site.name
      }))
  ];
}

function formatDutySiteCoordinates(site) {
  if (site?.latitude === undefined || site?.latitude === null || site?.longitude === undefined || site?.longitude === null) {
    return "Coordinates not set";
  }

  return `${Number(site.latitude).toFixed(5)}, ${Number(site.longitude).toFixed(5)}`;
}

function getDashboardErrorMessage(error) {
  return String(error?.message || "")
    .trim() || "Something went wrong while updating the admin dashboard. Please try again.";
}

const guardTextFieldNames = [
  "fullName",
  "email",
  "password",
  "phone",
  "shiftLabel",
  "dutySiteId",
  "employeeCode"
];

function buildGuardSubmissionPayload(form) {
  const hasIdentityFiles = Boolean(form.identityPhoto || form.identitySelfie);

  if (!hasIdentityFiles) {
    return guardTextFieldNames.reduce(
      (payload, fieldName) => ({
        ...payload,
        [fieldName]: form[fieldName] ?? ""
      }),
      {}
    );
  }

  const formData = new FormData();

  guardTextFieldNames.forEach((fieldName) => {
    formData.append(fieldName, form[fieldName] ?? "");
  });

  if (form.identityPhoto) {
    formData.append("identityPhoto", form.identityPhoto);
  }

  if (form.identitySelfie) {
    formData.append("identitySelfie", form.identitySelfie);
  }

  return formData;
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

function IdentityImagePicker({
  label,
  file,
  existingPath = "",
  existingVersion = "",
  emptyText,
  helperText,
  capture = false,
  onChange
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraSelection, setSelectedCameraSelection] = useState("");
  const [activeCameraLabel, setActiveCameraLabel] = useState("");
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [file]);

  function stopCamera({ updateState = true } = {}) {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;

    if (updateState) {
      setCameraActive(false);
      setActiveCameraLabel("");
    }
  }

  useEffect(() => {
    if (cameraActive && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraActive]);

  useEffect(() => () => stopCamera({ updateState: false }), []);

  async function openCamera(selectionOverride = null) {
    if (!capture) {
      return;
    }

    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
      const nextError = "Live camera capture is not supported in this browser. Use the file picker instead.";
      setCameraError(nextError);
      toast.error(nextError);
      return;
    }

    try {
      stopCamera();
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
      cameraStreamRef.current = stream;
      setSelectedCameraSelection(nextSelection);
      setActiveCameraLabel(activeTrackLabel || getCameraSelectionLabel(nextSelection, devices));
      setCameraActive(true);
    } catch (cameraAccessError) {
      const nextError =
        cameraAccessError?.message === "No camera devices were found."
          ? "No camera device was found. Check browser permission and device camera settings."
          : "Live camera is not available. Check browser permission or choose another camera mode.";
      setCameraError(nextError);
      toast.error(nextError);
    }
  }

  function handleCameraSelectionChange(selection) {
    setSelectedCameraSelection(selection);

    if (cameraActive) {
      window.setTimeout(() => {
        openCamera(selection);
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

  function captureSelfieFromCamera() {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      const nextError = "Camera preview is still loading. Please wait a moment and try again.";
      setCameraError(nextError);
      toast.error(nextError);
      return;
    }

    const scale = Math.min(
      1,
      identityCaptureMaxDimension / Math.max(video.videoWidth, video.videoHeight)
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

        const capturedFile = new File([blob], `identity-selfie-${Date.now()}.jpg`, {
          type: "image/jpeg"
        });
        onChange(capturedFile);
        setCameraError("");
        stopCamera();
        toast.success("Enrollment selfie captured from live camera.");
      },
      "image/jpeg",
      0.82
    );
  }

  function handleFileSelection(event) {
    onChange(event.target.files?.[0] || null);
    setCameraError("");
    stopCamera();
  }

  const existingUrl = previewUrl
    ? null
    : buildVersionedAssetUrl(existingPath, existingVersion || existingPath);
  const imageUrl = previewUrl || existingUrl;
  const statusText = file?.name || (existingUrl ? "Current enrolled image" : emptyText);
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
    ? "Only virtual cameras are visible to this browser. To use the laptop webcam directly, enable the device camera/privacy setting or disable virtual camera apps, then reopen capture."
    : "";

  return (
    <div className="block rounded-[20px] border border-white/10 bg-slate-950/25 p-3.5">
      <span className="app-label">{label}</span>
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            className="h-40 w-full object-cover"
          />
        ) : (
          <div className="flex h-40 items-center justify-center px-5 text-center text-xs app-copy-soft">
            No image selected yet.
          </div>
        )}
      </div>
      {capture && (
        <div className="mt-3 space-y-3">
          <button
            type="button"
            onClick={() => openCamera()}
            className="app-outline-button inline-flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-semibold"
          >
            <Camera className="h-4 w-4" />
            Capture live selfie
          </button>
          {(cameraDevices.length > 0 || cameraActive) && (
            <label className="block">
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
            <p className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
              {cameraAvailabilityNote}
            </p>
          )}
          {cameraActive && (
            <div className="rounded-[18px] border border-white/10 bg-slate-950/45 p-3">
              {activeCameraLabel && (
                <p className="mb-2 text-xs uppercase tracking-[0.2em] app-copy-soft">
                  Active camera: {activeCameraLabel}
                </p>
              )}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`h-[320px] w-full rounded-2xl bg-black sm:h-40 ${
                  selectedCameraSelection === cameraSelectionModes.rear
                    ? "object-contain"
                    : "object-cover"
                }`}
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={captureSelfieFromCamera}
                  className="app-primary-button rounded-2xl px-3 py-2.5 text-xs font-semibold"
                >
                  Use this selfie
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="app-outline-button rounded-2xl px-3 py-2.5 text-xs font-medium"
                >
                  Cancel camera
                </button>
                {isMobileCamera && (
                  <button
                    type="button"
                    onClick={switchMobileCamera}
                    className="app-outline-button rounded-2xl px-3 py-2.5 text-xs font-medium sm:col-span-2"
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
            <p className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-5 app-error-copy">
              {cameraError}
            </p>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture={capture ? "user" : undefined}
        onChange={handleFileSelection}
        className="sr-only"
      />
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="app-outline-button inline-flex items-center justify-center rounded-2xl px-3 py-2.5 text-xs font-semibold"
          >
            Choose image
          </button>
          <span className="min-w-0 truncate text-xs app-copy-muted">
            {statusText}
          </span>
        </div>
        {capture && (
          <p className="mt-2 text-xs leading-5 app-copy-soft">
            Use camera for a stronger identity reference, or choose an image if the webcam is not available.
          </p>
        )}
      </div>
      {helperText && (
        <p className="mt-1 text-xs leading-5 app-copy-soft">{helperText}</p>
      )}
    </div>
  );
}

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
  const [guardPendingStatusChange, setGuardPendingStatusChange] = useState(null);
  const [guardForm, setGuardForm] = useState(emptyGuardForm);
  const [guardEditForm, setGuardEditForm] = useState(emptyGuardForm);
  const [dutySiteForm, setDutySiteForm] = useState(emptyDutySiteForm);
  const [dutySitePendingEdit, setDutySitePendingEdit] = useState(null);
  const [dutySiteEditForm, setDutySiteEditForm] = useState(emptyDutySiteForm);
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
      setError(getDashboardErrorMessage(loadError));
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
      await createGuardAccount(buildGuardSubmissionPayload(guardForm));

      setGuardForm(emptyGuardForm);
      await reloadDashboard("New guard profile added to the roster.");
    } catch (submitError) {
      const nextError = getDashboardErrorMessage(submitError);
      setError(nextError);
      toast.error(nextError);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateDutySite(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await createDutySite(dutySiteForm);
      setDutySiteForm(emptyDutySiteForm);
      await reloadDashboard("Duty site created for this organization.");
    } catch (submitError) {
      const nextError = getDashboardErrorMessage(submitError);
      setError(nextError);
      toast.error(nextError);
    } finally {
      setBusy(false);
    }
  }

  function openEditDutySite(site) {
    setDutySitePendingEdit(site);
    setDutySiteEditForm(buildDutySiteEditForm(site));
  }

  async function handleUpdateDutySite(event) {
    event.preventDefault();

    if (!dutySitePendingEdit) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await updateDutySite(dutySitePendingEdit.id, dutySiteEditForm);
      const updatedName = dutySiteEditForm.name.trim() || dutySitePendingEdit.name;
      setDutySitePendingEdit(null);
      setDutySiteEditForm(emptyDutySiteForm);
      await reloadDashboard(`${updatedName} duty site updated.`);
    } catch (submitError) {
      const nextError = getDashboardErrorMessage(submitError);
      setError(nextError);
      toast.error(nextError);
    } finally {
      setBusy(false);
    }
  }

  async function toggleDutySiteStatus(site) {
    setBusy(true);
    setError("");

    try {
      const nextStatus = site.status === "active" ? "inactive" : "active";
      await updateDutySite(site.id, {
        ...site,
        status: nextStatus
      });
      await reloadDashboard(`Duty site marked ${nextStatus}.`);
    } catch (submitError) {
      const nextError = getDashboardErrorMessage(submitError);
      setError(nextError);
      toast.error(nextError);
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

      await updateGuardProfile(guardPendingEdit.id, buildGuardSubmissionPayload(payload));
      const updatedName = guardEditForm.fullName.trim() || guardPendingEdit.fullName;
      setSelectedGuardId(guardPendingEdit.id);
      setGuardPendingEdit(null);
      setGuardEditForm(emptyGuardForm);
      await reloadDashboard(`${updatedName}'s guard profile was updated.`);
    } catch (submitError) {
      const nextError = getDashboardErrorMessage(submitError);
      setError(nextError);
      toast.error(nextError);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmGuardStatusChange() {
    if (!guardPendingStatusChange) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const nextStatus = guardPendingStatusChange.status === "active" ? "inactive" : "active";
      await updateGuardAccess(guardPendingStatusChange.id, { status: nextStatus });
      const guardName = guardPendingStatusChange.fullName;
      setGuardPendingStatusChange(null);
      await reloadDashboard(`${guardName}'s access was ${nextStatus === "active" ? "reactivated" : "suspended"}.`);
    } catch (submitError) {
      const nextError = getDashboardErrorMessage(submitError);
      setError(nextError);
      toast.error(nextError);
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
      const nextError = getDashboardErrorMessage(submitError);
      setError(nextError);
      toast.error(nextError);
    } finally {
      setBusy(false);
    }
  }

  const dutySites = overview?.dutySites || [];
  const dutySiteOptions = buildDutySiteOptions(dutySites);
  const siteCoverage = overview?.siteCoverage || [];

  const filteredGuards =
    overview?.guards?.filter((guard) => {
      const query = deferredSearch.trim().toLowerCase();

      if (!query) {
        return true;
      }

      return [
        guard.fullName,
        guard.email,
        guard.shiftLabel,
        guard.employeeCode,
        guard.dutySite?.name,
        guard.dutySite?.area,
        guard.dutySite?.address,
        guard.mapLocation?.address,
        guard.mapLocation?.zoneDetail,
        guard.mapLocation?.dutyLabel
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    }) || [];

  const selectedGuard =
    filteredGuards.find((guard) => guard.id === selectedGuardId) ||
    filteredGuards.find((guard) => guard.latestLocation) ||
    filteredGuards.find((guard) => guard.mapLocation) ||
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
        filteredGuards.find((guard) => guard.latestLocation)?.id ||
          filteredGuards.find((guard) => guard.mapLocation)?.id ||
          filteredGuards[0].id
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
          <div className={`app-banner ${error ? "app-banner-error" : "app-banner-success"}`}>
            {error || message}
          </div>
        )}

        <MobileCollapseSection
          id="admin-overview"
          title="Operations Overview"
          subtitle="Quick command numbers for guards, attendance, alerts, and tracked patrol movement."
        >
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-6">
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
              detail={`${overview?.metrics?.checkedInGuardsToday ?? 0}/${overview?.metrics?.totalGuards ?? 0} guards checked in today`}
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
              icon={Building2}
              label="Duty Sites"
              value={overview?.metrics?.activeDutySites ?? 0}
              detail={`${overview?.metrics?.assignedToDutySites ?? 0}/${overview?.metrics?.totalGuards ?? 0} guards assigned`}
              tone="jade"
            />
            <StatCard
              icon={MapPinned}
              label="Tracked"
              value={overview?.metrics?.trackedGuards ?? 0}
              detail={`${overview?.metrics?.locationPingsToday ?? 0} location pings synced today`}
              tone="slate"
            />
          </section>
        </MobileCollapseSection>

        <MobileCollapseSection
          id="admin-duty-sites"
          title="Duty Site Coverage"
          subtitle="See how many guards are assigned to each duty site and how many are currently tracked there."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {siteCoverage.length ? (
              siteCoverage.map((site) => (
                <article
                  key={site.id}
                  className="rounded-[24px] border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-display text-xl font-semibold app-copy-primary">
                        {site.name}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] app-copy-soft">
                        {site.area || "No area label"}
                      </p>
                    </div>
                    <StatusBadge status={site.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2.5">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] app-copy-soft">
                        {site.isUnassigned ? "Guards" : "Assigned"}
                      </p>
                      <p className="mt-2 text-2xl font-semibold app-copy-primary">
                        {site.assignedCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] app-copy-soft">On duty</p>
                      <p className="mt-2 text-2xl font-semibold app-copy-primary">
                        {site.onDutyCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] app-copy-soft">Tracked</p>
                      <p className="mt-2 text-2xl font-semibold app-copy-primary">
                        {site.trackedCount}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm app-copy-muted">
                    {site.address || "No duty site address provided."}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] app-copy-soft">
                    {formatDutySiteCoordinates(site)}
                  </p>

                  {site.guards?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {site.guards.slice(0, 6).map((guard) => (
                        <button
                          key={guard.id}
                          type="button"
                          onClick={() => setSelectedGuardId(guard.id)}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs app-copy-muted transition hover:bg-white/10"
                        >
                          {guard.fullName}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="text-sm app-copy-muted">
                No duty sites yet. Create Panjim, Margao, or any client location from Duty Site Management.
              </p>
            )}
          </div>
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

          <div className="space-y-5">
          <Panel
            id="admin-duty-site-management"
            title="Duty Site Management"
            subtitle="Create and maintain organization locations such as Panjim Office, Margao Office, warehouses, gates, or client posts."
            className="self-start"
            collapsibleOnMobile
            defaultCollapsed
          >
            <form onSubmit={handleCreateDutySite} className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Duty site name"
                value={dutySiteForm.name}
                onChange={(value) => setDutySiteForm((current) => ({ ...current, name: value }))}
                placeholder="Panjim Office"
              />
              <FormField
                label="Area / city"
                value={dutySiteForm.area}
                onChange={(value) => setDutySiteForm((current) => ({ ...current, area: value }))}
                placeholder="Panjim"
              />
              <FormField
                label="Address / duty details"
                value={dutySiteForm.address}
                onChange={(value) => setDutySiteForm((current) => ({ ...current, address: value }))}
                placeholder="Main gate, lobby, perimeter, or client site"
              />
              <FormField
                label="Latitude"
                type="number"
                value={dutySiteForm.latitude}
                onChange={(value) => setDutySiteForm((current) => ({ ...current, latitude: value }))}
                placeholder="15.4909"
              />
              <FormField
                label="Longitude"
                type="number"
                value={dutySiteForm.longitude}
                onChange={(value) => setDutySiteForm((current) => ({ ...current, longitude: value }))}
                placeholder="73.8278"
              />
              <button
                type="submit"
                disabled={busy}
                className="app-primary-button rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:self-end"
              >
                Create duty site
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {dutySites.length ? (
                dutySites.map((site) => (
                  <div
                    key={site.id}
                    className="rounded-[22px] border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold app-copy-primary">{site.name}</p>
                        <p className="mt-1 text-sm app-copy-muted">
                          {site.area || "No area"} • {site.address || "No address"}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.2em] app-copy-soft">
                          {formatDutySiteCoordinates(site)}
                        </p>
                      </div>
                      <StatusBadge status={site.status} />
                    </div>

                    {dutySitePendingEdit?.id === site.id ? (
                      <form onSubmit={handleUpdateDutySite} className="mt-4 grid gap-4 sm:grid-cols-2">
                        <FormField
                          label="Duty site name"
                          value={dutySiteEditForm.name}
                          onChange={(value) => setDutySiteEditForm((current) => ({ ...current, name: value }))}
                        />
                        <FormField
                          label="Area / city"
                          value={dutySiteEditForm.area}
                          onChange={(value) => setDutySiteEditForm((current) => ({ ...current, area: value }))}
                        />
                        <FormField
                          label="Address / duty details"
                          value={dutySiteEditForm.address}
                          onChange={(value) => setDutySiteEditForm((current) => ({ ...current, address: value }))}
                        />
                        <FormField
                          label="Latitude"
                          type="number"
                          value={dutySiteEditForm.latitude}
                          onChange={(value) => setDutySiteEditForm((current) => ({ ...current, latitude: value }))}
                        />
                        <FormField
                          label="Longitude"
                          type="number"
                          value={dutySiteEditForm.longitude}
                          onChange={(value) => setDutySiteEditForm((current) => ({ ...current, longitude: value }))}
                        />
                        <FormField
                          label="Status"
                          as="select"
                          value={dutySiteEditForm.status}
                          onChange={(value) => setDutySiteEditForm((current) => ({ ...current, status: value }))}
                          options={[
                            { value: "active", label: "Active" },
                            { value: "inactive", label: "Inactive" }
                          ]}
                        />
                        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setDutySitePendingEdit(null);
                              setDutySiteEditForm(emptyDutySiteForm);
                            }}
                            className="app-outline-button rounded-2xl px-4 py-2.5 text-sm font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={busy}
                            className="app-primary-button rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Save duty site
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditDutySite(site)}
                          disabled={busy}
                          className="app-outline-button inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit site
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleDutySiteStatus(site)}
                          disabled={busy}
                          className="app-outline-button rounded-2xl px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {site.status === "active" ? "Mark inactive" : "Reactivate"}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm app-copy-muted">
                  No duty sites yet. Add the first office, branch, post, or client location.
                </p>
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
                label="Duty site"
                as="select"
                value={guardForm.dutySiteId}
                onChange={(value) => setGuardForm((current) => ({ ...current, dutySiteId: value }))}
                options={dutySiteOptions}
              />
              <FormField
                label="Employee code"
                value={guardForm.employeeCode}
                onChange={(value) => setGuardForm((current) => ({ ...current, employeeCode: value }))}
                placeholder="GRD-205"
              />

              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 sm:col-span-2">
                <div className="flex items-start gap-3">
                  <div className="app-surface-soft rounded-2xl p-3">
                    <Camera className="h-5 w-5 text-jade-400" />
                  </div>
                  <div>
                    <p className="font-medium app-copy-primary">Identity enrollment</p>
                    <p className="mt-1 text-sm app-copy-muted">
                      Add a registered profile image and an enrollment selfie. Shift selfies will
                      show admin whether a reference exists and whether the proof came from camera
                      capture or file upload.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <IdentityImagePicker
                    label="Registered guard photo"
                    file={guardForm.identityPhoto}
                    emptyText="Used as the guard roster reference image."
                    helperText="This image appears beside shift selfies for admin review."
                    onChange={(file) =>
                      setGuardForm((current) => ({
                        ...current,
                        identityPhoto: file
                      }))
                    }
                  />
                  <IdentityImagePicker
                    label="Enrollment selfie"
                    file={guardForm.identitySelfie}
                    emptyText="Best captured live during onboarding."
                    helperText="Use this as the closer comparison image for start/end shift proof."
                    capture
                    onChange={(file) =>
                      setGuardForm((current) => ({
                        ...current,
                        identitySelfie: file
                      }))
                    }
                  />
                </div>
              </div>

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
              placeholder="Search name, email, shift, duty site..."
              className="app-input w-full text-sm sm:w-64"
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {filteredGuards.length ? (
              visibleRosterGuards.map((guard) => {
                const mapLocation = guard.latestLocation || guard.mapLocation || null;
                const hasLiveLocation = Boolean(guard.latestLocation);
                const zoneLines = getLocationDisplayLines(mapLocation);
                const zoneTitle = zoneLines[0] || "No zone sync yet";
                const zoneDetail = zoneLines[1] || null;

                return (
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
                      <span>Assigned duty site</span>
                      <span className="text-right text-white">
                        {guard.dutySite?.name || "Unassigned"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Duty state</span>
                      <span className="text-right text-white">{guard.shiftState}</span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Identity reference</span>
                      <span className="text-right text-white">
                        {guard.identityPhotoPath || guard.identitySelfiePath ? "Enrolled" : "Not enrolled"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Latest map zone</span>
                      <span className="text-right text-white">
                        {zoneLines[0] || "No map sync yet"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Latest duty label</span>
                      <span className="text-right text-white">
                        {mapLocation?.dutyLabel || guard.shiftLabel || "No duty label"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span>Exact sync point</span>
                      <span className="text-right text-white">
                        {formatCoordinates(mapLocation)}
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
                        {hasLiveLocation ? `${guard.locationFreshnessMinutes ?? "N/A"} min` : "Awaiting live sync"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 p-3.5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Latest zone</p>
                    <p className="mt-2 text-sm text-white">
                      {zoneTitle}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                      Assigned duty site
                    </p>
                    <p className="mt-1 text-sm text-white">
                      {guard.dutySite?.name || "Unassigned"}
                      {guard.dutySite?.area ? ` • ${guard.dutySite.area}` : ""}
                    </p>
                    {zoneDetail ? (
                      <p className="mt-2 text-xs text-slate-400">{zoneDetail}</p>
                    ) : (
                      !mapLocation && (
                        <p className="mt-2 text-xs text-slate-400">
                          GPS live zone detail will appear here after sync.
                        </p>
                      )
                    )}
                    <p className="mt-2 text-sm text-slate-300">
                      {formatCoordinates(mapLocation)}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Duty label: {mapLocation?.dutyLabel || guard.shiftLabel || "No duty label"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {guard.latestLocation?.trackedAt
                        ? formatDateTime(guard.latestLocation.trackedAt)
                        : mapLocation
                          ? "Showing assigned duty site until first live sync"
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
                      onClick={() => setGuardPendingStatusChange(guard)}
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
                );
              })
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
                  label="Duty site"
                  as="select"
                  value={guardEditForm.dutySiteId}
                  onChange={(value) => setGuardEditForm((current) => ({ ...current, dutySiteId: value }))}
                  options={dutySiteOptions}
                />
                <FormField
                  label="Employee code"
                  value={guardEditForm.employeeCode}
                  onChange={(value) => setGuardEditForm((current) => ({ ...current, employeeCode: value }))}
                  placeholder="GRD-205"
                />

                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 sm:col-span-2">
                  <div className="flex items-start gap-3">
                    <div className="app-surface-soft rounded-2xl p-3">
                      <Camera className="h-5 w-5 text-jade-400" />
                    </div>
                    <div>
                      <p className="font-medium app-copy-primary">Identity reference images</p>
                      <p className="mt-1 text-sm app-copy-muted">
                        Replace these only when the guard needs re-enrollment. Existing reference
                        images remain active if no new files are selected.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <IdentityImagePicker
                      label="Replace registered photo"
                      file={guardEditForm.identityPhoto}
                      existingPath={guardPendingEdit.identityPhotoPath}
                      existingVersion={guardPendingEdit.identityEnrolledAt}
                      emptyText="No registered photo enrolled."
                      helperText="Selecting a new file replaces the current registered photo after save."
                      onChange={(file) =>
                        setGuardEditForm((current) => ({
                          ...current,
                          identityPhoto: file
                        }))
                      }
                    />
                    <IdentityImagePicker
                      label="Replace enrollment selfie"
                      file={guardEditForm.identitySelfie}
                      existingPath={guardPendingEdit.identitySelfiePath}
                      existingVersion={guardPendingEdit.identityEnrolledAt}
                      emptyText="No enrollment selfie enrolled."
                      helperText="Selecting a new file replaces the current enrollment selfie after save."
                      capture
                      onChange={(file) =>
                        setGuardEditForm((current) => ({
                          ...current,
                          identitySelfie: file
                        }))
                      }
                    />
                  </div>
                </div>

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

        {guardPendingStatusChange && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/52 px-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="glass-panel w-full max-w-xl rounded-[24px] border p-5 shadow-[0_28px_80px_rgba(2,6,23,0.45)] sm:rounded-[28px] sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    guardPendingStatusChange.status === "active"
                      ? "app-danger-icon-shell"
                      : "border border-jade-300/30 bg-jade-300/10 text-jade-200"
                  }`}
                >
                  {guardPendingStatusChange.status === "active" ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <ShieldCheck className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-2xl font-semibold app-copy-primary">
                    {guardPendingStatusChange.status === "active"
                      ? "Suspend guard access?"
                      : "Reactivate guard access?"}
                  </h3>
                  <p className="mt-2 text-sm app-copy-muted">
                    {guardPendingStatusChange.status === "active" ? (
                      <>
                        You are about to suspend{" "}
                        <span className="font-semibold app-copy-primary">
                          {guardPendingStatusChange.fullName}
                        </span>
                        . The guard will no longer be treated as an active field user until access is reactivated.
                      </>
                    ) : (
                      <>
                        You are about to reactivate{" "}
                        <span className="font-semibold app-copy-primary">
                          {guardPendingStatusChange.fullName}
                        </span>
                        . The guard will regain active roster access for this organization.
                      </>
                    )}
                  </p>
                  {guardPendingStatusChange.status === "active" && (
                    <p className="app-danger-copy mt-3 text-sm font-medium">
                      Confirm this only when the guard should be removed from active operations.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setGuardPendingStatusChange(null)}
                  disabled={busy}
                  className={`app-outline-button rounded-2xl px-4 py-3 text-sm font-medium ${
                    busy ? "app-button-disabled" : ""
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmGuardStatusChange}
                  disabled={busy}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                    guardPendingStatusChange.status === "active"
                      ? "app-danger-button"
                      : "app-primary-button"
                  } ${busy ? "app-button-disabled" : ""}`}
                >
                  {guardPendingStatusChange.status === "active" ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {busy
                    ? "Updating access..."
                    : guardPendingStatusChange.status === "active"
                      ? "Suspend guard access"
                      : "Reactivate guard access"}
                </button>
              </div>
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
