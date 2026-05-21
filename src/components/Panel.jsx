import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { fadeUp } from "../animations/transitions";

export default function Panel({
  id,
  title,
  subtitle,
  action,
  className = "",
  children,
  collapsibleOnMobile = false,
  defaultCollapsed = false
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <motion.section
      id={id}
      {...fadeUp}
      className={`glass-panel rounded-[24px] border p-4 sm:rounded-[28px] sm:p-6 ${className}`}
      style={{ boxShadow: "var(--app-shadow-glow)" }}
    >
      {(title || subtitle || action) && (
        <div className="mb-4 flex flex-col gap-3 border-b pb-3 sm:mb-5 sm:gap-4 sm:pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {title && <h2 className="font-display text-lg font-semibold app-copy-primary sm:text-xl">{title}</h2>}
            {subtitle && <p className="mt-1 text-[13px] leading-6 app-copy-muted sm:text-sm">{subtitle}</p>}
          </div>
          {(action || collapsibleOnMobile) && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {action}
              {collapsibleOnMobile && (
                <button
                  type="button"
                  onClick={() => setCollapsed((current) => !current)}
                  className="app-outline-button inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium md:hidden"
                  aria-expanded={!collapsed}
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
                  />
                  {collapsed ? "Show" : "Hide"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div className={collapsibleOnMobile && collapsed ? "hidden md:block" : ""}>{children}</div>
    </motion.section>
  );
}
