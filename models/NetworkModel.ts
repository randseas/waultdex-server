import { model, Schema } from "mongoose";
import type { Network } from "../types";

const networkSchema = new Schema<Network>({
  id: { type: String, required: true, unique: true, trim: true },
  img: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  ticker: { type: String, required: true, trim: true },
  explorer: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true },
});
export const NetworkModel = model<Network>(
  "NetworkModel",
  networkSchema,
  "networks"
);
