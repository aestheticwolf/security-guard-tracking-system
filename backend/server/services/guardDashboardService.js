import { listActivitiesByUserId } from "../models/activityModel.js";
import {
  findOpenAttendanceByUserId,
  listAttendanceByUserId
} from "../models/attendanceModel.js";
import { listLocationsByUserId } from "../models/locationModel.js";
import { findOrganizationById } from "../models/organizationModel.js";
import { listSelfiesByUserId } from "../models/selfieModel.js";
import { findUserById } from "../models/userModel.js";
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

export async function buildGuardOverview(userId) {
  const dateKey = getDateKey();
  const user = await findUserById(userId);
  const [organization, attendance, activities, locations, selfies, currentAttendance] = await Promise.all([
    user?.organizationId ? findOrganizationById(user.organizationId) : Promise.resolve(null),
    listAttendanceByUserId(userId),
    listActivitiesByUserId(userId),
    listLocationsByUserId(userId),
    listSelfiesByUserId(userId),
    findOpenAttendanceByUserId(userId)
  ]);

  const todayAttendance = attendance.filter((entry) =>
    String(entry.checkInAt).startsWith(dateKey)
  );
  const todayLocations = locations.filter((entry) =>
    String(entry.trackedAt).startsWith(dateKey)
  );
  const todayVerifiedSelfies = selfies.filter(
    (entry) => isVerifiedSelfie(entry) && String(entry.capturedAt).startsWith(dateKey)
  );

  return {
    user: sanitizeUser(user),
    organization,
    currentAttendance,
    recentAttendance: sortByNewest(todayAttendance, "checkInAt").slice(0, 3),
    recentActivities: sortByNewest(activities, "createdAt").slice(0, 8),
    recentLocations: sortByNewest(todayLocations.length ? todayLocations : locations, "trackedAt").slice(0, 12),
    lastLocation: sortByNewest(locations, "trackedAt")[0] ?? null,
    lastSelfie: sortByNewest(selfies, "capturedAt")[0] ?? null,
    stats: {
      activityCount: activities.length,
      attendanceRecordsToday: todayAttendance.length,
      locationPings: todayLocations.length,
      verifiedSelfiesToday: todayVerifiedSelfies.length,
      dutyMinutesToday: getAttendanceMinutesForDay(attendance, dateKey),
      onDutyMinutes: currentAttendance
        ? Math.max(
            0,
            Math.round(
              (Date.now() - new Date(currentAttendance.checkInAt).getTime()) / (1000 * 60)
            )
          )
        : 0
    }
  };
}
