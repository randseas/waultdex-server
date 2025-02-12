import stringRandom from "string-random";
import crypto from "crypto";
import axios from "axios";
class GeetestLibResult {
    constructor() {
        this.status = 0;
        this.data = "";
        this.msg = "";
    }
    setAll(status, data, msg) {
        this.status = status;
        this.data = data;
        this.msg = msg;
    }
    toString() {
        return `GeetestLibResult{status=${this.status}, data=${this.data}, msg=${this.msg}}`;
    }
}
class GeetestLib {
    constructor(geetest_id, geetest_key) {
        this.geetest_id = geetest_id;
        this.geetest_key = geetest_key;
        this.libResult = new GeetestLibResult();
    }
    gtlog(message) {
        if (GeetestLib.IS_DEBUG) {
            console.log("gtlog: " + message);
        }
    }
    async register(digestmod, params) {
        this.gtlog(`register(): Starting verification initialization, digestmod=${digestmod}.`);
        const origin_challenge = await this.requestRegister(params);
        this.buildRegisterResult(origin_challenge, digestmod);
        this.gtlog(`register(): Verification initialization, returning result=${this.libResult}.`);
        return this.libResult;
    }
    async requestRegister(params) {
        params = {
            ...params,
            gt: this.geetest_id,
            json_format: GeetestLib.JSON_FORMAT,
            sdk: GeetestLib.VERSION,
        };
        const register_url = GeetestLib.API_URL + GeetestLib.REGISTER_URL;
        this.gtlog(`requestRegister(): Sending request to Geetest, url=${register_url}, params=${JSON.stringify(params)}.`);
        try {
            const res = await axios.get(register_url, {
                timeout: GeetestLib.HTTP_TIMEOUT_DEFAULT,
                params: params,
            });
            const resBody = res.status === 200 ? res.data : "";
            this.gtlog(`requestRegister(): Successful network interaction with Geetest, status=${res.status}, body=${JSON.stringify(resBody)}.`);
            return resBody["challenge"] || "";
        }
        catch (e) {
            this.gtlog("requestRegister(): Request error, falling back to fail mode, " +
                e.message);
            return "";
        }
    }
    buildRegisterResult(origin_challenge, digestmod) {
        if (!origin_challenge || origin_challenge === "0") {
            const challenge = stringRandom(32).toLowerCase();
            const data = {
                success: 0,
                gt: this.geetest_id,
                challenge: challenge,
                new_captcha: GeetestLib.NEW_CAPTCHA,
            };
            this.libResult.setAll(0, JSON.stringify(data), "Fail mode activated, generating challenge locally.");
        }
        else {
            let challenge;
            switch (digestmod) {
                case "sha256":
                    challenge = this.sha256_encode(origin_challenge + this.geetest_key);
                    break;
                case "hmac-sha256":
                    challenge = this.hmac_sha256_encode(origin_challenge, this.geetest_key);
                    break;
                case "md5":
                default:
                    challenge = this.md5_encode(origin_challenge + this.geetest_key);
            }
            const data = {
                success: 1,
                gt: this.geetest_id,
                challenge: challenge,
                new_captcha: GeetestLib.NEW_CAPTCHA,
            };
            this.libResult.setAll(1, JSON.stringify(data), "");
        }
    }
    md5_encode(value) {
        return crypto.createHash("md5").update(value).digest("hex");
    }
    sha256_encode(value) {
        return crypto.createHash("sha256").update(value).digest("hex");
    }
    hmac_sha256_encode(value, key) {
        return crypto.createHmac("sha256", key).update(value).digest("hex");
    }
}
GeetestLib.IS_DEBUG = false;
GeetestLib.API_URL = "http://api.geetest.com";
GeetestLib.REGISTER_URL = "/register.php";
GeetestLib.VALIDATE_URL = "/validate.php";
GeetestLib.JSON_FORMAT = "1";
GeetestLib.NEW_CAPTCHA = true;
GeetestLib.HTTP_TIMEOUT_DEFAULT = 5000;
GeetestLib.VERSION = "node-express:3.1.1";
GeetestLib.GEETEST_CHALLENGE = "geetest_challenge";
GeetestLib.GEETEST_VALIDATE = "geetest_validate";
GeetestLib.GEETEST_SECCODE = "geetest_seccode";
GeetestLib.GEETEST_SERVER_STATUS_SESSION_KEY = "gt_server_status";
export default GeetestLib;
