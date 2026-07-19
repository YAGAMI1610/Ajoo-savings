import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { appendCircleActivity, useCircleActivityFeed } from "@/lib/activityFeed";
import { useCircleState, useJoinCircle } from "@/hooks/useCircles";

export const Route = createFileRoute("/invite/$address")({
  component: InviteDecisionPage,
});

function InviteDecisionPage() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { address: routeAddress } = Route.useParams();
  const circleAddress = useMemo(() => routeAddress as `0x${string}` | undefined, [routeAddress]);
  const { data: circle } = useCircleState(circleAddress);
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
    if (!address || !circleAddress) return;
    
    if (decision === "accepted") {
      setStatus("joining");
      join(0n); // Join with 0 collateral (or adjust based on circle config)
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

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
        <Link to="/dashboard" className="text-sm font-medium text-accent">← Back to dashboard</Link>
        <div className="rounded-[2rem] bg-foreground p-7 text-background">
          <p className="text-xs uppercase tracking-[0.2em] text-background/60">Invite decision</p>
          <h1 className="mt-2 font-display text-3xl italic">{circle?.name || "Circle invite"}</h1>
          <p className="mt-3 text-sm text-background/70">
            Review the invitation and choose whether to join this circle or decline it.
          </p>
        </div>

        <div className="rounded-[2rem] border border-foreground/10 bg-surface p-6">
          {status === "idle" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-foreground/70">
                Accepting this invite will execute a join transaction on-chain. You'll then be able to contribute and participate in the circle.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleDecision("accepted")}
                  disabled={isJoinPending}
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition disabled:opacity-50"
                >
                  {isJoinPending ? "Processing…" : "Accept invite & join"}
                </button>
                <button
                  onClick={() => handleDecision("rejected")}
                  className="rounded-full border border-foreground/10 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5 transition"
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
      </div>
    </div>
  );
}
