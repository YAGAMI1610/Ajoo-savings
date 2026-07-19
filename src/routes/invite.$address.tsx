import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { formatUnits, isAddress } from "viem";
import { SiteNav } from "@/components/SiteNav";
import { appendCircleActivity, useCircleActivityFeed } from "@/lib/activityFeed";
import { useCircleState, useJoinCircle } from "@/hooks/useCircles";
import { shortAddress } from "@/lib/circleMembers";

export const Route = createFileRoute("/invite/$address")({
  component: InviteDecisionPage,
});

function InviteDecisionPage() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { address: routeAddress } = Route.useParams();
  const circleAddress = useMemo(() => {
    if (!isAddress(routeAddress)) return undefined;
    return routeAddress as `0x${string}`;
  }, [routeAddress]);
  const { data: circle, isLoading: circleLoading } = useCircleState(circleAddress);
  const [status, setStatus] = useState<"idle" | "accepted" | "rejected" | "joining" | "joined-success">("idle");
  const { join, isPending: isJoinPending, isConfirming: isJoinConfirming, isConfirmed: isJoinConfirmed, error: joinError } = useJoinCircle(circleAddress);

  // Auto-redirect after successful join
  useEffect(() => {
    if (isJoinConfirmed && status === "accepted") {
      setStatus("joined-success");
      setTimeout(() => {
        navigate({ to: "/group" });
      }, 2000);
    }
  }, [isJoinConfirmed, status, navigate]);

  const handleDecision = (decision: "accepted" | "rejected") => {
    if (!isConnected || !address || !circleAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (decision === "accepted") {
      if (circleLoading || !circle || circle.collateralRequired === undefined) {
        toast.error("Circle information is still loading. Please wait a moment and try again.");
        return;
      }
      setStatus("joining");
      join(circle.collateralRequired ?? 0n);
    } else {
      setStatus("rejected");
      appendCircleActivity(circleAddress, {
        circleAddress,
        actor: address,
        type: "invite-rejected",
        title: "Invite rejected",
        message: `${address.slice(0, 8)}…${address.slice(-4)} declined the invite to join the circle.`,
      });
      toast.info("Invite declined. You can always accept later from the dashboard.");
    }
  };

  // Record acceptance in activity feed when join confirms
  useEffect(() => {
    if (isJoinConfirmed && status === "accepted") {
      appendCircleActivity(circleAddress, {
        circleAddress: circleAddress ?? "",
        actor: address ?? "unknown",
        type: "invite-accepted",
        title: "Invite accepted & joined",
        message: `${address?.slice(0, 8)}…${address?.slice(-4)} accepted the invite and joined the circle.`,
      });
      toast.success("Welcome to the circle! Redirecting…");
    }
  }, [isJoinConfirmed, status, circleAddress, address]);

  const activity = useCircleActivityFeed(circleAddress);

  if (!isAddress(routeAddress)) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="max-w-md mx-auto px-5 py-24 text-center space-y-4">
          <div className="size-14 rounded-full bg-surface mx-auto grid place-items-center text-2xl">✕</div>
          <h2 className="font-display text-2xl italic">Invalid invite link</h2>
          <p className="text-foreground/60 text-sm leading-relaxed">
            The invite link is not valid. Double-check the URL and ask the circle creator to re-share it.
          </p>
          <Link to="/dashboard" className="inline-block text-sm font-medium text-accent">
            Go to dashboard →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
        <Link to="/dashboard" className="text-sm font-medium text-accent">← Back to dashboard</Link>

        {!isConnected && (
          <div className="rounded-[2rem] bg-accent/10 border border-accent/30 p-6 text-center">
            <p className="text-sm font-medium text-accent">Wallet Not Connected</p>
            <p className="text-sm text-accent/80 mt-2">
              Connect your wallet to accept this invitation and join the circle.
            </p>
          </div>
        )}

        {circleLoading ? (
          <div className="rounded-[2rem] bg-foreground p-7 text-background animate-pulse">
            <p className="text-xs uppercase tracking-[0.2em] text-background/60">Loading invite…</p>
            <div className="mt-4 h-8 bg-background/20 rounded w-1/2" />
          </div>
        ) : (
          <div className="rounded-[2rem] bg-foreground p-7 text-background">
            <p className="text-xs uppercase tracking-[0.2em] text-background/60">Invite decision</p>
            <h1 className="mt-2 font-display text-3xl italic">{circle?.name || "Circle invite"}</h1>
            {circle?.description && <p className="mt-3 text-sm text-background/70">{circle.description}</p>}
          </div>
        )}

        {circle && (
          <div className="rounded-[2rem] border border-foreground/10 bg-surface p-6 space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 font-medium">Circle Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-foreground/50">Contribution</p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {circle.contributionAmount
                    ? `${formatUnits(circle.contributionAmount, circle.tokenConfig.decimals)} ${circle.tokenConfig.symbol} / round`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground/50">Members</p>
                <p className="text-sm font-semibold text-foreground mt-1">{circle.members.length} of {circle.maxParticipants}</p>
              </div>
              <div>
                <p className="text-xs text-foreground/50">Status</p>
                <p className="text-sm font-semibold text-foreground mt-1">{circle.status}</p>
              </div>
              <div>
                <p className="text-xs text-foreground/50">Creator</p>
                <p className="text-sm font-mono text-foreground mt-1">{shortAddress(circle.creator ?? "")}</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-[2rem] border border-foreground/10 bg-surface p-6">
          {status === "idle" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-foreground/70">
                Accepting this invite will execute a join transaction on-chain. You'll then be able to contribute and participate in the circle.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleDecision("accepted")}
                  disabled={isJoinPending || !isConnected || circleLoading || !circle || circle.collateralRequired === undefined}
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition disabled:opacity-50"
                >
                  {!isConnected ? "Connect wallet to join" : circleLoading ? "Loading circle…" : isJoinPending ? "Processing…" : "Accept invite & join"}
                </button>
                <button
                  onClick={() => handleDecision("rejected")}
                  disabled={!isConnected}
                  className="rounded-full border border-foreground/10 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5 transition disabled:opacity-50"
                >
                  Decline invite
                </button>
              </div>
            </div>
          )}
          {status === "joining" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Joining the circle…</p>
              <p className="text-sm text-foreground/70">
                {isJoinPending
                  ? "Waiting for your wallet to confirm the transaction…"
                  : "Confirming your join on-chain. This may take a moment."}
              </p>
              <div className="animate-pulse">
                <div className="h-2 bg-foreground/20 rounded w-full" />
              </div>
              {joinError && (
                <p className="text-xs text-destructive">Error: {joinError.message}</p>
              )}
            </div>
          )}
          {status === "joined-success" && (
            <div className="rounded-2xl border border-moss/30 bg-moss/10 p-4 text-sm">
              <p className="font-medium text-foreground">✓ You've joined the circle!</p>
              <p className="mt-1 text-foreground/70">Redirecting to the group page…</p>
            </div>
          )}
          {status === "rejected" && (
            <div className="rounded-2xl border border-foreground/10 bg-background p-4 text-sm">
              <p className="font-medium text-foreground">Invite declined</p>
              <p className="mt-1 text-foreground/70">Your response has been recorded. You can always change your mind and accept from the dashboard later.</p>
            </div>
          )}
        </div>

        {circle && (
          <div className="rounded-[2rem] border border-foreground/10 bg-surface p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">Circle activity feed</p>
            <div className="mt-4 space-y-3">
              {activity.length === 0 ? (
                <p className="text-sm text-foreground/60">No activity yet. Once you join, deposits and contributions will appear here.</p>
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
        )}
      </div>
    </div>
  );
}
