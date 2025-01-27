import { pools } from "../data/pools.ts";
import type { Pool } from "../types.ts";

export default class CLMM {
  pools: Pool[];
  constructor() {
    this.pools = pools;
  }
  addLiquidity(
    poolId: string,
    amountA: number,
    amountB: number,
    lowerTick: number,
    upperTick: number
  ): string {
    const pool = this.getPoolById(poolId);
    if (!pool) {
      throw new Error("Pool not found.");
    }
    pool.reserves.tokenAReserve += amountA;
    pool.reserves.tokenBReserve += amountB;
    this.updatePrice(pool);
    pool.lowerPrice = lowerTick;
    pool.upperPrice = upperTick;
    return `Added ${amountA} ${pool.pair.tokenA} and ${amountB} ${pool.pair.tokenB} to the pool with price range from ${lowerTick} to ${upperTick}.`;
  }
  swap(
    poolId: string,
    tokenA: string,
    tokenB: string,
    amountA: number
  ): string {
    const pool = this.getPoolById(poolId);
    if (!pool) {
      throw new Error("Pool not found.");
    }
    if (pool.pair.tokenA !== tokenA || pool.pair.tokenB !== tokenB) {
      throw new Error("Tokens don't match the pool pair.");
    }
    const amountB = this.calculateAmountB(pool, amountA);
    pool.reserves.tokenAReserve += amountA;
    pool.reserves.tokenBReserve -= amountB;
    pool.volume += amountA;
    this.updatePrice(pool);
    return `Swapped ${amountA} ${tokenA} to ${amountB} ${tokenB} at price ${pool.currentPrice}.`;
  }
  // Token A'dan token B'ye yapılan işlemi heaplamak için kullanılan fonksiyon
  calculateAmountB(pool: Pool, amountA: number): number {
    // Fiyat hesaplaması: currentPrice, tokenB/tokenA rezerv oranına dayanır
    return amountA * pool.currentPrice;
  }
  // Fiyatları havuzun rezervlerine göre güncelleme işlemi
  updatePrice(pool: Pool): void {
    // Fiyat, token rezervlerinin oranına bağlıdır
    // Bu mantık, Uniswap v3'teki "Concentrated Liquidity" modeline dayanır
    const price = pool.reserves.tokenBReserve / pool.reserves.tokenAReserve;
    pool.currentPrice = price;
    // Fiyat, upperPrice ve lowerPrice aralığında değişir
    if (pool.currentPrice < pool.lowerPrice) {
      pool.currentPrice = pool.lowerPrice;
    } else if (pool.currentPrice > pool.upperPrice) {
      pool.currentPrice = pool.upperPrice;
    }
  }
  getPrice(poolId: string): number {
    const pool = this.getPoolById(poolId);
    if (!pool) {
      throw new Error("Pool not found.");
    }
    return pool.currentPrice;
  }
  updatePriceRange(
    poolId: string,
    lowerPrice: number,
    upperPrice: number
  ): string {
    const pool = this.getPoolById(poolId);
    if (!pool) {
      throw new Error("Pool not found.");
    }
    pool.lowerPrice = lowerPrice;
    pool.upperPrice = upperPrice;
    this.updatePrice(pool);
    return `Updated price range for pool ${poolId}: ${lowerPrice} - ${upperPrice}`;
  }
  getPoolById(poolId: string): Pool | undefined {
    return this.pools.find((pool) => pool.id === poolId);
  }
}
