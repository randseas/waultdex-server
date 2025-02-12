import { model, Schema } from "mongoose";
const spotMarketSchema = new Schema({
    id: { type: String, required: true, unique: true },
    img: { type: String, required: true },
    ticker: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: String, required: false, default: "0.00" },
    mcap: { type: String, required: false, default: "0" },
    volume24h: { type: String, required: false, default: "0" },
    change24h: { type: String, required: false, default: "0" },
    networks: { type: Array, required: false, default: [] },
});
export const SpotMarketModel = model("SpotMarketModel", spotMarketSchema, "spotMarkets");
