const selfieVerificationThreshold = 0.75;

const identityLabels = {
  no_reference: "No reference enrolled",
  reference_review: "Reference review ready",
  upload_review: "Uploaded image review",
  matched: "Identity matched",
  mismatch: "Identity mismatch"
};

export function isSelfieVerificationPassed(selfie) {
  if (!selfie) {
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
