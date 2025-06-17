// routes/wallet/delete.post.ts
import { Request, Response } from "express";
import clientPromise from "@/lib/mongo";
import { Session, User, Wallet } from "@/types/global";

export default async (req: Request, res: Response) => {
  const { token, index } = req.body as { token: string; index: string };
  if (!token) return res.json({ status: "error", message: "token_required" });
  if (!index) return res.json({ status: "error", message: "index_required" });
  const intIndex = parseInt(index);
  if (isNaN(intIndex))
    return res.json({ status: "error", message: "invalid_index" });
  const db = (await clientPromise).db("waultdex").collection("users");
  const currentUser: User | any = await db.findOne({
    "sessions.token": token,
  });
  if (!currentUser) {
    return res.json({ status: "error", message: "user_not_found" });
  }
  const session = currentUser.sessions.find((s: Session) => s.token === token);
  if (!session)
    return res.json({ status: "error", message: "session_not_found" });
  const existingWallet: Wallet | null = currentUser.wallets[intIndex];
  if (!existingWallet) {
    return res.json({ status: "error", message: "wallet_not_found" });
  }
  try {
    await db.updateOne({ _id: currentUser._id }, {
      $pull: { wallets: { _id: existingWallet._id } },
    } as any);
    return res.json({ status: "ok", message: "wallet_deleted" });
  } catch (err: any) {
    console.error("wallet_pull_error:", err);
    return res.json({ status: "error", message: "wallet_pull_error" });
  }
};
