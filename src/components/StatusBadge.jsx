export default function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  const classes =
    normalized === "active" || normalized === "verified" || normalized === "on duty"
      ? "status-badge status-badge--success"
      : normalized === "inactive" || normalized === "alert"
        ? "status-badge status-badge--danger"
        : "status-badge status-badge--warning";

  return (
    <span className={classes}>{status}</span>
  );
}
