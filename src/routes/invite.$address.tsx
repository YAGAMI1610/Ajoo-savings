import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { useMemo, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { appendCircleActivity, useCircleActivityFeed } from "@/lib/activityFeed";
import { useCircleState } from "@/hooks/useCircles";

export const Route = createFileRoute("/invite/$address")({
  component: InviteDecisionPage,
});

function InviteDecisionPage() {
  const { address } = useAccount();
  const { address: routeAddress } = Route.useParams();
  const circleAddress = useMemo(() => routeAddress as `0x${string}` | undefined, [routeAddress]);
  const { data: circle } = useCircleState(circleAddress);
  const [status, setStatus] = useState<"idle" | "accepted" | "rejected">("idle");

  const handleDecision = (decision: "accepted" | "rejected") => {
    if (!address || !circleAddress) return;
    appendCircleActivity(circleAddress, {
      circleAddress,
      actor: address,
      type: decision === "accepted" ? "invite-accepted" : "invite-rejected",
      title: decision === "accepted" ? "Invite accepted" : "Invite rejected",
      message: decision === "accepted"
        ? `${address.slice(0, 8)}…${address.slice(-4)} accepted the invite to join the circle.`
        : `${address.slice(0, 8)}…${address.slice(-4)} declined the invite to join the circle.`,
    });
    setStatus(decision);
  };

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
            Review the invitation and choose whether to join this circle or decline it. Your decision is recorded for the circle group feed.
          </p>
        </div>

        <div className="rounded-[2rem] border border-foreground/10 bg-surface p-6">
          {status === "idle" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-foreground/70">You can accept this invite and join the circle, or reject it and leave the creator with a clear response.</p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => handleDecision("accepted")} className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">Accept invite</button>
                <button onClick={() => handleDecision("rejected")} className="rounded-full border border-foreground/10 bg-background px-4 py-2 text-sm font-medium text-foreground">Reject invite</button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-foreground/10 bg-background p-4 text-sm">
              <p className="font-medium text-foreground">{status === "accepted" ? "Invite accepted" : "Invite rejected"}</p>
              <p className="mt-1 text-foreground/70">Your feedback has been recorded and shared with the group feed.</p>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-foreground/10 bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">Circle activity feed</p>
          <div className="mt-4 space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-foreground/60">No activity yet. Deposits, contributions, and payout updates will appear here as they happen.</p>
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
