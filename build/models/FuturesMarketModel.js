import { model, Schema } from "mongoose";
const futuresMarketSchema = new Schema({
    id: { type: String, required: true, unique: true },
    img: { type: String, required: true, unique: true },
    ticker: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true }
});
export const FuturesMarketModel = model("FuturesPoolModel", futuresMarketSchema, "futuresMarkets");
