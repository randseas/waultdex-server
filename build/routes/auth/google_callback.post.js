import axios from "axios";
import createUUID from "@/helpers/uuid";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { Keypair as SOLWallet } from "@solana/web3.js";
import { Wallet as ERC20Wallet } from "ethers";
import * as bitcoin from "bitcoinjs-lib";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";
import crypto from "crypto";
import clientPromise from "@/lib/mongo";
import dotenv from "dotenv";
dotenv.config();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const JWT_KEY = process.env.JWT_KEY;
export default async (req, res) => {
    const db = (await clientPromise).db("waultdex");
    const { code, type } = req.body;
    if (!code || !type)
        return res.status(400).json({ status: "error", message: "missing_params" });
    try {
        const tokenRes = await axios.post("https://oauth2.googleapis.com/token", new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code",
        }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        const { access_token } = tokenRes.data;
        const userInfoRes = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`);
        const { email, name } = userInfoRes.data;
        if (!email)
            return res.status(400).json({ status: "error", message: "no_email" });
        let user = await db.collection("users").findOne({ email });
        if (type === "register") {
            if (user)
                return res.json({ status: "error", message: "user_already_exists" });
            const userId = createUUID();
            const solanaKeypair = SOLWallet.generate();
            const erc20Keypair = ERC20Wallet.createRandom();
            const bip32 = BIP32Factory(ecc);
            const network = bitcoin.networks.bitcoin;
            const seed = crypto.randomBytes(32);
            const root = bip32.fromSeed(seed, network);
            const path = "m/84'/0'/0'/0/0";
            const child = root.derivePath(path);
            const publicKeyBuffer = Buffer.from(child.publicKey);
            const { address } = bitcoin.payments.p2wpkh({
                pubkey: publicKeyBuffer,
                network,
            });
            const privateKey = child.toWIF();
            const bech32Keypair = { address, privateKey };
            const newUser = {
                userId,
                email,
                username: name || `User-${userId}`,
                permission: "user",
                created: Date.now().toString(),
                wallets: [
                    {
                        name: "",
                        keypairs: [
                            {
                                public: erc20Keypair.address,
                                private: erc20Keypair.privateKey,
                                type: "secp256k1",
                            },
                            {
                                public: solanaKeypair.publicKey.toString(),
                                private: bs58.encode(solanaKeypair.secretKey),
                                type: "ed25519",
                            },
                            {
                                public: bech32Keypair.address,
                                private: bech32Keypair.privateKey,
                                type: "bech32",
                            },
                        ],
                    },
                ],
                sessions: [],
                password: "",
                otp: "",
            };
            await db.collection("users").insertOne(newUser);
        }
        if (!user) {
            return res.json({ status: "error", message: "user_not_found" });
        }
        const newSession = {
            token: "",
            device: req.headers["user-agent"] || null,
            ipAddress: req.ip || null,
            createdAt: Date.now().toString(),
            lastSeen: Date.now().toString(),
        };
        const sessionToken = jwt.sign(newSession, JWT_KEY);
        newSession.token = sessionToken;
        user.sessions.push(newSession);
        await user.save();
        return res.json({
            status: "ok",
            message: "login_success",
            session: sessionToken,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ status: "error", message: "server_error" });
    }
};
