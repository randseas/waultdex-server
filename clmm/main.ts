import { pools } from "../data/pools.ts";
import type { Pool } from "../types.ts";

class CLMM {
  pools: Pool[];
  constructor() {
    this.pools = pools;
  }
  addLiquidity(
    poolId: string,
    amountA: number,
    amountB: number,
    lowerPrice: number,
    upperPrice: number
  ): boolean {
    const pool = this.getPoolById(poolId);
    if (!pool) {
      console.error("Pool not found.");
      return false;
    }
    const sqrtLowerPrice = Math.sqrt(lowerPrice);
    const sqrtUpperPrice = Math.sqrt(upperPrice);
    const sqrtCurrentPrice = Math.sqrt(pool.currentPrice);
    let liquidity = 0;
    if (sqrtCurrentPrice <= sqrtLowerPrice) {
      liquidity =
        (amountA * sqrtLowerPrice * sqrtUpperPrice) /
        (sqrtUpperPrice - sqrtLowerPrice);
    } else if (sqrtCurrentPrice >= sqrtUpperPrice) {
      liquidity = amountB / (sqrtUpperPrice - sqrtLowerPrice);
    } else {
      liquidity = Math.min(
        (amountA * sqrtCurrentPrice * (sqrtUpperPrice - sqrtCurrentPrice)) /
          (sqrtUpperPrice - sqrtLowerPrice),
        amountB / (sqrtUpperPrice - sqrtCurrentPrice)
      );
    }
    pool.reserves.tokenAReserve += amountA;
    pool.reserves.tokenBReserve += amountB;
    pool.totalLiquidity += liquidity;
    pool.lowerPrice = lowerPrice;
    pool.upperPrice = upperPrice;
    this.updatePrice(pool);
    console.log(
      `Added ${amountA} ${pool.pair.tokenA} and ${amountB} ${pool.pair.tokenB} to the pool with price range ${lowerPrice}-${upperPrice}.`
    );
    return true;
  }
  swap(
    poolId: string,
    tokenA: string,
    tokenB: string,
    amountA: number
  ): boolean {
    const pool = this.getPoolById(poolId);
    if (!pool) {
      console.error("Pool not found.");
      return false;
    }
    const sqrtCurrentPrice = Math.sqrt(pool.currentPrice);
    const sqrtLowerPrice = Math.sqrt(pool.lowerPrice);
    const sqrtUpperPrice = Math.sqrt(pool.upperPrice);
    let amountB = 0;
    if (
      sqrtCurrentPrice <= sqrtLowerPrice ||
      sqrtCurrentPrice >= sqrtUpperPrice
    ) {
      console.error("Current price is out of range.");
      return false;
    } else {
      amountB = amountA * pool.currentPrice;
      pool.reserves.tokenAReserve += amountA;
      pool.reserves.tokenBReserve -= amountB;
    }
    this.updatePrice(pool);
    console.log(
      `Swapped ${amountA} ${tokenA} for ${amountB} ${tokenB} at price ${pool.currentPrice}.`
    );
    return true;
  }
  updatePrice(pool: Pool): void {
    const sqrtPrice = Math.sqrt(
      pool.reserves.tokenBReserve / pool.reserves.tokenAReserve
    );
    pool.currentPrice = sqrtPrice * sqrtPrice;
    if (pool.currentPrice < pool.lowerPrice) {
      pool.currentPrice = pool.lowerPrice;
    } else if (pool.currentPrice > pool.upperPrice) {
      pool.currentPrice = pool.upperPrice;
    }
  }
  getPoolById(poolId: string): Pool | undefined {
    return this.pools.find((pool) => pool.id === poolId);
  }
}

export default new CLMM();