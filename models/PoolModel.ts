import { model, Schema } from "mongoose";
import type { Pool } from "../types";
import { Decimal128 } from "mongodb";

const poolSchema = new Schema<Pool>({
  address: { type: String, required: true, unique: true },
  network: { type: String, required: true },
  pair: {
    type: {
      tokenA: String,
      tokenB: String,
    },
    required: true,
  },
  totalLiquidity: { type: Decimal128, required: true },
  reserves: {
    type: {
      tokenAReserve: Decimal128,
      tokenBReserve: Decimal128,
    },
    required: true,
  },
  lowerPrice: { type: Decimal128, required: true },
  upperPrice: { type: Decimal128, required: true },
  currentPrice: { type: Decimal128, required: true },
  feeRate: { type: Decimal128, required: true },
  volume: { type: Decimal128, required: true },
  createdAt: { type: Number, required: true },
});
export const PoolModel = model<Pool>("PoolModel", poolSchema, "pools");
