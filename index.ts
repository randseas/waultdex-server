import express, { Request, Response } from "express";
import { mailRegex, generateToken } from "./helpers/user";
import { Server } from "socket.io";
import { JsonDatabase } from "./db/db";
import helmet from "helmet";
import bcrypt from "bcrypt";
import cors from "cors";
import http from "http";
import { pools } from "./data/pools";
import { futuresPools } from "./data/futuresPools";
import { FuturesPool, Pool } from "./types";

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
const db = new JsonDatabase();
app.use(express.json());
app.use(helmet());
app.use(
  cors({
    origin: "*",
  })
);

io.on("connection", (socket) => {
  socket.on("chat message", (msg) => {
    if (msg.split("::")[0] === "get_state") {
      const token = msg.split("::")[1];
      if (typeof token === "string") {
        setInterval(() => {
          const currentUser = db.findOne((user) => user.token === token);
          const stateData = {
            userData: currentUser,
            pools: Pools,
          };
          socket.emit("state data", stateData);
        }, 5000);
      } else {
        socket.emit("state data", "token_not_found");
      }
    } else if (msg.split("::")[0] === "graph") {
      const symbol = msg.split("::")[1];
      const resolution = msg.split("::")[2];
      //if (resolution === "1s") {}
      const pool = Pools.find((pool: Pool) => {
        const poolPair = `${pool.pair.tokenA}_${pool.network}/${pool.pair.tokenB}_${pool.network}`;
        return poolPair.toLowerCase() === symbol.toLowerCase();
      });
      socket.emit("graph_data", pool?.graph);
      socket.disconnect();
    } else if (msg.split("::")[0] === "kline") {
    } else if (msg.split("::")[0] === "unsubscribe") {
    }
  });
});
const getUserHandler = async (req: Request, res: Response) => {
  const token = req.body.token || req.query.token;
  if (typeof token === "string") {
    const user = db.findOne((user) => user.token === token);
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
  if (mailRegex.test(mailOrUsername.trim())) {
    if (password.length >= 6) {
      const user = db.findOne((user) => user.email === mailOrUsername);
      if (user && (await bcrypt.compare(password, user.password))) {
        const token = user.token;
        res.json({ status: "ok", token, message: "login_success" });
      } else {
        res.json({ status: "error", message: "Invalid credentials" });
      }
    } else {
      res.json({ status: "error", message: "Password length lower than 6" });
    }
  } else {
    res.json({ status: "error", message: "Invalid email" });
  }
});
app.post("/api/v1/register", async (req: Request, res: Response) => {
  const { email, password }: { email: string; password: string } = req.body;
  if (mailRegex.test(email.trim())) {
    if (password.length >= 6) {
      const existingUser = db.findOne((user) => user.email === email);
      if (existingUser) {
        return res.json({ status: "error", message: "User already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      const token = generateToken({ email });
      const userData = {
        email,
        password: hashedPassword,
        token,
        created: Date.now().toString(),
        wallets: [],
      };
      try {
        db.push(userData);
        res.json({ status: "ok", token });
      } catch (e) {
        res.json({ status: "error", message: "db error" });
      }
    } else {
      res.json({ status: "error", message: "Password length lower than 6" });
    }
  } else {
    res.json({ status: "error", message: "Invalid email" });
  }
});
server.listen(port, () => {
  console.log(`[server]-> Running on port: ${port}`);
});
