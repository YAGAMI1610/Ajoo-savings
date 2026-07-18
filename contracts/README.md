# Ajoo contracts

Solidity 0.8.24, Foundry. Two contracts:

### `CircleFactory.sol`

Deploys a new `Circle` per group. Deliberately has **no function to list or
browse circles** — Ajoo groups are never public. It only tracks:

- which circle addresses were created and by whom (needed for `getCirclesForMember`,
  so a connected wallet can find its own circles),
- a lightweight, best-effort reputation record per wallet (`circlesCompleted`,
  `circlesDefaulted`), used for the "Trusted Saver" badge (3+ completed
  circles, zero defaults).

### `Circle.sol`

One private savings circle. Lifecycle:

`Open → Full → Active → Completed` (or `Cancelled` if the creator pulls out
before it fills).

- **Invites**: `join()` takes the plaintext invite code and checks
  `keccak256(code) == inviteCodeHash`. The plaintext code is never stored
  onchain — only the hash, set at creation and rotatable by the creator until
  the group fills. `closeInvites()` lets a creator lock things manually too.
- **Payout order**: drawn exactly once, automatically, the instant the last
  seat fills (`_drawPayoutOrder`, called from `_fillGroup`). Stored in
  `payoutOrder` and never touched again — there is no function that can
  modify it after `payoutOrderDrawn` is set.
- **Rounds**: `contribute()` requires the exact contribution amount, tracks
  who has paid this round, and automatically pays the whole pool to
  `payoutOrder[currentRound - 1]` the instant everyone has paid.
- **Collateral & slashing**: if a member already received their payout and
  then misses a subsequent round's deadline, anyone can call `markDefault()`.
  Their collateral is slashed and split pro-rata among members still waiting
  for their turn — since they're the ones actually exposed by a default.

## Randomness

Payout order is drawn from a commit-reveal scheme, not block data alone:

1. **Commit** — any time while the group is still `Open`, a member can call
   `commitSeed(keccak256(secret, memberAddress))` to lock in a secret only
   they know. Commitments are optional and can't be changed once set.
2. **Reveal** — once the group is `Full`, committed members call
   `revealSeed(secret)`. Each reveal XORs the secret into an accumulator.
   The instant every committed member has revealed, `_drawPayoutOrder()` runs
   automatically in that same transaction.
3. **Fallback** — if a committed member won't reveal, anyone can call
   `finalizeDraw()` once `REVEAL_WINDOW` (1 day) has passed since the group
   filled, drawing from whatever was revealed by then. If nobody committed at
   all, the draw happens immediately on fill, same as before.

The final seed is `keccak256(revealAccumulator, block.prevrandao,
block.timestamp, block.number, address(this), memberCount, revealCount)` —
still a Fisher-Yates shuffle, still not a VRF, but no longer determined by
block data alone. A commitment is fixed before anyone (including a block
producer) knows the final member list or fill order, and can't be changed
retroactively because it's hash-locked. This degrades gracefully: a group
with zero commitments gets exactly the old block-data-only randomness, never
worse. An oracle-based VRF remains the natural next step if/when one is
broadly available on Monad mainnet, but wasn't required to close the gap
called out here.

## Testing

```bash
forge test -vvv
```

`test/Circle.t.sol` covers: creator auto-membership, invite-code rejection,
duplicate-join rejection, the group filling and drawing a full permutation as
its payout order, joins being rejected once full, a full contribution round
correctly paying the drawn recipient, the circle marking itself `Completed`
after every member has been paid exactly once (and rejecting further
contributions), and collateral slashing redistributing to members still owed
a payout.

## Deploying

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url monad_testnet \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

After deployment, copy the emitted `CircleFactory` address into the frontend
environment variable `VITE_CIRCLE_FACTORY_ADDRESS` and rebuild the app:

```bash
cd ..
npm run check:deploy
npm run build
```
