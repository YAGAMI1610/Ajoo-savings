import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { useEffect, useMemo, useState } from "react";
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
  const { address, isConnected } = useAccount();
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null | undefined>(undefined);
  const [manualAddress, setManualAddress] = useState("");
  const [joinMode, setJoinMode] = useState<"code" | "address">("code");
  const [requestStatus, setRequestStatus] = useState<string | null>(null);

  useEffect(() => {
    resolveInvite({ data: { codeHash: hashInviteCode(code) } })
      .then((res) => setResolvedAddress(res.found && res.circleAddress !== "pending" ? (res.circleAddress as `0x${string}`) : null))
      .catch(() => setResolvedAddress(null));
  }, [code]);

  const targetAddress = useMemo(() => {
    if (joinMode === "address") {
      return manualAddress && /^0x[a-fA-F0-9]{40}$/.test(manualAddress) ? (manualAddress as `0x${string}`) : undefined;
    }
    if (code && /^0x[a-fA-F0-9]{40}$/.test(code)) {
      return code as `0x${string}`;
    }
    return resolvedAddress ?? undefined;
  }, [joinMode, manualAddress, resolvedAddress, code]);

  const { data: circle } = useCircleState(targetAddress);
  const isNative = circle?.tokenConfig?.isNative ?? true;
  const { join, isPending, isConfirming, isConfirmed, error } = useJoinCircle(targetAddress, isNative);
  const {
    approve,
    hasSufficientAllowance,
    isPending: isApprovePending,
    isConfirming: isApproveConfirming,
  } = useTokenApproval(circle?.token, targetAddress);

  const collateral = circle?.collateralRequired ?? 0n;
  const needsApproval = !isNative && collateral > 0n && !hasSufficientAllowance(collateral);

  if (!IS_FACTORY_CONFIGURED) {
    return (
      <Shell>
        <Notice title="Contracts not deployed yet" body="This link will work once Ajoo's contracts are live on Monad testnet." />
      </Shell>
    );
  }

  if (joinMode === "code" && resolvedAddress === undefined) {
    return (
      <Shell>
        <div className="text-center py-16 text-sm text-foreground/50">Looking up invite…</div>
      </Shell>
    );
  }

  if (joinMode === "code" && resolvedAddress === null) {
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
        <div className="rounded-2xl bg-surface p-4 space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setJoinMode("code")} className={`flex-1 rounded-full px-3 py-2 text-sm ${joinMode === "code" ? "bg-foreground text-background" : "bg-background"}`}>
              Join with invite code
            </button>
            <button type="button" onClick={() => setJoinMode("address")} className={`flex-1 rounded-full px-3 py-2 text-sm ${joinMode === "address" ? "bg-foreground text-background" : "bg-background"}`}>
              Join with wallet address
            </button>
          </div>
          {joinMode === "address" && (
            <div className="space-y-2">
              <input value={manualAddress} onChange={(e) => setManualAddress(e.target.value)} placeholder="0x..." className="input" />
              <button
                type="button"
                onClick={() => {
                  if (!address || !manualAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
                    setRequestStatus("Enter a valid wallet address first.");
                    return;
                  }
                  if (typeof window !== "undefined") {
                    const current = window.localStorage.getItem(`pending-invites:${address}`);
                    const invites = current ? JSON.parse(current) : [];
                    const next = invites.includes(manualAddress) ? invites : [...invites, manualAddress];
                    window.localStorage.setItem(`pending-invites:${address}`, JSON.stringify(next));
                  }
                  setRequestStatus("Invite request saved. Open your dashboard to accept it.");
                }}
                className="w-full rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                Send join request
              </button>
              <p className="text-xs text-foreground/60">Enter the Ajoo savings address you were invited to. Ajoo stores the request locally for your wallet so you can accept it from the dashboard once connected.</p>
              {requestStatus && <p className="text-xs text-accent">{requestStatus}</p>}
            </div>
          )}
        </div>
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

            {address && <p className="text-xs text-foreground/60">Connected wallet: {address.slice(0, 8)}…{address.slice(-4)}</p>}
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
            <div className="rounded-2xl border border-foreground/10 bg-background/70 p-4 text-sm text-foreground/70">
              <p className="font-medium">Invitation request</p>
              <p className="mt-1 text-xs">When the creator sends you an invite, Ajoo will surface a request in your dashboard and you can accept it from your wallet once connected.</p>
            </div>
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
