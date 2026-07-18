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
  const readyConnectors = connectors.filter((connector) => connector.ready);
  const connectorButtons = readyConnectors.length > 0 ? readyConnectors : connectors;

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
        title={wrongNetwork ? "Wrong network — switch to Monad Testnet" : "Go to your wallet dashboard"}
      >
        {wrongNetwork ? (isSwitchPending ? "Switching…" : "Switch network") : short(address)}
      </button>
    );
  }

  return connectorButtons.length > 1 ? (
    <div className="flex flex-wrap gap-2">
      {connectorButtons.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
          disabled={isPending || !connector.ready}
          className="px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {isPending ? "Connecting…" : `Connect ${connector.name}`}
        </button>
      ))}
    </div>
  ) : (
    <button
      onClick={() => connectorButtons[0] && connect({ connector: connectorButtons[0] })}
      disabled={isPending || !connectorButtons[0]}
      className="px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
    >
      {isPending ? "Connecting…" : connectorButtons[0] ? `Connect ${connectorButtons[0].name}` : "No wallet found"}
    </button>
  );
}
