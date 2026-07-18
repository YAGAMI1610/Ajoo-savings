import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAccount } from "wagmi";
import { SiteNav } from "@/components/SiteNav";
import { Disclaimer } from "@/components/Disclaimer";
import { useCreateCircle } from "@/hooks/useCircles";
import { generateInviteCode, hashInviteCode, inviteLink } from "@/lib/invite";
import { registerInvite } from "@/lib/inviteRegistry";
import { IS_FACTORY_CONFIGURED, TOKENS, type Frequency, type TokenSymbol } from "@/lib/web3/contracts";
import { monadTestnet } from "@/lib/web3/chain";

export const Route = createFileRoute("/create")({
  component: CreateCircle,
  head: () => ({
    meta: [
      { title: "Start a circle — Ajoo" },
      { name: "description", content: "Create a private savings circle for people you trust." },
    ],
  }),
});

function CreateCircle() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const { createCircle, isPending, isConfirming, isConfirmed, hash, error } = useCreateCircle();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState<TokenSymbol>("MON");
  const [amount, setAmount] = useState("0.05");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [collateral, setCollateral] = useState("0");
  const [initialDeposit, setInitialDeposit] = useState("0");
  const [acknowledged, setAcknowledged] = useState(false);
  const [inviteCode] = useState(() => generateInviteCode());
  const [savedLocally, setSavedLocally] = useState(false);

  const selectedToken = TOKENS[tokenSymbol];

  const canSubmit =
    IS_FACTORY_CONFIGURED &&
    selectedToken.isConfigured &&
    isConnected &&
    acknowledged &&
    name.trim().length > 1 &&
    !isPending &&
    !isConfirming;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    createCircle({
      name: name.trim(),
      description: description.trim(),
      contributionAmount: amount,
      frequency,
      maxParticipants,
      collateralAmount: collateral,
      initialDepositAmount: initialDeposit,
      inviteCode,
      tokenSymbol,
    });
  }

  // Once the tx is confirmed we don't yet know the deployed circle address
  // client-side without reading the CircleCreated event — for the hackathon
  // build we persist the invite code against the wallet+timestamp locally and
  // point people to the dashboard, which resolves "my circles" from the
  // factory directly.
  if (isConfirmed && !savedLocally) {
    if (typeof window !== "undefined" && address) {
      window.localStorage.setItem(`pending-invite:${address}`, inviteCode);
      window.localStorage.setItem(`invite:${address}`, inviteCode);
    }
    registerInvite({
      data: { codeHash: hashInviteCode(inviteCode), circleAddress: "pending", chainId: monadTestnet.id },
    }).catch(() => {});
    setSavedLocally(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="max-w-xl mx-auto px-4 py-8 sm:px-5 sm:py-10 md:py-16 space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 font-medium">New circle</p>
          <h1 className="font-display text-4xl md:text-5xl italic leading-tight">Start a savings circle</h1>
        </header>

        <Disclaimer />

        {!IS_FACTORY_CONFIGURED && (
          <div className="rounded-2xl bg-clay/10 border border-clay/30 p-4 text-sm text-foreground/70">
            Contracts aren't deployed yet, so creation is disabled. Set <code>VITE_CIRCLE_FACTORY_ADDRESS</code>{" "}
            after deploying <code>contracts/</code> to Monad testnet.
          </div>
        )}

        {isConfirmed ? (
          <div className="rounded-2xl bg-moss/10 border border-moss/30 p-6 space-y-4">
            <h2 className="font-semibold">Circle created 🎉</h2>
            <p className="text-sm text-foreground/70">
              Share this invite code with the people you're inviting. It's shown only once — save it somewhere
              safe before you leave this page.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background text-sm font-mono break-all">{inviteLink(inviteCode)}</code>
              <button
                onClick={() => navigator.clipboard.writeText(inviteLink(inviteCode))}
                className="px-3 py-2 rounded-lg bg-foreground text-background text-xs font-medium"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium"
            >
              Go to dashboard →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field label="Group name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sunday Brunch Club"
                className="input"
                maxLength={64}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Cousins and close friends saving together monthly."
                className="input min-h-20"
                maxLength={280}
              />
            </Field>
            <Field label="Contribute in">
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(TOKENS) as TokenSymbol[]).map((sym) => {
                  const t = TOKENS[sym];
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        setTokenSymbol(sym);
                        setAmount(sym === "USDC" ? "5" : "0.05");
                        setCollateral("0");
                        setInitialDeposit("0");
                      }}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition text-left ${
                        tokenSymbol === sym
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/15 bg-background hover:border-foreground/40"
                      }`}
                    >
                      <span className="block">{t.symbol}</span>
                      <span className={`block text-xs font-normal ${tokenSymbol === sym ? "text-background/70" : "text-foreground/50"}`}>
                        {t.isNative ? "Native gas token" : "Stablecoin"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!selectedToken.isConfigured && (
                <p className="text-xs text-clay mt-2">
                  USDC isn't configured for this deployment yet — set <code>VITE_USDC_TESTNET_ADDRESS</code> to enable it.
                </p>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Contribution amount (${selectedToken.symbol})`}>
                <input
                  type="number"
                  min={selectedToken.isNative ? "0.001" : "0.01"}
                  step={selectedToken.isNative ? "0.001" : "0.01"}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input"
                  required
                />
              </Field>
              <Field label="Frequency">
                <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="input">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max participants">
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="input"
                  required
                />
              </Field>
              <Field label={`Collateral per member (${selectedToken.symbol}, optional)`}>
                <input
                  type="number"
                  min="0"
                  step={selectedToken.isNative ? "0.001" : "0.01"}
                  value={collateral}
                  onChange={(e) => setCollateral(e.target.value)}
                  className="input"
                />
              </Field>
            </div>

            <Field label={`Initial deposit to fund the circle (${selectedToken.symbol}, optional)`}>
              <input
                type="number"
                min="0"
                step={selectedToken.isNative ? "0.001" : "0.01"}
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(e.target.value)}
                className="input"
              />
              <p className="text-xs text-foreground/50">
                This amount is charged alongside the gas for creating the circle and becomes the opening balance.
              </p>
            </Field>

            <label className="flex items-start gap-3 text-sm text-foreground/70">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1"
                required
              />
              I understand Ajoo is for trusted friends and family only, and that I'm responsible for
              choosing who I invite.
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full px-5 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50"
            >
              {!isConnected
                ? "Connect your wallet first"
                : isPending
                  ? "Confirm in wallet…"
                  : isConfirming
                    ? "Deploying circle…"
                    : "Create circle"}
            </button>

            {hash && (
              <p className="text-xs text-foreground/50 text-center">
                Tx:{" "}
                <a
                  href={`${monadTestnet.blockExplorers.default.url}/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {hash}
                </a>
              </p>
            )}
            {error && <p className="text-xs text-destructive text-center">{error.message}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wide text-foreground/50 font-medium">{label}</span>
      {children}
    </label>
  );
}
