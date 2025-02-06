import stringRandom from "string-random";
import crypto from "crypto";
import axios from "axios";
import qs from "qs";

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
  static IS_DEBUG = false;
  static API_URL = "http://api.geetest.com";
  static REGISTER_URL = "/register.php";
  static VALIDATE_URL = "/validate.php";
  static JSON_FORMAT = "1";
  static NEW_CAPTCHA = true;
  static HTTP_TIMEOUT_DEFAULT = 5000;
  static VERSION = "node-express:3.1.1";
  static GEETEST_CHALLENGE = "geetest_challenge";
  static GEETEST_VALIDATE = "geetest_validate";
  static GEETEST_SECCODE = "geetest_seccode";
  static GEETEST_SERVER_STATUS_SESSION_KEY = "gt_server_status";
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
    this.gtlog(`register(): 开始验证初始化, digestmod=${digestmod}.`);
    const origin_challenge = await this.requestRegister(params);
    this.buildRegisterResult(origin_challenge, digestmod);
    this.gtlog(`register(): 验证初始化, lib包返回信息=${this.libResult}.`);
    return this.libResult;
  }
  async requestRegister(params) {
    params = Object.assign(params, {
      gt: this.geetest_id,
      json_format: GeetestLib.JSON_FORMAT,
      sdk: GeetestLib.VERSION,
    });
    const register_url = GeetestLib.API_URL + GeetestLib.REGISTER_URL;
    this.gtlog(
      `requestRegister(): 验证初始化, 向极验发送请求, url=${register_url}, params=${JSON.stringify(
        params
      )}.`
    );
    let origin_challenge;
    try {
      const res = await axios({
        url: register_url,
        method: "GET",
        timeout: GeetestLib.HTTP_TIMEOUT_DEFAULT,
        params: params,
      });
      const resBody = res.status === 200 ? res.data : "";
      this.gtlog(
        `requestRegister(): 验证初始化, 与极验网络交互正常, 返回码=${
          res.status
        }, 返回body=${JSON.stringify(resBody)}.`
      );
      origin_challenge = resBody["challenge"];
    } catch (e) {
      this.gtlog(
        "requestRegister(): 验证初始化, 请求异常，后续流程走宕机模式, " +
          e.message
      );
      origin_challenge = "";
    }
    return origin_challenge;
  }
  async localRegister() {
    this.gtlog("获取当前缓存中bypass状态为fail，后续流程走宕机模式 ");
    this.buildRegisterResult("", "");
    this.gtlog(`register(): 验证初始化, lib包返回信息=${this.libResult}.`);
    return this.libResult;
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
      this.libResult.setAll(
        0,
        JSON.stringify(data),
        "获取当前缓存中bypass状态为fail，本地生成challenge，后续流程走宕机模式"
      );
    } else {
      let challenge;
      if (digestmod === "md5") {
        challenge = this.md5_encode(origin_challenge + this.geetest_key);
      } else if (digestmod === "sha256") {
        challenge = this.sha256_encode(origin_challenge + this.geetest_key);
      } else if (digestmod === "hmac-sha256") {
        challenge = this.hmac_sha256_encode(origin_challenge, this.geetest_key);
      } else {
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
  async successValidate(challenge, validate, seccode, params) {
    this.gtlog(
      `successValidate(): 开始二次验证 正常模式, challenge=${challenge}, validate=${validate}, seccode=${validate}.`
    );
    if (!this.checkParam(challenge, validate, seccode)) {
      this.libResult.setAll(
        0,
        "",
        "正常模式，本地校验，参数challenge、validate、seccode不可为空"
      );
    } else {
      const response_seccode = await this.requestValidate(
        challenge,
        validate,
        seccode,
        params
      );
      if (!response_seccode) {
        this.libResult.setAll(0, "", "请求极验validate接口失败");
      } else if (response_seccode === "false") {
        this.libResult.setAll(0, "", "极验二次验证不通过");
      } else {
        this.libResult.setAll(1, "", "");
      }
    }
    this.gtlog(
      `successValidate(): 二次验证 正常模式, lib包返回信息=${this.libResult}.`
    );
    return this.libResult;
  }
  failValidate(challenge, validate, seccode) {
    this.gtlog(
      `failValidate(): 开始二次验证 宕机模式, challenge=${challenge}, validate=${validate}, seccode=${seccode}.`
    );
    if (!this.checkParam(challenge, validate, seccode)) {
      this.libResult.setAll(
        0,
        "",
        "宕机模式，本地校验，参数challenge、validate、seccode不可为空."
      );
    } else {
      this.libResult.setAll(1, "", "");
    }
    this.gtlog(
      `failValidate(): 二次验证 宕机模式, lib包返回信息=${this.libResult}.`
    );
    return this.libResult;
  }
  async requestValidate(challenge, validate, seccode, params) {
    params = Object.assign(params, {
      seccode: seccode,
      json_format: GeetestLib.JSON_FORMAT,
      challenge: challenge,
      sdk: GeetestLib.VERSION,
      captchaid: this.geetest_id,
    });
    const validate_url = GeetestLib.API_URL + GeetestLib.VALIDATE_URL;
    this.gtlog(
      `requestValidate(): 二次验证 正常模式, 向极验发送请求, url=${validate_url}, params=${JSON.stringify(
        params
      )}.`
    );
    let response_seccode;
    try {
      const res = await axios({
        url: validate_url,
        method: "POST",
        timeout: GeetestLib.HTTP_TIMEOUT_DEFAULT,
        data: qs.stringify(params),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const resBody = res.status === 200 ? res.data : "";
      this.gtlog(
        `requestValidate(): 二次验证 正常模式, 与极验网络交互正常, 返回码=${
          res.status
        }, 返回body=${JSON.stringify(resBody)}.`
      );
      response_seccode = resBody["seccode"];
    } catch (e) {
      this.gtlog(
        "requestValidate(): 二次验证 正常模式, 请求异常, " + e.message
      );
      response_seccode = "";
    }
    return response_seccode;
  }
  checkParam(challenge, validate, seccode) {
    return !(
      challenge == undefined ||
      challenge.trim() === "" ||
      validate == undefined ||
      validate.trim() === "" ||
      seccode == undefined ||
      seccode.trim() === ""
    );
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
export default GeetestLib;
