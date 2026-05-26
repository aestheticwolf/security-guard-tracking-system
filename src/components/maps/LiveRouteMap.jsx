import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed, MapPinned } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import {
  buildContiguousLocationTrail,
  getDistanceMeters,
  toLatLng
} from "../../utils/geo";
import {
  formatCoordinates,
  formatDistanceMeters,
  formatRelative,
  uniqueDisplayValues
} from "../../utils/format";
import {
  buildLeafletMapError,
  buildLeafletPopupHtml,
  createLeafletDivIcon,
  createLeafletMap,
  createLeafletTileLayer,
  fitLeafletMapToPoints
} from "../../utils/leafletMaps";

const indiaCenter = [20.5937, 78.9629];
const defaultSubjectMeta = [];

export default function LiveRouteMap({
  currentLocation,
  recentLocations = [],
  markerLabel = "GU",
  markerTone = "gold",
  title = "Live guard position",
  subtitle = "Awaiting field location sync.",
  focusSequence = 0,
  followCurrentLocation = false,
  heightClass = "h-[22rem]",
  adminLocation = null,
  adminLocationLabel = "Operations viewer location",
  adminDistanceLabel = "",
  adminLocationLoading = false,
  onRequestAdminLocation,
  subjectMeta = defaultSubjectMeta
}) {
  const { theme } = useTheme();
  const shellRef = useRef(null);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const adminMarkerRef = useRef(null);
  const adminAccuracyCircleRef = useRef(null);
  const resizeTimersRef = useRef([]);
  const latestFitPointsRef = useRef([]);
  const latestFitZoomRef = useRef(16);
  const latestCurrentPointRef = useRef(null);
  const latestFollowCurrentLocationRef = useRef(false);
  const hadRenderableSizeRef = useRef(false);
  const lastFocusRef = useRef(null);
  const hasInitialFitRef = useRef(false);
  const lastStaticFitSignatureRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const trailPoints = useMemo(
    () => buildContiguousLocationTrail(recentLocations, currentLocation),
    [recentLocations, currentLocation]
  );
  const currentPoint = toLatLng(currentLocation);
  const mapPoints = useMemo(() => {
    if (!currentPoint) {
      return trailPoints;
    }

    if (!trailPoints.length) {
      return [currentLocation];
    }

    const latestTrailPoint = trailPoints[trailPoints.length - 1];

    if (getDistanceMeters(latestTrailPoint, currentLocation) <= 8) {
      return trailPoints;
    }

    return [...trailPoints, currentLocation];
  }, [currentLocation, currentPoint, trailPoints]);
  const subjectFitPoints = useMemo(
    () =>
      mapPoints
        .map((point) => (Array.isArray(point) ? point : toLatLng(point)))
        .filter(Boolean),
    [mapPoints]
  );
  const adminPoint = toLatLng(adminLocation);
  const fitPoints = useMemo(() => {
    const points = [...subjectFitPoints];
    const nextAdminPoint = toLatLng(adminLocation);

    if (nextAdminPoint) {
      points.push(nextAdminPoint);
    }

    return points;
  }, [adminLocation, subjectFitPoints]);
  const accuracyRadiusMeters =
    currentLocation?.accuracy !== undefined && currentLocation?.accuracy !== null
      ? Math.max(0, Number(currentLocation.accuracy))
      : 0;
  const adminAccuracyRadiusMeters =
    adminLocation?.accuracy !== undefined && adminLocation?.accuracy !== null
      ? Math.max(0, Number(adminLocation.accuracy))
      : 0;

  function clearScheduledMapResizes() {
    resizeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    resizeTimersRef.current = [];
  }

  function scheduleMapResize({ refitWhenRevealed = false } = {}) {
    clearScheduledMapResizes();

    [0, 90, 260].forEach((delay) => {
      const timerId = window.setTimeout(() => {
        const map = mapRef.current;
        const container = containerRef.current;

        if (!map || !container) {
          return;
        }

        const { width, height } = container.getBoundingClientRect();
        const hasRenderableSize = width > 80 && height > 80;
        const wasHidden = !hadRenderableSizeRef.current;

        if (!hasRenderableSize) {
          hadRenderableSizeRef.current = false;
          return;
        }

        map.invalidateSize({
          animate: false,
          pan: false
        });

        if (refitWhenRevealed && wasHidden && latestFitPointsRef.current.length) {
          const latestCurrentPoint = latestCurrentPointRef.current;

          if (latestFollowCurrentLocationRef.current && latestCurrentPoint) {
            map.setView(latestCurrentPoint, 17, {
              animate: false
            });
          } else {
            fitLeafletMapToPoints(
              map,
              latestFitPointsRef.current,
              latestFitZoomRef.current
            );
          }
        }

        hadRenderableSizeRef.current = true;
      }, delay);

      resizeTimersRef.current.push(timerId);
    });
  }

  function handleLocateSubject() {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (subjectFitPoints.length) {
      fitLeafletMapToPoints(map, subjectFitPoints, currentPoint ? 17 : 16);
    }
  }

  async function handleRecenter() {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (!onRequestAdminLocation) {
      handleLocateSubject();
      return;
    }

    let nextFitPoints = fitPoints;
    let nextAdminPoint = adminPoint;

    const requestedLocation = await onRequestAdminLocation();
    const requestedPoint = toLatLng(requestedLocation);

    if (requestedPoint) {
      nextAdminPoint = requestedPoint;
      nextFitPoints = [...subjectFitPoints, requestedPoint];
    }

    if (!nextAdminPoint) {
      return;
    }

    if (nextAdminPoint && nextFitPoints.length > 1) {
      fitLeafletMapToPoints(map, nextFitPoints, 15);
      return;
    }

    if (currentPoint) {
      map.flyTo(currentPoint, 17, {
        duration: 0.45
      });
      return;
    }

    fitLeafletMapToPoints(map, nextFitPoints, 16);
  }

  useEffect(() => {
    latestFitPointsRef.current = fitPoints;
    latestFitZoomRef.current = currentPoint ? (adminPoint ? 15 : 17) : 16;
    latestCurrentPointRef.current = currentPoint;
    latestFollowCurrentLocationRef.current = followCurrentLocation;
  }, [adminPoint, currentPoint, fitPoints, followCurrentLocation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const map = createLeafletMap(containerRef.current, indiaCenter, 5);
    const tileLayer = createLeafletTileLayer();

    tileLayer.on("tileerror", () => {
      setMapError(buildLeafletMapError());
    });

    tileLayer.on("load", () => {
      setMapError("");
    });

    tileLayer.addTo(map);
    mapRef.current = map;
    tileLayerRef.current = tileLayer;
    setMapReady(true);

    scheduleMapResize({
      refitWhenRevealed: true
    });

    return () => {
      clearScheduledMapResizes();
      adminAccuracyCircleRef.current?.remove();
      adminMarkerRef.current?.remove();
      accuracyCircleRef.current?.remove();
      markerRef.current?.remove();
      routeLayerRef.current?.remove();
      tileLayerRef.current?.remove();
      map.remove();
      adminAccuracyCircleRef.current = null;
      adminMarkerRef.current = null;
      accuracyCircleRef.current = null;
      markerRef.current = null;
      routeLayerRef.current = null;
      tileLayerRef.current = null;
      mapRef.current = null;
      hadRenderableSizeRef.current = false;
      hasInitialFitRef.current = false;
      lastStaticFitSignatureRef.current = "";
      lastFocusRef.current = null;
      setMapReady(false);
      setMapError("");
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map) {
      return;
    }

    const routePoints = trailPoints.map((location) => toLatLng(location)).filter(Boolean);

    routeLayerRef.current?.remove();
    routeLayerRef.current = null;

    if (routePoints.length > 1) {
      routeLayerRef.current = L.polyline(routePoints, {
        color: markerTone === "jade" ? "#38c89b" : markerTone === "rose" ? "#fb7185" : "#f3bc52",
        weight: 5,
        opacity: 0.86,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);
    }

    const currentFocusToken =
      focusSequence ||
      currentLocation?.trackedAt ||
      currentLocation?.capturedAt ||
      `${currentPoint?.[0] ?? ""}:${currentPoint?.[1] ?? ""}`;

    if (followCurrentLocation && currentPoint && !adminPoint) {
      const shouldRefocus = lastFocusRef.current !== currentFocusToken;
      lastFocusRef.current = currentFocusToken;
      const mapCenter = map.getCenter?.();
      const centerDriftMeters = mapCenter
        ? getDistanceMeters(
            {
              latitude: mapCenter.lat,
              longitude: mapCenter.lng
            },
            {
              latitude: currentPoint[0],
              longitude: currentPoint[1]
            }
          )
        : Number.POSITIVE_INFINITY;

      if (shouldRefocus) {
        map.setView(currentPoint, 17, {
          animate: false
        });
      } else if (centerDriftMeters > 12 || map.getZoom?.() < 16.5) {
        map.flyTo(currentPoint, 17, {
          duration: 0.45
        });
      }

      return;
    }

    const normalizedPoints = fitPoints;
    const staticFitSignature = `${focusSequence}|${normalizedPoints
      .map((point) => `${Number(point[0]).toFixed(5)},${Number(point[1]).toFixed(5)}`)
      .join("|")}`;
    const shouldFitStaticMap =
      (!hasInitialFitRef.current && normalizedPoints.length > 0) ||
      lastStaticFitSignatureRef.current !== staticFitSignature;

    if (shouldFitStaticMap) {
      fitLeafletMapToPoints(map, normalizedPoints, currentPoint && !adminPoint ? 16 : 15);
      hasInitialFitRef.current = true;
      lastStaticFitSignatureRef.current = staticFitSignature;
    }
  }, [
    currentLocation,
    currentPoint,
    focusSequence,
    followCurrentLocation,
    adminPoint,
    fitPoints,
    mapPoints,
    mapReady,
    markerTone,
    trailPoints
  ]);

  useEffect(() => {
    const map = mapRef.current;

    markerRef.current?.remove();
    accuracyCircleRef.current?.remove();
    markerRef.current = null;
    accuracyCircleRef.current = null;

    if (!mapReady || !map || !currentPoint) {
      return;
    }

    markerRef.current = L.marker(currentPoint, {
      icon: createLeafletDivIcon(markerLabel, markerTone, "pinpoint"),
      keyboard: false
    })
      .bindPopup(
        buildLeafletPopupHtml({
          title,
          subtitle,
          meta: [
            uniqueDisplayValues(subtitle, currentLocation?.zoneDetail)[1] || null,
            ...subjectMeta.filter(Boolean),
            currentLocation?.dutyLabel ? `Duty label: ${currentLocation.dutyLabel}` : null,
            currentLocation?.trackedAt ? `Tracked ${currentLocation.trackedAt}` : null,
            accuracyRadiusMeters ? `Approximate within ${accuracyRadiusMeters}m` : null
          ]
        }),
        {
          offset: [0, -32]
        }
      )
      .addTo(map);

    if (accuracyRadiusMeters > 0) {
      accuracyCircleRef.current = L.circle(currentPoint, {
        radius: accuracyRadiusMeters,
        color: "rgba(59, 130, 246, 0.36)",
        fillColor: "rgba(59, 130, 246, 0.14)",
        fillOpacity: 0.55,
        weight: 1
      }).addTo(map);
    }

    return () => {
      markerRef.current?.remove();
      accuracyCircleRef.current?.remove();
      markerRef.current = null;
      accuracyCircleRef.current = null;
    };
  }, [
    accuracyRadiusMeters,
    currentLocation?.trackedAt,
    currentPoint,
    mapReady,
    markerLabel,
    markerTone,
    subtitle,
    subjectMeta,
    title
  ]);

  useEffect(() => {
    const map = mapRef.current;

    adminMarkerRef.current?.remove();
    adminAccuracyCircleRef.current?.remove();
    adminMarkerRef.current = null;
    adminAccuracyCircleRef.current = null;

    if (!mapReady || !map || !adminPoint) {
      return;
    }

    adminMarkerRef.current = L.marker(adminPoint, {
      icon: createLeafletDivIcon("ME", "slate", "pinpoint", {
        offsetX: 24,
        offsetY: -6
      }),
      keyboard: false,
      zIndexOffset: 1400
    })
      .bindPopup(
        buildLeafletPopupHtml({
          title: "My position",
          subtitle: adminLocationLabel,
          meta: [
            adminDistanceLabel || null,
            adminAccuracyRadiusMeters
              ? `Approximate within ${formatDistanceMeters(adminAccuracyRadiusMeters)}`
              : null,
            adminLocation?.capturedAt ? `Updated ${formatRelative(adminLocation.capturedAt)}` : null,
            formatCoordinates(adminLocation)
          ]
        }),
        {
          offset: [0, -32]
        }
      )
      .addTo(map);

    if (adminAccuracyRadiusMeters > 0) {
      adminAccuracyCircleRef.current = L.circle(adminPoint, {
        radius: adminAccuracyRadiusMeters,
        color: "rgba(148, 163, 184, 0.42)",
        fillColor: "rgba(15, 23, 42, 0.15)",
        fillOpacity: 0.5,
        weight: 1
      }).addTo(map);
    }

    return () => {
      adminMarkerRef.current?.remove();
      adminAccuracyCircleRef.current?.remove();
      adminMarkerRef.current = null;
      adminAccuracyCircleRef.current = null;
    };
  }, [
    adminAccuracyRadiusMeters,
    adminDistanceLabel,
    adminLocation,
    adminLocation?.capturedAt,
    adminLocationLabel,
    adminPoint,
    mapReady
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map) {
      return;
    }

    scheduleMapResize();
  }, [mapReady, currentPoint, focusSequence, theme]);

  useEffect(() => {
    if (!mapReady) {
      return undefined;
    }

    const handleViewportChange = () => {
      scheduleMapResize({
        refitWhenRevealed: true
      });
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleViewportChange();
      }
    };
    const ResizeObserverConstructor = window.ResizeObserver;
    const observer = ResizeObserverConstructor
      ? new ResizeObserverConstructor(handleViewportChange)
      : null;

    if (containerRef.current) {
      observer?.observe(containerRef.current);
    }

    if (shellRef.current) {
      observer?.observe(shellRef.current);
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    window.addEventListener("sentinel:layout-ready", handleViewportChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleViewportChange();

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      window.removeEventListener("sentinel:layout-ready", handleViewportChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mapReady]);

  return (
    <div
      ref={shellRef}
      className={`security-map-shell security-map-shell--${theme} ${heightClass}`}
    >
      <div className="security-map-overlay left-4 top-4 inline-flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_0_6px_rgba(52,211,153,0.18)]" />
        {followCurrentLocation && currentPoint ? "Live guard position" : "Awaiting live location"}
      </div>
      <button
        type="button"
        onClick={handleRecenter}
        className="security-map-recenter-button"
        disabled={adminLocationLoading}
      >
        <LocateFixed className="h-4 w-4" />
        {adminLocationLoading
          ? "Locating position"
          : onRequestAdminLocation
            ? "My Position"
            : followCurrentLocation
              ? "Current location"
              : "Recenter"}
      </button>
      {onRequestAdminLocation && (
        <button
          type="button"
          onClick={handleLocateSubject}
          className="security-map-guard-button disabled:cursor-not-allowed disabled:opacity-70"
          disabled={!subjectFitPoints.length}
        >
          <MapPinned className="h-4 w-4" />
          Locate Guard
        </button>
      )}
      {adminPoint && (
        <div className="security-map-overlay bottom-4 left-4 inline-flex items-center gap-2">
          <LocateFixed className="h-3.5 w-3.5 text-slate-200" />
          {adminDistanceLabel || "Position locked"}
        </div>
      )}
      <div ref={containerRef} className="security-map" />
      {mapError && (
        <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs app-error-copy backdrop-blur">
          {mapError}
        </div>
      )}
      {!mapPoints.length && !adminPoint && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35 px-8 text-center text-sm app-copy-soft">
          Live location will appear here after the device shares its first tracked position.
        </div>
      )}
    </div>
  );
}
