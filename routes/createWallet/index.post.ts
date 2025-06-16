// routes/createWallet/index.post.ts
import { Request, Response } from "express";
import UUID from "@/helpers/uuid";
import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import { Keypair as SOLWallet } from "@solana/web3.js";
import { Wallet as ERC20Wallet } from "ethers";
import * as bitcoin from "bitcoinjs-lib";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";
import clientPromise from "@/lib/mongo";
import { Session, User } from "@/types/global";

export default async (req: Request, res: Response) => {
  const db = (await clientPromise).db("waultdex");
  const {
    token,
    name,
    colorScheme,
  }: { token: string; name: string; colorScheme: string } = req.body;
  const users: User[] | any = db.collection("users").find({});
  const currentUser = users.find((user: User) =>
    user.sessions.some((session: Session) => session.token === token)
  );
  if (!currentUser || !token) {
    return res.json({ status: "error", message: "user_not_found" });
  }
  const session = currentUser.sessions.find((s: Session) => s.token === token);
  if (!session) {
    return res.json({ status: "error", message: "session_not_found" });
  }
  const id = UUID();
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
      {
        public: bech32Keypair?.address?.toString() || "",
        private: bech32Keypair?.privateKey?.toString() || "",
        type: "bech32",
      },
    ],
    balances: [],
  };
  try {
    currentUser.wallets.push(newWallet);
    await currentUser.save();
    return res.json({ status: "ok", message: "wallet_created" });
  } catch (err: any) {
    return res.json({ status: "error", message: "wallet_push_error" });
  }
};
