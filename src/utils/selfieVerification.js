const selfieVerificationThreshold = 0.75;

const identityLabels = {
  no_reference: "No reference enrolled",
  reference_review: "Reference review ready",
  upload_review: "Uploaded image review",
  identity_processing: "Face match processing",
  match_not_configured: "Matcher not configured",
  match_unavailable: "Matcher unavailable",
  matched: "Identity matched",
  possible_match: "Review-band match",
  mismatch: "Identity mismatch",
  face_not_detected: "Face not detected"
};
const automaticIdentityStatuses = new Set(["matched", "possible_match", "mismatch", "face_not_detected"]);
const positiveIdentityStatuses = new Set(["matched"]);
const negativeIdentityStatuses = new Set(["mismatch", "face_not_detected"]);
const setupIdentityStatuses = new Set(["match_not_configured", "match_unavailable"]);
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

export function isSelfieVerificationPassed(selfie) {
  if (!selfie) {
    return false;
  }

  if (selfie.identityStatus === "matched") {
    return true;
  }

  if (nonPassingIdentityStatuses.has(selfie.identityStatus)) {
    return false;
  }

  return Boolean(selfie.verified || Number(selfie.verificationScore) >= selfieVerificationThreshold);
}

export function getSelfieVerificationLabel(selfie) {
  if (!selfie) {
    return "Awaiting first capture";
  }

  return isSelfieVerificationPassed(selfie)
    ? "Verification passed"
    : "Capture recorded for review";
}

export function getSelfieIdentityLabel(selfie) {
  if (!selfie) {
    return "Awaiting selfie proof";
  }

  return identityLabels[selfie.identityStatus] || "Identity review pending";
}

export function hasAutomaticIdentityScore(selfie) {
  return automaticIdentityStatuses.has(selfie?.identityStatus);
}

export function getSelfieIdentityScorePercent(selfie) {
  if (!hasAutomaticIdentityScore(selfie)) {
    return null;
  }

  const numericScore = Number(selfie?.identityScore);

  if (!Number.isFinite(numericScore)) {
    return null;
  }

  return Math.max(0, Math.min(Math.round(numericScore * 100), 100));
}

export function formatSelfieIdentityScore(selfie) {
  if (!selfie) {
    return "Awaiting capture";
  }

  if (selfie?.identityStatus === "identity_processing") {
    return "Processing";
  }

  if (selfie?.identityStatus === "no_reference") {
    return "No reference";
  }

  if (selfie?.identityStatus === "upload_review") {
    return "Upload review";
  }

  if (selfie?.identityStatus === "reference_review") {
    return "Manual review";
  }

  if (selfie?.identityStatus === "match_not_configured") {
    return "Matcher not configured";
  }

  if (selfie?.identityStatus === "match_unavailable") {
    return "Matcher unavailable";
  }

  const score = getSelfieIdentityScorePercent(selfie);

  return score === null ? "Not available" : `${score}% match`;
}

export function getSelfieIdentityDecision(selfie) {
  if (!selfie) {
    return "Awaiting shift selfie";
  }

  if (positiveIdentityStatuses.has(selfie.identityStatus)) {
    return "Likely registered guard";
  }

  if (selfie.identityStatus === "mismatch") {
    return "Identity mismatch requires review";
  }

  if (selfie.identityStatus === "possible_match") {
    return "Review recommended";
  }

  if (selfie.identityStatus === "face_not_detected") {
    return "Face not detected";
  }

  if (selfie.identityStatus === "upload_review") {
    return "Uploaded proof needs review";
  }

  if (selfie.identityStatus === "identity_processing") {
    return "Face match processing";
  }

  if (selfie.identityStatus === "no_reference") {
    return "No registered reference";
  }

  if (selfie.identityStatus === "match_not_configured") {
    return "Matcher not configured";
  }

  if (selfie.identityStatus === "match_unavailable") {
    return "Matcher unavailable";
  }

  return "Manual review required";
}

export function getSelfieIdentityTone(selfie) {
  if (!selfie) {
    return "pending";
  }

  if (positiveIdentityStatuses.has(selfie.identityStatus)) {
    return "success";
  }

  if (negativeIdentityStatuses.has(selfie.identityStatus)) {
    return "danger";
  }

  if (selfie.identityStatus === "identity_processing") {
    return "processing";
  }

  if (selfie.identityStatus === "possible_match" || setupIdentityStatuses.has(selfie.identityStatus)) {
    return "warning";
  }

  return "warning";
}

export function getSelfieCaptureLabel(selfie) {
  if (!selfie?.captureSource || selfie.captureSource === "unknown") {
    return "Capture source unknown";
  }

  return selfie.captureSource === "camera"
    ? "Live camera capture"
    : "Uploaded image";
}

export function hasGuardIdentityReference(guard) {
  return Boolean(guard?.identityPhotoPath || guard?.identitySelfiePath);
}

export function getGuardIdentityEnrollmentLabel(guard) {
  if (!hasGuardIdentityReference(guard)) {
    return "No identity reference enrolled";
  }

  return guard?.identityEnrolledAt
    ? "Identity reference enrolled"
    : "Reference image available";
}

export function getGuardIdentityReferenceType(guard) {
  if (guard?.identitySelfiePath) {
    return "Enrollment selfie";
  }

  if (guard?.identityPhotoPath) {
    return "Registered photo";
  }

  return "No reference";
}
