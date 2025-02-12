import express from "express";
import { Server } from "socket.io";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import http from "http";
import fetch from "node-fetch";
import bcrypt from "bcrypt";
import { Keypair as SOLWallet } from "@solana/web3.js";
import { Wallet as ERC20Wallet } from "ethers";
import jwt from "jsonwebtoken";
import bs58 from "bs58";
import { sendEmail } from "./helpers/mailer.js";
import GeetestLib from "./lib/geetest.lib.js";
import { UserModel } from "./models/UserModel.js";
import { SpotMarketModel } from "./models/SpotMarketModel.js";
import { FuturesMarketModel } from "./models/FuturesMarketModel.js";
import { NetworkModel } from "./models/NetworkModel.js";
import dotenv from "dotenv";
dotenv.config();
export default class WaultdexServer {
    constructor() {
        this.port = parseInt(process.env.PORT || "9443");
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: ["http://localhost", "https://waultdex.vercel.app"],
                methods: ["GET", "POST"],
            },
        });
        this.socketsubs = new Map([]); // token -> socket.id
        this.spotMarkets = [];
        this.futuresMarkets = [];
        this.networks = [];
        this.initialize();
    }
    async initialize() {
        try {
            await mongoose.connect("mongodb+srv://waultbank:317aIGQECqJHqosC@cluster0.fkgjz.mongodb.net", {
                appName: "main",
                retryWrites: true,
                w: "majority",
            });
            console.log("[MongoDB]-> Connection success");
            this.db = mongoose.connection;
            this.spotMarkets = await SpotMarketModel.find();
            this.futuresMarkets = await FuturesMarketModel.find();
            const userChangeStream = UserModel.watch([], {
                fullDocument: "updateLookup",
            });
            const spotMarketChangeStream = SpotMarketModel.watch([]);
            const futuresMarketChangeStream = FuturesMarketModel.watch([]);
            const handleUserChange = async (change) => {
                try {
                    if (!["insert", "update", "replace", "delete"].includes(change.operationType)) {
                        return;
                    }
                    if (!change.fullDocument)
                        return;
                    let userData = { ...change.fullDocument };
                    delete userData.password;
                    const spotMarkets = await SpotMarketModel.find();
                    const futuresMarkets = await FuturesMarketModel.find();
                    const activeSessions = userData.sessions
                        .map((session) => this.socketsubs.get(session.token))
                        .filter((session) => session);
                    if (activeSessions.length > 0) {
                        console.log(`User changed and sent to subscribers: ${activeSessions.join(", ")}`);
                        activeSessions.forEach((subscription) => {
                            this.io.to(subscription).emit("live_data", {
                                userData,
                                spotMarkets,
                                futuresMarkets,
                            });
                        });
                    }
                    else {
                        console.log("User changed but cannot find any active socket subscription. Canceled.");
                    }
                }
                catch (error) {
                    console.error("User change stream error:", error);
                }
            };
            const handleSpotMarketChange = async () => {
                try {
                    const spotMarkets = await SpotMarketModel.find();
                    const futuresMarkets = await FuturesMarketModel.find();
                    this.io.emit("live_data", { spotMarkets, futuresMarkets });
                }
                catch (error) {
                    console.error("Spot market change stream error:", error);
                }
            };
            const handleFuturesMarketChange = async () => {
                try {
                    const spotMarkets = await SpotMarketModel.find();
                    const futuresMarkets = await FuturesMarketModel.find();
                    this.io.emit("live_data", { spotMarkets, futuresMarkets });
                }
                catch (error) {
                    console.error("Futures market change stream error:", error);
                }
            };
            userChangeStream.on("change", handleUserChange);
            spotMarketChangeStream.on("change", handleSpotMarketChange);
            futuresMarketChangeStream.on("change", handleFuturesMarketChange);
            console.log("[MongoDB]-> Change streams initialized");
        }
        catch (error) {
            console.error("[MongoDB]-> Connection failed:", error);
        }
        await this.setupServer();
    }
    async setupServer() {
        this.app.use(express.json());
        this.app.use(helmet());
        this.app.use(cors({ origin: "*" }));
        this.io.on("connection", async (socket) => {
            socket.on("chat message", async (msg) => {
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
                    const currentUser = users.find((user) => user.sessions.some((session) => session.token === sessionToken));
                    if (!currentUser) {
                        return socket.emit("live_data", {
                            userData: "user_not_found",
                            spotMarkets,
                            futuresMarkets,
                        });
                    }
                    const sessionIndex = currentUser.sessions.findIndex((s) => s.token === sessionToken);
                    if (sessionIndex === -1) {
                        return socket.emit("live_data", {
                            userData: "session_not_found",
                            spotMarkets,
                            futuresMarkets,
                        });
                    }
                    currentUser.sessions[sessionIndex].lastSeen = Date.now().toString();
                    await UserModel.updateOne({ _id: currentUser._id, "sessions.token": sessionToken }, { $set: { "sessions.$.lastSeen": Date.now().toString() } });
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
                }
                else if (action === "live_candle") {
                    //...
                }
                else if (action === "unsubscribe") {
                    //...
                }
                else if (action === "time") {
                    const serverTime = Date.now();
                    socket.emit("server_time", serverTime);
                }
            });
        });
        this.server.listen(this.port, () => {
            console.log(`[http]-> Running on port: ${this.port}`);
        });
        this.app.post("/api/v1/mempools", async (req, res) => {
            res.json({
                status: "ok",
                route: "1",
                spotMarkets: this.spotMarkets,
                futuresMarkets: this.futuresMarkets,
                networks: this.networks,
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
        function generateUID() {
            return Math.floor(10000000 + Math.random() * 90000000).toString();
        }
        function generateWalletID() {
            const chars = "abcdefghikmnpqrstuvwxyz0123456789";
            let walletID = "";
            for (let i = 0; i < 24; i++) {
                walletID += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return walletID;
        }
        this.app.post("/api/v1/login", async (req, res) => {
            try {
                const { email, password, otp } = req.body;
                const user = await UserModel.findOne({ email });
                if (!user) {
                    return res.json({ status: "error", message: "user_not_found" });
                }
                const isMatch = await bcrypt.compare(password, user.password || "");
                if (!isMatch) {
                    return res.json({ status: "error", message: "invalid_password" });
                }
                if (otp) {
                    if (user.otp === "") {
                        return res.json({ status: "error", message: "otp_time_invalid" });
                    }
                    if (user.otp !== otp) {
                        return res.json({ status: "error", message: "invalid_otp" });
                    }
                    const newSession = {
                        token: "",
                        device: req.headers["user-agent"] || null,
                        ipAddress: req.ip || null,
                        createdAt: Date.now().toString(),
                        lastSeen: Date.now().toString(),
                    };
                    const envJwtKey = process.env.JWT_KEY;
                    if (!envJwtKey) {
                        return res.json({ status: "error", message: "jwt_error" });
                    }
                    const sessionToken = jwt.sign(newSession, envJwtKey);
                    newSession.token = sessionToken;
                    try {
                        user.sessions.push(newSession);
                        user.otp = "";
                        await user.save();
                        return res.json({
                            status: "ok",
                            message: "login_success",
                            session: sessionToken,
                        });
                    }
                    catch (err) {
                        console.log("Session creation error:", JSON.stringify(err));
                        return res.json({
                            status: "error",
                            message: "cannot_create_session",
                        });
                    }
                }
                else {
                    const OTPCode = generateWalletID().slice(0, 6);
                    user.otp = OTPCode;
                    await user.save();
                    await sendEmail({ to: email, content: OTPCode });
                    return res.json({ status: "ok", message: "email_otp_sent" });
                }
            }
            catch (error) {
                console.error("Login error:", error);
                return res.json({ status: "error", message: "internal_server_error" });
            }
        });
        this.app.post("/api/v1/register", async (req, res) => {
            const { email, password } = req.body;
            if (password.length >= 6) {
                const existingUser = await UserModel.findOne({ email });
                if (existingUser) {
                    return res.json({ status: "error", message: "user_already_exists" });
                }
                const hashedPassword = await bcrypt.hash(password, 12);
                const envJwtKey = process.env.JWT_KEY;
                if (!envJwtKey) {
                    return res.json({ status: "error", message: "jwt_error" });
                }
                const userId = generateUID();
                const solanaKeypair = SOLWallet.generate();
                const erc20Keypair = ERC20Wallet.createRandom();
                const bip39Keypair = ERC20Wallet.createRandom();
                const userData = {
                    userId,
                    email,
                    password: hashedPassword,
                    username: `User-${userId}`,
                    permission: "user",
                    created: Date.now().toString(),
                    wallets: [
                        {
                            name: "",
                            keypairs: [
                                {
                                    public: erc20Keypair.address.toString(),
                                    private: erc20Keypair.privateKey.toString(),
                                    type: "secp256k1",
                                },
                                {
                                    public: solanaKeypair.publicKey.toString(),
                                    private: bs58.encode(solanaKeypair.secretKey).toString(),
                                    type: "ed25519",
                                },
                                {
                                    public: erc20Keypair.address.toString(),
                                    private: erc20Keypair.privateKey.toString(),
                                    type: "bip39",
                                },
                            ],
                        },
                    ],
                };
                const user = new UserModel(userData);
                try {
                    await user.save();
                    res.json({ status: "register_success" });
                }
                catch (e) {
                    res.json({ status: "error", message: "db_error" });
                    console.log(e);
                }
            }
            else {
                res.json({ status: "error", message: "passlength_low" });
            }
        });
        this.app.post("/api/v1/createWallet", async (req, res) => {
            const { token, name, colorScheme, } = req.body;
            const users = await UserModel.find({}, { password: 0 });
            const currentUser = users.find((user) => user.sessions.some((session) => session.token === token));
            if (!currentUser || !token) {
                return res.json({ status: "error", message: "user_not_found" });
            }
            const session = currentUser.sessions.find((s) => s.token === token);
            if (!session) {
                return res.json({ status: "error", message: "session_not_found" });
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
                currentUser.wallets.push(newWallet);
                await currentUser.save();
                return res.json({ status: "ok", message: "wallet_created" });
            }
            catch (err) {
                return res.json({ status: "error", message: "wallet_push_error" });
            }
        });
        this.app.get("/api/v1/time", async (req, res) => {
            res.status(200).json({ time: Date.now() });
        });
        this.app.get("/api/v1/geetest", async function (req, res) {
            const gtLib = new GeetestLib("2dbc99dae3e802c20224b3f9f63d874c", "ffedf90d76164b6c227188eb1cc642bf");
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
            const { symbol, interval, startTime, endTime, countBack } = req.query;
            const sanitizedSymbol = (symbol?.toString() || "BTC-USDT").toUpperCase();
            const symbolParts = sanitizedSymbol.split(/[^A-Za-z0-9]/);
            const updatedSymbol = symbolParts.length >= 2
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
                if (startTime)
                    url += `&startAt=${startTime}`;
                if (endTime)
                    url += `&endAt=${endTime}`;
                const kucoinRes = await fetch(url);
                const data = await kucoinRes.json();
                //@ts-ignore
                let ohlcvArray = data.data
                    ? //@ts-ignore
                        data.data.reverse().map((candle) => ({
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
                    const earliestTime = ohlcvArray.length > 0
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
            }
            catch (error) {
                console.error("KuCoin fetch error:", error);
                res.status(500).json({ list: [] });
            }
        });
        function intervalToMs(interval) {
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
            return multipliers[interval] || 0;
        }
    }
}
new WaultdexServer();
