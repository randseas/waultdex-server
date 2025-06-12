// routes/auth/login.post.ts
import { Request, Response } from "express";
import { sendEmail } from "../../helpers/mailer.ts";
import { UserModel } from "../../models/UserModel.ts";
import type { Session } from "../../types.ts";
import UUID from "../../helpers/uuid.ts";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export default async (req: Request, res: Response) => {
  try {
    const { email, password, otp } = req.body as {
      email: string;
      password: string;
      otp?: string;
    };
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.json({ status: "error", message: "user_not_found" });
    }
    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.json({ status: "error", message: "invalid_password" });
    }
    if (otp) {
      if (user.otp === "") {
        return res.json({ status: "error", message: "otp_time_invalid" });
      }
      if (user.otp !== otp) {
        return res.json({ status: "error", message: "invalid_otp" });
      }
      const newSession: Session = {
        token: "",
        device: req.headers["user-agent"] || null,
        ipAddress: req.ip || null,
        createdAt: Date.now().toString(),
        lastSeen: Date.now().toString(),
      };
      const envJwtKey = process.env.JWT_KEY;
      if (!envJwtKey) {
        return res.json({ status: "error", message: "jwt_error" });
      }
      const sessionToken = jwt.sign(newSession, envJwtKey);
      newSession.token = sessionToken;
      try {
        user.sessions.push(newSession);
        user.otp = "";
        await user.save();
        return res.json({
          status: "ok",
          message: "login_success",
          session: sessionToken,
        });
      } catch (err: any) {
        console.log("Session creation error:", JSON.stringify(err));
        return res.json({
          status: "error",
          message: "cannot_create_session",
        });
      }
    } else {
      const OTPCode = UUID().slice(0, 6);
      user.otp = OTPCode;
      await user.save();
      await sendEmail({ to: email, content: OTPCode });
      return res.json({ status: "ok", message: "email_otp_sent" });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.json({ status: "error", message: "internal_server_error" });
  }
};
