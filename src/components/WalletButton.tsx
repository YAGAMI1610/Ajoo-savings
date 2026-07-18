import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monadTestnet } from "@/lib/web3/chain";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletButton() {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();

  const injectedConnector = connectors.find((connector) => connector.id === "injected") ?? connectors[0];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const triggerClassName =
    "inline-flex items-center gap-2 rounded-full bg-foreground px-3.5 py-2 text-xs font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90 sm:text-sm";

  const panelClassName =
    "absolute right-0 top-full mt-2 min-w-[220px] rounded-2xl border border-foreground/10 bg-background p-1.5 shadow-xl shadow-foreground/5";

  if (isConnected && address) {
    const wrongNetwork = chainId !== monadTestnet.id;

    return (
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className={triggerClassName}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Wallet className="size-3.5" />
          <span className="max-w-[7rem] truncate">{wrongNetwork ? "Wrong network" : short(address)}</span>
          <ChevronDown className="size-3.5" />
        </button>

        {menuOpen ? (
          <div className={panelClassName} role="menu">
            {wrongNetwork ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  switchChain({ chainId: monadTestnet.id });
                }}
                disabled={isSwitchPending}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {isSwitchPending ? "Switching to Monad…" : "Switch to Monad Testnet"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate({ to: "/dashboard" });
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                Open dashboard
              </button>
            )}

            <div className="my-1 h-px bg-foreground/10" />

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                disconnect();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/5"
            >
              Disconnect wallet
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!injectedConnector) return;
          connect({ connector: injectedConnector });
        }}
        disabled={isPending || !injectedConnector}
        className={triggerClassName}
      >
        <Wallet className="size-3.5" />
        <span>{isPending ? "Connecting…" : "Connect wallet"}</span>
      </button>
    </div>
  );
}
