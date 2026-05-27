export default function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  const successStatuses = new Set([
    "active",
    "verified",
    "on duty",
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
  const classes =
    successStatuses.has(normalized)
      ? "status-badge status-badge--success"
      : dangerStatuses.has(normalized)
        ? "status-badge status-badge--danger"
        : "status-badge status-badge--warning";

  return (
    <span className={classes}>{status}</span>
  );
}
