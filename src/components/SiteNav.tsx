import { Link, useRouterState } from "@tanstack/react-router";
import { WalletButton } from "./WalletButton";

const links = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/group", label: "Group" },
  { to: "/payout", label: "Payout" },
] as const;

export function SiteNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 bg-background/80 backdrop-blur-md border-b border-foreground/5">
      <Link to="/" className="flex items-center gap-2 min-w-0">
        <span className="grid place-items-center size-8 rounded-full bg-foreground text-background">
          <span className="size-3 rounded-full border-2 border-background" />
        </span>
        <span className="font-display italic text-xl sm:text-2xl font-semibold tracking-tight leading-none">
          Ajoo
        </span>
      </Link>
      <div className="hidden md:flex items-center gap-1 rounded-full bg-surface/70 border border-foreground/5 p-1">
        {links.map((l) => {
          const active = pathname === l.to;
          return (
            <Link
              key={l.to}
              to={l.to}
              className={
                active
                  ? "px-4 py-1.5 rounded-full text-sm font-medium bg-foreground text-background"
                  : "px-4 py-1.5 rounded-full text-sm font-medium text-foreground/70 hover:text-foreground"
              }
            >
              {l.label}
            </Link>
          );
        })}
      </div>
      <WalletButton />
    </nav>
  );
}
