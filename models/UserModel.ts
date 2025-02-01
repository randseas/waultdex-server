import { model, Schema } from "mongoose";
import type { User, Wallet, WalletKeypairInterface } from "../types";

const keypairSchema = new Schema<WalletKeypairInterface>({
  public: { type: String, required: true },
  private: { type: String, required: true },
  network: { type: String, required: true },
});
const walletSchema = new Schema<Wallet>({
  name: { type: String, required: false },
  keypairs: { type: [keypairSchema], required: true, default: [] },
});
const userSchema = new Schema<User>({
  userId: { type: String, required: false, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  token: { type: String, required: true },
  username: { type: String, required: false },
  permission: { type: String, default: "user" },
  wallets: { type: [walletSchema], default: [] },
  created: { type: String, default: Date.now().toString(), required: true },
});
export const UserModel = model<User>("UserModel", userSchema, "users");
