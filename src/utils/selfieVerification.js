const selfieVerificationThreshold = 0.75;

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
