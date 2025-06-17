import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
dotenv.config();
if (!process.env.MONGODB_USER ||
    !process.env.MONGODB_PASS ||
    !process.env.MONGODB_HOST ||
    !process.env.MONGODB_DBNAME) {
    throw new Error("Please fill this values MONGODB_USER, MONGODB_PASS, MONGODB_HOST and MONGODB_DBNAME in your .env file.");
}
const username = process.env.MONGODB_USER;
const password = encodeURIComponent(process.env.MONGODB_PASS);
const host = process.env.MONGODB_HOST;
const dbName = process.env.MONGODB_DBNAME;
const uri = `mongodb+srv://${username}:${password}@${host}/?retryWrites=true&w=majority&appName=main`;
const options = {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
};
let client;
let clientPromise;
if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client
            .connect()
            .then(async (client) => {
            await client.db(dbName).command({ ping: 1 });
            console.log("[MongoDB] -> Connection established.");
            return client;
        });
    }
    clientPromise = global._mongoClientPromise;
}
else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}
export default clientPromise;
