# Ajoo

**Save together with people you trust.**

Ajoo brings traditional community savings circles — Ajo, Esusu, ROSCA —
onchain. It doesn't replace trust between family and friends; it removes the
spreadsheets, screenshots, and reliance on one person to keep the books
straight. Groups are private and invite-only, contribution rounds and payouts
are enforced by a smart contract on Monad testnet, and the payout order is
drawn once, onchain, and can never change.

> ⚠️ Ajoo is designed for trusted friends and family members only.
> Ajoo cannot guarantee that participants will continue contributing
> after receiving their payout. Never create a savings circle with strangers.

---

## What's real here

- **Smart contracts** (`/contracts`) — `CircleFactory.sol` and `Circle.sol`,
  written in Solidity, with a Foundry test suite covering the full lifecycle:
  joining, invite-code verification, the payout-order draw, automatic
  round-by-round payouts, circle completion, and collateral slashing on
  default.
- **Frontend** (`/src`) — TanStack Start + React 19, wired to the contracts
  with `wagmi`/`viem`. There is no mock data: the dashboard, group page, and
  payout reveal all read live contract state, and every action (create, join,
  contribute) is a real transaction signed by the connected wallet.
- **Invite system** — invite codes are generated client-side and never stored
  in plaintext anywhere. Only `keccak256(code)` goes onchain; a small server
  registry (`src/lib/inviteRegistry.ts`) maps that hash to a circle address
  so a link can be resolved without a public, browsable group list.

## What's a placeholder right now

`VITE_CIRCLE_FACTORY_ADDRESS` in `.env` is the zero address by default. Every
page that needs it detects this and shows an explicit "contracts not deployed
yet" state — it never fakes data or a fake success message. Deploy the
contracts (below), set the real address, and the whole app comes alive against
Monad testnet.

Randomness for the payout order is a documented, intentional tradeoff — see
[`contracts/README.md`](contracts/README.md#randomness) for why, and what a
production version would use instead.

---

## Run it in under 3 minutes

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# leave VITE_CIRCLE_FACTORY_ADDRESS as-is to explore the UI's empty states,
# or paste in a deployed CircleFactory address (see Deploying below)

# 3. Run
npm run dev
```

Open the printed local URL. Connect a wallet on Monad testnet (get test MON
from the [Monad testnet faucet](https://faucet.monad.xyz)) to create or join
circles once contracts are deployed.

## Deploying the contracts

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit   # first time only
forge build
forge test -vvv

forge script script/Deploy.s.sol:Deploy \
  --rpc-url monad_testnet \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

Copy the printed `CircleFactory deployed at:` address into
`VITE_CIRCLE_FACTORY_ADDRESS` in your root `.env`, restart `npm run dev`, and
the frontend is live against Monad testnet.

> **Sandbox note:** this repository was assembled in an environment without
> outbound network access, so `forge build`/`forge test` could not be run here
> to produce a compiled artifact. The contracts and tests are written to
> compile cleanly under `solc 0.8.24` with `forge-std`; run the commands above
> locally (or in CI) before your demo to confirm, and fix forward if anything
> surfaces — nothing here has been silently skipped.

---

## Project structure

```
src/
  routes/            TanStack Start file-based routes (/, /dashboard, /group,
                      /payout, /create, /join/$code)
  hooks/useCircles.ts wagmi hooks: create, join, contribute, read circle state
  lib/web3/           chain config, contract addresses, hand-authored ABIs
  lib/invite.ts       invite code generation + hashing (client-side only)
  lib/server/         invite registry server function (file-backed store)
  lib/circleMembers.ts turns raw addresses + onchain flags into display members
  components/         SavingsWheel, SiteNav, WalletButton, Disclaimer, Reveal
contracts/
  src/Circle.sol          one savings circle: membership, rounds, payouts, slashing
  src/CircleFactory.sol   deploys circles, tracks reputation, resolves "my circles"
  script/Deploy.s.sol     Foundry deploy script
  test/Circle.t.sol       full lifecycle test suite
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for how the pieces fit together. A
recorded demo video is included with the submission in place of a written
walkthrough.
