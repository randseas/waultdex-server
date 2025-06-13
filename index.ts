// index.ts
import cors from "cors";
import express from "express";
import helmet from "helmet";
import http from "http";
import router from "@/router";
import { connectDB, initChangeStreams } from "@/lib/mongo";
import { Server } from "socket.io";
import handleSocketConnection from "./socket/connection";

export default class WaultdexServer {
  private port = parseInt(process.env.PORT || "9443");
  private app = express();
  private server = http.createServer(this.app);
  public io = new Server(this.server, {
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
  public socketsubs = new Map<string, string>();
  public futuresMarkets: any;
  public spotMarkets: any;
  public networks: any;
  async initialize() {
    await connectDB();
    initChangeStreams(this.io, this.socketsubs);
    this.setupServer();
  }
  setupServer() {
    this.app.use(express.json());
    this.app.use(helmet());
    this.app.use(cors({ origin: "*", credentials: true }));
    router(this.app, "routes");
    this.io.on("connection", handleSocketConnection.bind(this));
    this.server.listen(this.port, () => {
      console.log(`[http]-> Running on port: ${this.port}`);
    });
  }
}
new WaultdexServer().initialize();
