// routes/test/get.js
import { Request, Response } from "express";

export default (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
};
