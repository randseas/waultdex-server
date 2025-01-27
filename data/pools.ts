import type { Pool } from "../types.ts";

export const pools: Pool[] = [
  {
    id: "fr1cx9r-sdvcvv-dsfgsdfds",
    network: "solana",
    pair: {
      tokenA: "SOL_native",
      tokenB: "USDC_EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    },
    totalLiquidity: 0,
    reserves: {
      tokenAReserve: 0,
      tokenBReserve: 0,
    },
    lowerPrice: 254.51,
    upperPrice: 254.56,
    currentPrice: 254.55,
    feeRate: 0,
    volume: 0,
    createdAt: Date.now(),
  },
  {
    id: "fr1cx9r-dgnfdgf-dfsfsdg",
    network: "solana",
    pair: {
      tokenA: "WSOL_So11111111111111111111111111111111111111112",
      tokenB: "USDC_EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    },
    totalLiquidity: 0,
    reserves: {
      tokenAReserve: 0,
      tokenBReserve: 0,
    },
    lowerPrice: 254.51,
    upperPrice: 254.56,
    currentPrice: 254.55,
    feeRate: 0,
    volume: 0,
    createdAt: Date.now(),
  },
  {
    id: "fr1cx9r-ashuisa-dsaasfasf",
    network: "ethereum",
    pair: {
      tokenA: "ETH_native",
      tokenB: "USDC_0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eb48",
    },
    totalLiquidity: 0,
    reserves: {
      tokenAReserve: 0,
      tokenBReserve: 0,
    },
    lowerPrice: 3368,
    upperPrice: 3370,
    currentPrice: 3369,
    feeRate: 0,
    volume: 0,
    createdAt: Date.now(),
  },
];
