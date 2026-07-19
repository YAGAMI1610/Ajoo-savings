import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { SiteNav } from "@/components/SiteNav";
import { usePendingInvitations } from "@/hooks/useCircles";
import { shortAddress, buildMembers } from "@/lib/circleMembers";
import { IS_FACTORY_CONFIGURED } from "@/lib/web3/contracts";

export const Route = createFileRoute("/invites")({
  component: InvitesPage,
  head: () => ({
    meta: [
      { title: "Pending Invites — Ajoo" },
      { name: "description", content: "View and manage all your pending circle invitations." },
    ],
  }),
});

function InvitesPage() {
  const { address, isConnected } = useAccount();
  const { data: pendingInvites, isLoading: pendingInvitesLoading, refetch: refreshPendingInvites } = usePendingInvitations();

  if (!IS_FACTORY_CONFIGURED) {
    return (
      <Shell>
        <div className="max-w-md mx-auto px-5 py-24">
          <div className="rounded-2xl bg-surface border border-foreground/10 p-6 text-center space-y-3">
            <p className="text-sm font-medium text-foreground">Contracts not deployed yet</p>
            <p className="text-xs text-foreground/60">
              VITE_CIRCLE_FACTORY_ADDRESS is still a placeholder. Deploy contracts and set the env var to see live circles.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  if (!isConnected) {
    return (
      <Shell>
        <div className="max-w-md mx-auto px-5 py-24 text-center space-y-4">
          <div className="size-14 rounded-full bg-surface mx-auto grid place-items-center text-2xl">○</div>
          <h2 className="font-display text-2xl italic">Connect your wallet</h2>
          <p className="text-foreground/60 text-sm leading-relaxed">
            Sign in with the wallet that has been invited to circles so you can see and accept invitations.
          </p>
        </div>
      </Shell>
    );
  }

  const walletText = address ? `${address.slice(0, 8)}…${address.slice(-6)}` : "Your wallet";

  return (
    <Shell>
      <div className="max-w-3xl mx-auto px-5 py-8 md:py-12 space-y-8">
        <header className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-4xl md:text-5xl leading-tight italic">Your Invites</h1>
              <p className="mt-2 text-foreground/60 text-sm">Circles you've been invited to join</p>
            </div>
            <button
              onClick={() => refreshPendingInvites?.()}
              disabled={pendingInvitesLoading}
              className="rounded-full border border-foreground/10 bg-background px-4 py-2 text-sm font-medium text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50 shrink-0"
            >
              {pendingInvitesLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <div className="rounded-2xl bg-foreground text-background p-4">
            <p className="text-xs uppercase tracking-widest text-background/60">Connected wallet</p>
            <p className="mt-2 font-mono text-sm">{walletText}</p>
          </div>
        </header>

        {pendingInvitesLoading ? (
          <div className="rounded-2xl bg-surface border border-foreground/10 p-8 text-center">
            <p className="text-sm text-foreground/60">Loading your invites…</p>
          </div>
        ) : pendingInvites && pendingInvites.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground/60">
              You have <strong>{pendingInvites.length}</strong> pending invitation{pendingInvites.length === 1 ? "" : "s"}.
              Click any to review and join.
            </p>
            <div className="grid gap-4">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.address}
                  className="rounded-[1.5rem] bg-surface border border-foreground/10 p-6 hover:border-foreground/20 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-widest text-foreground/50 font-medium">🔔 Pending invite</p>
                      <h3 className="mt-2 text-lg font-semibold text-foreground truncate">
                        {invite.name || "Untitled circle"}
                      </h3>
                      <p className="mt-1 text-xs text-foreground/50 font-mono">{shortAddress(invite.address)}</p>
                      <p className="mt-3 text-sm text-foreground/70">
                        Join this circle to start contributing and receiving payouts with trusted people.
                      </p>
                    </div>
                    <Link
                      to={`/invite/${invite.address}`}
                      className="shrink-0 px-5 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition whitespace-nowrap"
                    >
                      Accept & Join →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] bg-surface border border-foreground/10 p-12 text-center space-y-4">
            <p className="text-foreground/70">No pending invites right now</p>
            <p className="text-sm text-foreground/60 max-w-md mx-auto">
              Once someone invites you to a savings circle, you'll see it here. You can accept to join and start participating.
            </p>
            <Link
              to="/dashboard"
              className="inline-block text-sm font-medium text-accent hover:text-accent/80 transition"
            >
              Go to dashboard →
            </Link>
          </div>
        )}

        <div className="rounded-[1.5rem] bg-foreground text-background p-6 md:p-8 space-y-4">
          <h2 className="text-lg font-semibold">How it works</h2>
          <ol className="space-y-3 text-sm text-background/80">
            <li className="flex gap-3">
              <span className="shrink-0 font-bold text-background">1.</span>
              <span>Someone creates a savings circle and adds your wallet address as an invited member.</span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 font-bold text-background">2.</span>
              <span>You'll see the invite here and in the dashboard. Click to review the circle details.</span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 font-bold text-background">3.</span>
              <span>Accept the invite to join and execute the join transaction on-chain.</span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 font-bold text-background">4.</span>
              <span>Once joined, you can contribute each round and receive payouts when it's your turn.</span>
            </li>
          </ol>
        </div>

        <Link to="/dashboard" className="inline-block text-sm font-medium text-accent">
          ← Back to dashboard
        </Link>
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
