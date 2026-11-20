export default function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  const successStatuses = new Set([
    "active",
    "verified",
    "on duty",
    "selfie ready",
    "image verified",
    "identity matched",
    "likely registered guard"
  ]);
  const dangerStatuses = new Set([
    "inactive",
    "alert",
    "identity mismatch",
    "identity mismatch requires review",
    "face not detected",
    "mismatch",
    "failed"
  ]);
  const processingStatuses = new Set([
    "face match processing",
    "processing",
    "identity processing"
  ]);
  const warningStatuses = new Set([
    "review recommended",
    "review-band match",
    "matcher not configured",
    "matcher unavailable"
  ]);
  const classes =
    successStatuses.has(normalized)
      ? "status-badge status-badge--success"
      : dangerStatuses.has(normalized)
        ? "status-badge status-badge--danger"
        : processingStatuses.has(normalized) || warningStatuses.has(normalized)
          ? "status-badge status-badge--warning"
          : "status-badge status-badge--warning";

  return (
    <span className={classes}>{status}</span>
  );
}
