import { createServerFn } from "@tanstack/react-start";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Ajoo never lets groups be publicly browsable. This registry exists
 * purely so a wallet holding a valid invite code can resolve it to a circle
 * address without scanning every CircleCreated event on-chain (which would
 * work, but is slow and — if done via a public indexer — starts to leak
 * "a circle exists" info to people without the code).
 *
 * Storage is a flat JSON file for the hackathon build. It stores only:
 *   keccak256(code) -> { circleAddress, chainId }
 * Never the plaintext code, never balances, never member lists — those live
 * on-chain and are read directly from the contract once you have the address.
 *
 * Swap the persistence layer for Postgres/Redis before real production use;
 * the read/write functions below are the only two places that would change.
 */

const DB_PATH = path.join(process.cwd(), ".data", "invite-registry.json");

type RegistryEntry = { circleAddress: string; chainId: number; createdAt: number };
type Registry = Record<string, RegistryEntry>;

async function readRegistry(): Promise<Registry> {
  if (!existsSync(DB_PATH)) return {};
  try {
    const raw = await readFile(DB_PATH, "utf-8");
    return JSON.parse(raw) as Registry;
  } catch {
    return {};
  }
}

async function writeRegistry(registry: Registry): Promise<void> {
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

export const registerInvite = createServerFn({ method: "POST" })
  .validator((d: { codeHash: string; circleAddress: string; chainId: number }) => d)
  .handler(async ({ data }) => {
    const registry = await readRegistry();
    registry[data.codeHash.toLowerCase()] = {
      circleAddress: data.circleAddress,
      chainId: data.chainId,
      createdAt: Date.now(),
    };
    await writeRegistry(registry);
    return { ok: true as const };
  });

export const resolveInvite = createServerFn({ method: "GET" })
  .validator((d: { codeHash: string }) => d)
  .handler(async ({ data }) => {
    const registry = await readRegistry();
    const entry = registry[data.codeHash.toLowerCase()];
    if (!entry) return { found: false as const };
    return { found: true as const, ...entry };
  });
