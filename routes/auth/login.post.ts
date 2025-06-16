// routes/auth/login.post.ts
import { Request, Response } from "express";
import { sendEmail } from "@/helpers/mailer";
import clientPromise from "@/lib/mongo";
import type { Session } from "@/types/global";
import UUID from "@/helpers/uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export default async (req: Request, res: Response) => {
  try {
    const { email, password, otp } = req.body as {
      email: string;
      password: string;
      otp?: string;
    };
    const db = (await clientPromise).db("waultdex");
    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.json({ status: "error", message: "user_not_found" });
    }
    if (!user.password) {
      return res.json({ status: "error", message: "user_password_not_found" });
    }
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!regex.test(email)) {
      return res.json({ status: "error", message: "invalid_email" });
    }
    if (password.length < 8 || password.length > 32) {
      return res.json({ status: "error", message: "invalid_password" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ status: "error", message: "invalid_password" });
    }
    if (otp) {
      if (otp.length !== 6) {
        return res.json({ status: "error", message: "invalid_otp_format" });
      }
      if (!user.otp) {
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
        await usersCollection.updateOne({ _id: user._id }, {
          $push: { sessions: newSession },
          $set: { otp: "" },
        } as any);
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
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { otp: OTPCode } }
      );
      await sendEmail({ to: email, content: OTPCode });
      return res.json({ status: "ok", message: "email_otp_sent" });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.json({ status: "error", message: "internal_server_error" });
  }
};
