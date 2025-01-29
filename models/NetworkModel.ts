import { model, Schema } from "mongoose";
import type { Network } from "../types";

const networkSchema = new Schema<Network>({
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  address: { type: String, required: true },
  explorer: { type: String, required: true },
});
export const NetworkModel = model<Network>(
  "NetworkModel",
  networkSchema,
  "networks"
);