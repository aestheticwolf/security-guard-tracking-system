import { useEffect } from "react";

function parsePayload(token) {
  try {
    const raw = token.split(".")[1];
    return JSON.parse(window.atob(raw.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export default function useSessionTimer(token, onExpire) {
  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const payload = parsePayload(token);

    if (!payload?.exp) {
      return undefined;
    }

    const msUntilExpiry = payload.exp * 1000 - Date.now();

    if (msUntilExpiry <= 0) {
      onExpire();
      return undefined;
    }

    const timer = window.setTimeout(() => onExpire(), msUntilExpiry);
    return () => window.clearTimeout(timer);
  }, [token, onExpire]);
}
