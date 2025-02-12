import { model, Schema } from "mongoose";
const networkSchema = new Schema({
    id: { type: String, required: true, unique: true, trim: true },
    img: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    ticker: { type: String, required: true, trim: true },
    explorer: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
});
export const NetworkModel = model("NetworkModel", networkSchema, "networks");
