import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import User from "../types";

const dbPath = path.join(__dirname.replace("helpers", ""), "db", "users.json");

const generateToken = (userData: any) => {
  return jwt.sign(userData, "fortuco", {
    expiresIn: "750h",
  });
};
const findUserByEmail = (email: string): User | any => {
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath, "utf-8");
    const users = JSON.parse(data);
    const user = users.find((user: User) => user.email === email);
    return user;
  }
  return null;
};
const findUserByToken = (token: string): User | any => {
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath, "utf-8");
    const users = JSON.parse(data);
    const user = users.find((user: User) => user.token === token);
    return user;
  }
  return null;
};
const mailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export { generateToken, findUserByEmail, findUserByToken, mailRegex };
