// routes/auth/logout.post.ts
import { Request, Response } from "express";
import { UserModel } from "@/models/UserModel";
import type { Session, User } from "@/types";

export default async (req: Request, res: Response) => {
  try {
    const { session } = req.body as {
      session: string;
    };
    if (!session) {
      return res.json({
        status: "error",
        message: "session_token_not_found",
      });
    }
    const users = await UserModel.find({}, { password: 0 });
    const currentUser = users.find((user: User) =>
      user.sessions.some((s: Session) => s.token === session)
    );
    if (!currentUser) {
      return res.json({ status: "error", message: "user_not_found" });
    }
    const sessionIndex = currentUser.sessions.findIndex(
      (s) => s.token === session
    );
    if (sessionIndex === -1) {
      return res.json({ status: "error", message: "session_not_found" });
    }
    try {
      await UserModel.updateOne(
        { _id: currentUser._id },
        { $pull: { sessions: { token: session } } }
      );
      return res.json({ status: "ok", message: "logout_success" });
    } catch {
      return res.json({ status: "error", message: "logout_error" });
    }
  } catch (error) {
    console.error("Logout error:", error);
    return res.json({ status: "error", message: "internal_server_error" });
  }
};
