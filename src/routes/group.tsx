import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { useState } from "react";
import { toast } from "sonner";
import { formatUnits, isAddress, parseUnits } from "viem";
import { SiteNav } from "@/components/SiteNav";
import { useMyCircles, useCircleState, useContribute, useFundCircle, useMemberInfo, useTokenApproval, usePendingPayout, useAddInvitedAddress, useWithdrawPayout, useVoteToDelete, useDeleteCircle } from "@/hooks/useCircles";
import { buildMembers, shortAddress } from "@/lib/circleMembers";
import { IS_FACTORY_CONFIGURED } from "@/lib/web3/contracts";
import { appendCircleActivity, useCircleActivityFeed } from "@/lib/activityFeed";

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
  const { data: myPendingPayout } = usePendingPayout(activeCircle, address);
  const isNative = circle?.tokenConfig?.isNative ?? true;
  const { contribute, isPending, isConfirming, isConfirmed, error } = useContribute(activeCircle, isNative);
  const { fund, isPending: isFundPending, isConfirming: isFundConfirming, isConfirmed: isFundConfirmed, error: fundError } = useFundCircle(activeCircle, isNative);
  const { addInvitedAddress, isPending: isInvitePending, isConfirming: isInviteConfirming } = useAddInvitedAddress(activeCircle);
  const { withdrawPayout, isPending: isWithdrawPending, isConfirming: isWithdrawConfirming, isConfirmed: isWithdrawConfirmed } = useWithdrawPayout(activeCircle);
  const { voteToDelete, isPending: isVotePending, isConfirming: isVoteConfirming } = useVoteToDelete(activeCircle);
  const { deleteCircle, isPending: isDeletePending, isConfirming: isDeleteConfirming } = useDeleteCircle(activeCircle);
  const [fundAmount, setFundAmount] = useState("");
  const [inviteAddress, setInviteAddress] = useState("");
  const {
    approve,
    hasSufficientAllowance,
    isPending: isApprovePending,
    isConfirming: isApproveConfirming,
  } = useTokenApproval(circle?.token, activeCircle);
  const [copied, setCopied] = useState(false);
  const activity = useCircleActivityFeed(activeCircle);

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
          <InviteCard
            onAddMember={(invited) => {
              addInvitedAddress(invited);
              appendCircleActivity(activeCircle, {
                circleAddress: activeCircle,
                actor: address ?? "unknown",
                type: "invite-sent",
                title: "Invite sent",
                message: `${address?.slice(0, 8) ?? "A creator"}…${address?.slice(-4) ?? ""} invited ${invited.slice(0, 8)}…${invited.slice(-4)} to join the circle.`,
              });
              toast.success("Invite sent. The invited wallet will see it on the dashboard once connected.");
            }}
            inviteAddress={inviteAddress}
            setInviteAddress={setInviteAddress}
            isInvitePending={isInvitePending || isInviteConfirming}
          />
        )}

        {circle.creator?.toLowerCase() === address?.toLowerCase() && (
          <div className="rounded-2xl bg-surface border border-foreground/10 p-6 space-y-3">
            <h3 className="text-sm font-semibold">Fund this circle</h3>
            <p className="text-sm text-foreground/60">
              As the creator, fund the circle first so the round can begin. After that, each invited member will be asked to contribute for the round before a payout recipient is chosen.
            </p>
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
                  appendCircleActivity(activeCircle, {
                    circleAddress: activeCircle,
                    actor: address ?? "unknown",
                    type: "deposit",
                    title: "Circle funding requested",
                    message: `${address?.slice(0, 8) ?? "A member"}…${address?.slice(-4) ?? ""} requested a deposit to fund the circle.`,
                  });
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
            <p className="text-sm text-foreground/60">Once the creator has funded the circle, each member contributes for the round and the payout recipient is selected automatically.</p>
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
                onClick={() => {
                  if (!circle.contributionAmount) return;
                  contribute(circle.contributionAmount);
                  appendCircleActivity(activeCircle, {
                    circleAddress: activeCircle,
                    actor: address ?? "unknown",
                    type: "contribution",
                    title: "Contribution submitted",
                    message: `${address?.slice(0, 8) ?? "A member"}…${address?.slice(-4) ?? ""} submitted a contribution for the current round.`,
                  });
                }}
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

        {myPendingPayout && myPendingPayout > 0n && (
          <div className="rounded-2xl bg-moss/10 border border-moss/30 p-6 space-y-3">
            <h3 className="text-sm font-semibold">Your payout is ready — Withdraw {formatUnits(myPendingPayout, circle.tokenConfig.decimals)} {circle.tokenConfig.symbol}</h3>
            <button
              onClick={() => {
                withdrawPayout();
                appendCircleActivity(activeCircle, {
                  circleAddress: activeCircle,
                  actor: address ?? "unknown",
                  type: "withdrawal",
                  title: "Payout withdrawal requested",
                  message: `${address?.slice(0, 8) ?? "A member"}…${address?.slice(-4) ?? ""} requested a payout withdrawal.`,
                });
              }}
              disabled={isWithdrawPending || isWithdrawConfirming}
              className="px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50"
            >
              {isWithdrawPending || isWithdrawConfirming ? "Withdrawing…" : "Withdraw Now"}
            </button>
            {isWithdrawConfirmed && <p className="text-xs text-moss">Payout withdrawn.</p>}
          </div>
        )}

        {circle.status !== "Deleted" && (
          <div className="rounded-2xl bg-surface border border-foreground/10 p-6 space-y-3">
            <h3 className="text-sm font-semibold">Delete circle</h3>
            {circle.members.length === 1 ? (
              <button
                onClick={() => deleteCircle()}
                disabled={isDeletePending || isDeleteConfirming}
                className="px-5 py-2.5 rounded-full bg-clay text-background text-sm font-medium hover:bg-clay/90 transition disabled:opacity-50"
              >
                {isDeletePending || isDeleteConfirming ? "Deleting…" : "Delete and reclaim funds"}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => voteToDelete()}
                  disabled={isVotePending || isVoteConfirming}
                  className="px-5 py-2.5 rounded-full bg-clay text-background text-sm font-medium hover:bg-clay/90 transition disabled:opacity-50"
                >
                  {isVotePending || isVoteConfirming ? "Casting vote…" : "Vote to delete"}
                </button>
                <p className="text-xs text-foreground/60">All members must vote. Once every member agrees, funds are settled and the circle closes.</p>
              </div>
            )}
          </div>
        )}

        <div className="rounded-[2rem] border border-foreground/10 bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">Circle activity feed</p>
          <div className="mt-4 space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-foreground/60">No circle updates yet. Deposits, contributions, invite decisions, and payouts will appear here.</p>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="rounded-2xl border border-foreground/10 bg-background p-3 text-sm">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="mt-1 text-foreground/60">{item.message}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-foreground/40">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

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

function InviteCard({
  onAddMember,
  inviteAddress,
  setInviteAddress,
  isInvitePending,
}: {
  onAddMember: (wallet: `0x${string}`) => void;
  inviteAddress: string;
  setInviteAddress: (value: string) => void;
  isInvitePending: boolean;
}) {
  return (
    <div className="rounded-2xl bg-surface border border-foreground/10 p-5 space-y-3">
      <h3 className="text-sm font-semibold">Invite people you trust</h3>
      <div className="flex items-center gap-2">
        <input
          value={inviteAddress}
          onChange={(e) => setInviteAddress(e.target.value)}
          className="input flex-1"
          placeholder="0x... invited wallet"
        />
        <button
          onClick={() => {
            if (!isAddress(inviteAddress)) return;
            onAddMember(inviteAddress as `0x${string}`);
            toast.success("Invite sent. The invited wallet will see it on the dashboard once connected.");
            setInviteAddress("");
          }}
          disabled={isInvitePending || !isAddress(inviteAddress)}
          className="px-3 py-2 rounded-lg bg-foreground text-background text-xs font-medium shrink-0 disabled:opacity-50"
        >
          {isInvitePending ? "Adding…" : "Add Member"}
        </button>
      </div>
      <p className="text-xs text-foreground/60">The invited wallet will see a pending invitation on their Ajoo dashboard and can accept it when connected.</p>
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
