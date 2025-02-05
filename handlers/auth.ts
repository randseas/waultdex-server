import bcrypt from "bcrypt";
import { UserModel } from "../models/UserModel";
import { Keypair as SOLWallet } from "@solana/web3.js";
import { Wallet as ERC20Wallet } from "ethers";
import jwt from "jsonwebtoken";
import bs58 from "bs58";

export async function getUser(req: any, res: any) {
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
export async function login(req: any, res: any) {
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
    res.json({ status: "error", message: "passlength_low" });
  }
}
function generateUID(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}
export async function register(req: any, res: any) {
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
      username: `USER-${userId}`,
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
}
