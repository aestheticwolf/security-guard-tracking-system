import {
  listAllActivities,
  listActivitiesByUserId,
  listActivitiesForDate
} from "../models/activityModel.js";
import {
  findOpenAttendanceByUserId,
  listAttendanceByUserId,
  listAttendanceForDate
} from "../models/attendanceModel.js";
import {
  findLatestLocationByUserId,
  listLocationsByUserId,
  listAllLocations
} from "../models/locationModel.js";
import { listSelfiesByUserId } from "../models/selfieModel.js";
import { listGuards, listUsers } from "../models/userModel.js";
import { sanitizeUser } from "./auth.js";
import { getAttendanceMinutesForDay, getDateKey, sortByNewest } from "./coreService.js";

const selfieVerificationThreshold = 0.75;

function isVerifiedSelfie(selfie) {
  return Boolean(selfie?.verified || Number(selfie?.verificationScore) >= selfieVerificationThreshold);
}

function getLatestTimestamp(values) {
  const normalized = values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (!normalized.length) {
    return null;
  }

  return new Date(Math.max(...normalized)).toISOString();
}

function getMinutesSince(value) {
  if (!value) {
    return null;
  }

  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / (1000 * 60)));
}

function formatLocationCoordinates(location) {
  if (
    location?.latitude === undefined ||
    location?.longitude === undefined ||
    location?.latitude === null ||
    location?.longitude === null
  ) {
    return "Location unavailable";
  }

  return `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`;
}

function buildLocationFeedDetail(location) {
  const parts = [];

  if (location?.address) {
    parts.push(location.address);
  }

  if (location?.zoneDetail && location.zoneDetail !== location.address) {
    parts.push(location.zoneDetail);
  }

  if (location?.dutyLabel) {
    parts.push(`Duty label: ${location.dutyLabel}`);
  }

  parts.push(formatLocationCoordinates(location));

  return parts.filter(Boolean).join(" • ");
}

function buildAttendanceFeedDetail(entry, fallbackLocationLabel) {
  const parts = [entry.locationLabel || fallbackLocationLabel || "Field checkpoint"];

  if (entry.note) {
    parts.push(`Shift note: ${entry.note}`);
  }

  return parts.filter(Boolean).join(" • ");
}

export async function buildGuardRoster() {
  const dateKey = getDateKey();
  const guards = await listGuards();

  return Promise.all(
    guards.map(async (guard) => {
      const [currentShift, latestLocation, activities, attendance, locations, selfies] = await Promise.all([
        findOpenAttendanceByUserId(guard.id),
        findLatestLocationByUserId(guard.id),
        listActivitiesByUserId(guard.id),
        listAttendanceByUserId(guard.id),
        listLocationsByUserId(guard.id),
        listSelfiesByUserId(guard.id)
      ]);
      const activityHistory = sortByNewest(activities, "createdAt");
      const attendanceHistory = sortByNewest(attendance, "checkInAt");
      const locationHistory = sortByNewest(locations, "trackedAt");
      const selfieHistory = sortByNewest(selfies, "capturedAt");
      const recentActivities = activityHistory.slice(0, 3);
      const recentAttendance = attendanceHistory.slice(0, 2);
      const recentLocations = locationHistory.slice(0, 8);
      const lastSelfie = selfieHistory[0] ?? null;
      const activityCountToday = activities.filter((entry) =>
        String(entry.createdAt).startsWith(dateKey)
      ).length;
      const locationPingsToday = locations.filter((entry) =>
        String(entry.trackedAt).startsWith(dateKey)
      ).length;
      const verifiedSelfiesToday = selfies.filter(
        (entry) => isVerifiedSelfie(entry) && String(entry.capturedAt).startsWith(dateKey)
      ).length;
      const lastSeenAt = getLatestTimestamp([
        latestLocation?.trackedAt,
        recentActivities[0]?.createdAt,
        recentAttendance[0]?.checkInAt,
        recentAttendance[0]?.checkOutAt,
        lastSelfie?.capturedAt
      ]);
      const onDutyMinutes = currentShift ? getMinutesSince(currentShift.checkInAt) : 0;
      const dutyMinutesToday = getAttendanceMinutesForDay(attendance, dateKey);

      return {
        ...sanitizeUser(guard),
        lastSeenAt,
        shiftState: currentShift ? "On Duty" : "Off Duty",
        currentShift,
        latestLocation,
        latestActivity: recentActivities[0] ?? null,
        recentActivities,
        recentAttendance,
        recentLocations,
        activityHistory: activityHistory.slice(0, 10),
        attendanceHistory: attendanceHistory.slice(0, 8),
        locationHistory: locationHistory.slice(0, 16),
        selfieHistory: selfieHistory.slice(0, 8),
        lastSelfie,
        activityCountToday,
        locationPingsToday,
        verifiedSelfiesToday,
        onDutyMinutes,
        dutyMinutesToday,
        locationFreshnessMinutes: getMinutesSince(latestLocation?.trackedAt)
      };
    })
  );
}

export async function buildLiveFeed(limit = 20) {
  const [users, attendance, activities, locations] = await Promise.all([
    listUsers(),
    listAttendanceForDate(getDateKey()),
    listAllActivities(),
    listAllLocations()
  ]);

  const userLookup = new Map(users.map((user) => [user.id, user]));

  const attendanceEvents = attendance.flatMap((entry) => {
    const user = userLookup.get(entry.userId);
    const shared = {
      id: entry.id,
      userId: entry.userId,
      userName: user?.fullName ?? "Unknown guard"
    };

    const events = [
      {
        ...shared,
        type: "attendance",
        title: "Shift checked in",
        detail: buildAttendanceFeedDetail(entry, "Field checkpoint"),
        occurredAt: entry.checkInAt
      }
    ];

    if (entry.checkOutAt) {
      events.push({
        ...shared,
        type: "attendance",
        title: "Shift checked out",
        detail: buildAttendanceFeedDetail(entry, "Field checkpoint"),
        occurredAt: entry.checkOutAt
      });
    }

    return events;
  });

  const activityEvents = activities.map((entry) => {
    const user = userLookup.get(entry.userId);
    return {
      id: entry.id,
      userId: entry.userId,
      userName: user?.fullName ?? "Unknown guard",
      type: entry.type,
      title: entry.title,
      detail: entry.description,
      occurredAt: entry.createdAt
    };
  });

  const locationEvents = locations.map((entry) => {
    const user = userLookup.get(entry.userId);
    return {
      id: entry.id,
      userId: entry.userId,
      userName: user?.fullName ?? "Unknown guard",
      type: "location",
      title: "Location ping synced",
      detail: buildLocationFeedDetail(entry),
      occurredAt: entry.trackedAt
    };
  });

  return sortByNewest(
    [...attendanceEvents, ...activityEvents, ...locationEvents],
    "occurredAt"
  ).slice(0, limit);
}

export async function buildAdminOverview() {
  const dateKey = getDateKey();
  const [guards, attendance, activities, liveFeed] = await Promise.all([
    buildGuardRoster(),
    listAttendanceForDate(dateKey),
    listActivitiesForDate(dateKey),
    buildLiveFeed(20)
  ]);

  const incidents = activities.filter(
    (entry) => entry.type === "incident" || entry.type === "alert"
  );

  return {
    metrics: {
      totalGuards: guards.length,
      onDuty: guards.filter((guard) => guard.shiftState === "On Duty").length,
      attendanceRate: guards.length ? Math.round((attendance.length / guards.length) * 100) : 0,
      incidentCount: incidents.length,
      trackedGuards: guards.filter((guard) => guard.latestLocation).length,
      locationPingsToday: guards.reduce(
        (total, guard) => total + (guard.locationPingsToday ?? 0),
        0
      )
    },
    guards,
    attendance: attendance.map((entry) => {
      const user = guards.find((guard) => guard.id === entry.userId);
      return {
        ...entry,
        userName: user?.fullName ?? "Unknown guard"
      };
    }),
    liveFeed
  };
}
