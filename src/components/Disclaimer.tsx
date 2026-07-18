export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`p-5 rounded-3xl bg-accent/8 border border-accent/15 ${className}`}
      style={{ backgroundColor: "color-mix(in oklab, var(--clay) 8%, transparent)" }}
    >
      <p className="text-xs leading-relaxed text-accent font-medium text-pretty">
        «Ajoo is designed for family members and trusted friends only. Please do not
        create savings circles with strangers.»
      </p>
    </div>
  );
}
