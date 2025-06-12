// socket/connection.ts
import { FuturesMarketModel } from "@/models/FuturesMarketModel";
import { NetworkModel } from "@/models/NetworkModel";
import { SpotMarketModel } from "@/models/SpotMarketModel";
import { UserModel } from "@/models/UserModel";
import { Socket } from "socket.io";

export default function handleSocketConnection(this: any, socket: Socket) {
  socket.on("chat message", async (msg: string) => {
    const [action, payload] = msg.split("::");
    if (action === "live_data") {
      const sessionToken = payload;
      const spotMarkets = await SpotMarketModel.find();
      const futuresMarkets = await FuturesMarketModel.find();
      const networks = await NetworkModel.find();
      if (typeof sessionToken !== "string") {
        return socket.emit("live_data", {
          userData: "token_not_found",
          spotMarkets,
          futuresMarkets,
        });
      }
      const users = await UserModel.find({}, { password: 0 });
      const currentUser = users.find((user) =>
        user.sessions.some((session) => session.token === sessionToken)
      );
      if (!currentUser) {
        return socket.emit("live_data", {
          userData: "user_not_found",
          spotMarkets,
          futuresMarkets,
        });
      }
      const sessionIndex = currentUser.sessions.findIndex(
        (s) => s.token === sessionToken
      );
      if (sessionIndex === -1) {
        return socket.emit("live_data", {
          userData: "session_not_found",
          spotMarkets,
          futuresMarkets,
        });
      }
      currentUser.sessions[sessionIndex].lastSeen = Date.now().toString();
      await UserModel.updateOne(
        { _id: currentUser._id, "sessions.token": sessionToken },
        { $set: { "sessions.$.lastSeen": Date.now().toString() } }
      );
      this.socketsubs.set(sessionToken, socket.id);
      this.spotMarkets = spotMarkets;
      this.futuresMarkets = futuresMarkets;
      this.networks = networks;
      const stateData = {
        userData: currentUser,
        spotMarkets,
        futuresMarkets,
        networks,
      };
      socket.emit("live_data", stateData);
    }
  });
}
