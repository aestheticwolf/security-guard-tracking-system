import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { dedupeLocations, getDistanceMeters, hasCoordinates, toLatLng } from "../../utils/geo";
import {
  buildLeafletMapError,
  buildLeafletPopupHtml,
  createLeafletDivIcon,
  createLeafletMap,
  createLeafletTileLayer,
  fitLeafletMapToPoints
} from "../../utils/leafletMaps";

const indiaCenter = [20.5937, 78.9629];

function buildTrailPoints(recentLocations, currentLocation) {
  const trail = dedupeLocations(recentLocations);
  const orderedTrail = [...trail].reverse();

  if (!hasCoordinates(currentLocation)) {
    return orderedTrail;
  }

  if (!orderedTrail.length) {
    return [currentLocation];
  }

  const latestTrailPoint = orderedTrail[orderedTrail.length - 1];

  if (getDistanceMeters(latestTrailPoint, currentLocation) <= 8) {
    return orderedTrail;
  }

  return [...orderedTrail, currentLocation];
}

export default function LiveRouteMap({
  currentLocation,
  recentLocations = [],
  markerLabel = "GU",
  markerTone = "gold",
  title = "Live guard position",
  subtitle = "Awaiting field location sync.",
  focusSequence = 0,
  followCurrentLocation = false,
  heightClass = "h-[22rem]"
}) {
  const { theme } = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const lastFocusRef = useRef(null);
  const hasInitialFitRef = useRef(false);
  const lastStaticFitSignatureRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const trailPoints = useMemo(
    () => buildTrailPoints(recentLocations, currentLocation),
    [recentLocations, currentLocation]
  );
  const currentPoint = toLatLng(currentLocation);
  const mapPoints = currentPoint ? [...trailPoints, currentLocation] : trailPoints;
  const accuracyRadiusMeters =
    currentLocation?.accuracy !== undefined && currentLocation?.accuracy !== null
      ? Math.max(0, Number(currentLocation.accuracy))
      : 0;

  function handleRecenter() {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (currentPoint) {
      map.flyTo(currentPoint, 17, {
        duration: 0.45
      });
      return;
    }

    fitLeafletMapToPoints(
      map,
      mapPoints.map((point) => (Array.isArray(point) ? point : toLatLng(point))).filter(Boolean),
      16
    );
  }

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

    window.requestAnimationFrame(() => {
      map.invalidateSize();

      if (currentPoint) {
        map.setView(currentPoint, 17, {
          animate: false
        });
      }
    });

    return () => {
      accuracyCircleRef.current?.remove();
      markerRef.current?.remove();
      routeLayerRef.current?.remove();
      tileLayerRef.current?.remove();
      map.remove();
      accuracyCircleRef.current = null;
      markerRef.current = null;
      routeLayerRef.current = null;
      tileLayerRef.current = null;
      mapRef.current = null;
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

    if (followCurrentLocation && currentPoint) {
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

    const normalizedPoints = mapPoints
      .map((point) => (Array.isArray(point) ? point : toLatLng(point)))
      .filter(Boolean);
    const staticFitSignature = `${focusSequence}|${normalizedPoints
      .map((point) => `${Number(point[0]).toFixed(5)},${Number(point[1]).toFixed(5)}`)
      .join("|")}`;
    const shouldFitStaticMap =
      (!hasInitialFitRef.current && normalizedPoints.length > 0) ||
      lastStaticFitSignatureRef.current !== staticFitSignature;

    if (shouldFitStaticMap) {
      fitLeafletMapToPoints(map, normalizedPoints, currentPoint ? 16 : 15);
      hasInitialFitRef.current = true;
      lastStaticFitSignatureRef.current = staticFitSignature;
    }
  }, [
    currentLocation,
    currentPoint,
    focusSequence,
    followCurrentLocation,
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
            currentLocation?.zoneDetail && currentLocation.zoneDetail !== subtitle
              ? currentLocation.zoneDetail
              : null,
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
    title
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map) {
      return;
    }

    window.requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }, [mapReady, currentPoint, focusSequence, theme]);

  return (
    <div className={`security-map-shell security-map-shell--${theme} ${heightClass}`}>
      <div className="security-map-overlay left-4 top-4 inline-flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_0_6px_rgba(52,211,153,0.18)]" />
        {followCurrentLocation && currentPoint ? "Live guard position" : "Awaiting live location"}
      </div>
      <button
        type="button"
        onClick={handleRecenter}
        className="security-map-recenter-button"
      >
        <LocateFixed className="h-4 w-4" />
        {followCurrentLocation ? "Current location" : "Recenter"}
      </button>
      <div ref={containerRef} className="security-map" />
      {mapError && (
        <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs text-rose-100 backdrop-blur">
          {mapError}
        </div>
      )}
      {!mapPoints.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35 px-8 text-center text-sm app-copy-soft">
          Live location will appear here after the device shares its first tracked position.
        </div>
      )}
    </div>
  );
}
