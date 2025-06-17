import clientPromise from "@/lib/mongo";
export default async (req, res) => {
    try {
        const { session } = req.body;
        if (!session) {
            return res.json({ status: "error", message: "session_token_not_found" });
        }
        const db = (await clientPromise).db("waultdex");
        const users = (await db.collection("users").find().toArray());
        const currentUser = users.find((user) => user.sessions.some((s) => s.token === session));
        if (!currentUser) {
            return res.json({ status: "error", message: "user_not_found" });
        }
        const sessionIndex = currentUser.sessions.findIndex((s) => s.token === session);
        if (sessionIndex === -1) {
            return res.json({ status: "error", message: "session_not_found" });
        }
        try {
            await db.collection("users").updateOne({ _id: currentUser._id }, {
                $pull: { sessions: { token: session } },
            });
            return res.json({ status: "ok", message: "logout_success" });
        }
        catch {
            return res.json({ status: "error", message: "logout_error" });
        }
    }
    catch (error) {
        console.error("Logout error:", error);
        return res.json({ status: "error", message: "internal_server_error" });
    }
};
