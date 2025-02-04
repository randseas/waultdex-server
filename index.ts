import express, { Request, Response } from "express";
import { Server } from "socket.io";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import http from "http";
import WebSocket from "ws";
import fetch from "node-fetch"; // Eğer global fetch yoksa kurun: npm install node-fetch

import type { SpotMarket, FuturesMarket } from "./types";

import { UserModel } from "./models/UserModel";
import { SpotMarketModel } from "./models/SpotMarketModel";
import { FuturesMarketModel } from "./models/FuturesMarketModel";
import { getUser, login, register } from "./handlers/auth";

interface WsSubscription {
  ws: WebSocket;
  subscribers: Set<string>; // socket.io socket IDs
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

  // KuCoin için ayrıca bir SDK instance'ına ihtiyaç duyulabilir ama burada REST ve WS için doğrudan endpoint kullanalım.
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

      // Change streams (user, spot market, futures market) güncellemeleri
      const UserModelChangeStream = UserModel.watch([], {
        fullDocument: "updateLookup",
      });
      const SpotMarketModelChangeStream = SpotMarketModel.watch([], {
        fullDocument: "updateLookup",
      });
      const FuturesMarketModelChangeStream = FuturesMarketModel.watch([], {
        fullDocument: "updateLookup",
      });

      const handleChange = async (change: any) => {
        if (
          change.operationType === "insert" ||
          change.operationType === "update" ||
          change.operationType === "replace" ||
          change.operationType === "delete"
        ) {
          const spotMarkets = await SpotMarketModel.find();
          const futuresMarkets = await FuturesMarketModel.find();
          this.spotMarkets = spotMarkets;
          this.futuresMarkets = futuresMarkets;
          let userData = { ...change.fullDocument };
          delete userData.password;
          const subscription = this.socketsubs.get(userData.token);
          if (subscription) {
            const stateData = {
              userData,
              spotMarkets,
              futuresMarkets,
            };
            this.io.to(subscription).emit("live_data", stateData);
          }
        }
      };
      SpotMarketModelChangeStream.on("change", handleChange);
      FuturesMarketModelChangeStream.on("change", handleChange);
      UserModelChangeStream.on("change", handleChange);

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
              socket.disconnect();
            }
          } else {
            socket.emit("live_data", "token_not_found");
          }
        }
        // KuCoin WebSocket üzerinden gerçek zamanlı kline verisi
        else if (action === "live_candle") {
          const symbol = msg.split("::")[1]; // Örneğin "BTC-USDT"
          const resolution = msg.split("::")[2]; // Örneğin "1m", "5m", vb.
          const subscriberUID = msg.split("::")[3];
          console.log(
            `[live_candle] Method call with subscriberUID: ${subscriberUID}`
          );

          // KuCoin WebSocket konu formatı: /market/candles:{symbol}_{interval}
          // Örneğin: /market/candles:BTC-USDT_1min
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
                // Beklenen mesaj yapısı: { topic: "/market/candles:BTC-USDT_1min", data: { candle: [timestamp, open, close, high, low, volume], ... } }
                if (
                  parsedData.topic === topic &&
                  parsedData.data &&
                  parsedData.data.candle
                ) {
                  const candleData = parsedData.data.candle;
                  const candle = {
                    time: parseInt(candleData[0]) * 1000, // KuCoin timestamp saniye cinsinden olabilir
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

    // REST API endpointleri
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
