import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Crosshair, LocateFixed, MapPinned, Search } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import {
  formatCoordinates,
  formatDateTime,
  formatRelative,
  getLocationDisplayLines,
  initials
} from "../../utils/format";
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
const markerCollisionPrecision = 3;

function getMarkerCollisionKey(guard) {
  const location = guard.latestLocation;

  if (!hasCoordinates(location)) {
    return guard.id;
  }

  return `${Number(location.latitude).toFixed(markerCollisionPrecision)}:${Number(location.longitude).toFixed(markerCollisionPrecision)}`;
}

function buildMarkerGroups(guards) {
  const groups = new Map();

  guards.forEach((guard) => {
    const key = getMarkerCollisionKey(guard);
    const point = toLatLng(guard.latestLocation);
    const group = groups.get(key) || {
      key,
      point,
      guards: []
    };

    group.guards.push(guard);
    groups.set(key, group);
  });

  return Array.from(groups.values());
}

function getMarkerGroupTone(group, selectedGuard) {
  if (group.guards.some((guard) => guard.id === selectedGuard?.id)) {
    return "gold";
  }

  if (group.guards.some((guard) => guard.shiftState === "On Duty")) {
    return "jade";
  }

  if (group.guards.every((guard) => guard.status === "inactive")) {
    return "rose";
  }

  return "slate";
}

function buildMarkerGroupPopupHtml(group) {
  const primaryGuard = group.guards[0];
  const location = primaryGuard.latestLocation;
  const guardLines = group.guards.map(
    (guard) => `${guard.fullName} - ${guard.employeeCode || "No code"} - ${guard.shiftState}`
  );

  return buildLeafletPopupHtml({
    title:
      group.guards.length > 1
        ? `${group.guards.length} guards at this location`
        : primaryGuard.fullName,
    subtitle: getLocationDisplayLines(location)[0] || "Field zone",
    meta: [
      getLocationDisplayLines(location)[1] || null,
      group.guards.length > 1 ? "Select an exact guard from the shared-location panel." : null,
      ...guardLines,
      location?.dutyLabel ? `Duty label: ${location.dutyLabel}` : null,
      formatCoordinates(location),
      location?.trackedAt ? formatDateTime(location.trackedAt) : null
    ]
  });
}

function matchesGuardSearch(guard, query) {
  if (!query) {
    return true;
  }

  return [
    guard.fullName,
    guard.email,
    guard.employeeCode,
    guard.shiftLabel,
    guard.shiftState,
    guard.status,
    guard.latestLocation?.address,
    guard.latestLocation?.zoneDetail,
    guard.latestLocation?.dutyLabel,
    formatCoordinates(guard.latestLocation)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export default function GuardPositionMap({ guards = [], selectedGuardId, onSelectGuard }) {
  const { theme } = useTheme();
  const shellRef = useRef(null);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const resizeTimersRef = useRef([]);
  const latestFitPointsRef = useRef([]);
  const latestFitZoomRef = useRef(16);
  const hadRenderableSizeRef = useRef(false);
  const hasAutoFocusedRef = useRef(false);
  const lastAutoFocusedGuardIdRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [mapSearch, setMapSearch] = useState("");
  const [activeSharedGroupKey, setActiveSharedGroupKey] = useState("");

  const locatedGuards = useMemo(
    () => guards.filter((guard) => hasCoordinates(guard.latestLocation)),
    [guards]
  );
  const normalizedMapSearch = mapSearch.trim().toLowerCase();
  const visibleLocatedGuards = useMemo(
    () => locatedGuards.filter((guard) => matchesGuardSearch(guard, normalizedMapSearch)),
    [locatedGuards, normalizedMapSearch]
  );
  const selectedGuard =
    (normalizedMapSearch
      ? visibleLocatedGuards.find((guard) => guard.id === selectedGuardId)
      : locatedGuards.find((guard) => guard.id === selectedGuardId)) ||
    visibleLocatedGuards[0] ||
    locatedGuards[0] ||
    null;
  const selectedTrail = useMemo(
    () => dedupeLocations(selectedGuard?.recentLocations || []).reverse(),
    [selectedGuard]
  );
  const selectedTrailPoints = useMemo(
    () => selectedTrail.map(toLatLng).filter(Boolean),
    [selectedTrail]
  );
  const markerPoints = useMemo(
    () => visibleLocatedGuards.map((guard) => toLatLng(guard.latestLocation)).filter(Boolean),
    [visibleLocatedGuards]
  );
  const markerGroups = useMemo(
    () => buildMarkerGroups(visibleLocatedGuards),
    [visibleLocatedGuards]
  );
  const activeSharedGroup = useMemo(
    () =>
      markerGroups.find(
        (group) => group.key === activeSharedGroupKey && group.guards.length > 1
      ),
    [activeSharedGroupKey, markerGroups]
  );

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
          fitLeafletMapToPoints(
            map,
            latestFitPointsRef.current,
            latestFitZoomRef.current
          );
        }

        hadRenderableSizeRef.current = true;
      }, delay);

      resizeTimersRef.current.push(timerId);
    });
  }

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
    latestFitPointsRef.current = selectedTrailPoints.length
      ? [...markerPoints, ...selectedTrailPoints]
      : markerPoints;
    latestFitZoomRef.current = markerPoints.length > 1 ? 15 : 16;
  }, [markerPoints, selectedTrailPoints]);

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

    scheduleMapResize();

    return () => {
      clearScheduledMapResizes();
      routeLayerRef.current?.remove();
      markersLayer.clearLayers();
      tileLayer.remove();
      map.remove();
      routeLayerRef.current = null;
      markersLayerRef.current = null;
      tileLayerRef.current = null;
      mapRef.current = null;
      hadRenderableSizeRef.current = false;
      hasAutoFocusedRef.current = false;
      lastAutoFocusedGuardIdRef.current = "";
      setMapReady(false);
      setMapError("");
    };
  }, []);

  useEffect(() => {
    if (!activeSharedGroupKey) {
      return;
    }

    if (!activeSharedGroup) {
      setActiveSharedGroupKey("");
    }
  }, [activeSharedGroup, activeSharedGroupKey]);

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

    markerGroups.forEach((group) => {
      const primaryGuard = group.guards[0];
      const selectedGroupGuard =
        group.guards.find((guard) => guard.id === selectedGuard?.id) || primaryGuard;
      const isGrouped = group.guards.length > 1;
      const tone = getMarkerGroupTone(group, selectedGuard);
      const label = isGrouped ? `+${group.guards.length}` : initials(primaryGuard.fullName);

      const marker = L.marker(group.point, {
        icon: createLeafletDivIcon(label, tone, isGrouped ? "cluster" : "default"),
        keyboard: false,
        zIndexOffset: group.guards.some((guard) => guard.id === selectedGuard?.id) ? 1200 : 200
      })
        .bindPopup(buildMarkerGroupPopupHtml(group), {
          offset: [0, -22]
        })
        .on("click", () => {
          if (isGrouped) {
            setActiveSharedGroupKey(group.key);
            return;
          }

          setActiveSharedGroupKey("");
          onSelectGuard?.(selectedGroupGuard.id);
        });

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
  }, [
    mapReady,
    markerGroups,
    markerPoints,
    onSelectGuard,
    selectedGuard,
    selectedTrailPoints
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map) {
      return;
    }

    scheduleMapResize();
  }, [mapReady, theme, selectedGuardId, visibleLocatedGuards.length]);

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
    <div className="space-y-4">
      <div className="app-surface-soft rounded-[22px] p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 app-copy-soft" />
            <input
              value={mapSearch}
              onChange={(event) => setMapSearch(event.target.value)}
              placeholder="Search guard name, employee code, duty label, or live zone..."
              className="app-input pl-11 text-sm"
            />
          </label>
          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <p className="text-xs uppercase tracking-[0.2em] app-copy-soft">
              {normalizedMapSearch
                ? `${visibleLocatedGuards.length} of ${locatedGuards.length} visible`
                : `${locatedGuards.length} tracked guard${locatedGuards.length === 1 ? "" : "s"}`}
            </p>
            {mapSearch && (
              <button
                type="button"
                onClick={() => setMapSearch("")}
                className="app-outline-button rounded-2xl px-3 py-2 text-xs font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        ref={shellRef}
        className={`relative security-map-shell security-map-shell--${theme} h-[19rem] sm:h-[23rem] xl:h-[26rem]`}
      >
        <div className="security-map-overlay left-3 top-3 inline-flex items-center gap-2 sm:left-4 sm:top-4">
          <Crosshair className="h-3.5 w-3.5 text-gold-200" />
          Live security route map
        </div>
        <div className="security-map-overlay left-3 top-14 inline-flex items-center gap-2 sm:left-auto sm:right-4 sm:top-4">
          <MapPinned className="h-3.5 w-3.5 text-jade-200" />
          {normalizedMapSearch
            ? `${visibleLocatedGuards.length}/${locatedGuards.length} tracked`
            : `${locatedGuards.length} tracked guard${locatedGuards.length === 1 ? "" : "s"}`}
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
        {!visibleLocatedGuards.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35 px-8 text-center text-sm app-copy-soft">
            {locatedGuards.length
              ? "No tracked guards match this map search."
              : "Guard positions will appear here after a shift selfie, check-in, or live location sync stores a tracked point."}
          </div>
        )}
      </div>

      {activeSharedGroup && (
        <div className="app-surface-soft rounded-[24px] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold app-copy-primary">
                Shared location selector
              </p>
              <p className="mt-1 text-xs app-copy-muted">
                {activeSharedGroup.guards.length} guards are at{" "}
                {activeSharedGroup.guards[0]?.latestLocation?.address || "this live point"}.
                Select the exact guard to open their detail panel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSharedGroupKey("")}
              className="app-outline-button w-fit rounded-2xl px-3 py-2 text-xs font-medium"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {activeSharedGroup.guards.map((guard) => {
              const isSelected = guard.id === selectedGuardId;

              return (
                <button
                  key={guard.id}
                  type="button"
                  onClick={() => onSelectGuard?.(guard.id)}
                  className={`rounded-[20px] border p-3.5 text-left transition ${
                    isSelected
                      ? "border-gold-300/50 bg-gold-300/12"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium app-copy-primary">{guard.fullName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] app-copy-soft">
                        {guard.employeeCode || "No code"} - {guard.shiftState}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-900/70 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                      {formatRelative(guard.latestLocation?.trackedAt)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm app-copy-muted">
                    {guard.latestLocation?.dutyLabel || guard.shiftLabel || "No duty label"}
                  </p>
                  <p className="mt-2 text-xs app-copy-soft">
                    {formatCoordinates(guard.latestLocation)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleLocatedGuards.slice(0, 6).map((guard) => {
          const isSelected = guard.id === selectedGuard?.id;
          const zoneLines = getLocationDisplayLines(guard.latestLocation);
          const zoneTitle = zoneLines[0] || "Live zone unavailable";
          const zoneDetail = zoneLines[1] || null;

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
                {zoneTitle}
              </p>
              {zoneDetail ? (
                <p className="mt-2 text-xs text-slate-500">{zoneDetail}</p>
              ) : (
                !guard.latestLocation && (
                  <p className="mt-2 text-xs text-slate-500">
                    GPS live zone detail unavailable
                  </p>
                )
              )}
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
        {!visibleLocatedGuards.length && (
          <div className="app-surface-soft rounded-[22px] p-4 text-sm app-copy-soft md:col-span-2 xl:col-span-3">
            No guard cards match this map search.
          </div>
        )}
      </div>
    </div>
  );
}
