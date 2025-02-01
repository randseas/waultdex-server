import { model, Schema } from "mongoose";
import type { SpotMarket } from "../types";

const spotMarketSchema = new Schema<SpotMarket>({
  id: { type: String, required: true, unique: true },
  img: { type: String, required: true },
  ticker: { type: String, required: true },
  name: { type: String, required: true },
});
export const SpotMarketModel = model<SpotMarket>(
  "SpotMarketModel",
  spotMarketSchema,
  "spotMarkets"
);
