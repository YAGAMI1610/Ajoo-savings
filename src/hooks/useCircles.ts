import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { generateInviteCode, hashInviteCode } from "@/lib/invite";
import {
  CIRCLE_FACTORY_ADDRESS,
  IS_FACTORY_CONFIGURED,
  circleAbi,
  circleFactoryAbi,
  erc20Abi,
  type Frequency,
  FREQUENCY_SECONDS,
  TOKENS,
  type TokenSymbol,
  tokenForAddress,
} from "@/lib/web3/contracts";

export const CircleStatus = ["Open", "Full", "Active", "Completed", "Cancelled"] as const;

/** Circles the connected wallet has created or joined. */
export function useMyCircles(address?: `0x${string}`) {
  return useReadContract({
    address: CIRCLE_FACTORY_ADDRESS,
    abi: circleFactoryAbi,
    functionName: "getCirclesForMember",
    args: address ? [address] : undefined,
    query: { enabled: IS_FACTORY_CONFIGURED && Boolean(address) },
  });
}

export function useTrustedSaver(address?: `0x${string}`) {
  return useReadContract({
    address: CIRCLE_FACTORY_ADDRESS,
    abi: circleFactoryAbi,
    functionName: "isTrustedSaver",
    args: address ? [address] : undefined,
    query: { enabled: IS_FACTORY_CONFIGURED && Boolean(address) },
  });
}

/** Full on-chain snapshot of a single circle, batched into one multicall. */
export function useCircleState(circleAddress?: `0x${string}`) {
  const contractBase = { address: circleAddress, abi: circleAbi } as const;

  const { data, ...rest } = useReadContracts({
    contracts: [
      { ...contractBase, functionName: "name" },
      { ...contractBase, functionName: "description" },
      { ...contractBase, functionName: "creator" },
      { ...contractBase, functionName: "contributionAmount" },
      { ...contractBase, functionName: "frequencySeconds" },
      { ...contractBase, functionName: "maxParticipants" },
      { ...contractBase, functionName: "collateralRequired" },
      { ...contractBase, functionName: "token" },
      { ...contractBase, functionName: "status" },
      { ...contractBase, functionName: "currentRound" },
      { ...contractBase, functionName: "roundDeadline" },
      { ...contractBase, functionName: "poolBalance" },
      { ...contractBase, functionName: "payoutOrderDrawn" },
      { ...contractBase, functionName: "getMembers" },
      { ...contractBase, functionName: "getPayoutOrder" },
      { ...contractBase, functionName: "invitesLocked" },
    ],
    query: { enabled: Boolean(circleAddress), refetchInterval: 6000 },
  });

  const parsed = useMemo(() => {
    if (!data) return undefined;
    const [
      name,
      description,
      creator,
      contributionAmount,
      frequencySeconds,
      maxParticipants,
      collateralRequired,
      token,
      status,
      currentRound,
      roundDeadline,
      poolBalance,
      payoutOrderDrawn,
      members,
      payoutOrder,
      invitesLocked,
    ] = data;

    const tokenAddress = token.result as `0x${string}` | undefined;

    return {
      name: name.result as string | undefined,
      description: description.result as string | undefined,
      creator: creator.result as `0x${string}` | undefined,
      contributionAmount: contributionAmount.result as bigint | undefined,
      frequencySeconds: frequencySeconds.result as bigint | undefined,
      maxParticipants: maxParticipants.result as number | undefined,
      collateralRequired: collateralRequired.result as bigint | undefined,
      token: tokenAddress,
      tokenConfig: tokenForAddress(tokenAddress),
      status: CircleStatus[(status.result as number) ?? 0],
      currentRound: currentRound.result as number | undefined,
      roundDeadline: roundDeadline.result as bigint | undefined,
      poolBalance: poolBalance.result as bigint | undefined,
      payoutOrderDrawn: payoutOrderDrawn.result as boolean | undefined,
      members: (members.result as `0x${string}`[] | undefined) ?? [],
      payoutOrder: (payoutOrder.result as `0x${string}`[] | undefined) ?? [],
      invitesLocked: invitesLocked.result as boolean | undefined,
    };
  }, [data]);

  return { data: parsed, ...rest };
}

export function useMemberInfo(circleAddress?: `0x${string}`, wallet?: `0x${string}`) {
  return useReadContract({
    address: circleAddress,
    abi: circleAbi,
    functionName: "getMember",
    args: wallet ? [wallet] : undefined,
    query: { enabled: Boolean(circleAddress) && Boolean(wallet) },
  });
}

export function usePendingPayout(circleAddress?: `0x${string}`, wallet?: `0x${string}`) {
  return useReadContract({
    address: circleAddress,
    abi: circleAbi,
    functionName: "pendingPayouts",
    args: wallet ? [wallet] : undefined,
    query: { enabled: Boolean(circleAddress) && Boolean(wallet) },
  });
}

export function useCreateCircle() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  function createCircle(params: {
    name: string;
    description: string;
    contributionAmount: string;
    frequency: Frequency;
    maxParticipants: number;
    tokenSymbol: TokenSymbol;
  }) {
    const token = TOKENS[params.tokenSymbol];
    const inviteCodeHash = hashInviteCode(generateInviteCode());

    writeContract({
      address: CIRCLE_FACTORY_ADDRESS,
      abi: circleFactoryAbi,
      functionName: "createCircle",
      args: [
        params.name,
        params.description,
        parseUnits(params.contributionAmount || "0", token.decimals),
        BigInt(FREQUENCY_SECONDS[params.frequency]),
        params.maxParticipants,
        0n,
        inviteCodeHash,
        token.address,
      ],
      value: 0n,
    });
  }

  return {
    createCircle,
    hash,
    isPending,
    isConfirming: receipt.isLoading,
    isConfirmed: receipt.isSuccess,
    receipt: receipt.data,
    error,
  };
}

export function useJoinCircle(circleAddress?: `0x${string}`, isNative = true) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  function join(collateralAmount: bigint) {
    if (!circleAddress) return;
    writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "join",
      args: [],
      value: isNative ? collateralAmount : 0n,
    });
  }

  return { join, hash, isPending, isConfirming: receipt.isLoading, isConfirmed: receipt.isSuccess, error };
}

export function useAddInvitedAddress(circleAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  function addInvitedAddress(invited: `0x${string}`) {
    if (!circleAddress) return;
    writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "addInvitedAddress",
      args: [invited],
    });
  }

  return { addInvitedAddress, hash, isPending, isConfirming: receipt.isLoading, isConfirmed: receipt.isSuccess, error };
}

export function useWithdrawPayout(circleAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  function withdrawPayout() {
    if (!circleAddress) return;
    writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "withdrawPayout",
      args: [],
    });
  }

  return { withdrawPayout, hash, isPending, isConfirming: receipt.isLoading, isConfirmed: receipt.isSuccess, error };
}

export function useVoteToDelete(circleAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  function voteToDelete() {
    if (!circleAddress) return;
    writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "voteToDelete",
      args: [],
    });
  }

  return { voteToDelete, hash, isPending, isConfirming: receipt.isLoading, isConfirmed: receipt.isSuccess, error };
}

export function useDeleteCircle(circleAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  function deleteCircle() {
    if (!circleAddress) return;
    writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "deleteCircle",
      args: [],
    });
  }

  return { deleteCircle, hash, isPending, isConfirming: receipt.isLoading, isConfirmed: receipt.isSuccess, error };
}

export function useFundCircle(circleAddress?: `0x${string}`, isNative = true) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  function fund(amount: bigint) {
    if (!circleAddress) return;
    writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "fundCircle",
      args: [amount],
      value: isNative ? amount : 0n,
    });
  }

  return { fund, hash, isPending, isConfirming: receipt.isLoading, isConfirmed: receipt.isSuccess, error };
}

export function useContribute(circleAddress?: `0x${string}`, isNative = true) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  /** `amount` is already in base units (wei for MON, 6-decimals for USDC). */
  function contribute(amount: bigint) {
    if (!circleAddress) return;
    writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "contribute",
      args: [],
      value: isNative ? amount : 0n,
    });
  }

  return { contribute, hash, isPending, isConfirming: receipt.isLoading, isConfirmed: receipt.isSuccess, error };
}

/**
 * ERC20 approve() + live allowance for a token-denominated circle. No-op /
 * always-sufficient for native MON circles, since those never need approval.
 */
export function useTokenApproval(tokenAddress?: `0x${string}`, spender?: `0x${string}`) {
  const { address: owner } = useAccount();
  const isNative = !tokenAddress || tokenAddress === TOKENS.MON.address;

  const allowance = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !isNative && Boolean(owner) && Boolean(spender) && Boolean(tokenAddress), refetchInterval: 5000 },
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  function approve(amount: bigint) {
    if (!tokenAddress || !spender) return;
    writeContract({ address: tokenAddress, abi: erc20Abi, functionName: "approve", args: [spender, amount] });
  }

  function hasSufficientAllowance(amount: bigint) {
    if (isNative) return true;
    return typeof allowance.data === "bigint" && allowance.data >= amount;
  }

  return {
    approve,
    hasSufficientAllowance,
    allowance: allowance.data as bigint | undefined,
    hash,
    isPending,
    isConfirming: receipt.isLoading,
    isConfirmed: receipt.isSuccess,
    error,
  };
}

/** Pending invitations for the connected wallet. */
export function usePendingInvitations() {
  const { address } = useAccount();

  const invited = useReadContract({
    address: CIRCLE_FACTORY_ADDRESS,
    abi: circleFactoryAbi,
    functionName: "getInvitedCirclesForMember",
    args: address ? [address] : undefined,
    query: { enabled: IS_FACTORY_CONFIGURED && Boolean(address) },
  });

  const circleAddresses = (invited.data as `0x${string}`[] | undefined) ?? [];

  const calls = (circleAddresses || []).flatMap((addr) => [
    { address: addr, abi: circleAbi, functionName: "name" },
    { address: addr, abi: circleAbi, functionName: "getMember", args: address ? [address] : undefined },
  ]);

  const { data, isLoading } = useReadContracts({ contracts: calls, query: { enabled: Boolean(circleAddresses.length > 0 && address) } });

  const parsed = useMemo(() => {
    if (!data || data.length === 0) return [] as { address: `0x${string}`; name: string }[];
    const out: { address: `0x${string}`; name: string }[] = [];
    for (let i = 0; i < circleAddresses.length; i++) {
      const nameRes = data[2 * i];
      const memberRes = data[2 * i + 1];
      const name = (nameRes?.result as string) ?? "";
      const member = memberRes?.result as any;
      const exists = member ? Boolean(member.exists) : false;
      if (!exists) {
        out.push({ address: circleAddresses[i], name });
      }
    }
    return out;
  }, [data, circleAddresses]);

  return { data: parsed, isLoading, rawInvited: invited.data };
}
