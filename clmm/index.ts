import Decimal from "decimal.js";
import { EventEmitter } from "events";
import bs58 from "bs58";
import * as crypto from "node:crypto";

Decimal.set({ precision: 18, rounding: Decimal.ROUND_DOWN });

type TokenAmount = {
  tokenA: Decimal;
  tokenB: Decimal;
};

interface Oracle {
  getPrice: () => { price: Decimal; lastUpdated: number };
  isValid: () => boolean;
}

class PoolError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "PoolError";
  }
}

class Tick {
  public liquidityNet: Decimal = new Decimal(0);
  public liquidityGross: Decimal = new Decimal(0);
  public feeGrowthOutsideA: Decimal = new Decimal(0);
  public feeGrowthOutsideB: Decimal = new Decimal(0);
  constructor(public readonly value: number) {}
}

class Position {
  public feesA: Decimal = new Decimal(0);
  public feesB: Decimal = new Decimal(0);
  constructor(
    public readonly id: string,
    public readonly owner: string,
    public readonly lowerTick: number,
    public readonly upperTick: number,
    public liquidity: Decimal,
    public feeGrowthInsideALast: Decimal,
    public feeGrowthInsideBLast: Decimal
  ) {}
  calculateFees(
    feeGrowthGlobalA: Decimal,
    feeGrowthGlobalB: Decimal
  ): TokenAmount {
    if (this.liquidity.lte(0)) {
      return { tokenA: new Decimal(0), tokenB: new Decimal(0) };
    }
    const feeGrowthInsideA = Decimal.max(
      feeGrowthGlobalA.minus(this.feeGrowthInsideALast),
      new Decimal(0)
    );
    const feeGrowthInsideB = Decimal.max(
      feeGrowthGlobalB.minus(this.feeGrowthInsideBLast),
      new Decimal(0)
    );
    return {
      tokenA: this.liquidity.mul(feeGrowthInsideA),
      tokenB: this.liquidity.mul(feeGrowthInsideB),
    };
  }
}

class ConcentratedPool extends EventEmitter {
  private sqrtPriceX96: Decimal;
  private currentTick: number;
  private liquidity: Decimal = new Decimal(0);
  private ticks: Map<number, Tick> = new Map();
  private positions: Map<string, Position> = new Map();
  private feeGrowthGlobalA: Decimal = new Decimal(0);
  private feeGrowthGlobalB: Decimal = new Decimal(0);
  private protocolFeesA: Decimal = new Decimal(0);
  private protocolFeesB: Decimal = new Decimal(0);

  constructor(
    public readonly tokenA: string,
    public readonly tokenB: string,
    public readonly owner: string,
    public readonly oracle: Oracle,
    private readonly feeRate: Decimal = new Decimal(0.003),
    public readonly tickSpacing: number = 60,
    public readonly maxOraclePriceDeviation: Decimal = new Decimal(0.05)
  ) {
    super();
    const initialPrice = oracle.getPrice().price;
    this.sqrtPriceX96 = this.priceToSqrtX96(initialPrice);
    this.currentTick = this.sqrtPriceX96ToTick(this.sqrtPriceX96);
    this.setMaxListeners(100);
  }
  addLiquidity(
    owner: string,
    lowerTick: number,
    upperTick: number,
    amountA: Decimal,
    amountB: Decimal
  ): { positionId: string; liquidity: Decimal } {
    this.validateTicks(lowerTick, upperTick);
    this.checkOracleValidity();
    const sqrtLower = this.tickToSqrtX96(lowerTick);
    const sqrtUpper = this.tickToSqrtX96(upperTick);
    const sqrtCurrent = this.sqrtPriceX96;
    let liquidity: Decimal;
    if (this.currentTick < lowerTick) {
      liquidity = amountB.mul(sqrtUpper.sub(sqrtLower)).div(sqrtUpper);
    } else if (this.currentTick < upperTick) {
      const liquidityA = amountA
        .mul(sqrtCurrent)
        .mul(sqrtUpper)
        .div(sqrtUpper.sub(sqrtCurrent));
      const liquidityB = amountB.div(sqrtCurrent.sub(sqrtLower));
      liquidity = Decimal.min(liquidityA, liquidityB);
    } else {
      liquidity = amountA.mul(sqrtUpper).div(sqrtUpper.sub(sqrtLower));
    }
    const positionId = bs58.encode(crypto.randomBytes(32));
    const position = new Position(
      positionId,
      owner,
      lowerTick,
      upperTick,
      liquidity,
      this.feeGrowthGlobalA,
      this.feeGrowthGlobalB
    );
    this.liquidity = this.liquidity.add(liquidity);
    this.updateTicks(lowerTick, upperTick, liquidity, true);
    this.positions.set(positionId, position);
    this.emit("LiquidityAdded", {
      positionId,
      owner,
      tokenA: amountA.toString(),
      tokenB: amountB.toString(),
    });
    return { positionId, liquidity };
  }
  swap(
    inputToken: "tokenA" | "tokenB",
    amountIn: Decimal,
    minAmountOut: Decimal,
    deadline: number = Date.now() + 30_000
  ): Decimal {
    if (this.liquidity.lte(0)) {
      throw new PoolError("NO_LIQUIDITY", "No liquidity in the pool");
    }
    if (Date.now() > deadline)
      throw new PoolError("TX_EXPIRED", "Transaction expired");
    this.checkOracleValidity();
    const feeAmount = amountIn.mul(this.feeRate);
    const protocolFee = feeAmount.mul(0.1);
    const liquidityFee = feeAmount.sub(protocolFee);
    if (inputToken === "tokenA") {
      this.protocolFeesA = this.protocolFeesA.add(protocolFee);
      this.feeGrowthGlobalA = this.feeGrowthGlobalA.add(
        liquidityFee.div(this.liquidity || 1)
      );
    } else {
      this.protocolFeesB = this.protocolFeesB.add(protocolFee);
      this.feeGrowthGlobalB = this.feeGrowthGlobalB.add(
        liquidityFee.div(this.liquidity || 1)
      );
    }
    let remaining = amountIn.sub(feeAmount);
    let amountOut = new Decimal(0);

    while (remaining.gt(0) && this.liquidity.gt(0)) {
      const nextTick = this.findNextTick(inputToken);
      const [sqrtPriceNext, amountInUsed, amountOutPartial] =
        this.computeSwapStep(nextTick, remaining, inputToken);

      if (amountInUsed.lte(0)) break;

      remaining = remaining.sub(amountInUsed);
      amountOut = amountOut.add(amountOutPartial);
      this.sqrtPriceX96 = sqrtPriceNext;

      if (sqrtPriceNext.eq(this.tickToSqrtX96(nextTick))) {
        this.crossTick(nextTick, inputToken);
      }
    }

    if (amountOut.lt(minAmountOut)) {
      throw new PoolError(
        "SLIPPAGE",
        `Minimum output not met. Received: ${amountOut}, Required: ${minAmountOut}`
      );
    }

    this.currentTick = this.sqrtPriceX96ToTick(this.sqrtPriceX96);
    this.emit("Swap", { inputToken, amountIn, amountOut });
    return amountOut;
  }
  collectFees(positionId: string, recipient: string): TokenAmount {
    const position = this.getPosition(positionId);
    if (position.owner !== recipient) {
      throw new PoolError("UNAUTHORIZED", "Fee collection unauthorized");
    }
    const fees = position.calculateFees(
      this.feeGrowthGlobalA,
      this.feeGrowthGlobalB
    );
    position.feesA = new Decimal(0);
    position.feesB = new Decimal(0);
    this.emit("FeesCollected", { positionId, recipient, fees });
    return fees;
  }
  private checkOracleValidity(): void {
    if (!this.oracle.isValid()) {
      throw new PoolError("ORACLE_INVALID", "Price feed is invalid");
    }
    const oraclePrice = this.oracle.getPrice().price;
    const priceDeviation = this.sqrtPriceX96
      .div(this.priceToSqrtX96(oraclePrice))
      .sub(1)
      .abs();
    if (priceDeviation.gt(this.maxOraclePriceDeviation)) {
      this.adjustForArbitrage(oraclePrice);
    }
  }
  private adjustForArbitrage(targetPrice: Decimal): void {
    const targetSqrtX96 = this.priceToSqrtX96(targetPrice);
    const maxLiquidity = this.calculateMaxArbitrageLiquidity(targetSqrtX96);
    if (maxLiquidity.gt(0)) {
      this.sqrtPriceX96 = targetSqrtX96;
      this.currentTick = this.sqrtPriceX96ToTick(targetSqrtX96);
      this.emit("Arbitrage", {
        oldPrice: this.sqrtPriceX96,
        newPrice: targetSqrtX96,
      });
    }
  }
  private crossTick(tick: number, direction: "tokenA" | "tokenB"): void {
    const tickInfo = this.getTick(tick);
    this.liquidity =
      direction === "tokenA"
        ? this.liquidity.add(tickInfo.liquidityNet)
        : this.liquidity.sub(tickInfo.liquidityNet);
    this.feeGrowthGlobalA = this.feeGrowthGlobalA.add(
      tickInfo.feeGrowthOutsideA
    );
    this.feeGrowthGlobalB = this.feeGrowthGlobalB.add(
      tickInfo.feeGrowthOutsideB
    );
  }
  private priceToSqrtX96(price: Decimal): Decimal {
    return price.sqrt().mul(new Decimal(2).pow(96));
  }
  private sqrtPriceX96ToTick(sqrtPriceX96: Decimal): number {
    const ratio = sqrtPriceX96.div(new Decimal(2).pow(96));
    const tick = ratio.pow(2).log().div(new Decimal("1.0001").log()).floor();
    return tick.toNumber();
  }
  private tickToSqrtX96(tick: number): Decimal {
    const exponent = new Decimal(tick).div(2);
    const sqrtPrice = new Decimal(1.0001).pow(exponent);
    return sqrtPrice.mul(new Decimal(2).pow(96));
  }
  private updateTicks(
    lowerTick: number,
    upperTick: number,
    liquidityDelta: Decimal,
    isAdd: boolean
  ): void {
    const lowerTickInfo = this.getTick(lowerTick);
    const upperTickInfo = this.getTick(upperTick);
    if (isAdd) {
      lowerTickInfo.liquidityGross =
        lowerTickInfo.liquidityGross.add(liquidityDelta);
      upperTickInfo.liquidityGross =
        upperTickInfo.liquidityGross.add(liquidityDelta);
      lowerTickInfo.liquidityNet =
        lowerTickInfo.liquidityNet.add(liquidityDelta);
      upperTickInfo.liquidityNet =
        upperTickInfo.liquidityNet.sub(liquidityDelta);
    } else {
      lowerTickInfo.liquidityGross =
        lowerTickInfo.liquidityGross.sub(liquidityDelta);
      upperTickInfo.liquidityGross =
        upperTickInfo.liquidityGross.sub(liquidityDelta);
      lowerTickInfo.liquidityNet =
        lowerTickInfo.liquidityNet.sub(liquidityDelta);
      upperTickInfo.liquidityNet =
        upperTickInfo.liquidityNet.add(liquidityDelta);
    }
    this.ticks.set(lowerTick, lowerTickInfo);
    this.ticks.set(upperTick, upperTickInfo);
  }
  private findNextTick(inputToken: "tokenA" | "tokenB"): number {
    const ticks = Array.from(this.ticks.keys()).sort((a, b) => a - b);
    if (inputToken === "tokenA") {
      const lowerTicks = ticks.filter((t) => t < this.currentTick);
      return lowerTicks.length ? lowerTicks[lowerTicks.length - 1] : -Infinity;
    } else {
      const higherTicks = ticks.filter((t) => t > this.currentTick);
      return higherTicks.length ? higherTicks[0] : Infinity;
    }
  }
  private computeSwapStep(
    nextTick: number,
    amountRemaining: Decimal,
    inputToken: "tokenA" | "tokenB"
  ): [Decimal, Decimal, Decimal] {
    const Q96 = new Decimal(2).pow(96);
    const sqrtPriceCurrent = this.sqrtPriceX96;
    const sqrtPriceNext = this.tickToSqrtX96(nextTick);
    const fee = this.feeRate;
    const oneMinusFee = new Decimal(1).sub(fee);
    let sqrtPriceTarget: Decimal;
    let amountInUsed: Decimal;
    let amountOutComputed: Decimal;
    if (inputToken === "tokenA") {
      // TokenA (SOL) -> TokenB (USDC) swap
      const maxAmountA = this.liquidity
        .mul(sqrtPriceCurrent.sub(sqrtPriceNext))
        .div(sqrtPriceCurrent.mul(sqrtPriceNext).div(new Decimal(2).pow(96))) // Q64.96 ölçeklendirme düzeltildi
        .div(oneMinusFee);
      if (amountRemaining.gt(maxAmountA)) {
        sqrtPriceTarget = sqrtPriceNext;
        amountInUsed = maxAmountA;
      } else {
        sqrtPriceTarget = sqrtPriceCurrent.sub(
          amountRemaining
            .mul(sqrtPriceCurrent)
            .div(this.liquidity.mul(oneMinusFee))
        );
        amountInUsed = amountRemaining;
      }
      amountOutComputed = this.liquidity
        .mul(sqrtPriceCurrent.sub(sqrtPriceTarget))
        .div(new Decimal(2).pow(96)); // Q64.96 -> gerçek değer
    } else {
      // TokenB (USDC) -> TokenA (SOL) swap
      const numerator = this.liquidity.mul(sqrtPriceNext.sub(sqrtPriceCurrent));
      const denominator = Q96;
      const maxAmountB = numerator.div(denominator).div(oneMinusFee);
      if (amountRemaining.gt(maxAmountB)) {
        sqrtPriceTarget = sqrtPriceNext;
        amountInUsed = maxAmountB;
        amountOutComputed = this.liquidity
          .mul(sqrtPriceNext.sub(sqrtPriceCurrent))
          .div(sqrtPriceNext.mul(sqrtPriceCurrent).div(Q96));
      } else {
        sqrtPriceTarget = sqrtPriceCurrent.add(
          amountRemaining.mul(oneMinusFee).mul(Q96).div(this.liquidity)
        );
        amountInUsed = amountRemaining;
        amountOutComputed = this.liquidity
          .mul(sqrtPriceTarget.sub(sqrtPriceCurrent))
          .div(sqrtPriceTarget.mul(sqrtPriceCurrent).div(Q96));
      }
    }
    if (sqrtPriceTarget.eq(sqrtPriceCurrent)) {
      throw new PoolError("SWAP_ERROR", "Price did not change");
    }
    return [sqrtPriceTarget, amountInUsed, amountOutComputed];
  }
  private getPosition(positionId: string): Position {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new PoolError(
        "POSITION_NOT_FOUND",
        `Position ${positionId} not found`
      );
    }
    return position;
  }
  private calculateMaxArbitrageLiquidity(targetSqrtX96: Decimal): Decimal {
    const currentSqrtX96 = this.sqrtPriceX96;
    if (currentSqrtX96.eq(targetSqrtX96)) return new Decimal(0);

    return currentSqrtX96.lt(targetSqrtX96)
      ? this.liquidity
          .mul(targetSqrtX96.sub(currentSqrtX96))
          .div(currentSqrtX96.mul(targetSqrtX96))
      : this.liquidity.mul(currentSqrtX96.sub(targetSqrtX96));
  }
  private getTick(tick: number): Tick {
    return this.ticks.get(tick) || new Tick(tick);
  }
  private validateTicks(lowerTick: number, upperTick: number): void {
    if (lowerTick >= upperTick)
      throw new PoolError("INVALID_TICKS", "Lower >= Upper");
    if (
      lowerTick % this.tickSpacing !== 0 ||
      upperTick % this.tickSpacing !== 0
    ) {
      throw new PoolError("TICK_MISALIGNED", "Ticks not aligned with spacing");
    }
  }
}

// Düzeltilmiş Test Senaryosu
async function main() {
  const oracle: Oracle = {
    getPrice: () => ({ price: new Decimal(2000), lastUpdated: Date.now() }),
    isValid: () => true,
  };
  const pool = new ConcentratedPool("SOL", "USDC", "owner", oracle);

  console.log("Adding liquidity...");
  const { positionId } = pool.addLiquidity(
    "user1",
    -6000,
    6000,
    new Decimal(1), // 10 SOL
    new Decimal(1) // 20,000 USDC
  );
  console.log("Swapping 15 tokenA...");
  try {
    const amountOut = pool.swap("tokenA", new Decimal(255), new Decimal(0));
    console.log("Received tokenB:", amountOut.toFixed(9).toString());
  } catch (error) {
    console.error(
      "Swap failed:",
      error instanceof PoolError ? error.message : error
    );
  }

  console.log("Collecting fees...");
  const fees = pool.collectFees(positionId, "user1");
  console.log("Fees:", fees);
}

main().catch(console.error);
