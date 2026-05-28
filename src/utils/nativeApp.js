import { Capacitor } from "@capacitor/core";

export function isNativeApp() {
  return Boolean(Capacitor?.isNativePlatform?.());
}

export function getNativePlatform() {
  return Capacitor?.getPlatform?.() || "web";
}

export function applyNativeAppClasses() {
  if (!isNativeApp()) {
    return;
  }

  const platform = getNativePlatform();
  document.documentElement.classList.add("is-native-app", `is-native-${platform}`);
  document.body?.classList.add("is-native-app");
}
