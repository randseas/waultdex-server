// routes/createWallet/index.post.ts
import { Request, Response } from "express";
import clientPromise from "@/lib/mongo";
import { Session, User } from "@/types/global";
import createWallet from "@/lib/createWallet";

export default async (req: Request, res: Response) => {
  const {
    token,
    name,
    colorScheme,
  }: { token: string; name: string; colorScheme: string } = req.body;
  if (!token) return res.json({ status: "error", message: "token_required" });
  if (!colorScheme)
    return res.json({ status: "error", message: "colorScheme_required" });
  const db = (await clientPromise).db("waultdex").collection("users");
  const currentUser: User | any = await db.findOne({
    "sessions.token": token,
  });
  console.log("currentUser", JSON.stringify(currentUser));
  if (!currentUser) {
    return res.json({ status: "error", message: "user_not_found" });
  }
  const session = currentUser.sessions.find((s: Session) => s.token === token);
  if (!session)
    return res.json({ status: "error", message: "session_not_found" });
  const newWallet = createWallet({
    name,
    colorScheme,
  });
  try {
    await db.updateOne({ _id: currentUser._id }, {
      $push: { wallets: newWallet },
    } as any);
    return res.json({ status: "ok", message: "wallet_created" });
  } catch (err: any) {
    return res.json({ status: "error", message: "wallet_push_error" });
  }
};
