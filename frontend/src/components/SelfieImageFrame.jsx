export default function SelfieImageFrame({ src, alt, className = "" }) {
  return (
    <div className={`relative overflow-hidden bg-slate-950/60 ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover object-center opacity-45 blur-2xl saturate-110"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/60 via-slate-950/10 to-slate-950/55" />
      <img
        src={src}
        alt={alt}
        className="relative z-10 h-full w-full object-contain object-center drop-shadow-[0_18px_34px_rgba(2,6,23,0.28)]"
      />
    </div>
  );
}
