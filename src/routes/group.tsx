import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { SiteNav } from "@/components/SiteNav";
import { useMyCircles, useCircleState, useContribute, useFundCircle, useMemberInfo, useTokenApproval } from "@/hooks/useCircles";
import { buildMembers, shortAddress } from "@/lib/circleMembers";
import { inviteLink } from "@/lib/invite";
import { IS_FACTORY_CONFIGURED } from "@/lib/web3/contracts";

export const Route = createFileRoute("/group")({
  component: GroupDetails,
  head: () => ({
    meta: [
      { title: "Group details — Ajoo" },
      { name: "description", content: "Contribution details, timeline, and history for your circle." },
    ],
  }),
});

function GroupDetails() {
  const { address } = useAccount();
  const { data: myCircles } = useMyCircles(address);
  const activeCircle = (myCircles as `0x${string}`[] | undefined)?.[0];
  const { data: circle } = useCircleState(activeCircle);
  const { data: myMember } = useMemberInfo(activeCircle, address);
  const isNative = circle?.tokenConfig?.isNative ?? true;
  const { contribute, isPending, isConfirming, isConfirmed, error } = useContribute(activeCircle, isNative);
  const { fund, isPending: isFundPending, isConfirming: isFundConfirming, isConfirmed: isFundConfirmed, error: fundError } = useFundCircle(activeCircle, isNative);
  const [fundAmount, setFundAmount] = useState("");
  const {
    approve,
    hasSufficientAllowance,
    isPending: isApprovePending,
    isConfirming: isApproveConfirming,
  } = useTokenApproval(circle?.token, activeCircle);
  const [copied, setCopied] = useState(false);

  if (!IS_FACTORY_CONFIGURED || !activeCircle || !circle) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="max-w-3xl mx-auto px-5 py-24 text-center space-y-3">
          <h2 className="font-display text-2xl italic">No circle to show yet</h2>
          <p className="text-foreground/60 text-sm">
            {IS_FACTORY_CONFIGURED
              ? "Create or join a circle first."
              : "Contracts aren't deployed yet — this page will populate once VITE_CIRCLE_FACTORY_ADDRESS points at a live CircleFactory."}
          </p>
          <Link to="/create" className="inline-block text-sm font-medium text-accent">
            Start a circle →
          </Link>
        </div>
      </div>
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

  const member = myMember as
    | { hasContributedThisRound: boolean; hasReceivedPayout: boolean; exists: boolean }
    | undefined;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="max-w-3xl mx-auto px-5 py-8 md:py-12 space-y-10">
        <Link to="/dashboard" className="text-sm text-accent font-medium">
          ← Back to dashboard
        </Link>

        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 font-medium">Circle details</p>
          <h1 className="font-display text-4xl md:text-6xl leading-tight italic">{circle.name}</h1>
          {circle.description && <p className="text-foreground/60 max-w-lg">{circle.description}</p>}
        </header>

        <div className="rounded-[2rem] bg-foreground text-background p-7 md:p-9 space-y-4">
          <Row
            label="Contribution"
            value={
              circle.contributionAmount
                ? `${formatUnits(circle.contributionAmount, circle.tokenConfig.decimals)} ${circle.tokenConfig.symbol} / round`
                : "—"
            }
          />
          <Row label="Members" value={`${circle.members.length} of ${circle.maxParticipants}`} />
          <Row label="Status" value={circle.status ?? "—"} />
          <Row label="Total pool per round" value={`${totalPool.toLocaleString()} ${circle.tokenConfig.symbol}`} accent />
        </div>

        {circle.status === "Open" && circle.creator?.toLowerCase() === address?.toLowerCase() && (
          <InviteCard circleAddress={activeCircle} invitesLocked={circle.invitesLocked} />
        )}

        {circle.creator?.toLowerCase() === address?.toLowerCase() && (
          <div className="rounded-2xl bg-surface border border-foreground/10 p-6 space-y-3">
            <h3 className="text-sm font-semibold">Fund this circle</h3>
            <p className="text-sm text-foreground/60">Add extra MON or USDC to the circle balance. This is charged alongside the gas for the funding transaction.</p>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step={isNative ? "0.001" : "0.01"}
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="input flex-1"
                placeholder="0.1"
              />
              <button
                onClick={() => {
                  if (!fundAmount) return;
                  fund(parseUnits(fundAmount, isNative ? 18 : 6));
                }}
                disabled={isFundPending || isFundConfirming}
                className="px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50"
              >
                {isFundPending || isFundConfirming ? "Confirming…" : `Fund ${circle.tokenConfig.symbol}`}
              </button>
            </div>
            {isFundConfirmed && <p className="text-xs text-moss">Funding transaction confirmed.</p>}
            {fundError && <p className="text-xs text-destructive">{fundError.message}</p>}
          </div>
        )}

        {circle.status === "Active" && member?.exists && (
          <div className="rounded-2xl bg-surface border border-foreground/10 p-6 space-y-3">
            <h3 className="text-sm font-semibold">Round {circle.currentRound} contribution</h3>
            {member.hasContributedThisRound ? (
              <p className="text-sm text-moss font-medium">✓ You've contributed this round.</p>
            ) : !isNative && circle.contributionAmount && !hasSufficientAllowance(circle.contributionAmount) ? (
              <button
                onClick={() => circle.contributionAmount && approve(circle.contributionAmount)}
                disabled={isApprovePending || isApproveConfirming}
                className="px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50"
              >
                {isApprovePending || isApproveConfirming
                  ? "Approving…"
                  : `Approve ${formatUnits(circle.contributionAmount, circle.tokenConfig.decimals)} ${circle.tokenConfig.symbol}`}
              </button>
            ) : (
              <button
                onClick={() => circle.contributionAmount && contribute(circle.contributionAmount)}
                disabled={isPending || isConfirming}
                className="px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50"
              >
                {isPending || isConfirming
                  ? "Confirming…"
                  : `Contribute ${circle.contributionAmount ? formatUnits(circle.contributionAmount, circle.tokenConfig.decimals) : ""} ${circle.tokenConfig.symbol}`}
              </button>
            )}
            {isConfirmed && <p className="text-xs text-moss">Transaction confirmed.</p>}
            {error && <p className="text-xs text-destructive">{error.message}</p>}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Members</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {memberDisplay.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 border border-foreground/5">
                <div
                  className="size-9 rounded-full grid place-items-center text-[10px] font-bold text-background shrink-0"
                  style={{ background: m.color }}
                >
                  {m.address.slice(2, 4).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{shortAddress(m.address)}</p>
                  <p className="text-xs text-foreground/50 capitalize">
                    {m.round ? `Round ${m.round}` : "Order not drawn yet"} · {m.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {circle.payoutOrderDrawn && (
          <Link to="/payout" className="inline-block text-sm font-medium text-accent">
            View payout order reveal →
          </Link>
        )}
      </div>
    </div>
  );
}

function InviteCard({ circleAddress, invitesLocked }: { circleAddress: `0x${string}`; invitesLocked?: boolean }) {
  const [copied, setCopied] = useState(false);
  // The plaintext invite code is generated once at creation time and only the
  // creator holds it (stored locally); this card assumes it's already been
  // shared. In the create flow we surface + persist it right after deploy.
  const stored = typeof window !== "undefined"
    ? window.localStorage.getItem(`invite:${circleAddress}`) ?? window.localStorage.getItem(`invite:${window.ethereum?.selectedAddress ?? ""}`)
    : null;

  if (!stored) {
    return (
      <div className="rounded-2xl bg-surface border border-foreground/10 p-5 text-sm text-foreground/60">
        Invite code isn't available in this browser. It was shown once at creation — if you cleared local
        storage, invite whoever is missing by re-sharing the code you saved.
      </div>
    );
  }

  const link = inviteLink(stored);

  return (
    <div className="rounded-2xl bg-surface border border-foreground/10 p-5 space-y-3">
      <h3 className="text-sm font-semibold">Invite people you trust</h3>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 rounded-lg bg-background text-sm font-mono truncate">{link}</code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="px-3 py-2 rounded-lg bg-foreground text-background text-xs font-medium shrink-0"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      {invitesLocked && <p className="text-xs text-clay">Invitations are closed on this circle.</p>}
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
