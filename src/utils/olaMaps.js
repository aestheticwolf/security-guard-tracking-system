import { OlaMaps } from "olamaps-web-sdk";

const olaMapsApiKey = import.meta.env.VITE_OLA_MAPS_API_KEY?.trim() || "";
const lightStyleId =
  import.meta.env.VITE_OLA_MAPS_LIGHT_STYLE_ID?.trim() || "default-light-standard";
const darkStyleId =
  import.meta.env.VITE_OLA_MAPS_DARK_STYLE_ID?.trim() || "default-dark-standard";
const lightStyleUrl = import.meta.env.VITE_OLA_MAPS_LIGHT_STYLE_URL?.trim() || "";
const darkStyleUrl = import.meta.env.VITE_OLA_MAPS_DARK_STYLE_URL?.trim() || "";
const styleVersionQuery = "key=0.4.0";
const styleCache = new Map();

function normalizeStyleUrl(value) {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    if (value.includes("?")) {
      return value;
    }

    return `${value}?${styleVersionQuery}`;
  }

  return `https://api.olamaps.io/tiles/vector/v1/styles/${value}/style.json?${styleVersionQuery}`;
}

export function hasOlaMapsApiKey() {
  return Boolean(olaMapsApiKey);
}

export function getOlaMapsApiKey() {
  return olaMapsApiKey;
}

export function getOlaMapsMissingMessage() {
  return "Add VITE_OLA_MAPS_API_KEY to .env to enable Ola Maps in the dashboards.";
}

export function getOlaMapsAllowedDomainSuggestions() {
  if (typeof window === "undefined") {
    return [];
  }

  const suggestions = new Set();
  const { host, hostname, port } = window.location;

  if (host) {
    suggestions.add(host);
  }

  if (hostname) {
    suggestions.add(hostname);
  }

  if (hostname === "localhost") {
    suggestions.add(`127.0.0.1${port ? `:${port}` : ""}`);
  }

  if (hostname === "127.0.0.1") {
    suggestions.add(`localhost${port ? `:${port}` : ""}`);
  }

  return [...suggestions].filter(Boolean);
}

export function getOlaMapsTileDiagnostic() {
  return "Map tiles could not load. Refresh the page and check your internet connection.";
}

export function getOlaMapsStyleId(theme = "dark") {
  return theme === "light" ? lightStyleId : darkStyleId;
}

export function getOlaMapsStyleUrl(theme = "dark") {
  if (theme === "light" && lightStyleUrl) {
    return normalizeStyleUrl(lightStyleUrl);
  }

  if (theme === "dark" && darkStyleUrl) {
    return normalizeStyleUrl(darkStyleUrl);
  }

  return "";
}

export function buildStableMapStyle(theme = "dark") {
  const tileUrl =
    theme === "light"
      ? "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
      : "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";

  return {
    version: 8,
    sources: {
      "stable-raster": {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors © CARTO"
      }
    },
    layers: [
      {
        id: "stable-raster-base",
        type: "raster",
        source: "stable-raster",
        minzoom: 0,
        maxzoom: 22
      }
    ]
  };
}

function buildStyleFetchUrl(styleUrl) {
  const url = new URL(styleUrl);

  if (olaMapsApiKey && !url.searchParams.has("api_key")) {
    url.searchParams.set("api_key", olaMapsApiKey);
  }

  return url.toString();
}

function sanitizeStyleLayer(layer) {
  if (!layer) {
    return false;
  }

  if (layer.id === "3d_model_data") {
    return false;
  }

  if (layer["source-layer"] === "3d_model") {
    return false;
  }

  return true;
}

function sanitizeStyleDocument(styleDocument) {
  if (!styleDocument || typeof styleDocument !== "object") {
    return styleDocument;
  }

  return {
    ...styleDocument,
    layers: Array.isArray(styleDocument.layers)
      ? styleDocument.layers.filter(sanitizeStyleLayer)
      : styleDocument.layers
  };
}

export async function loadOlaMapsStyle(theme = "dark") {
  const styleUrl = getOlaMapsStyleUrl(theme);

  if (!styleUrl) {
    return buildStableMapStyle(theme);
  }

  const cacheKey = `${theme}:${styleUrl}`;

  if (styleCache.has(cacheKey)) {
    return styleCache.get(cacheKey);
  }

  try {
    const response = await fetch(buildStyleFetchUrl(styleUrl));

    if (!response.ok) {
      throw new Error(`Style request failed with ${response.status}`);
    }

    const styleDocument = await response.json();
    const sanitizedStyle = sanitizeStyleDocument(styleDocument);
    styleCache.set(cacheKey, sanitizedStyle);
    return sanitizedStyle;
  } catch {
    const fallbackStyle = buildStableMapStyle(theme);
    styleCache.set(cacheKey, fallbackStyle);
    return fallbackStyle;
  }
}

export async function waitForOlaMapReady(map) {
  if (!map) {
    return;
  }

  if (map.loaded?.() || map.isStyleLoaded?.()) {
    return;
  }

  await new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(fallbackTimer);
      map.off?.("load", finish);
      map.off?.("styledata", finish);
      map.off?.("idle", finish);
      resolve();
    };

    const fallbackTimer = window.setTimeout(finish, 1500);
    map.on?.("load", finish);
    map.on?.("styledata", finish);
    map.on?.("idle", finish);
  });
}

export function createOlaMapsClient() {
  if (!olaMapsApiKey) {
    return null;
  }

  return new OlaMaps({
    apiKey: olaMapsApiKey
  });
}

export function createOlaMarkerElement(label, tone = "gold", variant = "default") {
  const element = document.createElement("div");
  element.className = `security-map-marker security-map-marker--${tone} security-map-marker--${variant}`;

  if (variant === "pinpoint") {
    element.innerHTML = `
      <span class="security-map-marker__pulse"></span>
      <span class="security-map-marker__center"></span>
      <span class="security-map-marker__label">${label}</span>
    `;
    return element;
  }

  element.innerHTML = `<span class="security-map-marker__dot">${label}</span>`;
  return element;
}

export function buildOlaPopupHtml({ title, subtitle, meta = [] }) {
  const metaHtml = meta
    .filter(Boolean)
    .map((line) => `<p style="margin:4px 0 0;font-size:12px;opacity:0.8;">${line}</p>`)
    .join("");

  return `
    <div style="min-width:180px;padding:2px 0;">
      <p style="margin:0;font-size:14px;font-weight:700;">${title}</p>
      <p style="margin:4px 0 0;font-size:12px;opacity:0.82;">${subtitle}</p>
      ${metaHtml}
    </div>
  `;
}

export function toOlaCoordinates(point) {
  if (!point) {
    return null;
  }

  return [point[1], point[0]];
}

export function toGeoJsonLine(points = []) {
  return {
    type: "FeatureCollection",
    features:
      points.length > 1
        ? [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: points.map(toOlaCoordinates)
              },
              properties: {}
            }
          ]
        : []
  };
}

export function fitOlaMapToPoints(map, points = [], zoom = 16) {
  if (!map || !points.length) {
    return;
  }

  if (points.length === 1) {
    map.flyTo({
      center: toOlaCoordinates(points[0]),
      zoom,
      essential: true
    });
    return;
  }

  const latitudes = points.map(([latitude]) => Number(latitude));
  const longitudes = points.map(([, longitude]) => Number(longitude));

  map.fitBounds(
    [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)]
    ],
    {
      padding: 56,
      maxZoom: zoom,
      duration: 900
    }
  );
}
