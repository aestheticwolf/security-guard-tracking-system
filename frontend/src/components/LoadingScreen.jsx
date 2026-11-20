import { motion } from "framer-motion";
import { heroReveal } from "../animations/transitions";

export default function LoadingScreen({ label = "Securing your workspace..." }) {
  return (
    <div className="mesh-background flex min-h-screen items-center justify-center px-6 text-white">
      <motion.div {...heroReveal} className="glass-panel flex w-full max-w-sm flex-col items-center gap-5 rounded-[28px] p-10 text-center shadow-glow">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: "linear", duration: 6 }}
          className="flex h-20 w-20 items-center justify-center rounded-[26px] border border-white/10 bg-white/5"
        >
          <img src="/brand-shield.svg" alt="Sentinel Grid" className="h-12 w-12" />
        </motion.div>
        <div>
          <p className="font-display text-2xl font-semibold">Sentinel Grid</p>
          <p className="mt-2 text-sm text-slate-300">{label}</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            animate={{ x: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-gold-400 to-jade-400"
          />
        </div>
      </motion.div>
    </div>
  );
}
