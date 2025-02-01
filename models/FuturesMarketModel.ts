import { model, Schema } from "mongoose";
import type { FuturesMarket } from "../types";

const futuresMarketSchema = new Schema<FuturesMarket>({
  id: { type: String, required: true, unique: true },
  img: { type: String, required: true, unique: true },
  ticker: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true }
});
export const FuturesMarketModel = model<FuturesMarket>(
  "FuturesPoolModel",
  futuresMarketSchema,
  "futuresMarkets"
);
