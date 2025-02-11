import { model, Schema } from "mongoose";
import type { SpotMarket } from "../types";

const spotMarketSchema = new Schema<SpotMarket>({
  id: { type: String, required: true, unique: true },
  img: { type: String, required: true },
  ticker: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: String, required: false, default: "0.00" },
  mcap: { type: String, required: false, default: "0" },
  volume24h: { type: String, required: false, default: "0" },
  change24h: { type: String, required: false, default: "0" },
});
export const SpotMarketModel = model<SpotMarket>(
  "SpotMarketModel",
  spotMarketSchema,
  "spotMarkets"
);
