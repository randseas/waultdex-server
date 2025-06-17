import clientPromise from "@/lib/mongo";
import createWallet from "@/lib/createWallet";
export default async (req, res) => {
    const { token, name, colorScheme } = req.body;
    if (!token)
        return res.json({ status: "error", message: "token_required" });
    if (!colorScheme)
        return res.json({ status: "error", message: "colorScheme_required" });
    const db = (await clientPromise).db("waultdex").collection("users");
    const currentUser = await db.findOne({
        "sessions.token": token,
    });
    if (!currentUser) {
        return res.json({ status: "error", message: "user_not_found" });
    }
    const session = currentUser.sessions.find((s) => s.token === token);
    if (!session)
        return res.json({ status: "error", message: "session_not_found" });
    const newWallet = await createWallet({
        name,
        colorScheme,
    });
    try {
        await db.updateOne({ _id: currentUser._id }, {
            $push: { wallets: newWallet },
        });
        return res.json({ status: "ok", message: "wallet_created" });
    }
    catch (err) {
        return res.json({ status: "error", message: "wallet_push_error" });
    }
};
