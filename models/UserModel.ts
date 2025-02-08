import { model, Schema } from "mongoose";
import type { User, Wallet, Session, WalletKeypairInterface } from "../types";

const keypairSchema = new Schema<WalletKeypairInterface>({
  public: { type: String, required: true },
  private: { type: String, required: true },
  type: { type: String, required: true },
});
const walletSchema = new Schema<Wallet>({
  name: { type: String, required: false },
  colorScheme: { type: String, required: true, default: "blue" },
  keypairs: { type: [keypairSchema], required: true, default: [] },
});
//user merchandise
const sessionSchema = new Schema<Session>({
  token: { type: String, required: true },
  session: { type: String, required: true },
  device: { type: String, required: true },
  ipAddress: { type: String, required: true },
  createdAt: { type: String, required: true, default: Date.now().toString() },
  lastSeen: { type: String, required: true },
});
const userSchema = new Schema<User>({
  userId: { type: String, required: false, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  token: { type: String, required: true },
  username: { type: String, required: false },
  permission: { type: String, default: "user", required: true },
  wallets: { type: [walletSchema], default: [] },
  sessions: { type: [sessionSchema], default: [] },
  created: { type: String, default: Date.now().toString(), required: true },
});
export const UserModel = model<User>("UserModel", userSchema, "users");
