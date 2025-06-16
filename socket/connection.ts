// socket/connection.ts
import { Socket } from "socket.io";
import dbPromise from "@/lib/mongo";
import { Session } from "@/types/global";

export default async function handleSocketConnection(
  this: any,
  socket: Socket
) {
  const db = (await dbPromise).db("waultdex");
  socket.on("chat message", async (msg: string) => {
    const [action, payload] = msg.split("::");
    if (action !== "live_data") return;
    const sessionToken = payload;
    if (typeof sessionToken !== "string") {
      return socket.emit("live_data", {
        userData: "token_not_found",
        spotMarkets: [],
        futuresMarkets: [],
      });
    }
    const spotMarkets = await db.collection("spotMarkets").find().toArray();
    const futuresMarkets = await db
      .collection("futuresMarkets")
      .find()
      .toArray();
    const networks = await db.collection("networks").find().toArray();
    const currentUser = await db.collection("users").findOne({
      sessions: { $elemMatch: { token: sessionToken } },
    });
    if (!currentUser) {
      return socket.emit("live_data", {
        userData: "user_not_found",
        spotMarkets,
        futuresMarkets,
      });
    }
    const sessionIndex: number = currentUser.sessions.findIndex(
      (s: Session) => s.token === sessionToken
    );
    if (sessionIndex === -1) {
      return socket.emit("live_data", {
        userData: "session_not_found",
        spotMarkets,
        futuresMarkets,
      });
    }
    currentUser.sessions[sessionIndex].lastSeen = Date.now().toString();
    await db
      .collection("users")
      .updateOne(
        { _id: currentUser._id, "sessions.token": sessionToken },
        { $set: { "sessions.$.lastSeen": Date.now().toString() } }
      );
    this.socketsubs.set(sessionToken, socket.id);
    this.spotMarkets = spotMarkets;
    this.futuresMarkets = futuresMarkets;
    this.networks = networks;
    socket.emit("live_data", {
      userData: currentUser,
      spotMarkets,
      futuresMarkets,
      networks,
    });
  });
}
