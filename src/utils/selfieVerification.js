const selfieVerificationThreshold = 0.75;

const identityLabels = {
  no_reference: "No reference enrolled",
  reference_review: "Reference review ready",
  upload_review: "Uploaded image review",
  matched: "Identity matched",
  mismatch: "Identity mismatch",
  face_not_detected: "Face not detected"
};
const automaticIdentityStatuses = new Set(["matched", "mismatch", "face_not_detected"]);
const positiveIdentityStatuses = new Set(["matched"]);
const negativeIdentityStatuses = new Set(["mismatch", "face_not_detected"]);

export function isSelfieVerificationPassed(selfie) {
  if (!selfie) {
    return false;
  }

  if (["mismatch", "face_not_detected"].includes(selfie.identityStatus)) {
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
  const score = getSelfieIdentityScorePercent(selfie);

  return score === null ? "Match pending" : `${score}% match`;
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

  if (selfie.identityStatus === "face_not_detected") {
    return "Face not detected";
  }

  if (selfie.identityStatus === "upload_review") {
    return "Uploaded proof needs review";
  }

  if (selfie.identityStatus === "no_reference") {
    return "No registered reference";
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
