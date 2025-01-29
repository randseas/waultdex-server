import express, { Request, Response } from "express";
import { Server } from "socket.io";
import mongoose, { Connection } from "mongoose";
import helmet from "helmet";
import cors from "cors";
import http from "http";

import type { FuturesPool, Network, Pool } from "./types";

import { UserModel } from "./models/UserModel";
import { PoolModel } from "./models/PoolModel";
import { FuturesPoolModel } from "./models/FuturesPoolModel";
import { NetworkModel } from "./models/NetworkModel";
import { getUser, login, register } from "./handlers/auth";

export default class WaultdexServer {
  private port: number = 9443;
  private app = express();
  private server = http.createServer(this.app);
  private io = new Server(this.server, {
    cors: {
      origin: ["http://localhost", "https://waultdex.vercel.app"],
      methods: ["GET", "POST"],
    },
  });
  private socketsubs: Map<string, string> = new Map([]); //token->socketId
  public db: any;
  public clmm: any;
  public pools: Pool[] = [];
  public futuresPools: FuturesPool[] = [];
  public networks: Network[] = [];
  constructor() {
    this.initialize();
  }
  private async initialize() {
    try {
      await mongoose.connect(
        "mongodb+srv://waultbank:317aIGQECqJHqosC@cluster0.fkgjz.mongodb.net",
        {
          appName: "main",
          retryWrites: true,
          w: "majority",
        }
      );
      console.log("[MongoDB]-> Connection success");
      this.db = mongoose.connection;
      /*this.clmm = new CLMM(
        this.db,
        this.pools,
        this.futuresPools,
        this.networks
      );*/
      this.pools = await PoolModel.find();
      this.futuresPools = await FuturesPoolModel.find();
      this.networks = await NetworkModel.find();

      const UserModelChangeStream = UserModel.watch([], {
        fullDocument: "updateLookup",
      });
      UserModelChangeStream.on("change", async (change: any) => {
        if (
          change.operationType === "insert" ||
          change.operationType === "update" ||
          change.operationType === "replace" ||
          change.operationType === "delete"
        ) {
          let userData = { ...change.fullDocument };
          delete userData.password;
          const subscription = this.socketsubs.get(userData.token);
          if (subscription) {
            const stateData = {
              userData: userData,
              futuresPools: this.futuresPools,
              networks: this.networks,
              pools: this.pools,
            };
            this.io.to(subscription).emit("live_data", stateData);
          }
        }
      });
      console.log("[MongoDB]-> Change streams initialized");
    } catch (error) {
      console.error("[MongoDB]-> Connection failed:", error);
    }
    await this.setupServer();
  }
  async setupServer() {
    this.app.use(express.json());
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: "*",
      })
    );
    this.io.on("connection", async (socket: any) => {
      socket.on("chat message", async (msg: any) => {
        const [action, payload] = msg.split("::");
        if (action === "live_data") {
          const token = payload;
          if (typeof token === "string") {
            const currentUser = await UserModel.findOne({ token });
            if (!currentUser) {
              socket.emit("live_data", "user_not_found");
            } else {
              this.socketsubs.set(token, socket.id);
              let editedUser = { ...currentUser.toObject() };
              delete editedUser.password;
              const stateData = {
                userData: editedUser,
                futuresPools: this.futuresPools,
                networks: this.networks,
                pools: this.pools,
              };
              socket.emit("live_data", stateData);
              socket.disconnect();
            }
          } else {
            socket.emit("live_data", "token_not_found");
          }
        } else if (action === "graph") {
          const symbol = msg.split("::")[1];
          const resolution = msg.split("::")[2];
          const res = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=${resolution}`
          );
          const data = await res.json();
          const ohlcvArray = data?.map((candle: any) => ({
            time: candle[0],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5]),
          }));
          socket.emit("graph_data", JSON.stringify(ohlcvArray));
          socket.disconnect();
        } else if (action === "live_candle") {
          const symbol = msg.split("::")[1];
          const interval = msg.split("::")[2];
          const subscriberUID = msg.split("::")[3];
          console.log(
            `[live_candle] Method call with subscriberUID: ${subscriberUID}`
          );
          socket.emit("live_candle_data", {
            time: 0,
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            volume: 0,
          });
        } else if (action === "unsubscribe") {
          const subscriberUID = msg.split("::")[1];
          console.log(
            `[unsubscribe] Method call with subscriberUID: ${subscriberUID}`
          );
        }
      });
    });
    this.server.listen(this.port, () => {
      console.log(`[http]-> Running on port: ${this.port}`);
    });
    this.app.post("/api/v1/mempools", async (req: Request, res: Response) => {
      res.json({
        status: "ok",
        route: "1",
        networks: this.networks,
        pools: this.pools,
        futuresPools: this.futuresPools,
      });
    });
    this.app.get("/api/v1/get_state", getUser);
    this.app.post("/api/v1/get_state", getUser);
    this.app.post("/api/v1/login", async (req: Request, res: Response) => {
      login(req, res);
    });
    this.app.post("/api/v1/register", async (req: Request, res: Response) => {
      register(req, res);
    });
    this.app.get("/api/v1/time", async (req, res) => {
      res.status(200).json({ time: Date.now() });
    });
    this.app.post("/api/v1/rpc/solana", async (req, res) => {
      try {
        const response = await fetch("https://api.mainnet-beta.solana.com/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req.body),
        });
        const responseData = await response.json();
        res.json(responseData);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });
    this.app.post("/api/v1/rpc/ethereum", async (req, res) => {
      try {
        const response = await fetch("https://rpc.ankr.com/eth/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req.body),
        });
        const responseData = await response.json();
        res.json(responseData);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });
    /*await this.clmm.swap(
      "629WLQWqvT4Vz7nbi3xBRJB9",
      "WSOL_So11111111111111111111111111111111111111112",
      "USDC_EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      699,
      0.01
    );
    this.clmm.createPool({
      network: "solana",
      pair: {
        tokenA: "WNT_adDresSs21Xaqv",
        tokenB: "USDC_EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      },
      feeRate: 0.04,
      initialReserveA: 150000000,
      initialReserveB: 100,
    });*/
  }
}
new WaultdexServer();
