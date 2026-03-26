export function SliderField({ label, value, min, max, onChange, onCommit }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm text-white">{label}</span>
        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 font-mono text-[11px] text-[color:var(--muted-foreground)]">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="w-full accent-[color:var(--primary)]"
      />
    </div>
  );
}
