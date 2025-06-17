// index.ts
import cors from "cors";
import express from "express";
import helmet from "helmet";
import http from "http";
import router from "@/router";
import clientPromise from "@/lib/mongo";
import { Server } from "socket.io";
import handleSocketConnection from "./socket/connection";
export default class WaultdexServer {
    port = parseInt(process.env.PORT || "9443");
    app = express();
    server = http.createServer(this.app);
    io = new Server(this.server, {
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
    socketsubs = new Map();
    futuresMarkets;
    spotMarkets;
    networks;
    async initialize() {
        const db = (await clientPromise).db("waultdex");
        //initChangeStreams(this.io, this.socketsubs);
        await this.setupServer();
    }
    async setupServer() {
        this.app.use(express.json());
        this.app.use(helmet());
        this.app.use(cors({ origin: "*", credentials: true }));
        router(this.app, "routes");
        this.io.on("connection", await handleSocketConnection.bind(this));
        this.server.listen(this.port, () => {
            console.log(`[http] -> Running on port: ${this.port}`);
        });
    }
}
new WaultdexServer().initialize();
