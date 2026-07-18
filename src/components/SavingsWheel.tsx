import { type Member } from "@/lib/circleMembers";

type Props = {
  members: Member[];
  activeIndex: number;
  size?: number;
  spinning?: boolean;
};

export function SavingsWheel({ members, activeIndex, size = 288, spinning = false }: Props) {
  const radius = size / 2 - 28;
  const center = size / 2;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* Outer soft ring */}
      <div className="absolute inset-2 rounded-full border border-foreground/5 bg-cream/60" />
      {/* Dashed inner ring */}
      <div className="absolute inset-8 rounded-full border-2 border-dashed border-foreground/10" />

      {/* Avatars */}
      <div
        className={spinning ? "absolute inset-0 animate-wheel-reveal" : "absolute inset-0"}
        style={{ transformOrigin: "50% 50%" }}
      >
        {members.map((m, i) => {
          const angle = (i / members.length) * 2 * Math.PI - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          const isActive = i === activeIndex;
          return (
            <div
              key={m.id}
              className="absolute"
              style={{
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="relative flex flex-col items-center">
                <div
                  className={
                    isActive
                      ? "size-14 rounded-full ring-4 ring-accent/25 border-[3px] border-accent overflow-hidden shadow-lg animate-soft-pulse grid place-items-center text-[10px] font-bold text-background"
                      : "size-11 rounded-full border-[3px] border-surface overflow-hidden shadow-sm grid place-items-center text-[9px] font-bold text-background"
                  }
                  style={{ background: m.color }}
                  title={m.address}
                >
                  {m.address.slice(2, 4).toUpperCase()}
                </div>
                {isActive && (
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap">
                    Payout
                  </span>
                )}
                {m.status === "paid" && !isActive && (
                  <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-moss border-2 border-surface" />
                )}
                {m.status === "pending" && (
                  <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-clay/70 border-2 border-surface" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
