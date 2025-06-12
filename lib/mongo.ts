import mongoose from "mongoose";
import { UserModel } from "@/models/UserModel";
import { SpotMarketModel } from "@/models/SpotMarketModel";
import { FuturesMarketModel } from "@/models/FuturesMarketModel";
import dotenv from "dotenv";
dotenv.config();

export async function connectDB() {
  await mongoose.connect(
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@main.fkgjz.mongodb.net/?retryWrites=true&w=majority&appName=main`
  );
  console.log("[MongoDB]-> Connection established");
  return mongoose.connection;
}

export function initChangeStreams(io: any, socketsubs: Map<string, string>) {
  const userChangeStream = UserModel.watch([], {
    fullDocument: "updateLookup",
  });
  const spotMarketChangeStream = SpotMarketModel.watch([]);
  const futuresMarketChangeStream = FuturesMarketModel.watch([]);

  userChangeStream.on("change", async (change) => {
    if (
      !["insert", "update", "replace", "delete"].includes(change.operationType)
    )
      return;
    if (!change.fullDocument) return;
    try {
      const userData = { ...change.fullDocument };
      delete userData.password;
      const spotMarkets = await SpotMarketModel.find();
      const futuresMarkets = await FuturesMarketModel.find();

      const activeSessions = userData.sessions
        .map((session: any) => socketsubs.get(session.token))
        .filter(Boolean);

      activeSessions.forEach((socketId: string) => {
        io.to(socketId).emit("live_data", {
          userData,
          spotMarkets,
          futuresMarkets,
        });
      });
    } catch (err) {
      console.error("User change stream error:", err);
    }
  });

  const broadcastMarkets = async () => {
    try {
      const spotMarkets = await SpotMarketModel.find();
      const futuresMarkets = await FuturesMarketModel.find();
      io.emit("live_data", { spotMarkets, futuresMarkets });
    } catch (err) {
      console.error("Market change stream error:", err);
    }
  };

  spotMarketChangeStream.on("change", broadcastMarkets);
  futuresMarketChangeStream.on("change", broadcastMarkets);
}
