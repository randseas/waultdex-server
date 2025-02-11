import express, { Request, Response } from "express";
import { Server } from "socket.io";
import mongoose, { MongooseError } from "mongoose";
import helmet from "helmet";
import cors from "cors";
import http from "http";
import WebSocket from "ws";
import fetch from "node-fetch";
import bcrypt from "bcrypt";
import { Keypair as SOLWallet } from "@solana/web3.js";
import { Wallet as ERC20Wallet } from "ethers";
import jwt from "jsonwebtoken";
import bs58 from "bs58";
//@ts-expect-error
import GeetestLib from "./lib/geetest.lib.js";
import type { SpotMarket, FuturesMarket, Session } from "./types";
import { UserModel } from "./models/UserModel";
import { SpotMarketModel } from "./models/SpotMarketModel";
import { FuturesMarketModel } from "./models/FuturesMarketModel";

export interface WsSubscription {
  ws: WebSocket;
  subscribers: Set<string>;
  resolution: string;
  symbol: string;
}

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
  private socketsubs: Map<string, string> = new Map([]); // token -> socket.id
  private wsSubscriptions: { [topic: string]: WsSubscription } = {};
  public db: any;
  public spotMarkets: SpotMarket[] = [];
  public futuresMarkets: FuturesMarket[] = [];
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
          )
            return;
          if (!change.fullDocument) return;
          let userData = { ...change.fullDocument };
          delete userData.password;
          const spotMarkets = await SpotMarketModel.find();
          const futuresMarkets = await FuturesMarketModel.find();
          const subscription = this.socketsubs.get(userData.token);
          if (subscription) {
            console.log(`User changed and sent to subscriber: ${subscription}`);
            this.io.to(subscription).emit("live_data", {
              userData,
              spotMarkets,
              futuresMarkets,
            });
            console.log("sentData", JSON.stringify(userData));
          } else {
            console.log(
              `User changed but cannot find socket subscription. canceled.`
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
              const spotMarkets = await SpotMarketModel.find();
              const futuresMarkets = await FuturesMarketModel.find();
              this.spotMarkets = spotMarkets;
              this.futuresMarkets = futuresMarkets;
              const stateData = {
                userData: editedUser,
                spotMarkets,
                futuresMarkets,
              };
              socket.emit("live_data", stateData);
            }
          } else {
            socket.emit("live_data", "token_not_found");
          }
        } else if (action === "live_candle") {
          const symbol = msg.split("::")[1];
          const resolution = msg.split("::")[2];
          const subscriberUID = msg.split("::")[3];
          console.log(
            `[live_candle] Method call with subscriberUID: ${subscriberUID}`
          );
          let intervalForTopic = resolution;
          if (resolution.endsWith("m")) {
            intervalForTopic = resolution.slice(0, -1) + "min";
          } else if (resolution.endsWith("h")) {
            intervalForTopic = resolution.slice(0, -1) + "hour";
          }
          const topic = `/market/candles:${symbol}_${intervalForTopic}`;
          if (!this.wsSubscriptions[topic]) {
            const kucoinWsUrl = "wss://ws-api-spot.kucoin.com";
            const ws = new WebSocket(kucoinWsUrl);
            const subscription: WsSubscription = {
              ws,
              subscribers: new Set<string>(),
              resolution,
              symbol,
            };
            this.wsSubscriptions[topic] = subscription;
            ws.on("open", () => {
              console.log(`Connected to KuCoin live stream for topic ${topic}`);
              const subscribeMessage = {
                id: Date.now().toString(),
                type: "subscribe",
                topic: topic,
                privateChannel: false,
                response: true,
              };
              ws.send(JSON.stringify(subscribeMessage));
            });
            ws.on("message", (data: any) => {
              try {
                const parsedData = JSON.parse(data.toString());
                if (
                  parsedData.topic === topic &&
                  parsedData.data &&
                  parsedData.data.candle
                ) {
                  const candleData = parsedData.data.candle;
                  const candle = {
                    time: parseInt(candleData[0]) * 1000,
                    open: parseFloat(candleData[1]),
                    close: parseFloat(candleData[2]),
                    high: parseFloat(candleData[3]),
                    low: parseFloat(candleData[4]),
                    volume: parseFloat(candleData[5]),
                    resolution: resolution,
                  };
                  subscription.subscribers.forEach((socketId) => {
                    this.io.to(socketId).emit("live_candle_data", candle);
                  });
                }
              } catch (error) {
                console.error("Error parsing KuCoin WS message:", error);
              }
            });
            ws.on("error", (err) => {
              console.error("WebSocket error:", err);
            });
            ws.on("close", (code, reason) => {
              console.log(
                `WS connection for topic ${topic} closed. Code: ${code}, Reason: ${reason}`
              );
              delete this.wsSubscriptions[topic];
            });
          }
          this.wsSubscriptions[topic].subscribers.add(socket.id);
          socket.on("disconnect", () => {
            if (this.wsSubscriptions[topic]) {
              this.wsSubscriptions[topic].subscribers.delete(socket.id);
              console.log(
                `Socket ${socket.id} unsubscribed from topic ${topic}`
              );
              if (this.wsSubscriptions[topic].subscribers.size === 0) {
                this.wsSubscriptions[topic].ws.close();
                delete this.wsSubscriptions[topic];
                console.log(
                  `No subscribers left for topic ${topic}. WS closed.`
                );
              }
            }
          });
        } else if (action === "unsubscribe") {
          const subscriberUID = msg.split("::")[1];
          const parts = subscriberUID.split("/");
          const symbol = parts[0].split("_")[0] + parts[1].split("_")[0];
          const resolution = subscriberUID.split("#_")[1];
          const topic = `kline.${resolution}.${symbol}`;
          this.wsSubscriptions[topic]?.subscribers?.delete(subscriberUID);
          console.log(
            `[unsubscribe] Method call for subscriberUID: ${subscriberUID}`
          );
        } else if (action === "time") {
          const serverTime = Date.now();
          socket.emit("server_time", serverTime);
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
        spotMarkets: this.spotMarkets,
        futuresMarkets: this.futuresMarkets,
        carousel: [
          {
            img: null,
            auth: false,
            title: "carousel1Title",
            description: "carousel1Desc",
            buttons: [
              { url: "/oauth/register", text: "carousel1BtnRegister" },
              { url: "/oauth/login", text: "carousel1BtnLogin" },
            ],
          },
          {
            img: null,
            auth: true,
            title: "carousel2Title",
            description: "carousel2Desc",
            buttons: [{ url: "/earn", text: "carousel2Btn1" }],
          },
        ],
        newListed: [
          { id: "679d16892a2ba02c09c52f1c" },
          { id: "679d16892a2ba02c09c52f1c" },
        ],
        gainers: [{ id: "679d16892a2ba02c09c52f1c" }],
        popular: [{ id: "679d16892a2ba02c09c52f1c" }],
      });
    });
    async function getUser(req: any, res: any) {
      const token = req.body.token || req.query.token;
      if (typeof token === "string") {
        const user = await UserModel.findOne({ token });
        if (user) {
          res.json({
            status: "ok",
            userData: user,
          });
        } else {
          res.json({
            status: "error",
            error: "user_not_found",
          });
        }
      } else {
        res.json({
          status: "error",
          error: "token_not_found",
        });
      }
    }
    function generateUID(): string {
      return Math.floor(10000000 + Math.random() * 90000000).toString();
    }
    function generateWalletID(): string {
      const chars = "abcdefghikmnpqrstuvwxyz0123456789";
      let walletID = "";
      for (let i = 0; i < 24; i++) {
        walletID += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return walletID;
    }
    this.app.get("/api/v1/get_state", getUser);
    this.app.post("/api/v1/get_state", getUser);
    this.app.post("/api/v1/login", async (req: Request, res: Response) => {
      try {
        const { email, password } = req.body as {
          email: string;
          password: string;
        };
        const user = await UserModel.findOne({ email });
        if (!user) {
          return res.json({ status: "error", message: "user_not_found" });
        }
        const isMatch = await bcrypt.compare(password, user.password || "");
        if (!isMatch) {
          return res.json({ status: "error", message: "invalid_password" });
        }
        const session = generateUID();
        const newSession: Session = {
          token: user.token,
          session,
          device: req.headers["user-agent"] || null,
          ipAddress: req.ip || null,
          createdAt: Date.now().toString(),
          lastSeen: Date.now().toString(),
        };
        try {
          user.sessions.push(newSession);
          await user.save();
          return res.json({ status: "login_success", session });
        } catch (err: any) {
          console.log(
            "Session creation error:",
            typeof err === "string" ? err : JSON.stringify(err)
          );
          return res.json({
            status: "error",
            message: "cannot_create_session",
          });
        }
      } catch (error) {
        console.error("Login error:", error);
        return res.json({ status: "error", message: "internal_server_error" });
      }
    });
    this.app.post("/api/v1/register", async (req: Request, res: Response) => {
      const { email, password }: { email: string; password: string } = req.body;
      if (password.length >= 6) {
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
          return res.json({ status: "error", message: "user_already_exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const token = jwt.sign({ email }, "waultdex");
        const userId = generateUID();
        const solanaKeypair = SOLWallet.generate();
        const erc20Keypair = ERC20Wallet.createRandom();
        const userData = {
          userId,
          email,
          password: hashedPassword,
          token,
          username: `User-${userId}`,
          permission: "user",
          created: Date.now().toString(),
          wallets: [
            {
              name: "",
              keypairs: [
                {
                  public: solanaKeypair.publicKey.toString(),
                  private: bs58.encode(solanaKeypair.secretKey).toString(),
                  type: "ed25519",
                },
                {
                  public: erc20Keypair.address.toString(),
                  private: erc20Keypair.privateKey.toString(),
                  type: "secp256k1",
                },
              ],
            },
          ],
        };
        const user = new UserModel(userData);
        try {
          await user.save();
          res.json({ status: "register_success", token });
        } catch (e) {
          res.json({ status: "error", message: "db_error" });
          console.log(e);
        }
      } else {
        res.json({ status: "error", message: "passlength_low" });
      }
    });
    this.app.post("/api/v1/createWallet", async (req, res) => {
      const {
        token,
        name,
        colorScheme,
      }: { token: string; name: string; colorScheme: string } = req.body;
      const user = await UserModel.findOne({ token });
      if (!user) {
        return res.json({ status: "error", message: "user_not_found" });
      }
      const id = generateWalletID();
      const solanaKeypair = SOLWallet.generate();
      const erc20Keypair = ERC20Wallet.createRandom();
      const newWallet = {
        id,
        name,
        colorScheme,
        keypairs: [
          {
            public: solanaKeypair.publicKey.toString(),
            private: bs58.encode(solanaKeypair.secretKey).toString(),
            type: "ed25519",
          },
          {
            public: erc20Keypair.address.toString(),
            private: erc20Keypair.privateKey.toString(),
            type: "secp256k1",
          },
        ],
        balances: [],
      };
      try {
        user.wallets.push(newWallet);
        await user.save();
        return res.json({ status: "ok", message: "wallet_created" });
      } catch (err: any) {
        return res.json({ status: "error", message: "wallet_push_error" });
      }
    });
    this.app.get("/api/v1/time", async (req, res) => {
      res.status(200).json({ time: Date.now() });
    });
    this.app.get("/api/v1/geetest", async function (req, res) {
      const gtLib = new GeetestLib(
        "2dbc99dae3e802c20224b3f9f63d874c",
        "ffedf90d76164b6c227188eb1cc642bf"
      );
      const digestmod = "md5";
      const userId = "nano";
      const params = {
        digestmod: digestmod,
        user_id: userId,
        client_type: "web",
        ip_address: "127.0.0.1",
      };
      let result;
      result = await gtLib.register(digestmod, params);
      res.set("Content-Type", "application/json;charset=UTF-8");
      return res.send(result.data);
    });
    this.app.get("/api/v1/klines", async (req, res) => {
      const { symbol, interval, startTime, endTime, countBack }: any =
        req.query;
      const sanitizedSymbol = (symbol?.toString() || "BTC-USDT").toUpperCase();
      const symbolParts = sanitizedSymbol.split(/[^A-Za-z0-9]/);
      const updatedSymbol =
        symbolParts.length >= 2
          ? `${symbolParts[0]}-${symbolParts[2]}`
          : "BTC-USDT";
      console.log(`[historic_kline] Method call with symbol: ${updatedSymbol}`);
      if (!interval || !updatedSymbol) {
        return res.json({
          list: [],
          message: "Required params: [symbol, interval].",
        });
      }
      try {
        let url = `https://api.kucoin.com/api/v1/market/candles?type=${interval}&symbol=${updatedSymbol}`;
        if (startTime) url += `&startAt=${startTime}`;
        if (endTime) url += `&endAt=${endTime}`;
        const kucoinRes = await fetch(url);
        const data = await kucoinRes.json();
        //@ts-ignore
        let ohlcvArray = data.data
          ? //@ts-ignore
            data.data.reverse().map((candle: string[]) => ({
              time: parseInt(candle[0]) * 1000,
              open: parseFloat(candle[1]),
              close: parseFloat(candle[2]),
              high: parseFloat(candle[3]),
              low: parseFloat(candle[4]),
              volume: parseFloat(candle[5]),
            }))
          : [];
        console.log(`Received ${ohlcvArray.length} klines from KuCoin`);
        if (countBack) {
          const msPerInterval = intervalToMs(interval);
          const earliestTime =
            ohlcvArray.length > 0
              ? ohlcvArray[0].time
              : Date.now() - countBack * msPerInterval;
          for (let i = 1; i <= countBack; i++) {
            const newTime = earliestTime - i * msPerInterval;
            ohlcvArray.unshift({
              time: newTime,
              open: ohlcvArray[0]?.open ?? 0,
              close: ohlcvArray[0]?.open ?? 0,
              high: ohlcvArray[0]?.open ?? 0,
              low: ohlcvArray[0]?.open ?? 0,
              volume: 0,
            });
          }
        }
        res.json({ list: ohlcvArray });
      } catch (error) {
        console.error("KuCoin fetch error:", error);
        res.status(500).json({ list: [] });
      }
    });
    function intervalToMs(interval: any) {
      const multipliers = {
        "1min": 60 * 1000,
        "3min": 3 * 60 * 1000,
        "5min": 5 * 60 * 1000,
        "15min": 15 * 60 * 1000,
        "30min": 30 * 60 * 1000,
        "1hour": 60 * 60 * 1000,
        "2hour": 2 * 60 * 60 * 1000,
        "4hour": 4 * 60 * 60 * 1000,
        "6hour": 6 * 60 * 60 * 1000,
        "8hour": 8 * 60 * 60 * 1000,
        "12hour": 12 * 60 * 60 * 1000,
        "1day": 24 * 60 * 60 * 1000,
        "1week": 7 * 24 * 60 * 60 * 1000,
      };
      return multipliers[interval as keyof typeof multipliers] || 0;
    }
  }
}
new WaultdexServer();
