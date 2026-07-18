import circleFactoryAbiJson from "./abis/CircleFactory.json";
import circleAbiJson from "./abis/Circle.json";
import erc20AbiJson from "./abis/ERC20.json";

/**
 * PLACEHOLDER — replace once CircleFactory is deployed to Monad testnet.
 *
 *   cd contracts
 *   forge script script/Deploy.s.sol:Deploy --rpc-url monad_testnet \
 *     --private-key $DEPLOYER_PRIVATE_KEY --broadcast
 *
 * Then set VITE_CIRCLE_FACTORY_ADDRESS in your .env to the deployed address.
 * Until then the app runs against this placeholder and every write call will
 * revert / fail loudly — reads simply return empty state — rather than
 * silently faking success.
 */
export const CIRCLE_FACTORY_ADDRESS = (import.meta.env.VITE_CIRCLE_FACTORY_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const IS_FACTORY_CONFIGURED =
  CIRCLE_FACTORY_ADDRESS.toLowerCase() !== "0x0000000000000000000000000000000000000000";

export const circleFactoryAbi = circleFactoryAbiJson;
export const circleAbi = circleAbiJson;
export const erc20Abi = erc20AbiJson;

/**
 * Assets a circle can be denominated in. `address: ZERO_ADDRESS` means the
 * chain's native currency (MON) and is passed on-chain as `address(0)`; USDC
 * is the only other supported asset, moved via approve()/transferFrom().
 *
 * MONAD_TESTNET_USDC_ADDRESS is Circle's official native USDC contract on
 * Monad Testnet, per https://developers.circle.com/stablecoins/usdc-contract-addresses.
 * Override with VITE_USDC_TESTNET_ADDRESS if you want to point at a different
 * test token (e.g. your own mock USDC).
 */
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const MONAD_TESTNET_USDC_ADDRESS = "0x534b2f3A21130d7a60830c2Df862319e593943A3" as const;

export const USDC_TESTNET_ADDRESS = (import.meta.env.VITE_USDC_TESTNET_ADDRESS ??
  MONAD_TESTNET_USDC_ADDRESS) as `0x${string}`;

export type TokenSymbol = "MON" | "USDC";

export interface TokenConfig {
  symbol: TokenSymbol;
  label: string;
  address: `0x${string}`;
  decimals: number;
  isNative: boolean;
  /** false while the token's real testnet address hasn't been configured yet */
  isConfigured: boolean;
}

export const TOKENS: Record<TokenSymbol, TokenConfig> = {
  MON: {
    symbol: "MON",
    label: "MON (native)",
    address: ZERO_ADDRESS,
    decimals: 18,
    isNative: true,
    isConfigured: true,
  },
  USDC: {
    symbol: "USDC",
    label: "USDC",
    address: USDC_TESTNET_ADDRESS,
    decimals: 6,
    isNative: false,
    isConfigured: USDC_TESTNET_ADDRESS.toLowerCase() !== ZERO_ADDRESS,
  },
};

export function tokenForAddress(address?: string | null): TokenConfig {
  if (!address || address.toLowerCase() === ZERO_ADDRESS) return TOKENS.MON;
  const match = Object.values(TOKENS).find((t) => t.address.toLowerCase() === address.toLowerCase());
  if (match) return match;
  // Unknown ERC20 — don't guess a symbol or decimals count that could be wrong.
  return { symbol: "TOKEN" as TokenSymbol, label: "Unknown token", address: address as `0x${string}`, decimals: 18, isNative: false, isConfigured: true };
}

export const FREQUENCY_SECONDS = {
  daily: 60 * 60 * 24,
  weekly: 60 * 60 * 24 * 7,
  monthly: 60 * 60 * 24 * 30,
} as const;

export type Frequency = keyof typeof FREQUENCY_SECONDS;
