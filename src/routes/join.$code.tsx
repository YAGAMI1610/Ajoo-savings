import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { SiteNav } from "@/components/SiteNav";
import { Disclaimer } from "@/components/Disclaimer";
import { useCircleState, useJoinCircle, useTokenApproval } from "@/hooks/useCircles";
import { hashInviteCode } from "@/lib/invite";
import { resolveInvite } from "@/lib/inviteRegistry";
import { IS_FACTORY_CONFIGURED } from "@/lib/web3/contracts";

export const Route = createFileRoute("/join/$code")({
  component: JoinCircle,
  head: () => ({
    meta: [{ title: "Join a circle — Ajoo" }],
  }),
});

function JoinCircle() {
  const { code } = useParams({ from: "/join/$code" });
  const { isConnected } = useAccount();
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null | undefined>(undefined);

  useEffect(() => {
    resolveInvite({ data: { codeHash: hashInviteCode(code) } })
      .then((res) => setResolvedAddress(res.found && res.circleAddress !== "pending" ? (res.circleAddress as `0x${string}`) : null))
      .catch(() => setResolvedAddress(null));
  }, [code]);

  const { data: circle } = useCircleState(resolvedAddress ?? undefined);
  const isNative = circle?.tokenConfig?.isNative ?? true;
  const { join, isPending, isConfirming, isConfirmed, error } = useJoinCircle(resolvedAddress ?? undefined, isNative);
  const {
    approve,
    hasSufficientAllowance,
    isPending: isApprovePending,
    isConfirming: isApproveConfirming,
  } = useTokenApproval(circle?.token, resolvedAddress ?? undefined);

  const collateral = circle?.collateralRequired ?? 0n;
  const needsApproval = !isNative && collateral > 0n && !hasSufficientAllowance(collateral);

  if (!IS_FACTORY_CONFIGURED) {
    return (
      <Shell>
        <Notice title="Contracts not deployed yet" body="This link will work once Ajoo's contracts are live on Monad testnet." />
      </Shell>
    );
  }

  if (resolvedAddress === undefined) {
    return (
      <Shell>
        <div className="text-center py-16 text-sm text-foreground/50">Looking up invite…</div>
      </Shell>
    );
  }

  if (resolvedAddress === null) {
    return (
      <Shell>
        <Notice
          title="Invite not found"
          body="This invite code doesn't match an active circle. Double-check the link, or ask whoever invited you to re-share it — invite codes can be regenerated before a circle starts."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-lg mx-auto px-5 py-10 md:py-16 space-y-8">
        <Disclaimer />
        {!circle ? (
          <div className="text-center py-10 text-sm text-foreground/50">Loading circle…</div>
        ) : (
          <div className="rounded-[2rem] bg-foreground text-background p-7 space-y-4">
            <h1 className="font-display text-3xl italic">{circle.name}</h1>
            {circle.description && <p className="text-background/70 text-sm">{circle.description}</p>}
            <Row
              label="Contribution"
              value={
                circle.contributionAmount
                  ? `${formatUnits(circle.contributionAmount, circle.tokenConfig.decimals)} ${circle.tokenConfig.symbol}`
                  : "—"
              }
            />
            <Row label="Members" value={`${circle.members.length} / ${circle.maxParticipants}`} />
            <Row
              label="Collateral required"
              value={
                circle.collateralRequired
                  ? `${formatUnits(circle.collateralRequired, circle.tokenConfig.decimals)} ${circle.tokenConfig.symbol}`
                  : "None"
              }
            />

            {circle.status !== "Open" ? (
              <p className="text-sm text-clay">This circle is no longer accepting new members.</p>
            ) : isConfirmed ? (
              <p className="text-sm text-moss font-medium">✓ You've joined. Head to your dashboard.</p>
            ) : needsApproval ? (
              <button
                onClick={() => approve(collateral)}
                disabled={!isConnected || isApprovePending || isApproveConfirming}
                className="w-full px-5 py-3 rounded-full bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50"
              >
                {isApprovePending || isApproveConfirming
                  ? "Approving…"
                  : `Approve ${formatUnits(collateral, circle.tokenConfig.decimals)} ${circle.tokenConfig.symbol}`}
              </button>
            ) : (
              <button
                onClick={() => join(code, collateral)}
                disabled={!isConnected || isPending || isConfirming}
                className="w-full px-5 py-3 rounded-full bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50"
              >
                {!isConnected ? "Connect wallet to join" : isPending || isConfirming ? "Joining…" : "Join this circle"}
              </button>
            )}
            {error && <p className="text-xs text-red-300">{error.message}</p>}
          </div>
        )}
        {isConfirmed && (
          <Link to="/dashboard" className="inline-block text-sm font-medium text-accent">
            Go to dashboard →
          </Link>
        )}
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

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-md mx-auto px-5 py-24 text-center space-y-3">
      <h2 className="font-display text-2xl italic">{title}</h2>
      <p className="text-foreground/60 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-background/60">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
