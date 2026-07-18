import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { SiteNav } from "@/components/SiteNav";
import { SavingsWheel } from "@/components/SavingsWheel";
import { useMyCircles, useCircleState } from "@/hooks/useCircles";
import { buildMembers, shortAddress } from "@/lib/circleMembers";
import { IS_FACTORY_CONFIGURED } from "@/lib/web3/contracts";

export const Route = createFileRoute("/payout")({
  component: PayoutReveal,
  head: () => ({
    meta: [
      { title: "Payout reveal — Ajoo" },
      { name: "description", content: "Watch the random payout order spin into place." },
    ],
  }),
});

function PayoutReveal() {
  const { address } = useAccount();
  const { data: myCircles } = useMyCircles(address);
  const activeCircle = (myCircles as `0x${string}`[] | undefined)?.[0];
  const { data: circle } = useCircleState(activeCircle);
  const [phase, setPhase] = useState<"idle" | "spinning" | "revealed">("idle");

  useEffect(() => {
    if (circle?.payoutOrderDrawn && phase === "idle") {
      setPhase("spinning");
      const t = setTimeout(() => setPhase("revealed"), 2600);
      return () => clearTimeout(t);
    }
  }, [circle?.payoutOrderDrawn, phase]);

  if (!IS_FACTORY_CONFIGURED || !activeCircle || !circle) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="max-w-md mx-auto px-5 py-24 text-center space-y-3">
          <h2 className="font-display text-2xl italic">Nothing to reveal yet</h2>
          <p className="text-foreground/60 text-sm">Join or fill a circle first — the order draws automatically.</p>
          <Link to="/dashboard" className="inline-block text-sm font-medium text-accent">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!circle.payoutOrderDrawn) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="max-w-md mx-auto px-5 py-24 text-center space-y-3">
          <div className="size-14 rounded-full bg-surface mx-auto grid place-items-center text-2xl">◌</div>
          <h2 className="font-display text-2xl italic">Waiting for the last seat</h2>
          <p className="text-foreground/60 text-sm">
            {circle.members.length} of {circle.maxParticipants} joined. The payout order draws the instant the
            group fills — permanently, and visible to everyone.
          </p>
        </div>
      </div>
    );
  }

  const memberDisplay = buildMembers({
    members: circle.members,
    payoutOrder: circle.payoutOrder,
    hasReceivedByAddress: {},
    hasContributedByAddress: {},
    currentRound: circle.currentRound ?? 1,
  });

  const order = memberDisplay
    .slice()
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0));

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <SiteNav />

      {phase === "revealed" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => {
            const colors = ["var(--clay)", "var(--moss)", "var(--ink)", "#E8C77E"];
            return (
              <span
                key={i}
                className="absolute top-0 size-2 rounded-sm animate-confetti"
                style={{
                  left: `${(i * 37) % 100}%`,
                  background: colors[i % colors.length],
                  animationDelay: `${(i % 10) * 0.15}s`,
                  animationDuration: `${2.5 + (i % 5) * 0.4}s`,
                }}
              />
            );
          })}
        </div>
      )}

      <div className="relative max-w-2xl mx-auto px-5 py-10 md:py-16 text-center space-y-10">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 font-medium mb-2">
            {circle.name}
          </p>
          <h1 className="font-display text-4xl md:text-6xl italic leading-tight">
            {phase === "revealed" ? "The order is set." : "Drawing the payout order…"}
          </h1>
          <p className="text-foreground/60 mt-3 max-w-md mx-auto text-sm">
            Drawn on-chain the moment your circle filled, from block data no one — including the circle's
            creator — could have predicted in advance. It can never be changed.
          </p>
        </div>

        <SavingsWheel members={memberDisplay} activeIndex={0} size={320} spinning={phase === "spinning"} />

        {phase === "revealed" && (
          <ol className="text-left max-w-sm mx-auto space-y-2">
            {order.map((m, i) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl bg-surface px-4 py-2.5 animate-fade-up"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="font-display text-lg italic text-accent w-6 shrink-0">{i + 1}</span>
                <div
                  className="size-7 rounded-full grid place-items-center text-[9px] font-bold text-background shrink-0"
                  style={{ background: m.color }}
                >
                  {m.address.slice(2, 4).toUpperCase()}
                </div>
                <span className="text-sm font-medium">{shortAddress(m.address)}</span>
              </li>
            ))}
          </ol>
        )}

        <Link to="/dashboard" className="inline-block text-sm font-medium text-accent">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
