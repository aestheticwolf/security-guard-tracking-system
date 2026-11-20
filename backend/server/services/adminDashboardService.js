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
import { listDutySites } from "../models/dutySiteModel.js";
import { findOrganizationById } from "../models/organizationModel.js";
import { listSelfiesByUserId } from "../models/selfieModel.js";
import { listGuards, listUsers } from "../models/userModel.js";
import { sanitizeUser } from "./auth.js";
import { getAttendanceMinutesForDay, getDateKey, sortByNewest } from "./coreService.js";

const selfieVerificationThreshold = 0.75;
const nonPassingIdentityStatuses = new Set([
  "no_reference",
  "reference_review",
  "upload_review",
  "identity_processing",
  "match_not_configured",
  "match_unavailable",
  "possible_match",
  "mismatch",
  "face_not_detected"
]);

function isVerifiedSelfie(selfie) {
  if (selfie?.identityStatus === "matched") {
    return true;
  }

  if (nonPassingIdentityStatuses.has(selfie?.identityStatus)) {
    return false;
  }

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

function isSameDateKey(value, dateKey) {
  return Boolean(value && String(value).startsWith(dateKey));
}

function getTimestampMs(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function findClosestSelfie(selfies, targetTime) {
  const targetTimestamp = getTimestampMs(targetTime);

  if (!selfies.length || targetTimestamp === null) {
    return null;
  }

  return [...selfies].sort((left, right) => {
    const leftDistance = Math.abs((getTimestampMs(left.capturedAt) ?? 0) - targetTimestamp);
    const rightDistance = Math.abs((getTimestampMs(right.capturedAt) ?? 0) - targetTimestamp);
    return leftDistance - rightDistance;
  })[0] || null;
}

function buildTodaySelfieEvidence(attendanceHistory, selfieHistory, dateKey) {
  return attendanceHistory
    .filter((entry) => isSameDateKey(entry.checkInAt, dateKey) || isSameDateKey(entry.checkOutAt, dateKey))
    .map((entry) => {
      const linkedSelfies = selfieHistory
        .filter((selfie) => selfie.attendanceId === entry.id)
        .sort((left, right) => (getTimestampMs(left.capturedAt) ?? 0) - (getTimestampMs(right.capturedAt) ?? 0));
      const checkInSelfie = findClosestSelfie(linkedSelfies, entry.checkInAt) || linkedSelfies[0] || null;
      const checkInSelfieId = checkInSelfie?.id || `${checkInSelfie?.imagePath || ""}-${checkInSelfie?.capturedAt || ""}`;
      const checkoutCandidates = linkedSelfies.filter((selfie) => {
        const selfieId = selfie.id || `${selfie.imagePath || ""}-${selfie.capturedAt || ""}`;
        return selfieId !== checkInSelfieId;
      });
      const checkOutSelfie = entry.checkOutAt
        ? findClosestSelfie(checkoutCandidates, entry.checkOutAt) || checkoutCandidates[checkoutCandidates.length - 1] || null
        : null;

      return {
        attendanceId: entry.id,
        checkInAt: entry.checkInAt,
        checkOutAt: entry.checkOutAt,
        status: entry.status,
        locationLabel: entry.locationLabel,
        note: entry.note,
        checkInSelfie,
        checkOutSelfie
      };
    });
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

function hasDutySiteCoordinates(site) {
  return (
    site?.latitude !== undefined &&
    site?.latitude !== null &&
    site?.longitude !== undefined &&
    site?.longitude !== null &&
    Number.isFinite(Number(site.latitude)) &&
    Number.isFinite(Number(site.longitude))
  );
}

function buildDutySiteMapLocation(site, guard) {
  if (!hasDutySiteCoordinates(site)) {
    return null;
  }

  return {
    id: `duty-site-${site.id}-${guard.id}`,
    userId: guard.id,
    latitude: Number(site.latitude),
    longitude: Number(site.longitude),
    accuracy: null,
    address: site.name,
    zoneDetail: [site.area, site.address].filter(Boolean).join(" • "),
    dutyLabel: guard.shiftLabel || site.name,
    battery: null,
    trackedAt: null,
    source: "duty_site"
  };
}

function buildLocationFeedDetail(location) {
  const parts = [];

  if (location?.address) {
    parts.push(location.address);
  }

  if (
    location?.zoneDetail &&
    String(location.zoneDetail).trim().toLowerCase() !== String(location.address || "").trim().toLowerCase()
  ) {
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

function buildDutySiteCoverage(dutySites, guards) {
  const siteLookup = new Map(dutySites.map((site) => [site.id, site]));
  const coverage = dutySites.map((site) => {
    const assignedGuards = guards.filter((guard) => guard.dutySiteId === site.id);

    return {
      ...site,
      assignedCount: assignedGuards.length,
      onDutyCount: assignedGuards.filter((guard) => guard.shiftState === "On Duty").length,
      trackedCount: assignedGuards.filter((guard) => guard.latestLocation).length,
      guards: assignedGuards.map((guard) => ({
        id: guard.id,
        fullName: guard.fullName,
        employeeCode: guard.employeeCode,
        shiftState: guard.shiftState,
        status: guard.status,
        latestLocation: guard.latestLocation
      }))
    };
  });
  const unassignedGuards = guards.filter(
    (guard) => !guard.dutySiteId || !siteLookup.has(guard.dutySiteId)
  );

  if (unassignedGuards.length) {
    coverage.push({
      id: "unassigned",
      organizationId: null,
      name: "Unassigned",
      area: "Needs duty site assignment",
      address: "Assign these guards to a duty site from their roster profile.",
      latitude: null,
      longitude: null,
      status: "unassigned",
      isUnassigned: true,
      assignedCount: unassignedGuards.length,
      onDutyCount: unassignedGuards.filter((guard) => guard.shiftState === "On Duty").length,
      trackedCount: unassignedGuards.filter((guard) => guard.latestLocation).length,
      guards: unassignedGuards.map((guard) => ({
        id: guard.id,
        fullName: guard.fullName,
        employeeCode: guard.employeeCode,
        shiftState: guard.shiftState,
        status: guard.status,
        latestLocation: guard.latestLocation
      }))
    });
  }

  return coverage;
}

export async function buildGuardRoster(organizationId = null, dutySitesOverride = null) {
  const dateKey = getDateKey();
  const [guards, dutySites] = await Promise.all([
    listGuards(organizationId),
    dutySitesOverride
      ? Promise.resolve(dutySitesOverride)
      : organizationId
        ? listDutySites(organizationId)
        : Promise.resolve([])
  ]);
  const dutySiteLookup = new Map(dutySites.map((site) => [site.id, site]));

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

      const dutySite = guard.dutySiteId ? dutySiteLookup.get(guard.dutySiteId) || null : null;
      const mapLocation = latestLocation || buildDutySiteMapLocation(dutySite, guard);

      return {
        ...sanitizeUser(guard),
        dutySite,
        lastSeenAt,
        shiftState: currentShift ? "On Duty" : "Off Duty",
        currentShift,
        latestLocation,
        mapLocation,
        mapLocationType: latestLocation ? "live" : mapLocation ? "duty_site" : "none",
        latestActivity: recentActivities[0] ?? null,
        recentActivities,
        recentAttendance,
        recentLocations,
        activityHistory: activityHistory.slice(0, 10),
        attendanceHistory: attendanceHistory.slice(0, 8),
        locationHistory: locationHistory.slice(0, 16),
        selfieHistory,
        todaySelfieEvidence: buildTodaySelfieEvidence(attendanceHistory, selfieHistory, dateKey),
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

export async function buildLiveFeed(limit = 20, organizationId = null) {
  const [users, attendance, activities, locations] = await Promise.all([
    listUsers(organizationId),
    listAttendanceForDate(getDateKey()),
    listAllActivities(),
    listAllLocations()
  ]);

  const userLookup = new Map(users.map((user) => [user.id, user]));
  const scopedUserIds = new Set(users.map((user) => user.id));
  const scopedAttendance = organizationId
    ? attendance.filter((entry) => scopedUserIds.has(entry.userId))
    : attendance;
  const scopedActivities = organizationId
    ? activities.filter((entry) => scopedUserIds.has(entry.userId))
    : activities;
  const scopedLocations = organizationId
    ? locations.filter((entry) => scopedUserIds.has(entry.userId))
    : locations;

  const attendanceEvents = scopedAttendance.flatMap((entry) => {
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

  const activityEvents = scopedActivities.map((entry) => {
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

  const locationEvents = scopedLocations.map((entry) => {
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

export async function buildAdminOverview(organizationId = null) {
  const dateKey = getDateKey();
  const [organization, dutySites] = await Promise.all([
    organizationId ? findOrganizationById(organizationId) : Promise.resolve(null),
    organizationId ? listDutySites(organizationId) : Promise.resolve([])
  ]);
  const [guards, attendance, activities, liveFeed] = await Promise.all([
    buildGuardRoster(organizationId, dutySites),
    listAttendanceForDate(dateKey),
    listActivitiesForDate(dateKey),
    buildLiveFeed(20, organizationId)
  ]);
  const guardIds = new Set(guards.map((guard) => guard.id));
  const scopedAttendance = organizationId
    ? attendance.filter((entry) => guardIds.has(entry.userId))
    : attendance;
  const scopedActivities = organizationId
    ? activities.filter((entry) => guardIds.has(entry.userId))
    : activities;

  const incidents = scopedActivities.filter(
    (entry) => entry.type === "incident" || entry.type === "alert"
  );
  const checkedInGuardIdsToday = new Set(scopedAttendance.map((entry) => entry.userId));
  const checkedInGuardsToday = checkedInGuardIdsToday.size;
  const attendanceRate = guards.length
    ? Math.min(100, Math.round((checkedInGuardsToday / guards.length) * 100))
    : 0;

  return {
    organization,
    metrics: {
      totalGuards: guards.length,
      onDuty: guards.filter((guard) => guard.shiftState === "On Duty").length,
      attendanceRate,
      checkedInGuardsToday,
      attendanceRecordsToday: scopedAttendance.length,
      incidentCount: incidents.length,
      trackedGuards: guards.filter((guard) => guard.latestLocation).length,
      activeDutySites: dutySites.filter((site) => site.status === "active").length,
      assignedToDutySites: guards.filter((guard) => guard.dutySite).length,
      locationPingsToday: guards.reduce(
        (total, guard) => total + (guard.locationPingsToday ?? 0),
        0
      )
    },
    guards,
    attendance: scopedAttendance.map((entry) => {
      const user = guards.find((guard) => guard.id === entry.userId);
      return {
        ...entry,
        userName: user?.fullName ?? "Unknown guard"
      };
    }),
    dutySites,
    siteCoverage: buildDutySiteCoverage(dutySites, guards),
    liveFeed
  };
}
