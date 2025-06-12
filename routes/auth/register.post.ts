// routes/auth/register.post.ts
import { Request, Response } from "express";
import { UserModel } from "@/models/UserModel";
import UUID from "@/helpers/uuid";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import { Keypair as SOLWallet } from "@solana/web3.js";
import { Wallet as ERC20Wallet } from "ethers";
import * as bitcoin from "bitcoinjs-lib";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";

export default async (req: Request, res: Response) => {
  const { email, password }: { email: string; password: string } = req.body;
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
    const userId = UUID();
    const solanaKeypair = SOLWallet.generate();
    const erc20Keypair = ERC20Wallet.createRandom();
    const bip32 = BIP32Factory(ecc);
    const network = bitcoin.networks.bitcoin;
    const seed = randomBytes(32);
    const root = bip32.fromSeed(seed, network);
    const path = "m/84'/0'/0'/0/0";
    const child = root.derivePath(path);
    const publicKeyBuffer = Buffer.from(child.publicKey);
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: publicKeyBuffer,
      network,
    });
    const privateKey = child.toWIF();
    const bech32Keypair = {
      address,
      privateKey,
    };
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
              public: bech32Keypair?.address?.toString() || "",
              private: bech32Keypair?.privateKey?.toString() || "",
              type: "bech32",
            },
          ],
        },
      ],
    };
    const user = new UserModel(userData);
    try {
      await user.save();
      res.json({ status: "ok", message: "register_success" });
    } catch (e) {
      res.json({ status: "error", message: "db_error" });
      console.log(e);
    }
  } else {
    res.json({ status: "error", message: "passlength_low" });
  }
};
