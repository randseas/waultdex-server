// routes/auth/register.post.ts
import { Request, Response } from "express";
import UUID from "@/helpers/uuid";
import bcrypt from "bcrypt";
import createWallet from "@/lib/createWallet";
import { User } from "@/types/global";
import clientPromise from "@/lib/mongo";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;

export default async (req: Request, res: Response) => {
  const db = (await clientPromise).db("waultdex");
  const { email, password }: { email: string; password: string } = req.body;
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ status: "error", message: "invalid_email" });
  }
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return res.status(400).json({ status: "error", message: "passlength_low" });
  }
  try {
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ status: "error", message: "user_already_exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const newWallet = await createWallet({});
    const userId = UUID();
    const userData: User = {
      userId,
      email,
      password: hashedPassword,
      username: `User-${userId}`,
      permission: "user",
      wallets: [newWallet],
      sessions: [],
      created: Date.now().toString(),
    };
    await db.collection("users").insertOne(userData);
    res.status(201).json({ status: "ok", message: "register_success" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: "error", message: "server_error" });
  }
};
