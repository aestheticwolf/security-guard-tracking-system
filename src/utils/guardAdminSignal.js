const channelName = "sentinel-grid-guard-admin-signal";
const storageKey = "sentinel-grid-guard-admin-signal-event";

function createSignal(payload = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
    ...payload
  };
}

export function publishGuardAdminSignal(payload = {}) {
  if (typeof window === "undefined") {
    return null;
  }

  const signal = createSignal(payload);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(signal));
  } catch {
    // Ignore storage write failures.
  }

  if (typeof window.BroadcastChannel !== "undefined") {
    try {
      const channel = new window.BroadcastChannel(channelName);
      channel.postMessage(signal);
      channel.close();
    } catch {
      // Ignore channel failures and rely on storage events.
    }
  }

  return signal;
}

export function subscribeGuardAdminSignals(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const seenSignalIds = new Set();

  function emit(signal) {
    if (!signal?.id || seenSignalIds.has(signal.id)) {
      return;
    }

    seenSignalIds.add(signal.id);

    if (seenSignalIds.size > 50) {
      const [firstId] = seenSignalIds;
      seenSignalIds.delete(firstId);
    }

    callback?.(signal);
  }

  const handleStorage = (event) => {
    if (event.key !== storageKey || !event.newValue) {
      return;
    }

    try {
      emit(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed payloads.
    }
  };

  window.addEventListener("storage", handleStorage);

  let channel = null;

  if (typeof window.BroadcastChannel !== "undefined") {
    try {
      channel = new window.BroadcastChannel(channelName);
      channel.onmessage = (event) => emit(event.data);
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener("storage", handleStorage);
    channel?.close();
  };
}
