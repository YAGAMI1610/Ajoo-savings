import { keccak256, toBytes } from "viem";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

/** Generates a hard-to-guess invite code like CIRCLE-X7K9P2. */
export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let suffix = "";
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `CIRCLE-${suffix}`;
}

/** keccak256 hash of the plaintext code — this, not the code itself, goes on-chain. */
export function hashInviteCode(code: string): `0x${string}` {
  return keccak256(toBytes(code.trim().toUpperCase()));
}

export function inviteLink(code: string): string {
  const base =
    typeof window !== "undefined" ? window.location.origin : "https://ajoo.app";
  return `${base}/join/${encodeURIComponent(code)}`;
}
