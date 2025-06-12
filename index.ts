import express from "express";
import { Server } from "socket.io";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import http from "http";
import WebSocket from "ws";
import type { SpotMarket, FuturesMarket, Session, Network } from "@/types.ts";
import { UserModel } from "@/models/UserModel.ts";
import { SpotMarketModel } from "@/models/SpotMarketModel.ts";
import { FuturesMarketModel } from "@/models/FuturesMarketModel.ts";
import { NetworkModel } from "@/models/NetworkModel.ts";
import dotenv from "dotenv";
dotenv.config();

import router from "@/router.ts";

export interface WsSubscription {
  ws: WebSocket;
  subscribers: Set<string>;
  resolution: string;
  symbol: string;
}

export default class WaultdexServer {
  private port: number = parseInt(process.env.PORT || "9443");
  private app = express();
  private server = http.createServer(this.app);
  private io = new Server(this.server, {
    cors: {
      origin: [
        "http://localhost",
        "https://waultdex.vercel.app",
        "https://waultdex.com",
        "https://waultdex.io",
      ],
      methods: ["GET", "POST"],
    },
  });
  private socketsubs: Map<string, string> = new Map([]); // token -> socket.id
  public db: any;
  public spotMarkets: SpotMarket[] = [];
  public futuresMarkets: FuturesMarket[] = [];
  public networks: Network[] = [];
  constructor() {
    this.initialize();
  }
  private async initialize() {
    try {
      await mongoose.connect(
        `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@main.fkgjz.mongodb.net/?retryWrites=true&w=majority&appName=main`
      );
      console.log("[MongoDB]-> Connection established");
      this.db = mongoose.connection;
      this.spotMarkets = await SpotMarketModel.find();
      this.futuresMarkets = await FuturesMarketModel.find();
      const userChangeStream = UserModel.watch([], {
        fullDocument: "updateLookup",
      });
      const spotMarketChangeStream = SpotMarketModel.watch([]);
      const futuresMarketChangeStream = FuturesMarketModel.watch([]);
      const handleUserChange = async (change: any) => {
        try {
          if (
            !["insert", "update", "replace", "delete"].includes(
              change.operationType
            )
          ) {
            return;
          }
          if (!change.fullDocument) return;
          let userData = { ...change.fullDocument };
          delete userData.password;
          const spotMarkets = await SpotMarketModel.find();
          const futuresMarkets = await FuturesMarketModel.find();
          const activeSessions = userData.sessions
            .map((session: Session) => this.socketsubs.get(session.token))
            .filter((session: Session) => session);
          if (activeSessions.length > 0) {
            console.log(
              `User changed and sent to subscribers: ${activeSessions.join(", ")}`
            );
            activeSessions.forEach((subscription: any) => {
              this.io.to(subscription).emit("live_data", {
                userData,
                spotMarkets,
                futuresMarkets,
              });
            });
          } else {
            console.log(
              "User changed but cannot find any active socket subscription. Canceled."
            );
          }
        } catch (error) {
          console.error("User change stream error:", error);
        }
      };
      const handleSpotMarketChange = async () => {
        try {
          const spotMarkets = await SpotMarketModel.find();
          const futuresMarkets = await FuturesMarketModel.find();
          this.io.emit("live_data", { spotMarkets, futuresMarkets });
        } catch (error) {
          console.error("Spot market change stream error:", error);
        }
      };
      const handleFuturesMarketChange = async () => {
        try {
          const spotMarkets = await SpotMarketModel.find();
          const futuresMarkets = await FuturesMarketModel.find();
          this.io.emit("live_data", { spotMarkets, futuresMarkets });
        } catch (error) {
          console.error("Futures market change stream error:", error);
        }
      };
      userChangeStream.on("change", handleUserChange);
      spotMarketChangeStream.on("change", handleSpotMarketChange);
      futuresMarketChangeStream.on("change", handleFuturesMarketChange);
      console.log("[MongoDB]-> Change streams initialized");
    } catch (error) {
      console.error("[MongoDB]-> Connection failed:", error);
    }
    await this.setupServer();
  }
  async setupServer() {
    this.app.use(express.json());
    this.app.use(helmet());
    this.app.use(cors({ origin: "*" }));
    await router(this.app, "routes");
    this.io.on("connection", async (socket: any) => {
      socket.on("chat message", async (msg: any) => {
        const [action, payload] = msg.split("::");
        if (action === "live_data") {
          const sessionToken = payload;
          const spotMarkets = await SpotMarketModel.find();
          const futuresMarkets = await FuturesMarketModel.find();
          const networks = await NetworkModel.find();
          if (typeof sessionToken !== "string") {
            return socket.emit("live_data", {
              userData: "token_not_found",
              spotMarkets,
              futuresMarkets,
            });
          }
          const users = await UserModel.find({}, { password: 0 });
          const currentUser = users.find((user) =>
            user.sessions.some((session) => session.token === sessionToken)
          );
          if (!currentUser) {
            return socket.emit("live_data", {
              userData: "user_not_found",
              spotMarkets,
              futuresMarkets,
            });
          }
          const sessionIndex = currentUser.sessions.findIndex(
            (s) => s.token === sessionToken
          );
          if (sessionIndex === -1) {
            return socket.emit("live_data", {
              userData: "session_not_found",
              spotMarkets,
              futuresMarkets,
            });
          }
          currentUser.sessions[sessionIndex].lastSeen = Date.now().toString();
          await UserModel.updateOne(
            { _id: currentUser._id, "sessions.token": sessionToken },
            { $set: { "sessions.$.lastSeen": Date.now().toString() } }
          );
          this.socketsubs.set(sessionToken, socket.id);
          this.spotMarkets = spotMarkets;
          this.futuresMarkets = futuresMarkets;
          this.networks = networks;
          const stateData = {
            userData: currentUser,
            spotMarkets,
            futuresMarkets,
            networks,
          };
          socket.emit("live_data", stateData);
        } else if (action === "live_candle") {
          //...
        } else if (action === "unsubscribe") {
          //...
        } else if (action === "time") {
          const serverTime = Date.now();
          socket.emit("server_time", serverTime);
        }
      });
    });
    this.server.listen(this.port, () => {
      console.log(`[http]-> Running on port: ${this.port}`);
    });
    this.app.get("/api/v1/time", async (req, res) => {
      res.status(200).json({ time: Date.now() });
    });
  }
}
new WaultdexServer();
