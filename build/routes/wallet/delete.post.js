import clientPromise from "@/lib/mongo";
export default async (req, res) => {
    const { token, index } = req.body;
    if (!token)
        return res.json({ status: "error", message: "token_required" });
    if (!index)
        return res.json({ status: "error", message: "index_required" });
    const intIndex = parseInt(index);
    if (isNaN(intIndex))
        return res.json({ status: "error", message: "invalid_index" });
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
    const existingWallet = currentUser.wallets[intIndex];
    if (!existingWallet) {
        return res.json({ status: "error", message: "wallet_not_found" });
    }
    try {
        await db.updateOne({ _id: currentUser._id }, {
            $pull: { wallets: { _id: existingWallet._id } },
        });
        return res.json({ status: "ok", message: "wallet_deleted" });
    }
    catch (err) {
        console.error("wallet_pull_error:", err);
        return res.json({ status: "error", message: "wallet_pull_error" });
    }
};
