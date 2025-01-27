import express, { Request, Response } from "express";
import { Server } from "socket.io";
import mongoose, { model, Schema } from "mongoose";
import helmet from "helmet";
import bcrypt from "bcrypt";
import cors from "cors";
import http from "http";
import { pools } from "./data/pools";
import { futuresPools } from "./data/futuresPools";
import { FuturesPool, Pool } from "./types";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { Keypair as SOLWallet } from "@solana/web3.js";
import { Wallet as ERC20Wallet } from "ethers";

let Pools: Pool[] = [...pools];
let FuturesPools: FuturesPool[] = [...futuresPools];
let Networks: any = [];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost", "https://waultdex.vercel.app"],
    methods: ["GET", "POST"],
  },
});
const port = 9443;
app.use(express.json());
app.use(helmet());
app.use(
  cors({
    origin: "*",
  })
);
export interface IUserInterface {
  userId?: string;
  email: string;
  password?: string;
  token: string;
  username?: string;
  permission: string;
  wallets: IWalletInterface[];
  created: string;
}
export interface IWalletInterface {
  name: string;
  keypairs: IWalletKeypairInterface[];
}
export interface IWalletKeypairInterface {
  public: string;
  private: string;
  type: string;
}
const keypairSchema = new Schema<IWalletKeypairInterface>({
  public: { type: String, required: true },
  private: { type: String, required: true },
  type: { type: String, required: true },
});
const walletSchema = new Schema<IWalletInterface>({
  name: { type: String, required: false },
  keypairs: { type: [keypairSchema], required: true, default: [] },
});
const userSchema = new Schema<IUserInterface>({
  userId: { type: String, required: false, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  token: { type: String, required: true },
  username: { type: String, required: false },
  permission: { type: String, default: "user" },
  wallets: { type: [walletSchema], default: [] },
  created: { type: String, default: Date.now().toString(), required: true },
});
export const UserModel = model<IUserInterface>(
  "UserModel",
  userSchema,
  "users"
);
mongoose.connect(
  "mongodb+srv://waultbank:317aIGQECqJHqosC@cluster0.fkgjz.mongodb.net",
  {
    appName: "main",
    retryWrites: true,
    w: "majority",
  }
);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB Connection Error:"));
db.once("open", () => {
  console.log("[MongoDB]-> Connection success");
});
const socketSubscriptions: Map<string, string> = new Map([]); //token->socketId
db.once("open", async () => {
  const UserModelChangeStream = UserModel.watch([], {
    fullDocument: "updateLookup",
  });
  UserModelChangeStream.on("change", async (change) => {
    if (
      change.operationType === "insert" ||
      change.operationType === "update" ||
      change.operationType === "replace" ||
      change.operationType === "delete"
    ) {
      let userData = { ...change.fullDocument };
      delete userData.password;
      const subscription = socketSubscriptions.get(userData.token);
      if (subscription) {
        const stateData = {
          userData: userData,
          futuresPools: FuturesPools,
          networks: Networks,
          pools: Pools,
        };
        io.to(subscription).emit("live_data", stateData);
      }
    }
  });
});
io.on("connection", async (socket) => {
  socket.on("chat message", async (msg) => {
    const [action, payload] = msg.split("::");
    if (action === "live_data") {
      const token = payload;
      if (typeof token === "string") {
        const currentUser = await UserModel.findOne({ token });
        if (!currentUser) {
          socket.emit("live_data", "user_not_found");
        } else {
          socketSubscriptions.set(token, socket.id);
          let editedUser = { ...currentUser.toObject() };
          delete editedUser.password;
          const stateData = {
            userData: editedUser,
            futuresPools: FuturesPools,
            networks: Networks,
            pools: Pools,
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
const getUserHandler = async (req: Request, res: Response) => {
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
};
app.get("/api/v1/get_state", getUserHandler);
app.post("/api/v1/get_state", getUserHandler);
app.post("/api/v1/mempools", async (req: Request, res: Response) => {
  res.json({
    status: "ok",
    route: "1",
    networks: Networks,
    pools: Pools,
    futuresPools: FuturesPools,
    newListed: [
      {
        symbol: "SOL",
        network: "solana",
        address: "native",
      },
      {
        symbol: "WSOL",
        network: "solana",
        address: "So11111111111111111111111111111111111111112",
      },
      {
        symbol: "USDC",
        network: "solana",
        address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      },
      {
        symbol: "WNT",
        network: "solana",
        address: "EPeFWBd5AufqxSqeM2qN1xzybapC8G4wEGGkZxzwault",
      },
    ],
    gainers: [],
    popular: [],
  });
});
app.post("/api/v1/login", async (req: Request, res: Response) => {
  const {
    mailOrUsername,
    password,
  }: { mailOrUsername: string; password: string } = req.body;

  if (password.length >= 6) {
    const user = await UserModel.findOne({ email: mailOrUsername });
    if (user) {
      if (await bcrypt.compare(password, user?.password || "")) {
        const token = user.token;
        res.json({ status: "login_success", token });
      } else {
        res.json({ status: "error", message: "invalid_password" });
      }
    } else {
      res.json({ status: "error", message: "user_not_found" });
    }
  } else {
    res.json({ status: "error", message: "passlength_<_six" });
  }
});
app.post("/api/v1/register", async (req: Request, res: Response) => {
  const { email, password }: { email: string; password: string } = req.body;
  if (password.length >= 6) {
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.json({ status: "error", message: "user_already_exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const token = await jwt.sign({ email }, "waultdex");
    const solanaKeypair = SOLWallet.generate();
    const erc20Keypair = ERC20Wallet.createRandom();
    const userData = {
      email,
      password: hashedPassword,
      token,
      permission: "user",
      created: Date.now().toString(),
      wallets: [
        {
          name: "Wallet 1",
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
      res.json({ status: "error", message: "db error" });
      console.log(e);
    }
  } else {
    res.json({ status: "error", message: "Password length lower than 6" });
  }
});
app.get("/api/v1/time", async (req, res) => {
  res.status(200).json({ time: Date.now() });
});
//web3 rpcs
app.post("/api/v1/rpc/solana", async (req, res) => {
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
app.post("/api/v1/rpc/ethereum", async (req, res) => {
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
server.listen(port, () => {
  console.log(`[server]-> Running on port: ${port}`);
});
