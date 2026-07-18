import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const connectorOptions = readyConnectors.length > 0 ? readyConnectors : connectors;

  const triggerClassName =
    "inline-flex items-center gap-2 rounded-full bg-foreground px-3.5 py-2 text-xs font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90 sm:text-sm";

  if (isConnected && address) {
    const wrongNetwork = chainId !== monadTestnet.id;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={triggerClassName}>
          <Wallet className="size-3.5" />
          <span className="max-w-[7rem] truncate">{wrongNetwork ? "Wrong network" : short(address)}</span>
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {wrongNetwork ? (
            <DropdownMenuItem
              onSelect={() => switchChain({ chainId: monadTestnet.id })}
              disabled={isSwitchPending}
            >
              {isSwitchPending ? "Switching to Monad…" : "Switch to Monad Testnet"}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => navigate({ to: "/dashboard" })}>
              Open dashboard
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => disconnect()}
            className="text-destructive focus:text-destructive"
          >
            Disconnect wallet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (!connectorOptions.length) {
    return (
      <button className={triggerClassName} disabled>
        <Wallet className="size-3.5" />
        <span>No wallet</span>
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClassName}>
        <Wallet className="size-3.5" />
        <span>{isPending ? "Connecting…" : "Connect"}</span>
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {connectorOptions.map((connector) => (
          <DropdownMenuItem
            key={connector.id}
            onSelect={() => connect({ connector })}
            disabled={isPending || !connector.ready}
          >
            {connector.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
