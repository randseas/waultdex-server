import clientPromise from "@/lib/mongo";
export default async function handleSocketConnection(socket) {
    const db = (await clientPromise).db("waultdex");
    socket.on("live data", async (sessionToken) => {
        if (typeof sessionToken !== "string") {
            return socket.emit("live data", {
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
            return socket.emit("live data", {
                userData: "session_not_found",
                spotMarkets,
                futuresMarkets,
            });
        }
        const sessionIndex = currentUser.sessions.findIndex((s) => s.token === sessionToken);
        if (sessionIndex === -1) {
            return socket.emit("live data", {
                userData: "session_not_found",
                spotMarkets,
                futuresMarkets,
            });
        }
        currentUser.sessions[sessionIndex].lastSeen = Date.now().toString();
        await db
            .collection("users")
            .updateOne({ _id: currentUser._id, "sessions.token": sessionToken }, { $set: { "sessions.$.lastSeen": Date.now().toString() } });
        this.socketsubs.set(sessionToken, socket.id);
        this.spotMarkets = spotMarkets;
        this.futuresMarkets = futuresMarkets;
        this.networks = networks;
        socket.emit("live data", {
            userData: currentUser,
            spotMarkets,
            futuresMarkets,
            networks,
            feed: {
                carousel: [
                    {
                        img: "/images/home-banner-wct-quest.png",
                        auth: false,
                        title: "carousel1Title",
                        description: "carousel1Desc",
                        buttons: [{ url: "/oauth/register", text: "carousel1Btn" }],
                    },
                    {
                        img: "/images/home-banner-wct-quest.png",
                        auth: true,
                        title: "carousel2Title",
                        description: "carousel2Desc",
                        buttons: [{ url: "/earn", text: "carousel2Btn" }],
                    },
                    {
                        img: "/images/home-banner-wct-quest.png",
                        auth: true,
                        title: "carousel3Title",
                        description: "carousel3Desc",
                        buttons: [{ url: "/earn", text: "carousel3Btn" }],
                    },
                ],
                newListed: [
                //{ id: "" },
                ],
                gainers: [
                //{ id: "" },
                ],
                popular: [
                //{ id: "" },
                ],
            },
        });
    });
    socket.on("chat message", async (msg) => {
        socket.emit("chat message", {
            status: "ok",
            msg: "pong",
        });
    });
}
