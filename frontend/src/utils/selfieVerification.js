const selfieVerificationThreshold = 0.75;

const identityLabels = {
  no_reference: "No reference enrolled",
  reference_review: "Reference review ready",
  upload_review: "Uploaded image review",
  identity_processing: "Face match processing",
  match_not_configured: "Face scoring not enabled",
  match_unavailable: "Face scoring unavailable",
  matched: "Identity matched",
  possible_match: "Review-band match",
  mismatch: "Identity mismatch",
  face_not_detected: "Face not clear"
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
    : "Selfie captured for review";
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
    return "Not enabled";
  }

  if (selfie?.identityStatus === "match_unavailable") {
    return "Unavailable";
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
    return "Retake recommended";
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
    return "Scoring not enabled";
  }

  if (selfie.identityStatus === "match_unavailable") {
    return "Scoring unavailable";
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

export function getSelfieIdentityGuidance(selfie) {
  if (!selfie) {
    return "";
  }

  switch (selfie.identityStatus) {
    case "matched":
      return "The live selfie matches the enrolled reference. Keep the capture on record with this shift.";
    case "possible_match":
      return "The result is close but needs supervisor confirmation before accepting it as a verified match.";
    case "mismatch":
      return "The live selfie does not confidently match the enrolled reference. Review both images before approving the shift proof.";
    case "face_not_detected":
      return "The selfie is not clear enough for reliable verification. Ask the guard to retake a front-facing selfie.";
    case "match_unavailable":
      return "Face-match scoring did not return a result. Review manually and check production matcher connectivity.";
    case "match_not_configured":
      return "Face-match scoring is not enabled on this deployment. Manual review is required until the production matcher is connected.";
    case "upload_review":
      return "This proof came from an uploaded image. Prefer live camera capture for stronger identity assurance.";
    case "reference_review":
      return "Live camera proof is saved. Review it against the enrolled reference before marking it verified.";
    case "identity_processing":
      return "Automatic matching is still processing. Refresh shortly or review manually if the result does not return.";
    case "no_reference":
      return "No enrolled reference is available. Add a registered photo or enrollment selfie to enable identity review.";
    default:
      return "";
  }
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
