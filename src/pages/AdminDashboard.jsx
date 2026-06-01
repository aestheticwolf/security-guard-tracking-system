import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Building2,
  Camera,
  LayoutDashboard,
  MapPinned,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X
} from "lucide-react";
import toast from "react-hot-toast";
import GuardDetailPanel from "../components/admin/GuardDetailPanel";
import DutySiteLocationPicker from "../components/admin/DutySiteLocationPicker";
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
  updateDutyZoneLabels,
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
  getLocationDisplayLines,
  initials
} from "../utils/format";
import { navigateAppSection } from "../utils/appNavigation";
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
import { isNativeApp } from "../utils/nativeApp";

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
  { id: "admin-map", label: "Live Map", icon: MapPinned },
  { id: "admin-guard-detail", label: "Guards", icon: ShieldCheck },
  { id: "admin-create-guard", label: "Add & Sites", icon: UserPlus }
];

const defaultQuickDutyZoneLabels = ["Gate", "Lobby", "Warehouse", "Perimeter", "Ring"];

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

function normalizeDutyZoneLabels(labels = []) {
  const seen = new Set();

  return (Array.isArray(labels) ? labels : [])
    .map((entry) => String(entry ?? "").trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .filter((label) => {
      const key = label.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 30);
}

function getDutyZoneLabelKey(label) {
  return String(label ?? "").trim().toLowerCase();
}

function buildQuickDutyZoneLabels(labels = []) {
  return normalizeDutyZoneLabels([...labels, ...defaultQuickDutyZoneLabels]);
}

function buildDutyZoneOptions(labels = [], fallback = "") {
  const options = normalizeDutyZoneLabels(labels);
  const fallbackText = String(fallback || "").trim().replace(/\s+/g, " ");

  if (
    fallbackText &&
    !options.some((label) => label.toLowerCase() === fallbackText.toLowerCase())
  ) {
    options.unshift(fallbackText);
  }

  return options.map((label) => ({ value: label, label }));
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

function getGuardProfileImageUrl(guard) {
  const profilePath = guard?.identityPhotoPath || guard?.avatarUrl || guard?.identitySelfiePath;

  return buildVersionedAssetUrl(profilePath, guard?.identityEnrolledAt || guard?.updatedAt || profilePath);
}

function GuardAvatar({ guard, className = "h-12 w-12 rounded-2xl" }) {
  const avatarUrl = getGuardProfileImageUrl(guard);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-gold-400 to-jade-400 font-semibold text-slate-950 ${className}`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${guard?.fullName || "Guard"} profile`}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(guard?.fullName)
      )}
    </div>
  );
}

function getGuardLocationSummary(guard) {
  const mapLocation = guard?.latestLocation || guard?.mapLocation || null;
  const zoneLines = getLocationDisplayLines(mapLocation);

  return {
    mapLocation,
    zoneTitle: zoneLines[0] || "No live location yet",
    zoneDetail: zoneLines[1] || "",
    coordinates: formatCoordinates(mapLocation),
    freshness: guard?.latestLocation
      ? `${guard.locationFreshnessMinutes ?? "N/A"} min ago`
      : guard?.mapLocation
        ? "Assigned site"
        : "Awaiting sync"
  };
}

function GuardQuickSelectCard({ guard, selected, onSelectGuard, onOpenDetails, onEditGuard, busy }) {
  const locationSummary = getGuardLocationSummary(guard);

  return (
    <article
      className={`rounded-[22px] border p-3.5 transition ${
        selected
          ? "border-jade-300/45 bg-jade-300/10 shadow-[0_18px_48px_rgba(45,212,191,0.14)]"
          : "border-white/10 bg-white/5"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelectGuard(guard)}
        className="flex w-full items-start gap-3 text-left"
      >
        <GuardAvatar guard={guard} className="h-14 w-14 rounded-[20px] text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold app-copy-primary">{guard.fullName}</p>
              <p className="mt-0.5 truncate text-xs app-copy-muted">
                {guard.employeeCode || "No employee code"}
              </p>
            </div>
            <StatusBadge status={guard.shiftState} />
          </div>
          <p className="mt-2 truncate text-sm app-copy-primary">
            {guard.dutySite?.name || guard.shiftLabel || "Unassigned duty"}
          </p>
          <p className="mt-1 line-clamp-2 text-xs app-copy-muted">
            {locationSummary.zoneTitle}
          </p>
        </div>
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="uppercase tracking-[0.18em] app-copy-soft">Location</p>
          <p className="mt-1 font-medium app-copy-primary">{locationSummary.freshness}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="uppercase tracking-[0.18em] app-copy-soft">Identity</p>
          <p className="mt-1 font-medium app-copy-primary">
            {guard.identityPhotoPath || guard.identitySelfiePath ? "Enrolled" : "Missing"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onOpenDetails(guard)}
          className="app-primary-button flex-1 rounded-2xl px-3 py-2 text-xs font-semibold"
        >
          View details
        </button>
        <button
          type="button"
          onClick={() => onEditGuard(guard)}
          disabled={busy}
          className={`app-outline-button rounded-2xl px-3 py-2 text-xs font-medium ${
            busy ? "app-button-disabled" : ""
          }`}
        >
          Edit
        </button>
      </div>
    </article>
  );
}

function GuardLookupPanel({
  guards,
  selectedGuard,
  search,
  onSearchChange,
  onSelectGuard,
  onOpenDetails,
  onEditGuard,
  busy
}) {
  const visibleGuards = guards.slice(0, 4);

  return (
    <div className="mb-5 space-y-4">
      <div className="rounded-[22px] border border-white/10 bg-white/5 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search guard name, employee code, duty site, or location..."
            className="app-input min-h-[3rem] flex-1 text-sm"
          />
          <div className="grid grid-cols-3 gap-2 text-center text-xs lg:w-[24rem]">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="uppercase tracking-[0.16em] app-copy-soft">Results</p>
              <p className="mt-1 text-lg font-semibold app-copy-primary">{guards.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="uppercase tracking-[0.16em] app-copy-soft">On duty</p>
              <p className="mt-1 text-lg font-semibold app-copy-primary">
                {guards.filter((guard) => guard.shiftState === "On Duty").length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="uppercase tracking-[0.16em] app-copy-soft">Tracked</p>
              <p className="mt-1 text-lg font-semibold app-copy-primary">
                {guards.filter((guard) => guard.latestLocation || guard.mapLocation).length}
              </p>
            </div>
          </div>
        </div>
        {selectedGuard && (
          <div className="mt-3 flex flex-col gap-3 rounded-[20px] border border-jade-300/20 bg-jade-300/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <GuardAvatar guard={selectedGuard} className="h-12 w-12 rounded-2xl text-sm" />
              <div className="min-w-0">
                <p className="truncate font-semibold app-copy-primary">{selectedGuard.fullName}</p>
                <p className="truncate text-sm app-copy-muted">
                  {selectedGuard.dutySite?.name || selectedGuard.shiftLabel || "Unassigned duty"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selectedGuard.status} />
              <StatusBadge status={selectedGuard.shiftState} />
            </div>
          </div>
        )}
      </div>

      {visibleGuards.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {visibleGuards.map((guard) => (
            <GuardQuickSelectCard
              key={guard.id}
              guard={guard}
              selected={guard.id === selectedGuard?.id}
              onSelectGuard={onSelectGuard}
              onOpenDetails={onOpenDetails}
              onEditGuard={onEditGuard}
              busy={busy}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[22px] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm app-copy-muted">
          No guard matches this search. Try name, employee code, duty site, or area.
        </div>
      )}
    </div>
  );
}

function AdminActionHub({ selectedGuard, metrics }) {
  const locationSummary = selectedGuard ? getGuardLocationSummary(selectedGuard) : null;

  return (
    <div className="mb-4 rounded-[24px] border border-white/10 bg-gradient-to-br from-jade-400/12 to-gold-400/10 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {selectedGuard ? (
            <GuardAvatar guard={selectedGuard} className="h-16 w-16 rounded-[24px] text-sm" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] border border-white/10 bg-white/10">
              <ShieldCheck className="h-6 w-6 app-copy-muted" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.24em] app-copy-soft">Command focus</p>
            <h3 className="mt-1 truncate font-display text-2xl font-semibold app-copy-primary">
              {selectedGuard?.fullName || "Find a guard quickly"}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm app-copy-muted">
              {selectedGuard
                ? `${selectedGuard.dutySite?.name || selectedGuard.shiftLabel || "Unassigned duty"} • ${locationSummary?.freshness || "Awaiting sync"}`
                : `${metrics?.totalGuards ?? 0} guards registered • ${metrics?.onDuty ?? 0} currently on duty`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[34rem]">
          <button
            type="button"
            onClick={() => navigateAppSection("admin-guard-detail")}
            className="app-primary-button rounded-2xl px-3 py-3 text-xs font-semibold"
          >
            Find Guards
          </button>
          <button
            type="button"
            onClick={() => navigateAppSection("admin-map")}
            className="app-outline-button rounded-2xl px-3 py-3 text-xs font-semibold"
          >
            Live Map
          </button>
          <button
            type="button"
            onClick={() => navigateAppSection("admin-create-guard")}
            className="app-outline-button rounded-2xl px-3 py-3 text-xs font-semibold"
          >
            Add Guard
          </button>
          <button
            type="button"
            onClick={() => navigateAppSection("admin-duty-site-management")}
            className="app-outline-button rounded-2xl px-3 py-3 text-xs font-semibold"
          >
            Sites
          </button>
        </div>
      </div>
    </div>
  );
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
  const nativeApp = isNativeApp();
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
  const [guardDetailModal, setGuardDetailModal] = useState(null);
  const [guardPendingEdit, setGuardPendingEdit] = useState(null);
  const [guardPendingDelete, setGuardPendingDelete] = useState(null);
  const [guardPendingStatusChange, setGuardPendingStatusChange] = useState(null);
  const [guardForm, setGuardForm] = useState(emptyGuardForm);
  const [guardEditForm, setGuardEditForm] = useState(emptyGuardForm);
  const [dutySiteForm, setDutySiteForm] = useState(emptyDutySiteForm);
  const [dutySitePendingEdit, setDutySitePendingEdit] = useState(null);
  const [dutySiteEditForm, setDutySiteEditForm] = useState(emptyDutySiteForm);
  const [dutyLabelDraft, setDutyLabelDraft] = useState([]);
  const [dutyLabelInput, setDutyLabelInput] = useState("");
  const [selectedDutyLabelForEdit, setSelectedDutyLabelForEdit] = useState("");
  const [dutyLabelAutoSaving, setDutyLabelAutoSaving] = useState(false);
  const [dutyLabelPendingSave, setDutyLabelPendingSave] = useState(null);
  const [dutyLabelPendingDelete, setDutyLabelPendingDelete] = useState(null);
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

  function buildDutyLabelSaveRequest(label, { mode = "auto" } = {}) {
    const nextLabel = String(label || "").trim().replace(/\s+/g, " ");

    if (!nextLabel) {
      return null;
    }

    const currentLabels = normalizeDutyZoneLabels(dutyLabelDraft);
    const selectedKey = mode === "add" ? "" : getDutyZoneLabelKey(selectedDutyLabelForEdit);
    const nextKey = getDutyZoneLabelKey(nextLabel);
    const editingIndex = selectedKey
      ? currentLabels.findIndex((label) => getDutyZoneLabelKey(label) === selectedKey)
      : -1;
    const duplicateIndex = currentLabels.findIndex(
      (label) => getDutyZoneLabelKey(label) === nextKey
    );
    let nextLabels = currentLabels;

    if (duplicateIndex !== -1 && duplicateIndex !== editingIndex) {
      const existingLabel = currentLabels[duplicateIndex];
      setSelectedDutyLabelForEdit(existingLabel);
      setDutyLabelInput(existingLabel);
      toast.error(`${existingLabel} is already available.`);
      return null;
    }

    let action = "add";
    let previousLabel = "";

    if (editingIndex !== -1) {
      nextLabels = [...currentLabels];
      previousLabel = currentLabels[editingIndex];
      nextLabels[editingIndex] = nextLabel;
      action = "update";
    } else {
      if (currentLabels.length >= 30) {
        const nextError = "Up to 30 duty zone labels can be saved.";
        setError(nextError);
        toast.error(nextError);
        return null;
      }

      nextLabels = [...currentLabels, nextLabel];
    }

    const normalizedLabels = normalizeDutyZoneLabels(nextLabels);

    return {
      action,
      label: nextLabel,
      previousLabel,
      nextLabels: normalizedLabels
    };
  }

  function handleAddDutyLabel() {
    const pendingChange = buildDutyLabelSaveRequest(dutyLabelInput);

    if (pendingChange) {
      setDutyLabelPendingSave(pendingChange);
    }
  }

  async function persistDutyLabels(labels, { successMessage = "", auto = false } = {}) {
    const normalizedLabels = normalizeDutyZoneLabels(labels);

    if (!normalizedLabels.length) {
      const nextError = "At least one duty zone label is required.";
      setError(nextError);
      toast.error(nextError);
      return null;
    }

    if (auto) {
      setDutyLabelAutoSaving(true);
    } else {
      setBusy(true);
    }
    setError("");

    try {
      const response = await updateDutyZoneLabels({ labels: normalizedLabels });
      const savedLabels = response.overview?.organization?.dutyLabels || normalizedLabels;
      startTransition(() => setOverview(response.overview));
      setDutyLabelDraft(savedLabels);

      if (successMessage) {
        setMessage(successMessage);
        toast.success(successMessage);
      }

      return savedLabels;
    } catch (submitError) {
      const nextError = getDashboardErrorMessage(submitError);
      setError(nextError);
      toast.error(nextError);
      return null;
    } finally {
      if (auto) {
        setDutyLabelAutoSaving(false);
      } else {
        setBusy(false);
      }
    }
  }

  function handleQuickDutyLabel(label) {
    const nextLabel = String(label || "").trim().replace(/\s+/g, " ");

    if (!nextLabel) {
      return;
    }

    const existingLabel = dutyLabelDraft.find(
      (entry) => getDutyZoneLabelKey(entry) === getDutyZoneLabelKey(nextLabel)
    );
    const selectedLabel = existingLabel || nextLabel;

    setSelectedDutyLabelForEdit(selectedLabel);
    setDutyLabelInput(selectedLabel);

    if (existingLabel) {
      return;
    }

    const pendingChange = buildDutyLabelSaveRequest(nextLabel, { mode: "add" });

    if (pendingChange) {
      setDutyLabelPendingSave(pendingChange);
    }
  }

  async function handleConfirmDutyLabelSave() {
    if (!dutyLabelPendingSave) {
      return;
    }

    const successMessage =
      dutyLabelPendingSave.action === "update"
        ? `${dutyLabelPendingSave.previousLabel} was updated to ${dutyLabelPendingSave.label}.`
        : `${dutyLabelPendingSave.label} was added to guard shift zones.`;

    const savedLabels = await persistDutyLabels(dutyLabelPendingSave.nextLabels, {
      successMessage
    });

    if (savedLabels) {
      if (dutyLabelPendingSave.action === "update") {
        const savedLabel =
          savedLabels.find(
            (entry) =>
              getDutyZoneLabelKey(entry) === getDutyZoneLabelKey(dutyLabelPendingSave.label)
          ) || dutyLabelPendingSave.label;
        setSelectedDutyLabelForEdit(savedLabel);
        setDutyLabelInput(savedLabel);
      } else {
        setSelectedDutyLabelForEdit("");
        setDutyLabelInput("");
      }

      setDutyLabelPendingSave(null);
    }
  }

  function handleRequestDeleteDutyLabel(label) {
    const currentLabels = normalizeDutyZoneLabels(dutyLabelDraft);
    const labelKey = getDutyZoneLabelKey(label);
    const existingLabel = currentLabels.find(
      (entry) => getDutyZoneLabelKey(entry) === labelKey
    );

    if (!existingLabel) {
      return;
    }

    if (currentLabels.length <= 1) {
      const nextError = "At least one duty zone label is required.";
      setError(nextError);
      toast.error(nextError);
      return;
    }

    const assignedGuardCount = (overview?.guards || []).filter(
      (guard) => getDutyZoneLabelKey(guard.shiftLabel) === labelKey
    ).length;
    const nextLabels = currentLabels.filter(
      (entry) => getDutyZoneLabelKey(entry) !== labelKey
    );

    setDutyLabelPendingDelete({
      label: existingLabel,
      nextLabels,
      assignedGuardCount
    });
  }

  async function handleConfirmDutyLabelDelete() {
    if (!dutyLabelPendingDelete) {
      return;
    }

    const savedLabels = await persistDutyLabels(dutyLabelPendingDelete.nextLabels, {
      successMessage: `${dutyLabelPendingDelete.label} was removed from guard shift zones.`
    });

    if (savedLabels) {
      if (
        getDutyZoneLabelKey(selectedDutyLabelForEdit) ===
        getDutyZoneLabelKey(dutyLabelPendingDelete.label)
      ) {
        setSelectedDutyLabelForEdit("");
        setDutyLabelInput("");
      }

      setDutyLabelPendingDelete(null);
    }
  }

  async function handleSaveDutyLabels() {
    const pendingLabel = dutyLabelInput.trim().replace(/\s+/g, " ");
    let labels = normalizeDutyZoneLabels(dutyLabelDraft);

    if (pendingLabel) {
      const pendingChange = buildDutyLabelSaveRequest(pendingLabel);

      if (pendingChange) {
        setDutyLabelPendingSave(pendingChange);
      }

      return;
    }

    if (!labels.length) {
      const nextError = "At least one duty zone label is required.";
      setError(nextError);
      toast.error(nextError);
      return;
    }

    await persistDutyLabels(labels, {
      successMessage: "Duty zone labels updated for this organization."
    });
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
  const organization = overview?.organization || null;
  const dutyZoneLabels = normalizeDutyZoneLabels(organization?.dutyLabels);
  const dutyZoneLabelKey = dutyZoneLabels.join("|");
  const dutySiteOptions = buildDutySiteOptions(dutySites);
  const dutyZoneOptions = buildDutyZoneOptions(dutyZoneLabels, guardForm.shiftLabel);
  const editDutyZoneOptions = buildDutyZoneOptions(dutyZoneLabels, guardEditForm.shiftLabel);
  const quickDutyZoneOptions = buildQuickDutyZoneLabels(
    dutyLabelDraft.length ? dutyLabelDraft : dutyZoneLabels
  );
  const selectedDutyLabelKey = getDutyZoneLabelKey(selectedDutyLabelForEdit);
  const selectedDutyLabelExists = dutyLabelDraft.some(
    (label) => getDutyZoneLabelKey(label) === selectedDutyLabelKey
  );
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

  const detailModalGuard =
    guardDetailModal
      ? filteredGuards.find((guard) => guard.id === guardDetailModal.id) || guardDetailModal
      : null;

  const liveFeedItems = overview?.liveFeed || [];
  const hasMoreLiveFeed = liveFeedItems.length > initialLiveFeedVisibleCount;
  const hiddenLiveFeedCount = Math.max(
    liveFeedItems.length - initialLiveFeedVisibleCount,
    0
  );
  const visibleLiveFeed = showAllLiveFeed
    ? liveFeedItems
    : liveFeedItems.slice(0, initialLiveFeedVisibleCount);
  const activeVisibleLiveFeed = nativeApp
    ? liveFeedItems.slice(0, 3)
    : visibleLiveFeed;
  const hasMoreRoster = filteredGuards.length > initialRosterVisibleCount;
  const hiddenRosterCount = Math.max(filteredGuards.length - initialRosterVisibleCount, 0);
  const visibleRosterGuards = showAllRoster
    ? filteredGuards
    : filteredGuards.slice(0, initialRosterVisibleCount);
  const adminShellTitle = nativeApp ? "Admin Field Console" : "Admin Mission Control";
  const adminShellSubtitle = nativeApp
    ? "Guards, map, selfies, and sites."
    : "Live guards, sites, and attendance.";

  useEffect(() => {
    setDutyLabelDraft(dutyZoneLabels);
    setSelectedDutyLabelForEdit((current) =>
      current &&
      dutyZoneLabels.some((label) => getDutyZoneLabelKey(label) === getDutyZoneLabelKey(current))
        ? current
        : ""
    );
  }, [dutyZoneLabelKey]);

  useEffect(() => {
    if (!dutyZoneLabels.length) {
      return;
    }

    setGuardForm((current) =>
      current.shiftLabel
        ? current
        : {
            ...current,
            shiftLabel: dutyZoneLabels[0]
          }
    );
  }, [dutyZoneLabelKey]);

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
        title={adminShellTitle}
        subtitle={adminShellSubtitle}
        workspace={overview?.organization}
      >
        <DashboardSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={adminShellTitle}
      subtitle={adminShellSubtitle}
      mobileQuickLinks={adminSectionLinks}
      sectionLinks={adminSectionLinks}
      workspace={overview?.organization}
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
          subtitle="Key command numbers."
        >
          <AdminActionHub selectedGuard={selectedGuard} metrics={overview?.metrics} />
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

        {!nativeApp && (
          <MobileCollapseSection
            id="admin-duty-sites"
            title="Duty Site Coverage"
            subtitle="Site coverage and tracked guards."
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
        )}

        <div className="grid gap-5">
          <Panel
            id="admin-map"
            title="Operations Live Map"
            subtitle="Latest saved guard positions."
            collapsibleOnMobile
            defaultCollapsed={!nativeApp}
          >
            <GuardPositionMap
              guards={filteredGuards}
              selectedGuardId={selectedGuard?.id}
              onSelectGuard={setSelectedGuardId}
              onRefreshLocations={refreshOverview}
            />
          </Panel>

          <Panel
            id="admin-guard-detail"
            title="Guard Lookup"
            subtitle="Find guards and view details."
            collapsibleOnMobile
            defaultCollapsed={!nativeApp}
          >
            <GuardLookupPanel
              guards={filteredGuards}
              selectedGuard={selectedGuard}
              search={search}
              onSearchChange={setSearch}
              onSelectGuard={(guard) => setSelectedGuardId(guard.id)}
              onOpenDetails={(guard) => {
                setSelectedGuardId(guard.id);
                setGuardDetailModal(guard);
              }}
              onEditGuard={openEditGuard}
              busy={busy}
            />
            <GuardDetailPanel guard={selectedGuard} compact />
          </Panel>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel
            id="admin-feed"
            title={nativeApp ? "Recent Activity" : "Live Operations Feed"}
            subtitle={
              nativeApp
                ? "Latest field updates."
                : "Attendance, activity, and location updates."
            }
            collapsibleOnMobile
          >
            <div className="space-y-4">
              {liveFeedItems.length ? (
                activeVisibleLiveFeed.map((event) => (
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

              {!nativeApp && hasMoreLiveFeed && (
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
            subtitle="Sites, zones, and guard posts."
            className="self-start"
            collapsibleOnMobile
            defaultCollapsed={!nativeApp}
          >
            <div className="mb-5 rounded-[22px] border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] app-copy-soft">
                    Duty zone labels
                  </p>
                  <h3 className="mt-1 font-display text-xl font-semibold app-copy-primary">
                    Guard selectable duty zones
                  </h3>
                  <p className="mt-1 text-sm leading-5 app-copy-muted">
                    Used in guard shift forms.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.24em] app-copy-soft">
                  Quick select
                </p>
                <p className="mt-1 text-xs app-copy-muted">
                  Pick a saved zone or preset. Remove saved labels with the delete icon.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {quickDutyZoneOptions.map((label) => {
                    const isAdded = dutyLabelDraft.some(
                      (entry) => getDutyZoneLabelKey(entry) === getDutyZoneLabelKey(label)
                    );
                    const isSelected = getDutyZoneLabelKey(label) === selectedDutyLabelKey;
                    const chipClass = isSelected
                      ? "border-jade-400 bg-jade-300 text-slate-950 shadow-lg shadow-jade-500/20 ring-2 ring-jade-300/40"
                      : isAdded
                        ? "border-emerald-300 bg-emerald-100 text-emerald-950 shadow-sm"
                        : "border-slate-300 bg-white text-slate-950 shadow-sm hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50";

                    return (
                      <div
                        key={label}
                        className={`inline-flex min-w-0 items-center overflow-hidden rounded-2xl border text-xs font-semibold transition ${chipClass} ${
                          dutyLabelAutoSaving ? "opacity-70" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleQuickDutyLabel(label)}
                          disabled={dutyLabelAutoSaving}
                          className="min-w-0 flex-1 truncate px-3 py-2 transition disabled:cursor-not-allowed"
                          aria-pressed={isSelected}
                        >
                          {label}
                        </button>
                        {isAdded && (
                          <button
                            type="button"
                            onClick={() => handleRequestDeleteDutyLabel(label)}
                            disabled={dutyLabelAutoSaving || busy}
                            className="flex h-full items-center justify-center border-l border-current/15 px-2.5 py-2 transition hover:bg-red-100/70 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Delete ${label} duty zone label`}
                            title={`Delete ${label}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <input
                  value={dutyLabelInput}
                  onChange={(event) => setDutyLabelInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddDutyLabel();
                    }
                  }}
                  className="app-input"
                  placeholder="Add zone label, e.g. Gate A"
                />
                <button
                  type="button"
                  onClick={handleAddDutyLabel}
                  className="app-outline-button rounded-2xl px-4 py-3 text-sm font-medium"
                >
                  {selectedDutyLabelExists ? "Update label" : "Add label"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveDutyLabels}
                  disabled={busy}
                  className="app-primary-button rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Save labels
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateDutySite} className="grid gap-4 sm:grid-cols-2">
              <DutySiteLocationPicker
                value={dutySiteForm}
                onChange={(nextValue) =>
                  setDutySiteForm((current) => ({
                    ...current,
                    ...nextValue
                  }))
                }
              />
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
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 sm:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] app-copy-soft">
                      Manual coordinates
                    </p>
                    <p className="mt-1 text-sm app-copy-muted">
                      Optional fallback if search or map selection is unavailable.
                    </p>
                  </div>
                  <StatusBadge status="secondary" />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="app-primary-button rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:col-span-2"
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
                        <DutySiteLocationPicker
                          value={dutySiteEditForm}
                          onChange={(nextValue) =>
                            setDutySiteEditForm((current) => ({
                              ...current,
                              ...nextValue
                            }))
                          }
                        />
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
                        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 sm:col-span-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.24em] app-copy-soft">
                                Manual coordinates
                              </p>
                              <p className="mt-1 text-sm app-copy-muted">
                                Optional fallback if search or map selection is unavailable.
                              </p>
                            </div>
                            <StatusBadge status="secondary" />
                          </div>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                          </div>
                        </div>
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
            subtitle="Add guard access and assignment."
            className="self-start"
            collapsibleOnMobile
            defaultCollapsed={!nativeApp}
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
                label="Duty zone label"
                as="select"
                value={guardForm.shiftLabel}
                onChange={(value) => setGuardForm((current) => ({ ...current, shiftLabel: value }))}
                options={
                  dutyZoneOptions.length
                    ? dutyZoneOptions
                    : [{ value: "", label: "Add duty labels first" }]
                }
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
          title="Guard Directory"
          subtitle="Roster, access, and location."
          className="mx-auto w-full xl:max-w-[72rem]"
          collapsibleOnMobile
          defaultCollapsed={!nativeApp}
          action={
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, shift, duty site..."
              className="app-input w-full text-sm sm:w-64"
            />
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                    className="rounded-[22px] border border-white/10 bg-white/5 p-3.5 sm:p-4"
                  >
                  <div className="flex items-start gap-3">
                    <GuardAvatar guard={guard} className="h-14 w-14 rounded-[20px] text-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-display text-xl font-semibold app-copy-primary">
                            {guard.fullName}
                          </p>
                          <p className="mt-1 truncate text-sm app-copy-muted">{guard.email}</p>
                        </div>
                        <StatusBadge status={guard.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge status={guard.shiftState} />
                        <StatusBadge
                          status={guard.identityPhotoPath || guard.identitySelfiePath ? "Photo enrolled" : "No photo"}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                      <p className="text-xs uppercase tracking-[0.18em] app-copy-soft">Duty site</p>
                      <p className="mt-1 truncate font-medium app-copy-primary">
                        {guard.dutySite?.name || guard.shiftLabel || "Unassigned"}
                      </p>
                      {guard.dutySite?.area && (
                        <p className="mt-0.5 truncate text-xs app-copy-muted">{guard.dutySite.area}</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                      <p className="text-xs uppercase tracking-[0.18em] app-copy-soft">Last sync</p>
                      <p className="mt-1 font-medium app-copy-primary">
                        {hasLiveLocation ? `${guard.locationFreshnessMinutes ?? "N/A"} min ago` : "Awaiting GPS"}
                      </p>
                      <p className="mt-0.5 truncate text-xs app-copy-muted">
                        {guard.latestActivity ? formatRelative(guard.latestActivity.createdAt) : "No activity"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.24em] app-copy-soft">Latest position</p>
                        <p className="mt-2 truncate text-sm font-medium app-copy-primary">{zoneTitle}</p>
                        {zoneDetail && <p className="mt-1 line-clamp-2 text-xs app-copy-muted">{zoneDetail}</p>}
                      </div>
                      <MapPinned className="h-4 w-4 shrink-0 text-jade-400" />
                    </div>
                    <p className="mt-3 truncate text-sm app-copy-muted">{formatCoordinates(mapLocation)}</p>
                    <p className="mt-1 truncate text-xs app-copy-soft">
                      {guard.latestLocation?.trackedAt
                        ? formatDateTime(guard.latestLocation.trackedAt)
                        : mapLocation
                          ? "Assigned duty site fallback"
                          : "Awaiting first location sync"}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGuardId(guard.id);
                        document.getElementById("admin-guard-detail")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start"
                        });
                      }}
                      className="app-primary-button rounded-2xl px-3 py-2.5 text-sm font-semibold"
                    >
                      Details
                    </button>
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
                  </div>
                  <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
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

        {!nativeApp && (
          <Panel
            title="Today’s Attendance Snapshot"
            subtitle="Today check-ins."
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
        )}

        <AnimatePresence>
          {detailModalGuard && (
            <motion.div
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGuardDetailModal(null)}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="guard-detail-modal-title"
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="glass-panel max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-[30px] border p-4 shadow-[0_28px_90px_rgba(2,6,23,0.45)] sm:rounded-[30px] sm:p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <GuardAvatar guard={detailModalGuard} className="h-14 w-14 rounded-[20px] text-sm" />
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.22em] app-copy-soft">Guard profile</p>
                      <h3
                        id="guard-detail-modal-title"
                        className="truncate font-display text-2xl font-semibold app-copy-primary"
                      >
                        {detailModalGuard.fullName}
                      </h3>
                      <p className="truncate text-sm app-copy-muted">
                        {detailModalGuard.email || detailModalGuard.employeeCode || "Field guard"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={detailModalGuard.status} />
                    <StatusBadge status={detailModalGuard.shiftState} />
                    <button
                      type="button"
                      onClick={() => {
                        setGuardDetailModal(null);
                        openEditGuard(detailModalGuard);
                      }}
                      disabled={busy}
                      className={`app-outline-button rounded-2xl px-3 py-2 text-xs font-semibold ${
                        busy ? "app-button-disabled" : ""
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuardDetailModal(null)}
                      className="app-outline-button flex h-10 w-10 items-center justify-center rounded-2xl"
                      aria-label="Close guard details"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <GuardDetailPanel guard={detailModalGuard} />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {dutyLabelPendingSave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/52 px-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="glass-panel w-full max-w-xl rounded-[24px] border p-5 shadow-[0_28px_80px_rgba(2,6,23,0.45)] sm:rounded-[28px] sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-jade-300/30 bg-jade-300/10 text-jade-200">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-2xl font-semibold app-copy-primary">
                    {dutyLabelPendingSave.action === "update"
                      ? "Update duty zone label?"
                      : "Add duty zone label?"}
                  </h3>
                  <p className="mt-2 text-sm app-copy-muted">
                    {dutyLabelPendingSave.action === "update" ? (
                      <>
                        This will rename{" "}
                        <span className="font-semibold app-copy-primary">
                          {dutyLabelPendingSave.previousLabel}
                        </span>{" "}
                        to{" "}
                        <span className="font-semibold app-copy-primary">
                          {dutyLabelPendingSave.label}
                        </span>{" "}
                        for future guard shift selections.
                      </>
                    ) : (
                      <>
                        This will add{" "}
                        <span className="font-semibold app-copy-primary">
                          {dutyLabelPendingSave.label}
                        </span>{" "}
                        as a selectable duty zone for guard shift forms.
                      </>
                    )}
                  </p>
                  <p className="mt-3 rounded-2xl border border-jade-300/25 bg-jade-300/10 px-3 py-2 text-sm font-medium app-copy-primary">
                    Existing attendance records will remain unchanged.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDutyLabelPendingSave(null)}
                  disabled={busy}
                  className={`app-outline-button rounded-2xl px-4 py-3 text-sm font-medium ${
                    busy ? "app-button-disabled" : ""
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDutyLabelSave}
                  disabled={busy}
                  className={`app-primary-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                    busy ? "app-button-disabled" : ""
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {busy
                    ? "Saving label..."
                    : dutyLabelPendingSave.action === "update"
                      ? "Update label"
                      : "Add label"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {dutyLabelPendingDelete && (
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
                    Delete duty zone label?
                  </h3>
                  <p className="mt-2 text-sm app-copy-muted">
                    You are about to remove{" "}
                    <span className="font-semibold app-copy-primary">
                      {dutyLabelPendingDelete.label}
                    </span>{" "}
                    from the guard-selectable duty zone list.
                  </p>
                  {dutyLabelPendingDelete.assignedGuardCount > 0 && (
                    <p className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-medium app-copy-primary">
                      {dutyLabelPendingDelete.assignedGuardCount} guard
                      {dutyLabelPendingDelete.assignedGuardCount === 1 ? "" : "s"} currently use
                      this label. Their saved assignments and old attendance records will not be
                      deleted.
                    </p>
                  )}
                  <p className="app-danger-copy mt-3 text-sm font-medium">
                    Guards will not be able to choose this label for new shifts after removal.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDutyLabelPendingDelete(null)}
                  disabled={busy}
                  className={`app-outline-button rounded-2xl px-4 py-3 text-sm font-medium ${
                    busy ? "app-button-disabled" : ""
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDutyLabelDelete}
                  disabled={busy}
                  className={`app-danger-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                    busy ? "app-button-disabled" : ""
                  }`}
                >
                  <Trash2 className="h-4 w-4" />
                  {busy ? "Deleting label..." : "Delete label"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

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
                  label="Duty zone label"
                  as="select"
                  value={guardEditForm.shiftLabel}
                  onChange={(value) => setGuardEditForm((current) => ({ ...current, shiftLabel: value }))}
                  options={
                    editDutyZoneOptions.length
                      ? editDutyZoneOptions
                      : [{ value: "", label: "Add duty labels first" }]
                  }
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
