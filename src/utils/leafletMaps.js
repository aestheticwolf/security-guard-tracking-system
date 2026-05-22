import L from "leaflet";

const openStreetMapTileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const openStreetMapAttribution = "&copy; OpenStreetMap contributors";
const worldTileBounds = [
  [-85.05112878, -180],
  [85.05112878, 180]
];
const minimumCoveredWorldZoom = 1;

export function createLeafletMap(container, center = [20.5937, 78.9629], zoom = 5) {
  const initialZoom = Math.max(zoom, minimumCoveredWorldZoom);
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true,
    minZoom: minimumCoveredWorldZoom,
    maxBounds: worldTileBounds,
    maxBoundsViscosity: 0.9,
    worldCopyJump: true
  });

  map.setView(center, initialZoom, {
    animate: false
  });

  L.control.zoom({
    position: "topright"
  }).addTo(map);

  return map;
}

export function createLeafletTileLayer() {
  return L.tileLayer(openStreetMapTileUrl, {
    attribution: openStreetMapAttribution,
    minZoom: minimumCoveredWorldZoom,
    maxZoom: 20,
    bounds: worldTileBounds,
    crossOrigin: true
  });
}

export function createLeafletDivIcon(label, tone = "gold", variant = "default", options = {}) {
  const className = `security-map-marker security-map-marker--${tone} security-map-marker--${variant}`;
  const offsetX = Number(options.offsetX || 0);
  const offsetY = Number(options.offsetY || 0);
  const offsetStyle = `style="--marker-offset-x:${offsetX}px;--marker-offset-y:${offsetY}px;"`;

  const markerHtml =
    variant === "pinpoint"
      ? `
        <span class="security-map-marker__pulse"></span>
        <span class="security-map-marker__center"></span>
        <span class="security-map-marker__label">${label}</span>
      `
      : `<span class="security-map-marker__dot">${label}</span>`;
  const html = `
    <span class="security-map-marker__offset security-map-marker__offset--${variant}" ${offsetStyle}>
      ${markerHtml}
    </span>
  `;

  return L.divIcon({
    className,
    html,
    iconSize: variant === "pinpoint" ? [54, 62] : [44, 52],
    iconAnchor: variant === "pinpoint" ? [27, 52] : [22, 46],
    popupAnchor: [0, -42]
  });
}

export function buildLeafletPopupHtml({ title, subtitle, meta = [] }) {
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

export function fitLeafletMapToPoints(map, points = [], zoom = 16) {
  if (!map || !points.length) {
    return;
  }

  if (points.length === 1) {
    map.setView(points[0], zoom, {
      animate: true
    });
    return;
  }

  const size = map.getSize?.();
  const paddingX = size?.x ? Math.max(24, Math.min(56, Math.floor(size.x * 0.12))) : 56;
  const paddingY = size?.y ? Math.max(24, Math.min(56, Math.floor(size.y * 0.12))) : 56;

  map.fitBounds(points, {
    padding: [paddingY, paddingX],
    maxZoom: zoom,
    animate: true
  });
}

export function buildLeafletMapError() {
  return "Map tiles could not load. Refresh the page and check your internet connection.";
}
