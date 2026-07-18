# Architecture

## Overview

```
┌─────────────────────┐        ┌──────────────────────────┐
│   Browser (wallet)   │        │      Monad Testnet        │
│                      │  RPC   │                            │
│  TanStack Start SPA  │◄──────►│  CircleFactory.sol         │
│  wagmi + viem        │  txs   │    └─ creates ──► Circle.sol│
│                      │        │         (one per group)    │
└──────────┬───────────┘        └──────────────────────────┘
           │ HTTP (invite lookup only)
           ▼
┌──────────────────────┐
│ TanStack Start server │
│ fn: inviteRegistry.ts │
│  (file-backed JSON)   │
└──────────────────────┘
```

Money, membership, rounds, and the payout order all live **onchain** — the
contract is the single source of truth. The only thing that lives off-chain
is the mapping from an invite *code* to a circle *address*, because storing
that mapping (or worse, a plaintext code) onchain would either be needlessly
expensive or leak which codes are valid to anyone reading chain state.

## Why this split

**Frontend never trusts itself.** Every number shown (contribution amount,
round, pool size, member list, payout order) comes from a `useReadContract` /
`useReadContracts` call against the live contract, refetched on an interval.
There's no client-side model of "what should be true" — if the contract
disagrees with the UI, the UI is wrong and will self-correct on the next
refetch.

**Invite codes stay off private-group leakage risk.** A circle's existence
and address are technically visible to anyone reading the `CircleCreated`
event log — that's unavoidable on a public chain. What Ajoo protects is
*joining*: `join()` reverts unless you supply a code whose hash matches, and
the frontend never exposes a way to enumerate circles you weren't invited to.
The server-side registry exists purely so pasting an invite link resolves
instantly instead of requiring a client-side event-log scan.

**Reputation is best-effort, not load-bearing.** `CircleFactory` tracks
`circlesCompleted` / `circlesDefaulted` via callbacks from each `Circle`
(wrapped in `try/catch` so a reputation-tracking failure can never block a
real join, contribution, or payout). It's a nice-to-have signal for the
"Trusted Saver" badge, not a security boundary.

## Data flow for the core loop

1. **Create** (`/create`): frontend generates an invite code locally, hashes
   it, calls `CircleFactory.createCircle(...)`. On confirmation, the invite
   code is shown once and the hash→address mapping is registered server-side.
2. **Invite** (`/join/$code`): resolves the code's hash against the registry
   to get a circle address, then reads the circle's live state to show real
   details before the wallet ever signs anything.
3. **Join**: calls `Circle.join(code)` with the exact collateral value. The
   contract re-verifies the hash itself — the server registry is a lookup
   convenience, never a trust boundary.
4. **Fill → draw**: the moment the last seat is taken, `join()` internally
   calls `_fillGroup()` → `_drawPayoutOrder()` in the same transaction. The
   order is emitted (`PayoutOrderDrawn`) and permanently stored.
5. **Contribute → payout**: each `contribute()` call is a real value-bearing
   transaction. The contract auto-pays the round's recipient the instant every
   member has paid, in the same transaction as the final contribution — there
   is no separate "trigger payout" step for anyone to forget.
6. **Completion**: after the last round, the contract flips to `Completed` and
   reverts any further `contribute()` calls.

## Frontend structure

TanStack Start's file-based router maps directly to the user flow:
`/` (landing) → `/create` or `/join/$code` → `/dashboard` → `/group` →
`/payout` (the reveal). `SavingsWheel` is the one visualization shared across
dashboard, group, and payout — it's driven entirely by the `Member[]` shape
in `lib/circleMembers.ts`, which is a pure function of onchain data (no
fabricated names/photos: unknown wallets render as their address + a
deterministic identicon color).
