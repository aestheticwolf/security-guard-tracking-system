export function navigateAppSection(target) {
  if (typeof window === "undefined" || !target) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("sentinel:navigate-section", {
      detail: { target }
    })
  );
}
