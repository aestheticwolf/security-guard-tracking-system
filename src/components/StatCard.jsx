import { motion } from "framer-motion";

export default function StatCard({ icon: Icon, label, value, detail, tone = "gold", className = "" }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`app-stat app-stat--${tone} rounded-[22px] p-4 sm:rounded-[24px] sm:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] app-copy-soft sm:text-xs">{label}</p>
          <p className="mt-2.5 font-display text-[2rem] font-semibold leading-none app-copy-primary sm:mt-3 sm:text-3xl">
            {value}
          </p>
          {detail && <p className="mt-2 text-[13px] leading-5 app-copy-muted sm:text-sm">{detail}</p>}
        </div>
        {Icon ? (
          <div className="app-surface-soft rounded-[18px] p-2.5 sm:rounded-2xl sm:p-3">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
