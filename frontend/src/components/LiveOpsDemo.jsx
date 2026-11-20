import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

/* ── Configuration Data ─────────────────────────────────────────────────────── */

const SITES = [
  { id: "marine", n: "Marine Plaza", x: 140, y: 90 },
  { id: "midc", n: "MIDC Gate 2", x: 460, y: 80 },
  { id: "godown", n: "Godown 7", x: 300, y: 200 }
];

const GEOFENCE_RADIUS = 38;

// Distinct initial positions, route directions & stop offsets so guards never collide
const GUARDS = [
  {
    name: "Rajesh K.",
    x: 180,
    y: 160,
    t: 0,
    hero: true,
    route: [0, 1, 2], // Clockwise: Marine -> MIDC -> Godown
    offsetX: -14,
    offsetY: 0
  },
  {
    name: "Anita D.",
    x: 460,
    y: 80,
    t: 0,
    hero: false,
    route: [1, 0, 2], // Counter: MIDC -> Marine -> Godown
    offsetX: 14,
    offsetY: -8
  },
  {
    name: "Sameer P.",
    x: 350,
    y: 150,
    t: 0,
    hero: false,
    route: [2, 1, 0], // Staggered: Godown -> MIDC -> Marine
    offsetX: 0,
    offsetY: 14
  }
];

const GRID_X = [40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440, 480, 520, 560];
const GRID_Y = [40, 80, 120, 160, 200, 240];

const STEP_CONFIGS = [
  {
    idleText: "Selfie verification",
    doneText: "Selfie verified, 98% match"
  },
  {
    idleText: "GPS inside duty site",
    doneText: "Inside duty site, 12 m from post"
  },
  {
    idleText: "Attendance marked",
    doneText: "Attendance marked"
  }
];

const INITIAL_FEED = [
  {
    id: "init-1",
    name: "North Gate",
    desc: "Shift check-in verified with selfie capture",
    time: "09:12"
  },
  {
    id: "init-2",
    name: "Warehouse Ring",
    desc: "Location sync received from field device",
    time: "09:09"
  },
  {
    id: "init-3",
    name: "Command Center",
    desc: "Roster updated for overnight coverage",
    time: "09:02"
  }
];

export default function LiveOpsDemo() {
  const [steps, setSteps] = useState(["idle", "idle", "idle"]);
  const [currentSiteName, setCurrentSiteName] = useState("En route to site");
  const [isScanning, setIsScanning] = useState(false);
  const [faceOk, setFaceOk] = useState(false);
  const [feed, setFeed] = useState(INITIAL_FEED);
  const [verifiedCount, setVerifiedCount] = useState(41);
  const [clock, setClock] = useState("09:14");

  // SVG group and dot refs for direct DOM transforms
  const guardGroupRefs = useRef([]);
  const guardDotRefs = useRef([]);

  useEffect(() => {
    let mounted = true;
    let animId = null;
    let lastTime = performance.now();
    const timers = [];

    // Clone guards so each mount has independent state
    const guards = GUARDS.map((g) => ({ ...g, busy: false }));

    let simMinutes = 9 * 60 + 14; // starts at 09:14
    const getNextStamp = () => {
      simMinutes += 1 + Math.floor(Math.random() * 2);
      const m = simMinutes % 60;
      const h = Math.floor(simMinutes / 60);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const wait = (ms) =>
      new Promise((resolve) => {
        const id = setTimeout(() => {
          resolve();
        }, ms);
        timers.push(id);
      });

    const addFeedEntry = (name, desc) => {
      if (!mounted) return;
      const time = getNextStamp();
      setClock(time);
      setFeed((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          name,
          desc,
          time
        },
        ...prev.slice(0, 4)
      ]);
    };

    // Hero guard check-in sequence
    const runHeroCheckin = async (guard, site) => {
      if (!mounted) return;
      setCurrentSiteName(site.n);
      addFeedEntry(guard.name, `Arrived at ${site.n}`);

      // Step 1: Selfie verification (1.5s)
      setSteps(["running", "idle", "idle"]);
      setIsScanning(true);
      setFaceOk(false);
      await wait(1500);
      if (!mounted) return;

      // Step 2: GPS check (1.1s)
      setSteps(["done", "running", "idle"]);
      setIsScanning(false);
      setFaceOk(true);
      await wait(1100);
      if (!mounted) return;

      // Step 3: Attendance marked (0.8s)
      setSteps(["done", "done", "running"]);
      await wait(800);
      if (!mounted) return;

      // Completion
      setSteps(["done", "done", "done"]);
      setVerifiedCount((c) => c + 1);
      addFeedEntry(guard.name, `Attendance marked at ${site.n}`);
      await wait(1400);
      if (!mounted) return;

      // Reset for next movement
      setSteps(["idle", "idle", "idle"]);
      setFaceOk(false);
      setCurrentSiteName("En route to site");
      guard.t++;
      guard.busy = false;
    };

    // Patrol guard brief arrival
    const runPatrolArrival = async (guard, site) => {
      if (!mounted) return;
      addFeedEntry(guard.name, `Reached ${site.n}`);
      await wait(2800 + Math.random() * 1400);
      if (!mounted) return;
      guard.t++;
      guard.busy = false;
    };

    // Movement animation loop (runs without triggering React re-renders)
    const tick = (now) => {
      if (!mounted) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      guards.forEach((g, idx) => {
        if (!g.busy) {
          const siteIdx = g.route[g.t % g.route.length];
          const site = SITES[siteIdx];
          // Target point with distinct offset to prevent overlapping
          const targetX = site.x + g.offsetX;
          const targetY = site.y + g.offsetY;

          const dx = targetX - g.x;
          const dy = targetY - g.y;
          const dist = Math.hypot(dx, dy);

          if (dist > 8) {
            const speed = (g.hero ? 52 : 46) * dt; // px per second
            g.x += (dx / dist) * speed;
            g.y += (dy / dist) * speed;
          } else {
            g.busy = true;
            if (g.hero) {
              runHeroCheckin(g, site);
            } else {
              runPatrolArrival(g, site);
            }
          }
        }

        const isInside = SITES.some(
          (s) => Math.hypot(s.x - g.x, s.y - g.y) < GEOFENCE_RADIUS
        );

        // Direct SVG DOM updates via refs
        const groupEl = guardGroupRefs.current[idx];
        const dotEl = guardDotRefs.current[idx];
        if (groupEl) {
          groupEl.setAttribute(
            "transform",
            `translate(${g.x.toFixed(1)}, ${g.y.toFixed(1)})`
          );
        }
        if (dotEl) {
          dotEl.setAttribute("fill", isInside ? "#1E6B56" : "#D97706");
        }
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (animId) cancelAnimationFrame(animId);
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <div className="p-2.5 sm:p-5 space-y-2.5 sm:space-y-3.5">
      {/* ── 1. Live Field Map Panel ────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 overflow-hidden relative shadow-2xs">
        {/* Top Overlay Badge & Clock */}
        <div className="absolute top-2 left-2 right-2 sm:top-2.5 sm:left-3 sm:right-3 flex items-center justify-between text-xs pointer-events-none z-10">
          <div className="inline-flex items-center gap-1.5 px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded bg-white/95 border border-slate-200/90 shadow-2xs text-slate-800 font-semibold text-[9px] sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live field map</span>
          </div>
          <span className="px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded bg-white/95 border border-slate-200/90 shadow-2xs text-slate-700 font-bold text-[9px] sm:text-[11px] tabular-nums">
            {clock}
          </span>
        </div>

        {/* 600x270 SVG Map Canvas */}
        <svg
          viewBox="0 0 600 270"
          className="w-full h-auto block select-none"
          role="img"
          aria-label="Live field map showing 3 duty sites and patrolling guards"
        >
          {/* Faint Background Grid Lines */}
          {GRID_X.map((x) => (
            <line
              key={`gx-${x}`}
              x1={x}
              y1="0"
              x2={x}
              y2="270"
              stroke="#CBD5E1"
              strokeWidth="0.6"
              opacity="0.65"
            />
          ))}
          {GRID_Y.map((y) => (
            <line
              key={`gy-${y}`}
              x1="0"
              y1={y}
              x2="600"
              y2={y}
              stroke="#CBD5E1"
              strokeWidth="0.6"
              opacity="0.65"
            />
          ))}

          {/* Triangular Patrol Route Pathway */}
          <path
            d="M 140 90 L 460 80 L 300 200 Z"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2.5"
            strokeDasharray="6 4"
            strokeLinejoin="round"
            opacity="0.6"
          />

          {/* 3 Duty Sites with Dashed Geofence Circles */}
          {SITES.map((site) => (
            <g key={site.id}>
              {/* Soft Geofence Pulse Animation */}
              <circle
                cx={site.x}
                cy={site.y}
                r={GEOFENCE_RADIUS}
                fill="none"
                stroke="#182B45"
                strokeWidth="1.5"
                className="liveops-geofence-pulse"
              />
              {/* Dashed Geofence Boundary */}
              <circle
                cx={site.x}
                cy={site.y}
                r={GEOFENCE_RADIUS}
                fill="rgba(24, 43, 69, 0.05)"
                stroke="#182B45"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              {/* Central Site Square Marker */}
              <rect
                x={site.x - 5}
                y={site.y - 5}
                width="10"
                height="10"
                rx="2"
                fill="#182B45"
              />
              {/* Site Name Label with High Contrast */}
              <text
                x={site.x}
                y={site.y + GEOFENCE_RADIUS + 13}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#0F172A"
                className="select-none tracking-tight font-sans"
              >
                {site.n}
              </text>
            </g>
          ))}

          {/* 3 Patrolling Guards (Positioned and updated directly via Refs) */}
          {GUARDS.map((guard, idx) => (
            <g
              key={guard.name}
              ref={(el) => (guardGroupRefs.current[idx] = el)}
              transform={`translate(${guard.x}, ${guard.y})`}
            >
              {/* Guard Dot Marker */}
              <circle
                ref={(el) => (guardDotRefs.current[idx] = el)}
                r="7.5"
                fill="#1E6B56"
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
              {/* Pill Badge Container for Guard Name (Ensures crystal clarity) */}
              <rect
                x="-28"
                y="-23"
                width="56"
                height="14"
                rx="3"
                fill="#FFFFFF"
                stroke="#CBD5E1"
                strokeWidth="0.8"
              />
              <text
                y="-12"
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill="#0F172A"
                className="select-none pointer-events-none font-sans"
              >
                {guard.name}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* ── 2. Check-in & Recent Activity Two-Column Row (Stacked on Mobile) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
        
        {/* Left Box: Live Guard Check-in Flow */}
        <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 sm:p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 sm:pb-2.5 border-b border-slate-100 text-xs">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] sm:text-[11px]">
                Check-in
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#0F766E] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 truncate max-w-[120px] sm:max-w-[140px]">
                {currentSiteName}
              </span>
            </div>

            {/* Guard Profile & Avatar Silhouette with Animated Scan Line */}
            <div className="flex items-center gap-2.5 sm:gap-3 my-2 sm:my-3">
              <div
                className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-100 border overflow-hidden shrink-0 transition-colors ${
                  faceOk
                    ? "border-[#1E6B56] ring-2 ring-[#1E6B56]/20"
                    : "border-slate-300"
                }`}
              >
                {/* Silhouette SVG Avatar */}
                <svg
                  viewBox="0 0 76 76"
                  className="w-full h-full text-slate-500"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="38" cy="28" r="14" opacity="0.75" />
                  <path d="M12 76c2-22 14-30 26-30s24 8 26 30z" opacity="0.75" />
                </svg>

                {/* Animated Horizontal Scan Line Sweep */}
                {isScanning && <div className="liveops-scan-line" />}
              </div>

              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
                  Rajesh K.
                </p>
                <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 font-medium">
                  Night shift, Post A
                </p>
              </div>
            </div>

            {/* 3 Step Sequence with High Contrast */}
            <div className="space-y-1.5 text-xs">
              {STEP_CONFIGS.map((step, idx) => {
                const status = steps[idx]; // 'idle' | 'running' | 'done'
                return (
                  <div
                    key={step.idleText}
                    className={`flex items-center gap-2 sm:gap-2.5 px-2 sm:px-2.5 py-1.5 rounded-md border transition-colors ${
                      status === "done"
                        ? "border-emerald-300 bg-emerald-50/70 text-emerald-950 font-semibold"
                        : status === "running"
                          ? "border-amber-300 bg-amber-50/70 text-amber-950 font-semibold"
                          : "border-slate-200 bg-slate-50 text-slate-700 font-medium"
                    }`}
                  >
                    {status === "done" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#1E6B56] shrink-0" />
                    ) : status === "running" ? (
                      <Loader2 className="h-3.5 w-3.5 text-amber-600 animate-spin shrink-0" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-400 bg-white shrink-0" />
                    )}
                    <span className="text-[10px] sm:text-[11px] truncate">
                      {status === "done" ? step.doneText : step.idleText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Box: Recent Activity Stream (3 newest entries) */}
        <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 sm:p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 sm:pb-2.5 border-b border-slate-100 text-xs">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] sm:text-[11px]">
                Recent activity
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>

            {/* Exactly 3 Activity Stream Rows with Strong Contrast */}
            <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-2.5">
              {feed.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 sm:gap-2.5 text-xs animate-[feed-slide_0.35s_ease-out]"
                >
                  <span className="h-2 w-2 rounded-full bg-[#1E6B56] mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1.5">
                      <p className="font-bold text-slate-900 truncate text-[11px] sm:text-xs">
                        {item.name}
                      </p>
                      <span className="text-[9px] sm:text-[11px] text-slate-500 font-medium shrink-0">
                        {item.time}
                      </span>
                    </div>
                    <p className="text-slate-700 text-[10px] sm:text-[11px] mt-0.5 leading-tight truncate font-normal">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── 3. Thin Counter Strip at Bottom ───────────────────────────────── */}
      <div className="border-t border-slate-200/80 pt-2 sm:pt-3 grid grid-cols-3 divide-x divide-slate-200 text-center">
        <div className="px-1 sm:px-2">
          <p className="text-[9px] sm:text-[11px] text-slate-600 font-semibold truncate">Guards on duty</p>
          <p className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5">12</p>
        </div>
        <div className="px-1 sm:px-2">
          <p className="text-[9px] sm:text-[11px] text-slate-600 font-semibold truncate">Verified today</p>
          <p className="text-sm sm:text-lg font-bold text-[#0F766E] mt-0.5 tabular-nums">
            {verifiedCount}
          </p>
        </div>
        <div className="px-1 sm:px-2">
          <p className="text-[9px] sm:text-[11px] text-slate-600 font-semibold truncate">Open alerts</p>
          <p className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5">0</p>
        </div>
      </div>
    </div>
  );
}
