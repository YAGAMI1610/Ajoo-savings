import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { SiteNav } from "@/components/SiteNav";
import { Disclaimer } from "@/components/Disclaimer";
import { SavingsWheel } from "@/components/SavingsWheel";
import { useMyCircles, useCircleState } from "@/hooks/useCircles";
import { buildMembers, shortAddress } from "@/lib/circleMembers";
import { IS_FACTORY_CONFIGURED } from "@/lib/web3/contracts";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — Ajoo" },
      { name: "description", content: "Your active savings circle at a glance." },
    ],
  }),
});

function useCountdown(deadline?: bigint) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return null;
  const ms = Number(deadline) * 1000 - now;
  if (ms <= 0) return "Due now";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Dashboard() {
  const { address, isConnected } = useAccount();
  const { data: myCircles, isLoading: circlesLoading } = useMyCircles(address);
  const circleAddresses = useMemo(() => ((myCircles as `0x${string}`[] | undefined) ?? []).filter(Boolean), [myCircles]);
  const [pendingInvites, setPendingInvites] = useState<string[]>([]);
  const activeCircle = circleAddresses[0];
  const { data: circle, isLoading: circleLoading } = useCircleState(activeCircle);
  const countdown = useCountdown(circle?.roundDeadline);
  const otherCircles = circleAddresses.slice(1);

  useEffect(() => {
    if (typeof window === "undefined" || !address) return;
    const stored = window.localStorage.getItem(`pending-invites:${address}`);
    if (stored) {
      try {
        setPendingInvites(JSON.parse(stored));
      } catch {
        setPendingInvites([]);
      }
    } else {
      setPendingInvites([]);
    }
  }, [address]);

  if (!IS_FACTORY_CONFIGURED) {
    return (
      <Shell>
        <div className="max-w-md mx-auto px-5 py-24">
          <NoticeCard
            title="Contracts not deployed yet"
            body="VITE_CIRCLE_FACTORY_ADDRESS is still a placeholder. Deploy contracts/ to Monad testnet and set the env var to see live circles here."
          />
        </div>
      </Shell>
    );
  }

  if (!isConnected) {
    return (
      <Shell>
        <EmptyState
          title="Connect your wallet"
          body="Connect the wallet you'll use for Ajoo to see the circles you've created or joined."
        />
      </Shell>
    );
  }

  if (circlesLoading) {
    return (
      <Shell>
        <LoadingCard label="Reading your circles from Monad testnet…" />
      </Shell>
    );
  }

  if (!activeCircle) {
    return (
      <Shell>
        <EmptyState
          title="No circles yet"
          body="Start a savings circle with your family or closest friends, or join one with an invite link someone shared with you."
          cta={
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition"
            >
              Start a circle →
            </Link>
          }
        />
      </Shell>
    );
  }

  if (circleLoading || !circle) {
    return (
      <Shell>
        <LoadingCard label="Loading circle details…" />
      </Shell>
    );
  }

  const memberDisplay = buildMembers({
    members: circle.members,
    payoutOrder: circle.payoutOrder,
    hasReceivedByAddress: {},
    hasContributedByAddress: {},
    currentRound: circle.currentRound ?? 0,
  });

  const totalPool = circle.contributionAmount
    ? Number(formatUnits(circle.contributionAmount, circle.tokenConfig.decimals)) * circle.members.length
    : 0;

  const activeIndex = circle.payoutOrder.findIndex((_a, i) => i === (circle.currentRound ?? 1) - 1);

  return (
    <Shell>
      <div className="max-w-md md:max-w-5xl mx-auto px-5 py-8 md:py-12 grid md:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-8">
          <header className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 font-medium mb-1">
                Your active circle
              </p>
              <h1 className="font-display text-4xl md:text-5xl leading-tight italic">
                {circle.name || "Untitled circle"}
              </h1>
            </div>
            <span className="shrink-0 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest">
              {circle.status === "Active"
                ? `Round ${circle.currentRound} of ${circle.maxParticipants}`
                : circle.status}
            </span>
          </header>

          <div className="rounded-[2rem] bg-foreground text-background p-7 md:p-9 space-y-4">
            <Row
              label="Contribution"
              value={
                circle.contributionAmount
                  ? `${formatUnits(circle.contributionAmount, circle.tokenConfig.decimals)} ${circle.tokenConfig.symbol}`
                  : "—"
              }
            />
            <Row label="Members" value={`${circle.members.length} / ${circle.maxParticipants}`} />
            <Row label="Status" value={circle.status ?? "—"} />
            {circle.status === "Active" && <Row label="Next round due in" value={countdown ?? "—"} accent />}
            <Row label="Pool this round" value={`${totalPool.toLocaleString()} ${circle.tokenConfig.symbol}`} accent />
          </div>

          {circle.status === "Open" && (
            <NoticeCard
              title="Waiting for members"
              body={`${circle.members.length} of ${circle.maxParticipants} joined. Invites are open — share the link from the Group page. The payout order draws automatically the moment the last seat fills.`}
            />
          )}

          {circle.status === "Completed" && (
            <NoticeCard
              title="Circle completed 🎉"
              body="Every member has received their payout exactly once. No further deposits are accepted on this circle."
            />
          )}

          <Link to="/group" className="inline-block text-sm font-medium text-accent">
            View full timeline →
          </Link>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[2rem] bg-surface p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 font-medium mb-4 text-center">
              Savings wheel
            </p>
            {memberDisplay.length > 0 ? (
              <SavingsWheel members={memberDisplay} activeIndex={Math.max(activeIndex, 0)} />
            ) : (
              <p className="text-sm text-foreground/50 text-center py-10">No members yet</p>
            )}
          </div>

          {pendingInvites.length > 0 && (
            <div className="rounded-[2rem] bg-surface p-6 md:p-8 space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 font-medium">Pending invitations</p>
              {pendingInvites.map((inviteAddress) => (
                <Link key={inviteAddress} to={`/join/${encodeURIComponent(inviteAddress)}`} className="block rounded-2xl border border-foreground/10 bg-background px-3 py-3 text-sm">
                  Accept invitation for {shortAddress(inviteAddress)}
                </Link>
              ))}
            </div>
          )}

          {otherCircles.length > 0 && (
            <div className="rounded-[2rem] bg-surface p-6 md:p-8 space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 font-medium">Other circles</p>
              {otherCircles.map((circleAddress) => (
                <Link key={circleAddress} to="/group" className="block rounded-2xl border border-foreground/10 bg-background px-3 py-3 text-sm">
                  {shortAddress(circleAddress)}
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>

      <div className="max-w-md md:max-w-5xl mx-auto px-5 pb-14">
        <Disclaimer />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      {children}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-background/60">{label}</span>
      <span className={accent ? "font-semibold text-accent" : "font-semibold"}>{value}</span>
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto px-5 py-24 text-center space-y-4">
      <div className="size-14 rounded-full bg-surface mx-auto grid place-items-center text-2xl">○</div>
      <h2 className="font-display text-2xl italic">{title}</h2>
      <p className="text-foreground/60 text-sm leading-relaxed">{body}</p>
      {cta}
    </div>
  );
}

function NoticeCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-surface border border-foreground/10 p-5 space-y-1.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-foreground/60 leading-relaxed">{body}</p>
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="max-w-md mx-auto px-5 py-24 text-center space-y-3">
      <div className="size-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto" />
      <p className="text-sm text-foreground/50">{label}</p>
    </div>
  );
}
