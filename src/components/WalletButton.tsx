import { useNavigate } from "@tanstack/react-router";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monadTestnet } from "@/lib/web3/chain";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletButton() {
  const navigate = useNavigate();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();

  if (isConnected && address) {
    const wrongNetwork = chainId !== monadTestnet.id;
    return (
      <button
        onClick={() => {
          if (wrongNetwork) {
            switchChain({ chainId: monadTestnet.id });
            return;
          }
          navigate({ to: "/dashboard" });
        }}
        className={
          wrongNetwork
            ? "px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/15 transition-colors"
            : "px-4 py-2 rounded-full bg-surface border border-foreground/10 text-sm font-medium hover:bg-foreground/5 transition-colors"
        }
        title={wrongNetwork ? "Wrong network — switch to Monad Testnet" : "Click to disconnect"}
      >
        {wrongNetwork ? (isSwitchPending ? "Switching…" : "Switch network") : short(address)}
      </button>
    );
  }

  const injectedConnector = connectors.find((c) => c.id === "injected") ?? connectors[0];

  return (
    <button
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      disabled={isPending || !injectedConnector}
      className="px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
    >
      {isPending ? "Connecting…" : injectedConnector ? "Connect wallet" : "No wallet found"}
    </button>
  );
}
