const virtualCameraTerms = [
  "vcam",
  "virtual",
  "obs",
  "snap camera",
  "manycam",
  "xsplit",
  "nvidia broadcast",
  "droidcam",
  "iriun",
  "camo"
];

const preferredCameraTerms = [
  "integrated",
  "built-in",
  "internal",
  "webcam",
  "hd camera",
  "hd webcam",
  "usb camera"
];

const deviceSelectionPrefix = "device:";

export const cameraSelectionModes = {
  default: "mode:default",
  front: "mode:front",
  rear: "mode:rear"
};

export function isLikelyMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  if (navigator.userAgentData?.mobile !== undefined) {
    return Boolean(navigator.userAgentData.mobile);
  }

  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || "");
}

export function getCameraLabel(device, index) {
  return device?.label || `Camera ${index + 1}`;
}

export function isVirtualCameraDevice(device) {
  const label = String(device?.label || "").toLowerCase();
  return virtualCameraTerms.some((term) => label.includes(term));
}

export function hasOnlyVirtualCameras(devices = []) {
  return devices.length > 0 && devices.every(isVirtualCameraDevice);
}

function getCameraRank(device) {
  const label = String(device?.label || "").toLowerCase();
  const virtualPenalty = isVirtualCameraDevice(device) ? 100 : 0;
  const preferredBonus = preferredCameraTerms.some((term) => label.includes(term)) ? -10 : 0;

  return virtualPenalty + preferredBonus;
}

export function sortCameraDevices(devices = []) {
  return [...devices].sort((left, right) => getCameraRank(left) - getCameraRank(right));
}

export function createDeviceCameraSelection(deviceId) {
  return deviceId ? `${deviceSelectionPrefix}${deviceId}` : cameraSelectionModes.default;
}

export function isDeviceCameraSelection(selection) {
  return String(selection || "").startsWith(deviceSelectionPrefix);
}

export function getDeviceIdFromCameraSelection(selection) {
  return isDeviceCameraSelection(selection)
    ? String(selection).slice(deviceSelectionPrefix.length)
    : "";
}

export function getDefaultCameraSelection(devices = []) {
  if (isLikelyMobileDevice()) {
    return cameraSelectionModes.front;
  }

  const preferredDevice = sortCameraDevices(devices).find((device) => !isVirtualCameraDevice(device));
  return preferredDevice?.deviceId
    ? createDeviceCameraSelection(preferredDevice.deviceId)
    : cameraSelectionModes.default;
}

export function normalizeCameraSelection(selection, devices = []) {
  const normalizedSelection = String(selection || "");

  if (Object.values(cameraSelectionModes).includes(normalizedSelection)) {
    return normalizedSelection;
  }

  const selectedDeviceId = getDeviceIdFromCameraSelection(normalizedSelection);

  if (selectedDeviceId && devices.some((device) => device.deviceId === selectedDeviceId)) {
    return normalizedSelection;
  }

  return getDefaultCameraSelection(devices);
}

export function getCameraSelectionLabel(selection, devices = []) {
  const normalizedSelection = normalizeCameraSelection(selection, devices);

  if (normalizedSelection === cameraSelectionModes.front) {
    return isLikelyMobileDevice() ? "Front selfie camera" : "Front camera / webcam";
  }

  if (normalizedSelection === cameraSelectionModes.rear) {
    return "Back camera";
  }

  if (normalizedSelection === cameraSelectionModes.default) {
    return "Browser default camera";
  }

  const selectedDeviceId = getDeviceIdFromCameraSelection(normalizedSelection);
  const selectedDevice = devices.find((device) => device.deviceId === selectedDeviceId);

  if (!selectedDevice) {
    return "Selected camera";
  }

  const deviceIndex = devices.findIndex((device) => device.deviceId === selectedDeviceId);
  return getCameraLabel(selectedDevice, deviceIndex);
}

export function buildCameraConstraints(selection, devices = []) {
  const normalizedSelection = normalizeCameraSelection(selection, devices);
  const baseConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 }
  };

  if (normalizedSelection === cameraSelectionModes.front) {
    return {
      ...baseConstraints,
      facingMode: { ideal: "user" }
    };
  }

  if (normalizedSelection === cameraSelectionModes.rear) {
    return {
      ...baseConstraints,
      facingMode: { ideal: "environment" }
    };
  }

  const selectedDeviceId = getDeviceIdFromCameraSelection(normalizedSelection);

  if (selectedDeviceId) {
    return {
      ...baseConstraints,
      deviceId: { exact: selectedDeviceId }
    };
  }

  return baseConstraints;
}

export async function getVideoInputDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return sortCameraDevices(devices.filter((device) => device.kind === "videoinput"));
}
