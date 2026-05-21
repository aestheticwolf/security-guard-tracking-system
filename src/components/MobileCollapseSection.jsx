import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { fadeUp } from "../animations/transitions";

export default function MobileCollapseSection({
  id,
  title,
  subtitle,
  className = "",
  defaultCollapsed = false,
  children
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <motion.section
      id={id}
      {...fadeUp}
      className={`glass-panel rounded-[24px] border p-4 md:border-0 md:bg-transparent md:p-0 md:[background:none] md:backdrop-blur-none ${className}`}
    >
      <div className="flex items-start justify-between gap-3 md:hidden">
        <div>
          <h2 className="font-display text-lg font-semibold app-copy-primary">{title}</h2>
          {subtitle && <p className="mt-1 text-[13px] leading-6 app-copy-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          className="app-outline-button inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium"
          aria-expanded={!collapsed}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      <div className={`${collapsed ? "hidden md:block" : ""} ${title || subtitle ? "mt-4 md:mt-0" : ""}`}>
        {children}
      </div>
    </motion.section>
  );
}
