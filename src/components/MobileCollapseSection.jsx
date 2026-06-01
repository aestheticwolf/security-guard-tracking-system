import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { fadeUp } from "../animations/transitions";
import { isNativeApp } from "../utils/nativeApp";

export default function MobileCollapseSection({
  id,
  title,
  subtitle,
  className = "",
  defaultCollapsed = false,
  children
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const nativeApp = isNativeApp();
  const contentCollapsed = !nativeApp && collapsed;

  return (
    <motion.section
      id={id}
      {...fadeUp}
      className={`glass-panel rounded-[24px] border p-4 md:border-0 md:bg-transparent md:p-0 md:[background:none] md:backdrop-blur-none ${className}`}
    >
      <div className="mobile-collapse-header flex items-start justify-between gap-3 md:hidden">
        <div>
          <h2 className="mobile-collapse-title font-display text-lg font-semibold app-copy-primary">{title}</h2>
          {subtitle && <p className="mobile-collapse-subtitle mt-1 text-[13px] leading-5 app-copy-muted">{subtitle}</p>}
        </div>
        {!nativeApp && (
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="mobile-collapse-toggle app-outline-button inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium"
            aria-expanded={!collapsed}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
            />
            {collapsed ? "Details" : "Close"}
          </button>
        )}
      </div>

      <div className={`mobile-collapse-content ${contentCollapsed ? "hidden md:block" : ""} ${title || subtitle ? "mt-4 md:mt-0" : ""}`}>
        {children}
      </div>
    </motion.section>
  );
}
