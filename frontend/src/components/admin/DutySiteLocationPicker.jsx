import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Loader2, MapPin, Search, Target } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { searchDutySiteLocations } from "../../services/adminService";
import { getStoredDeviceLocation, readBestAvailableDeviceContext } from "../../utils/device";
import { formatCoordinates } from "../../utils/format";
import {
  buildLeafletMapError,
  createLeafletDivIcon,
  createLeafletMap,
  createLeafletTileLayer,
  fitLeafletMapToPoints
} from "../../utils/leafletMaps";
import StatusBadge from "../StatusBadge";

const defaultCenter = [15.4909, 73.8278];
const defaultZoom = 13;
const storedMapCenterMaxAgeMs = 30 * 60_000;

function parseCoordinate(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getPointFromValue(value = {}) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const latitude = parseCoordinate(value.latitude);
  const longitude = parseCoordinate(value.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return [latitude, longitude];
}

function getPointFromLocation(location = {}) {
  if (!location || typeof location !== "object") {
    return null;
  }

  const latitude = parseCoordinate(location.latitude);
  const longitude = parseCoordinate(location.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return [latitude, longitude];
}

function getStoredMapPoint() {
  return getPointFromLocation(getStoredDeviceLocation(storedMapCenterMaxAgeMs));
}

function formatCoordinateInput(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(6) : "";
}

function buildLocationPatch(location, currentValue = {}) {
  return {
    name: currentValue.name || location.name || "",
    area: location.area || currentValue.area || "",
    address: location.address || currentValue.address || "",
    latitude: formatCoordinateInput(location.latitude),
    longitude: formatCoordinateInput(location.longitude)
  };
}

function canUseLeafletMap(map) {
  const container = map?.getContainer?.();
  return Boolean(map && container && container.isConnected);
}

function safelyResizeMap(map) {
  if (!canUseLeafletMap(map)) {
    return false;
  }

  try {
    map.invalidateSize();
    return true;
  } catch {
    return false;
  }
}

function safelySetMapView(map, point, zoom) {
  if (!safelyResizeMap(map)) {
    return;
  }

  try {
    map.setView(point, zoom, { animate: false });
  } catch {
    // Leaflet can throw while mobile panels are being mounted or hidden.
  }
}

function safelyFitMapToPoints(map, points, zoom) {
  if (!safelyResizeMap(map)) {
    return;
  }

  try {
    fitLeafletMapToPoints(map, points, zoom);
  } catch {
    // Keep the form usable even if Leaflet is between layout passes.
  }
}

export default function DutySiteLocationPicker({ value = {}, onChange }) {
  const { theme } = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const initialCenterRef = useRef(null);
  const pendingTimeoutsRef = useRef([]);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedResultId, setSelectedResultId] = useState("");
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [helperText, setHelperText] = useState("Search a place or tap the map to set the duty site point.");

  const selectedPoint = useMemo(() => getPointFromValue(value), [value.latitude, value.longitude]);

  if (!initialCenterRef.current) {
    initialCenterRef.current = selectedPoint || getStoredMapPoint() || defaultCenter;
  }

  function scheduleMapTask(callback, delay) {
    const timeoutId = window.setTimeout(() => {
      pendingTimeoutsRef.current = pendingTimeoutsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delay);

    pendingTimeoutsRef.current.push(timeoutId);
  }

  function resizeMapView(point = selectedPoint, delays = [0, 120, 360, 800]) {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    delays.forEach((delay) => {
      scheduleMapTask(() => {
        if (mapRef.current !== map || !safelyResizeMap(map)) {
          return;
        }

        if (point) {
          safelyFitMapToPoints(map, [point], 17);
        }
      }, delay);
    });
  }

  function centerMapView(point = initialCenterRef.current || defaultCenter, zoom = defaultZoom, delays = [0, 120, 360, 800]) {
    const map = mapRef.current;

    if (!map || !Array.isArray(point) || !point.every(Number.isFinite)) {
      return;
    }

    delays.forEach((delay) => {
      scheduleMapTask(() => {
        if (mapRef.current !== map) {
          return;
        }

        safelySetMapView(map, point, zoom);
      }, delay);
    });
  }

  useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
  }, [onChange, value]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    try {
      const initialCenter = initialCenterRef.current || selectedPoint || defaultCenter;
      const map = createLeafletMap(containerRef.current, initialCenter, selectedPoint ? 16 : defaultZoom);
      createLeafletTileLayer().addTo(map);

      map.on("click", (event) => {
        const latitude = formatCoordinateInput(event.latlng.lat);
        const longitude = formatCoordinateInput(event.latlng.lng);

        onChangeRef.current?.({
          ...valueRef.current,
          latitude,
          longitude
        });
        setSelectedResultId("");
        setHelperText("Map point selected. Confirm the name, area, and address before saving.");
      });

      mapRef.current = map;
      setMapReady(true);
      centerMapView(initialCenter, selectedPoint ? 16 : defaultZoom, [80, 250, 700]);

      return () => {
        pendingTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
        pendingTimeoutsRef.current = [];
        map.remove();
        mapRef.current = null;
        markerRef.current = null;
      };
    } catch {
      setMapError(buildLeafletMapError());
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady || !containerRef.current) {
      return undefined;
    }

    const map = mapRef.current;
    const resizeMap = () => {
      if (mapRef.current !== map || !safelyResizeMap(map)) {
        return;
      }

      if (selectedPoint) {
        safelyFitMapToPoints(map, [selectedPoint], 17);
      }
    };
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resizeMap) : null;
    const resizeTimeouts = [80, 300, 900].map((delay) => window.setTimeout(resizeMap, delay));

    resizeObserver?.observe(containerRef.current);
    resizeMap();

    return () => {
      resizeObserver?.disconnect();
      resizeTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [mapReady, results.length, selectedPoint]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) {
      return;
    }

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (!selectedPoint) {
      return;
    }

    try {
      markerRef.current = L.marker(selectedPoint, {
        icon: createLeafletDivIcon("SITE", "jade", "pinpoint")
      }).addTo(mapRef.current);
      safelyFitMapToPoints(mapRef.current, [selectedPoint], 17);
    } catch {
      markerRef.current = null;
    }
  }, [mapReady, selectedPoint]);

  async function handleSearch(event) {
    event?.preventDefault?.();
    const searchQuery = query.trim();

    if (searchQuery.length < 3) {
      setHelperText("Type at least 3 characters to search a place.");
      setResults([]);
      resizeMapView();
      return;
    }

    setLoading(true);
    setHelperText("Searching places...");

    try {
      const response = await searchDutySiteLocations(searchQuery);
      const locations = response.locations || [];
      setResults(locations);
      setHelperText(locations.length ? "Select the best match below." : "No places found. Try a more specific name.");

      const resultPoints = locations
        .map((location) => getPointFromLocation(location))
        .filter(Boolean);

      if (resultPoints.length && mapRef.current) {
        const map = mapRef.current;
        scheduleMapTask(() => {
          if (mapRef.current === map) {
            safelyFitMapToPoints(map, resultPoints, 13);
          }
        }, 120);
      } else {
        centerMapView(initialCenterRef.current || defaultCenter, defaultZoom, [120, 360]);
      }
    } catch {
      setResults([]);
      setHelperText("Place search is unavailable. You can still tap the map or enter coordinates manually.");
      centerMapView(selectedPoint || initialCenterRef.current || defaultCenter, selectedPoint ? 17 : defaultZoom, [120, 360]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUseCurrentLocation() {
    setGpsLoading(true);
    setHelperText("Reading current GPS position...");

    try {
      const location = await readBestAvailableDeviceContext({
        forceFresh: true,
        timeout: 15_000,
        maxPositionAgeMs: 60_000,
        storedMaxAgeMs: 0
      });
      const latitude = formatCoordinateInput(location.latitude);
      const longitude = formatCoordinateInput(location.longitude);
      const point = [Number(latitude), Number(longitude)];

      onChange?.({
        ...value,
        latitude,
        longitude
      });
      setSelectedResultId("");
      setHelperText("Current GPS applied. Confirm the duty site name and address before saving.");

      if (mapRef.current && point.every(Number.isFinite)) {
        initialCenterRef.current = point;
        centerMapView(point, 17);
      }
    } catch (error) {
      setHelperText(error?.message || "GPS is unavailable. Search a place or tap the map instead.");
    } finally {
      setGpsLoading(false);
    }
  }

  function handleApplyLocation(location) {
    onChange?.({
      ...value,
      ...buildLocationPatch(location, value)
    });
    setSelectedResultId(location.id);
    setHelperText("Place applied. Review details, then save the duty site.");

    const point = [Number(location.latitude), Number(location.longitude)];

    if (mapRef.current && point.every(Number.isFinite)) {
      initialCenterRef.current = point;
      centerMapView(point, 17);
    }
  }

  return (
    <div className="space-y-4 rounded-[22px] border border-white/10 bg-white/5 p-4 sm:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] app-copy-soft">Site location</p>
          <h3 className="mt-1 font-display text-lg font-semibold app-copy-primary">
            Search or choose on map
          </h3>
          <p className="mt-1 text-sm app-copy-muted">
            Coordinates are filled automatically after selection.
          </p>
        </div>
        <StatusBadge status={selectedPoint ? "point set" : "select point"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <span className="app-label">Search place name first</span>
          <Search className="pointer-events-none absolute bottom-3.5 left-4 h-4 w-4 app-copy-soft" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSearch();
              }
            }}
            className="app-input pl-11"
            placeholder="Search office, area, landmark, or client site"
          />
        </label>
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="app-outline-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:self-end"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={gpsLoading}
          className="app-outline-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:self-end"
        >
          {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
          Use GPS
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm app-copy-muted">
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-jade-500" />
          <span>{helperText}</span>
        </div>
      </div>

      {results.length ? (
        <div className="grid gap-2">
          {results.map((location) => {
            const active = selectedResultId === location.id;

            return (
              <button
                key={location.id}
                type="button"
                onClick={() => handleApplyLocation(location)}
                className={`rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-jade-300/45 bg-jade-300/10"
                    : "border-white/10 bg-white/5 hover:-translate-y-0.5 hover:bg-white/10"
                }`}
              >
                <span className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-jade-500" />
                  <span>
                    <span className="block text-sm font-semibold app-copy-primary">
                      {location.name}
                    </span>
                    <span className="mt-1 block text-xs app-copy-muted">
                      {[location.area, location.address].filter(Boolean).join(" - ")}
                    </span>
                    <span className="mt-2 block text-[11px] uppercase tracking-[0.18em] app-copy-soft">
                      {formatCoordinates(location)}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={`security-map-shell security-map-shell--${theme} min-h-[16rem] sm:min-h-[18rem]`}>
        <div ref={containerRef} className="security-map h-[16rem] min-h-[16rem] sm:h-[18rem] sm:min-h-[18rem]" />
        <div className="security-map-overlay left-4 top-4 inline-flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5" />
          Tap map to pin exact site
        </div>
        {mapError ? (
          <div className="security-map-overlay bottom-4 left-4 inline-flex max-w-[calc(100%-2rem)] items-center gap-2 text-rose-500">
            {mapError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
