import L from "leaflet";

const openStreetMapTileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const openStreetMapAttribution = "&copy; OpenStreetMap contributors";

export function createLeafletMap(container, center = [20.5937, 78.9629], zoom = 5) {
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true
  });

  map.setView(center, zoom, {
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
    maxZoom: 20,
    crossOrigin: true
  });
}

export function createLeafletDivIcon(label, tone = "gold", variant = "default") {
  const className = `security-map-marker security-map-marker--${tone} security-map-marker--${variant}`;

  const html =
    variant === "pinpoint"
      ? `
        <span class="security-map-marker__pulse"></span>
        <span class="security-map-marker__center"></span>
        <span class="security-map-marker__label">${label}</span>
      `
      : `<span class="security-map-marker__dot">${label}</span>`;

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

  map.fitBounds(points, {
    padding: [56, 56],
    maxZoom: zoom,
    animate: true
  });
}

export function buildLeafletMapError() {
  return "Map tiles could not load. Refresh the page and check your internet connection.";
}
