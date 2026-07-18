export type MemberStatus = "paid" | "pending" | "received" | "upcoming";

export type Member = {
  id: string; // wallet address
  address: `0x${string}`;
  name: string; // short address — we never invent a display name for a real wallet
  status: MemberStatus;
  round?: number; // 1-indexed payout round, if the order has been drawn
  color: string; // deterministic identicon color, derived from the address
};

const PALETTE = [
  "var(--clay)",
  "var(--moss)",
  "#E8C77E",
  "#C08552",
  "#7A8B69",
  "#B5654B",
  "#9AA37A",
  "#D9A441",
];

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function colorForAddress(addr: string): string {
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = (hash * 31 + addr.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/**
 * Builds the member list the UI renders from real on-chain data:
 * - `members`: every address currently in the circle
 * - `payoutOrder`: the immutable draw result (empty until the group fills)
 * - `hasReceivedByAddress` / `hasContributedByAddress`: per-member on-chain flags
 * - `currentRound`: circle.currentRound()
 */
export function buildMembers(params: {
  members: `0x${string}`[];
  payoutOrder: `0x${string}`[];
  hasReceivedByAddress: Record<string, boolean>;
  hasContributedByAddress: Record<string, boolean>;
  currentRound: number;
}): Member[] {
  const { members, payoutOrder, hasReceivedByAddress, hasContributedByAddress, currentRound } = params;
  const roundOf = new Map<string, number>();
  payoutOrder.forEach((addr, i) => roundOf.set(addr.toLowerCase(), i + 1));

  return members.map((address) => {
    const round = roundOf.get(address.toLowerCase());
    const received = hasReceivedByAddress[address.toLowerCase()];
    const contributed = hasContributedByAddress[address.toLowerCase()];

    let status: MemberStatus;
    if (received) status = "received";
    else if (round === currentRound && contributed) status = "paid";
    else if (round === currentRound) status = "pending";
    else status = "upcoming";

    return {
      id: address,
      address,
      name: shortAddress(address),
      status,
      round,
      color: colorForAddress(address),
    };
  });
}
