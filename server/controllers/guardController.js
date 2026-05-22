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
import { scoreSelfieCapture, toPublicSelfiePath } from "../services/selfie.js";
import { buildGuardOverview } from "../services/guardDashboardService.js";
import {
  createHttpError,
  createId,
  now
} from "../services/coreService.js";

async function buildResolvedLocation({
  latitude,
  longitude,
  manualDutyLabel,
  fallbackAddress
}) {
  if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
    return {
      address: fallbackAddress || manualDutyLabel || "Live field position",
      zoneDetail: fallbackAddress || manualDutyLabel || "Live field position",
      dutyLabel: manualDutyLabel || null
    };
  }

  const resolvedZone = await reverseGeocodeLocation(latitude, longitude);

  return {
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
  };
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

  const { note, locationLabel, latitude, longitude, accuracy, battery } = request.body ?? {};
  const shiftNote = note ? String(note).trim() : "";
  const attendanceId = createId();
  const timestamp = now();
  const selfieCheck = scoreSelfieCapture(request.file);
  const selfiePath = toPublicSelfiePath(request.file);

  await createAttendance({
    id: attendanceId,
    userId: request.user.id,
    checkInAt: timestamp,
    checkOutAt: null,
    status: "checked-in",
    selfiePath,
    locationLabel: locationLabel ? String(locationLabel).trim() : "Field checkpoint",
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
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

  if (latitude && longitude) {
    const resolvedLocation = await buildResolvedLocation({
      latitude,
      longitude,
      manualDutyLabel: locationLabel ? String(locationLabel).trim() : "",
      fallbackAddress: "Shift check-in"
    });

    await createLocation({
      id: createId(),
      userId: request.user.id,
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy ? Number(accuracy) : null,
      address: resolvedLocation.address,
      zoneDetail: resolvedLocation.zoneDetail,
      dutyLabel: resolvedLocation.dutyLabel,
      battery: battery ? Number(battery) : null,
      trackedAt: timestamp
    });
  }

  await touchUser(request.user.id, timestamp);
  return response.status(201).json(await buildGuardOverview(request.user.id));
}

export async function checkOut(request, response) {
  const openAttendance = await findOpenAttendanceByUserId(request.user.id);

  if (!openAttendance) {
    throw createHttpError(404, "No active shift was found for check-out.");
  }

  const timestamp = now();
  const nextNote = request.body?.note ? String(request.body.note).trim() : openAttendance.note;
  const {
    latitude,
    longitude,
    accuracy,
    address,
    dutyLabel,
    battery
  } = request.body ?? {};

  await updateAttendanceOnCheckout(openAttendance.id, {
    checkOutAt: timestamp,
    status: "completed",
    note: nextNote
  });

  await createActivity({
    id: createId(),
    userId: request.user.id,
    type: "attendance",
    title: "Shift check-out completed",
    description: appendShiftNote(
      "Guard wrapped up the active patrol shift with a final location sync.",
      nextNote
    ),
    priority: "low",
    status: "logged",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  if (latitude && longitude) {
    const resolvedLocation = await buildResolvedLocation({
      latitude,
      longitude,
      manualDutyLabel: dutyLabel ? String(dutyLabel).trim() : "",
      fallbackAddress: address ? String(address).trim() : "Shift check-out"
    });

    await createLocation({
      id: createId(),
      userId: request.user.id,
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy ? Number(accuracy) : null,
      address: resolvedLocation.address,
      zoneDetail: resolvedLocation.zoneDetail,
      dutyLabel: resolvedLocation.dutyLabel,
      battery: battery ? Number(battery) : null,
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

  if (latitude && longitude) {
    const resolvedLocation = await buildResolvedLocation({
      latitude,
      longitude,
      manualDutyLabel: dutyLabel ? String(dutyLabel).trim() : "",
      fallbackAddress: address ? String(address).trim() : "Activity update"
    });

    await createLocation({
      id: createId(),
      userId: request.user.id,
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy ? Number(accuracy) : null,
      address: resolvedLocation.address,
      zoneDetail: resolvedLocation.zoneDetail,
      dutyLabel: resolvedLocation.dutyLabel,
      battery: battery ? Number(battery) : null,
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

  if (latitude === undefined || longitude === undefined) {
    throw createHttpError(400, "Latitude and longitude are required.");
  }

  const timestamp = now();
  const resolvedLocation = await buildResolvedLocation({
    latitude,
    longitude,
    manualDutyLabel: dutyLabel ? String(dutyLabel).trim() : "",
    fallbackAddress: address ? String(address).trim() : "Live location sync"
  });

  await createLocation({
    id: createId(),
    userId: request.user.id,
    latitude: Number(latitude),
    longitude: Number(longitude),
    accuracy: accuracy ? Number(accuracy) : null,
    address: resolvedLocation.address,
    zoneDetail: resolvedLocation.zoneDetail,
    dutyLabel: resolvedLocation.dutyLabel,
    battery: battery ? Number(battery) : null,
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
