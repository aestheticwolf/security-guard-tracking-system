import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Crosshair, LocateFixed, MapPinned } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { formatCoordinates, formatDateTime, formatRelative, initials } from "../../utils/format";
import { dedupeLocations, hasCoordinates, toLatLng } from "../../utils/geo";
import {
  buildLeafletMapError,
  buildLeafletPopupHtml,
  createLeafletDivIcon,
  createLeafletMap,
  createLeafletTileLayer,
  fitLeafletMapToPoints
} from "../../utils/leafletMaps";

const indiaCenter = [20.5937, 78.9629];

export default function GuardPositionMap({ guards = [], selectedGuardId, onSelectGuard }) {
  const { theme } = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const hasAutoFocusedRef = useRef(false);
  const lastAutoFocusedGuardIdRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const locatedGuards = guards.filter((guard) => hasCoordinates(guard.latestLocation));
  const selectedGuard =
    locatedGuards.find((guard) => guard.id === selectedGuardId) || locatedGuards[0] || null;
  const selectedTrail = useMemo(
    () => dedupeLocations(selectedGuard?.recentLocations || []).reverse(),
    [selectedGuard]
  );
  const selectedTrailPoints = selectedTrail.map(toLatLng).filter(Boolean);
  const markerPoints = locatedGuards.map((guard) => toLatLng(guard.latestLocation)).filter(Boolean);

  function handleRecenter() {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (selectedTrailPoints.length) {
      fitLeafletMapToPoints(
        map,
        [...markerPoints, ...selectedTrailPoints],
        markerPoints.length > 1 ? 15 : 16
      );
      return;
    }

    fitLeafletMapToPoints(map, markerPoints, markerPoints.length > 1 ? 15 : 16);
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const map = createLeafletMap(containerRef.current, indiaCenter, 5);
    const tileLayer = createLeafletTileLayer();
    const markersLayer = L.layerGroup();

    tileLayer.on("tileerror", () => {
      setMapError(buildLeafletMapError());
    });

    tileLayer.on("load", () => {
      setMapError("");
    });

    tileLayer.addTo(map);
    markersLayer.addTo(map);

    mapRef.current = map;
    tileLayerRef.current = tileLayer;
    markersLayerRef.current = markersLayer;
    setMapReady(true);

    window.requestAnimationFrame(() => map.invalidateSize());

    return () => {
      routeLayerRef.current?.remove();
      markersLayer.clearLayers();
      tileLayer.remove();
      map.remove();
      routeLayerRef.current = null;
      markersLayerRef.current = null;
      tileLayerRef.current = null;
      mapRef.current = null;
      hasAutoFocusedRef.current = false;
      lastAutoFocusedGuardIdRef.current = "";
      setMapReady(false);
      setMapError("");
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;

    if (!mapReady || !map || !markersLayer) {
      return;
    }

    routeLayerRef.current?.remove();
    routeLayerRef.current = null;
    markersLayer.clearLayers();

    if (selectedTrailPoints.length > 1) {
      routeLayerRef.current = L.polyline(selectedTrailPoints, {
        color: "#f3bc52",
        weight: 5,
        opacity: 0.84,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);
    }

    locatedGuards.forEach((guard) => {
      const point = toLatLng(guard.latestLocation);
      const tone =
        guard.id === selectedGuard?.id
          ? "gold"
          : guard.shiftState === "On Duty"
            ? "jade"
            : guard.status === "inactive"
              ? "rose"
              : "slate";

      const marker = L.marker(point, {
        icon: createLeafletDivIcon(initials(guard.fullName), tone),
        keyboard: false
      })
        .bindPopup(
          buildLeafletPopupHtml({
            title: guard.fullName,
            subtitle: guard.latestLocation?.address || "Field zone",
            meta: [
              guard.latestLocation?.zoneDetail && guard.latestLocation.zoneDetail !== guard.latestLocation.address
                ? guard.latestLocation.zoneDetail
                : null,
              guard.latestLocation?.dutyLabel
                ? `Duty label: ${guard.latestLocation.dutyLabel}`
                : null,
              formatCoordinates(guard.latestLocation),
              `${guard.shiftState} • ${formatRelative(guard.latestLocation?.trackedAt)}`,
              guard.latestLocation?.trackedAt ? formatDateTime(guard.latestLocation.trackedAt) : null
            ]
          }),
          {
            offset: [0, -22]
          }
        )
        .on("click", () => onSelectGuard?.(guard.id));

      markersLayer.addLayer(marker);
    });

    const selectedGuardKey = selectedGuard?.id || "";
    const shouldAutoFocus =
      (!hasAutoFocusedRef.current && markerPoints.length > 0) ||
      (selectedGuardKey && selectedGuardKey !== lastAutoFocusedGuardIdRef.current);

    if (shouldAutoFocus) {
      fitLeafletMapToPoints(
        map,
        selectedTrailPoints.length ? [...markerPoints, ...selectedTrailPoints] : markerPoints,
        markerPoints.length > 1 ? 15 : 16
      );
      hasAutoFocusedRef.current = true;
      lastAutoFocusedGuardIdRef.current = selectedGuardKey;
    } else if (!selectedGuardKey) {
      lastAutoFocusedGuardIdRef.current = "";
    }
  }, [locatedGuards, mapReady, markerPoints, onSelectGuard, selectedGuard, selectedTrailPoints]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map) {
      return;
    }

    window.requestAnimationFrame(() => map.invalidateSize());
  }, [mapReady, theme, selectedGuardId, locatedGuards.length]);

  return (
    <div className="space-y-4">
      <div className={`relative security-map-shell security-map-shell--${theme} h-[19rem] sm:h-[23rem] xl:h-[26rem]`}>
        <div className="security-map-overlay left-3 top-3 inline-flex items-center gap-2 sm:left-4 sm:top-4">
          <Crosshair className="h-3.5 w-3.5 text-gold-200" />
          Live security route map
        </div>
        <div className="security-map-overlay left-3 top-14 inline-flex items-center gap-2 sm:left-auto sm:right-4 sm:top-4">
          <MapPinned className="h-3.5 w-3.5 text-jade-200" />
          {locatedGuards.length} tracked guard{locatedGuards.length === 1 ? "" : "s"}
        </div>
        <button
          type="button"
          onClick={handleRecenter}
          className="security-map-recenter-button"
        >
          <LocateFixed className="h-4 w-4" />
          Selected guard
        </button>
        <div ref={containerRef} className="security-map" />
        {mapError && (
          <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs text-rose-100 backdrop-blur">
            {mapError}
          </div>
        )}
        {!locatedGuards.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35 px-8 text-center text-sm app-copy-soft">
            Guard positions will appear here after a shift selfie, check-in, or live location sync stores a tracked point.
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {locatedGuards.slice(0, 6).map((guard) => {
          const isSelected = guard.id === selectedGuard?.id;

          return (
            <button
              key={guard.id}
              type="button"
              onClick={() => onSelectGuard?.(guard.id)}
              className={`rounded-[22px] border p-3.5 text-left transition sm:p-4 ${
                isSelected
                  ? "border-gold-300/40 bg-gold-300/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-white">{guard.fullName}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                    {guard.employeeCode || "No code"} • {guard.shiftState}
                  </p>
                </div>
                <span className="w-fit rounded-full border border-white/10 bg-slate-900/70 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                  {formatRelative(guard.latestLocation?.trackedAt)}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                {guard.latestLocation?.address || "Live zone unavailable"}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {guard.latestLocation?.zoneDetail || "GPS live zone detail unavailable"}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {formatCoordinates(guard.latestLocation)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Duty label: {guard.latestLocation?.dutyLabel || guard.shiftLabel || "No duty label"}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {guard.latestLocation?.trackedAt
                  ? formatDateTime(guard.latestLocation.trackedAt)
                  : "No tracked time"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
