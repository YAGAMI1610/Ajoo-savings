import { useEffect, useState } from "react";
import { useWatchContractEvent } from "wagmi";
import { circleAbi } from "@/lib/web3/contracts";

export type CircleActivityType = "invite-sent" | "invite-accepted" | "invite-rejected" | "deposit" | "contribution" | "withdrawal";

export interface CircleActivityEntry {
  id: string;
  circleAddress: string;
  actor: string;
  type: CircleActivityType;
  title: string;
  message: string;
  createdAt: string;
}

const STORAGE_PREFIX = "ajoo-circle-activity";

function getStorageKey(circleAddress: string) {
  return `${STORAGE_PREFIX}:${circleAddress.toLowerCase()}`;
}

export function readCircleActivity(circleAddress?: string | null): CircleActivityEntry[] {
  if (typeof window === "undefined" || !circleAddress) return [];

  try {
    const raw = window.localStorage.getItem(getStorageKey(circleAddress));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCircleActivity(circleAddress: string, entries: CircleActivityEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(circleAddress), JSON.stringify(entries));
  } catch {
    // Ignore storage failures so the app keeps working even in restricted browser contexts.
  }
}

export function appendCircleActivity(
  circleAddress: string | undefined,
  entry: Omit<CircleActivityEntry, "id" | "createdAt">
): CircleActivityEntry[] {
  if (!circleAddress) return [];

  const nextEntry: CircleActivityEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  };

  const existing = readCircleActivity(circleAddress);
  const updated = [nextEntry, ...existing].slice(0, 20);
  writeCircleActivity(circleAddress, updated);
  return updated;
}

export function useCircleActivityFeed(circleAddress?: string | null) {
  const [entries, setEntries] = useState<CircleActivityEntry[]>(() => readCircleActivity(circleAddress));

  useEffect(() => {
    setEntries(readCircleActivity(circleAddress));
  }, [circleAddress]);

  const addEntry = (entry: CircleActivityEntry) => {
    setEntries((current) => {
      if (current.some((item) => item.id === entry.id)) return current;
      const next = [entry, ...current].slice(0, 20);
      if (circleAddress) writeCircleActivity(circleAddress, next);
      return next;
    });
  };

  useWatchContractEvent({
    address: (circleAddress as `0x${string}` | undefined) ?? undefined,
    abi: circleAbi as any,
    eventName: "MemberInvited",
    onLogs: (logs) => {
      logs.forEach((log: any) => {
        const args = log.args as { circle?: string; invited?: string; invitedBy?: string } | undefined;
        if (!args?.circle || !args.invited) return;
        addEntry({
          id: `${log.transactionHash}-${log.logIndex}`,
          circleAddress: args.circle,
          actor: args.invitedBy ?? "unknown",
          type: "invite-sent",
          title: "Invite sent",
          message: `${(args.invitedBy ?? "A creator").slice(0, 8)}…${(args.invitedBy ?? "").slice(-4)} invited ${(args.invited ?? "a wallet").slice(0, 8)}…${(args.invited ?? "").slice(-4)}.`,
          createdAt: new Date().toISOString(),
        });
      });
    },
  });

  useWatchContractEvent({
    address: (circleAddress as `0x${string}` | undefined) ?? undefined,
    abi: circleAbi as any,
    eventName: "MemberJoined",
    onLogs: (logs) => {
      logs.forEach((log: any) => {
        const args = log.args as { member?: string } | undefined;
        if (!args?.member) return;
        addEntry({
          id: `${log.transactionHash}-${log.logIndex}`,
          circleAddress: circleAddress ?? "",
          actor: args.member,
          type: "contribution",
          title: "Member joined",
          message: `${args.member.slice(0, 8)}…${args.member.slice(-4)} joined the circle.`,
          createdAt: new Date().toISOString(),
        });
      });
    },
  });

  useWatchContractEvent({
    address: (circleAddress as `0x${string}` | undefined) ?? undefined,
    abi: circleAbi as any,
    eventName: "ContributionMade",
    onLogs: (logs) => {
      logs.forEach((log: any) => {
        const args = log.args as { member?: string } | undefined;
        if (!args?.member) return;
        addEntry({
          id: `${log.transactionHash}-${log.logIndex}`,
          circleAddress: circleAddress ?? "",
          actor: args.member,
          type: "contribution",
          title: "Contribution made",
          message: `${args.member.slice(0, 8)}…${args.member.slice(-4)} made a contribution.`,
          createdAt: new Date().toISOString(),
        });
      });
    },
  });

  useWatchContractEvent({
    address: (circleAddress as `0x${string}` | undefined) ?? undefined,
    abi: circleAbi as any,
    eventName: "FundsDeposited",
    onLogs: (logs) => {
      logs.forEach((log: any) => {
        const args = log.args as { creator?: string } | undefined;
        if (!args?.creator) return;
        addEntry({
          id: `${log.transactionHash}-${log.logIndex}`,
          circleAddress: circleAddress ?? "",
          actor: args.creator,
          type: "deposit",
          title: "Funds deposited",
          message: `${args.creator.slice(0, 8)}…${args.creator.slice(-4)} funded the circle.`,
          createdAt: new Date().toISOString(),
        });
      });
    },
  });

  useWatchContractEvent({
    address: (circleAddress as `0x${string}` | undefined) ?? undefined,
    abi: circleAbi as any,
    eventName: "PayoutWithdrawn",
    onLogs: (logs) => {
      logs.forEach((log: any) => {
        const args = log.args as { recipient?: string } | undefined;
        if (!args?.recipient) return;
        addEntry({
          id: `${log.transactionHash}-${log.logIndex}`,
          circleAddress: circleAddress ?? "",
          actor: args.recipient,
          type: "withdrawal",
          title: "Payout withdrawn",
          message: `${args.recipient.slice(0, 8)}…${args.recipient.slice(-4)} withdrew a payout.`,
          createdAt: new Date().toISOString(),
        });
      });
    },
  });

  return entries;
}
