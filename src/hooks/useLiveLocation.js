import { useCallback, useEffect, useState } from "react";
import {
  getStoredDeviceLocation,
  readBestAvailableDeviceContext,
  watchDeviceContext
} from "../utils/device";

export function useLiveLocation(initialStatus = "Waiting for location permission.") {
  const [deviceLocation, setDeviceLocation] = useState(() => getStoredDeviceLocation());
  const [locationStatus, setLocationStatus] = useState(() =>
    getStoredDeviceLocation()
      ? "Using the latest saved device location until live tracking refreshes."
      : initialStatus
  );

  const refreshLocation = useCallback(async (statusLabel = "Refreshing live location...", options = {}) => {
    setLocationStatus(statusLabel);
    const liveLocation = await readBestAvailableDeviceContext(options);
    setDeviceLocation(liveLocation);
    return liveLocation;
  }, []);

  useEffect(() => {
    setLocationStatus("Requesting live location access...");

    const stopWatching = watchDeviceContext(
      (liveLocation) => {
        setDeviceLocation(liveLocation);
        setLocationStatus("Live tracking active.");
      },
      (message) => {
        const cachedLocation = getStoredDeviceLocation();
        setLocationStatus(
          cachedLocation ? `${message} Using the latest saved device location.` : message
        );
      }
    );

    return () => stopWatching();
  }, []);

  return {
    deviceLocation,
    setDeviceLocation,
    locationStatus,
    setLocationStatus,
    refreshLocation
  };
}
