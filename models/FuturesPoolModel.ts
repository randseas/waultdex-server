import { model, Schema } from "mongoose";
import type { FuturesPool } from "../types";

const futuresPoolSchema = new Schema<FuturesPool>({
  address: { type: String, required: true, unique: true },
  network: { type: String, required: true },
  pair: {
    type: {
      tokenA: String,
      tokenB: String,
    },
    required: true,
  },
  totalLiquidity: { type: Number, required: true },
  totalOpenInterest: { type: Number, required: true }, // Açık pozisyonların toplam büyüklüğü (USD cinsinden)
  feeRate: { type: Number, required: true }, // İşlem ücreti oranı (örn: 0.001 = %0.1)
  fundingRate: { type: Number, required: true }, // Fonlama oranı (periyodik olarak long/short arasında aktarılır)
  openPositions: { type: Number, required: true }, // Havuzdaki toplam açık pozisyon sayısı
  currentPrice: { type: Number, required: true },
  markPrice: { type: Number, required: true }, // Fonlama oranı ve spot piyasa fiyatının formülle hesaplanmış fiyatıdır
  createdAt: { type: Number, required: true },
});
export const FuturesPoolModel = model<FuturesPool>(
  "FuturesPoolModel",
  futuresPoolSchema,
  "futuresPools"
);