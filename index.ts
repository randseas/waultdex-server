import express, { Request, Response } from "express";
import { Server } from "socket.io";
import mongoose, { model, Schema } from "mongoose";
import helmet from "helmet";
import bcrypt from "bcrypt";
import cors from "cors";
import http from "http";
import { pools } from "./data/pools";
import { futuresPools } from "./data/futuresPools";
import { FuturesPool, Pool, Wallet } from "./types";
import bs58 from "bs58";
import jwt from "jsonwebtoken";

//Web3
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
      //if (resolution === "1s") {}
      const pool = Pools.find((pool: Pool) => {
        const poolPair = `${pool.pair.tokenA}_${pool.network}/${pool.pair.tokenB}_${pool.network}`;
        return poolPair.toLowerCase() === symbol.toLowerCase();
      });
      socket.emit("graph_data", pool?.graph);
      socket.disconnect();
    } else if (action === "kline") {
    } else if (action === "unsubscribe") {
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
app.post("/api/v1/homeFeed", async (req: Request, res: Response) => {
  res.json({
    status: "ok",
    route: "1",
    networks: Networks,
    pools: Pools,
    futuresPools: FuturesPools,
    newListed: [
      {
        symbol: "ETH",
        network: "ethereum",
        address: "eth",
      },
      {
        symbol: "ARB",
        network: "arbitrum",
        address: "arb",
      },
      {
        symbol: "XAUT",
        network: "ethereum",
        address: "xaut",
      },
      {
        symbol: "USDC",
        network: "ethereum",
        address: "usdc",
      },
    ],
    gainers: [
      {
        symbol: "WX",
        network: "solana",
        address: "wx",
      },
      {
        symbol: "WLD",
        network: "ethereum",
        address: "wld",
      },
      {
        symbol: "EURT",
        network: "ethereum",
        address: "eurt",
      },
      {
        symbol: "GOAT",
        network: "solana",
        address: "goat",
      },
    ],
    popular: [
      {
        symbol: "SOL",
        network: "ethereum",
        address: "sol",
      },
      {
        symbol: "BTC",
        network: "arbitrum",
        address: "btc",
      },
      {
        symbol: "ETH",
        network: "ethereum",
        address: "eth",
      },
      {
        symbol: "SHIB",
        network: "ethereum",
        address: "shib",
      },
    ],
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
server.listen(port, () => {
  console.log(`[server]-> Running on port: ${port}`);
});
