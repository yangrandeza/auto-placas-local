export function MiniPill({ label, tone }) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
      : tone === "amber"
        ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
        : tone === "green"
          ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
          : "border-white/10 bg-white/5 text-white/70";

  return (
    <span className={`rounded-full border px-2 py-1 text-[11px] ${toneClass}`}>
      {label}
    </span>
  );
}
