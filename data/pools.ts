import { Pool } from "../types";

export const pools: Pool[] = [
  {
    id: "fr1cx9r-4emfxc-p5xt3qz",
    network: "solana",
    pair: {
      tokenA: "BULLY_KssRzfHGof7sbjoQZSTCFWuyHbcBMz1fFpD42B8iw18y", // TICKER_ADDRESS
      tokenB: "USDT_gFMDyJ1EJJoPa1579jgntE7zzTjdu6Vu2F3q1tyYfYna", // TICKER_ADDRESS
    },
    totalLiquidity: 1000000,
    volume: 100,
    apr: 100,
    reserves: {
      tokenAReserve: 1000000,
      tokenBReserve: 1000000,
    },
    graph: [
      {
        time: 1736177230,
        open: 0.15,
        high: 0.17,
        low: 0.14,
        close: 0.16,
        volume: 12,
      },
      {
        time: 1736177290,
        open: 0.16,
        high: 0.18,
        low: 0.15,
        close: 0.17,
        volume: 16,
      },
    ],
    feeRate: 0,
    createdAt: new Date(),
  },
];
