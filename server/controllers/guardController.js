import { createActivity, listActivitiesByUserId } from "../models/activityModel.js";
import {
  createAttendance,
  findOpenAttendanceByUserId,
  updateAttendanceOnCheckout
} from "../models/attendanceModel.js";
import { createLocation, findLatestLocationByUserId } from "../models/locationModel.js";
import { createSelfie } from "../models/selfieModel.js";
import { touchUser } from "../models/userModel.js";
import { reverseGeocodeLocation } from "../services/geocoding.js";
import { storeSelfieFile, verifySelfieCapture } from "../services/selfie.js";
import { buildGuardOverview } from "../services/guardDashboardService.js";
import {
  createHttpError,
  createId,
  now
} from "../services/coreService.js";

function cleanLocationText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function buildLocationResult({ address, zoneDetail, dutyLabel }) {
  const cleanAddress = cleanLocationText(address) || "Live field position";
  const cleanZoneDetail = cleanLocationText(zoneDetail);

  return {
    address: cleanAddress,
    zoneDetail:
      cleanZoneDetail && cleanZoneDetail.toLowerCase() !== cleanAddress.toLowerCase()
        ? cleanZoneDetail
        : null,
    dutyLabel: dutyLabel || null
  };
}

function normalizeBattery(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 100) {
    return null;
  }

  return Math.round(numericValue);
}

function isBlankCoordinate(value) {
  return value === undefined || value === null || value === "";
}

function parseLocationCoordinates(latitude, longitude, { required = false } = {}) {
  const latitudeBlank = isBlankCoordinate(latitude);
  const longitudeBlank = isBlankCoordinate(longitude);

  if (latitudeBlank && longitudeBlank && !required) {
    return null;
  }

  if (latitudeBlank || longitudeBlank) {
    throw createHttpError(400, "Latitude and longitude must be supplied together.");
  }

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    throw createHttpError(400, "Latitude and longitude must be valid numbers.");
  }

  if (parsedLatitude < -90 || parsedLatitude > 90) {
    throw createHttpError(400, "Latitude must be between -90 and 90.");
  }

  if (parsedLongitude < -180 || parsedLongitude > 180) {
    throw createHttpError(400, "Longitude must be between -180 and 180.");
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude
  };
}

async function buildResolvedLocation({
  latitude,
  longitude,
  manualDutyLabel,
  fallbackAddress
}) {
  if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
    return buildLocationResult({
      address: fallbackAddress || manualDutyLabel || "Live field position",
      zoneDetail: fallbackAddress || manualDutyLabel || "Live field position",
      dutyLabel: manualDutyLabel || null
    });
  }

  const resolvedZone = await reverseGeocodeLocation(latitude, longitude);

  return buildLocationResult({
    address:
      resolvedZone?.zoneName ||
      fallbackAddress ||
      manualDutyLabel ||
      "Live field position",
    zoneDetail:
      resolvedZone?.zoneDetail ||
      fallbackAddress ||
      manualDutyLabel ||
      "Live field position",
    dutyLabel: manualDutyLabel || null
  });
}

function appendShiftNote(description, note) {
  const cleanNote = note ? String(note).trim() : "";
  return cleanNote ? `${description} Shift note: ${cleanNote}` : description;
}

export async function getOverview(request, response) {
  return response.json(await buildGuardOverview(request.user.id));
}

export async function getActivities(request, response) {
  return response.json({
    activities: await listActivitiesByUserId(request.user.id)
  });
}

export async function checkIn(request, response) {
  if (!request.file) {
    throw createHttpError(400, "A selfie is required to start a shift.");
  }

  const openAttendance = await findOpenAttendanceByUserId(request.user.id);

  if (openAttendance) {
    throw createHttpError(409, "You are already checked in for an active shift.");
  }

  const { note, locationLabel, latitude, longitude, accuracy, battery, captureSource } = request.body ?? {};
  const parsedCoordinates = parseLocationCoordinates(latitude, longitude);
  const shiftNote = note ? String(note).trim() : "";
  const attendanceId = createId();
  const timestamp = now();
  const selfieCheck = await verifySelfieCapture(request.file, {
    captureSource,
    identityPhotoPath: request.user.identityPhotoPath,
    identitySelfiePath: request.user.identitySelfiePath
  });
  const selfiePath = await storeSelfieFile(request.file);

  await createAttendance({
    id: attendanceId,
    userId: request.user.id,
    checkInAt: timestamp,
    checkOutAt: null,
    status: "checked-in",
    selfiePath,
    locationLabel: locationLabel ? String(locationLabel).trim() : "Field checkpoint",
    latitude: parsedCoordinates?.latitude ?? null,
    longitude: parsedCoordinates?.longitude ?? null,
    accuracy: accuracy ? Number(accuracy) : null,
    note: shiftNote
  });

  await createSelfie({
    id: createId(),
    userId: request.user.id,
    attendanceId,
    imagePath: selfiePath,
    verified: selfieCheck.verified,
    verificationScore: selfieCheck.score,
    captureSource: selfieCheck.captureSource,
    identityStatus: selfieCheck.identityStatus,
    identityScore: selfieCheck.identityScore,
    identityNotes: selfieCheck.identityNotes,
    capturedAt: timestamp
  });

  await createActivity({
    id: createId(),
    userId: request.user.id,
    type: "attendance",
    title: "Shift check-in verified",
    description: appendShiftNote(
      "Guard started duty with a selfie capture and location stamp.",
      shiftNote
    ),
    priority: "medium",
    status: "logged",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  if (parsedCoordinates) {
    const resolvedLocation = await buildResolvedLocation({
      latitude: parsedCoordinates.latitude,
      longitude: parsedCoordinates.longitude,
      manualDutyLabel: locationLabel ? String(locationLabel).trim() : "",
      fallbackAddress: "Shift check-in"
    });

    await createLocation({
      id: createId(),
      userId: request.user.id,
      latitude: parsedCoordinates.latitude,
      longitude: parsedCoordinates.longitude,
      accuracy: accuracy ? Number(accuracy) : null,
      address: resolvedLocation.address,
      zoneDetail: resolvedLocation.zoneDetail,
      dutyLabel: resolvedLocation.dutyLabel,
      battery: normalizeBattery(battery),
      trackedAt: timestamp
    });
  }

  await touchUser(request.user.id, timestamp);
  return response.status(201).json(await buildGuardOverview(request.user.id));
}

export async function checkOut(request, response) {
  if (!request.file) {
    throw createHttpError(400, "A checkout selfie is required to end a shift.");
  }

  const openAttendance = await findOpenAttendanceByUserId(request.user.id);

  if (!openAttendance) {
    throw createHttpError(404, "No active shift was found for check-out.");
  }

  const timestamp = now();
  const {
    latitude,
    longitude,
    accuracy,
    address,
    dutyLabel,
    battery,
    captureSource
  } = request.body ?? {};
  const parsedCoordinates = parseLocationCoordinates(latitude, longitude);
  const selfieCheck = await verifySelfieCapture(request.file, {
    captureSource,
    identityPhotoPath: request.user.identityPhotoPath,
    identitySelfiePath: request.user.identitySelfiePath
  });
  const selfiePath = await storeSelfieFile(request.file);
  const nextNote = request.body?.note ? String(request.body.note).trim() : openAttendance.note;

  await createSelfie({
    id: createId(),
    userId: request.user.id,
    attendanceId: openAttendance.id,
    imagePath: selfiePath,
    verified: selfieCheck.verified,
    verificationScore: selfieCheck.score,
    captureSource: selfieCheck.captureSource,
    identityStatus: selfieCheck.identityStatus,
    identityScore: selfieCheck.identityScore,
    identityNotes: selfieCheck.identityNotes,
    capturedAt: timestamp
  });

  await updateAttendanceOnCheckout(openAttendance.id, {
    checkOutAt: timestamp,
    status: "completed",
    note: nextNote
  });

  await createActivity({
    id: createId(),
    userId: request.user.id,
    type: "attendance",
    title: "Shift check-out selfie verified",
    description: appendShiftNote(
      "Guard wrapped up the active patrol shift with a selfie confirmation and final location sync.",
      nextNote
    ),
    priority: "low",
    status: "logged",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  if (parsedCoordinates) {
    const resolvedLocation = await buildResolvedLocation({
      latitude: parsedCoordinates.latitude,
      longitude: parsedCoordinates.longitude,
      manualDutyLabel: dutyLabel ? String(dutyLabel).trim() : "",
      fallbackAddress: address ? String(address).trim() : "Shift check-out"
    });

    await createLocation({
      id: createId(),
      userId: request.user.id,
      latitude: parsedCoordinates.latitude,
      longitude: parsedCoordinates.longitude,
      accuracy: accuracy ? Number(accuracy) : null,
      address: resolvedLocation.address,
      zoneDetail: resolvedLocation.zoneDetail,
      dutyLabel: resolvedLocation.dutyLabel,
      battery: normalizeBattery(battery),
      trackedAt: timestamp
    });
  }

  await touchUser(request.user.id, timestamp);
  return response.json(await buildGuardOverview(request.user.id));
}

export async function createGuardActivity(request, response) {
  const {
    type,
    title,
    description,
    priority,
    latitude,
    longitude,
    accuracy,
    address,
    dutyLabel,
    battery
  } = request.body ?? {};

  if (!title) {
    throw createHttpError(400, "Activity title is required.");
  }

  const timestamp = now();
  const parsedCoordinates = parseLocationCoordinates(latitude, longitude);

  await createActivity({
    id: createId(),
    userId: request.user.id,
    type: type ? String(type).trim() : "note",
    title: String(title).trim(),
    description: description ? String(description).trim() : "",
    priority: priority ? String(priority).trim() : "medium",
    status: "logged",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  if (parsedCoordinates) {
    const resolvedLocation = await buildResolvedLocation({
      latitude: parsedCoordinates.latitude,
      longitude: parsedCoordinates.longitude,
      manualDutyLabel: dutyLabel ? String(dutyLabel).trim() : "",
      fallbackAddress: address ? String(address).trim() : "Activity update"
    });

    await createLocation({
      id: createId(),
      userId: request.user.id,
      latitude: parsedCoordinates.latitude,
      longitude: parsedCoordinates.longitude,
      accuracy: accuracy ? Number(accuracy) : null,
      address: resolvedLocation.address,
      zoneDetail: resolvedLocation.zoneDetail,
      dutyLabel: resolvedLocation.dutyLabel,
      battery: normalizeBattery(battery),
      trackedAt: timestamp
    });
  }

  await touchUser(request.user.id, timestamp);
  return response.status(201).json(await buildGuardOverview(request.user.id));
}

export async function syncLocation(request, response) {
  const {
    latitude,
    longitude,
    accuracy,
    address,
    dutyLabel,
    battery
  } = request.body ?? {};

  const parsedCoordinates = parseLocationCoordinates(latitude, longitude, { required: true });

  const timestamp = now();
  const resolvedLocation = await buildResolvedLocation({
    latitude: parsedCoordinates.latitude,
    longitude: parsedCoordinates.longitude,
    manualDutyLabel: dutyLabel ? String(dutyLabel).trim() : "",
    fallbackAddress: address ? String(address).trim() : "Live location sync"
  });

  await createLocation({
    id: createId(),
    userId: request.user.id,
    latitude: parsedCoordinates.latitude,
    longitude: parsedCoordinates.longitude,
    accuracy: accuracy ? Number(accuracy) : null,
    address: resolvedLocation.address,
    zoneDetail: resolvedLocation.zoneDetail,
    dutyLabel: resolvedLocation.dutyLabel,
    battery: normalizeBattery(battery),
    trackedAt: timestamp
  });

  await touchUser(request.user.id, timestamp);

  return response.status(201).json({
    location: await findLatestLocationByUserId(request.user.id)
  });
}

export async function getLatestLocation(request, response) {
  return response.json({
    location: await findLatestLocationByUserId(request.user.id)
  });
}
