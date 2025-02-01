import express, { Request, Response } from "express";
import { Server } from "socket.io";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import http from "http";
import WebSocket from "ws";

import type { SpotMarket, FuturesMarket } from "./types";

import { UserModel } from "./models/UserModel";
import { SpotMarketModel } from "./models/SpotMarketModel";
import { FuturesMarketModel } from "./models/FuturesMarketModel";
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
      const UserModelChangeStream = UserModel.watch([], {
        fullDocument: "updateLookup",
      });
      const SpotMarketModelChangeStream = SpotMarketModel.watch([], {
        fullDocument: "updateLookup",
      });
      const FuturesMarketModelChangeStream = FuturesMarketModel.watch([], {
        fullDocument: "updateLookup",
      });
      SpotMarketModelChangeStream.on("change", async (change: any) => {
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
              userData: userData,
              spotMarkets: spotMarkets,
              futuresMarkets: futuresMarkets,
            };
            this.io.to(subscription).emit("live_data", stateData);
          }
        }
        FuturesMarketModelChangeStream.on("change", async (change: any) => {
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
                userData: userData,
                spotMarkets: spotMarkets,
                futuresMarkets: futuresMarkets,
              };
              this.io.to(subscription).emit("live_data", stateData);
            }
          }
        });
      });
      UserModelChangeStream.on("change", async (change: any) => {
        if (
          change.operationType === "insert" ||
          change.operationType === "update" ||
          change.operationType === "replace" ||
          change.operationType === "delete"
        ) {
          const spotMarkets = await SpotMarketModel.find();
          const futuresMarkets = await FuturesMarketModel.find();
          let userData = { ...change.fullDocument };
          delete userData.password;
          const subscription = this.socketsubs.get(userData.token);
          if (subscription) {
            const stateData = {
              userData: userData,
              spotMarkets: spotMarkets,
              futuresMarkets: futuresMarkets,
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
    var liveCandleConnections = {};
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
                spotMarkets: spotMarkets,
                futuresMarkets: futuresMarkets,
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
          const binanceSymbol = `${symbol.split("/")[0].split("_")[0]}${symbol.split("/")[1].split("_")[0]}`;
          const res = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${resolution.toLowerCase()}`
          );
          const data = await res.json();
          if (Array.isArray(data)) {
            const ohlcvArray = data?.map((candle: any) => ({
              time: candle[0],
              open: parseFloat(candle[1]),
              high: parseFloat(candle[2]),
              low: parseFloat(candle[3]),
              close: parseFloat(candle[4]),
              volume: parseFloat(candle[5]),
            }));
            socket.emit("graph_data", JSON.stringify(ohlcvArray));
          } else {
            socket.emit("graph_data", JSON.stringify([]));
          }
        } else if (action === "live_candle") {
          const symbol = msg.split("::")[1];
          const resolution = msg.split("::")[2];
          const subscriberUID = msg.split("::")[3];
          console.log(
            `[live_candle] Method call with subscriberUID: ${subscriberUID}`
          );
          const binanceSymbol = `${symbol.split("/")[0].split("_")[0].toLowerCase()}${symbol.split("/")[1].split("_")[0].toLowerCase()}`;
          const binanceWsUrl = `wss://stream.binance.com:9443/ws/${binanceSymbol}@kline_${resolution}`;
          console.log("connectedWsUrl", binanceWsUrl);
          const binanceWS = new WebSocket(binanceWsUrl);
          binanceWS.on("open", () => {
            console.log(
              `Connected to Binance live stream for ${binanceSymbol} at resolution ${resolution}`
            );
          });
          binanceWS.on("ping", (data) => {
            console.log(
              `Received ping from Binance for ${binanceSymbol}. Sending pong response.`
            );
            binanceWS.pong(data);
          });
          binanceWS.on("pong", (data) => {
            console.log(`Received pong from Binance for ${binanceSymbol}.`);
          });
          binanceWS.on("message", (data: any) => {
            try {
              const parsedData = JSON.parse(data.toString());
              const kline = parsedData.k;
              const candle = {
                time: kline.t,
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
                volume: parseFloat(kline.v),
                resolution: resolution,
              };
              socket.emit("live_candle_data", candle);
            } catch (error) {
              console.error("Error parsing Binance WS message:", error);
            }
          });
          binanceWS.on("error", (err) => {
            console.error("WebSocket hata:", err);
          });
          binanceWS.on("close", (code, reason) => {
            console.log(`Bağlantı kapandı. Kod: ${code}, Sebep: ${reason}`);
          });
          //@ts-expect-error
          liveCandleConnections[subscriberUID] = binanceWS;
          socket.on("disconnect", () => {
            //@ts-expect-error
            if (liveCandleConnections[subscriberUID]) {
              //@ts-expect-error
              liveCandleConnections[subscriberUID].close();
              //@ts-expect-error
              delete liveCandleConnections[subscriberUID];
              console.log(
                `Disconnected live candle WS for subscriberUID: ${subscriberUID}`
              );
            }
          });
        } else if (action === "unsubscribe") {
          const subscriberUID = msg.split("::")[1];
          console.log(
            `[unsubscribe] Method call with subscriberUID: ${subscriberUID}`
          );
          //@ts-expect-error
          if (liveCandleConnections[subscriberUID]) {
            //@ts-expect-error
            liveCandleConnections[subscriberUID].close();
            //@ts-expect-error
            delete liveCandleConnections[subscriberUID];
            console.log(
              `Unsubscribed live candle data for subscriberUID: ${subscriberUID}`
            );
          }
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
        /* primary */
        spotMarkets: this.spotMarkets,
        futuresMarkets: this.futuresMarkets,
        /* home feed */
        carousel: [
          {
            img: null,
            auth: false, //is for logged in users?
            title: "carousel1Title",
            description: "carousel1Desc",
            buttons: [
              {
                url: "/oauth/register",
                text: "carousel1BtnRegister",
              },
              {
                url: "/oauth/login",
                text: "carousel1BtnLogin",
              },
            ],
          },
          {
            img: null,
            auth: true, //is for logged in users?
            title: "carousel2Title",
            description: "carousel2Desc",
            buttons: [
              {
                url: "/earn",
                text: "carousel2Btn1",
              },
            ],
          },
        ],
        newListed: [
          {
            id: "679d16892a2ba02c09c52f1c",
          },
          {
            id: "679d16892a2ba02c09c52f1c",
          },
        ],
        gainers: [
          {
            id: "679d16892a2ba02c09c52f1c",
          },
        ],
        popular: [
          {
            id: "679d16892a2ba02c09c52f1c",
          },
        ],
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
  }
}
new WaultdexServer();
