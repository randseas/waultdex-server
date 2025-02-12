import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export async function sendEmail({
  to,
  content,
}: {
  to: string;
  content: string;
}) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  await transporter.sendMail({
    from: `"Waultdex" <${process.env.EMAIL_USER}>`,
    to,
    subject: "One Time Passcode",
    text: `Your otp code: ${content}, This can only be used once and expires in 10 minutes. If it wasn't you, you can ignore this mail safely.`,
    html: `
    <div
  id=":ny"
  class="ii gt"
  jslog="20277; u014N:xr6bB; 1:WyIjdGhyZWFkLWY6MTgyMzg1NjcwMjYxNzU5ODE2NiJd; 4:WyIjbXNnLWY6MTgyMzg1NjcwMjYxNzU5ODE2NiIsbnVsbCxudWxsLG51bGwsMSwwLFsxLDAsMF0sMzIsMTk4LG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCwxLG51bGwsbnVsbCxbM10sbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsMF0."
>
  <div id=":nz" class="a3s aiL msg-1047279496699427441">
    <div>
      <center class="m_-1047279496699427441wrapper">
        <div>
          <table
            cellpadding="0"
            cellspacing="0"
            border="0"
            width="100%"
            class="m_-1047279496699427441wrapper"
            bgcolor="#FFFFFF"
          >
            <tbody>
              <tr>
                <td valign="top" bgcolor="#FFFFFF" width="100%">
                  <table
                    width="100%"
                    role="content-container"
                    align="center"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                  >
                    <tbody>
                      <tr>
                        <td width="100%">
                          <table
                            width="100%"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                          >
                            <tbody>
                              <tr>
                                <td>
                                  <table
                                    width="100%"
                                    cellpadding="0"
                                    cellspacing="0"
                                    border="0"
                                    style="width: 100%; max-width: 600px"
                                    align="center"
                                  >
                                    <tbody>
                                      <tr>
                                        <td
                                          role="modules-container"
                                          style="
                                            padding: 0px 0px 0px 0px;
                                            color: #000000;
                                            text-align: left;
                                          "
                                          bgcolor="#FFFFFF"
                                          width="100%"
                                          align="left"
                                        >
                                          <table
                                            role="module"
                                            border="0"
                                            cellpadding="0"
                                            cellspacing="0"
                                            width="100%"
                                            style="
                                              display: none !important;
                                              opacity: 0;
                                              color: transparent;
                                              height: 0;
                                              width: 0;
                                            "
                                          >
                                            <tbody>
                                              <tr>
                                                <td role="module-content">
                                                  <p></p>
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                          <table
                                            role="module"
                                            border="0"
                                            cellpadding="0"
                                            cellspacing="0"
                                            width="100%"
                                            style="table-layout: fixed"
                                          >
                                            <tbody>
                                              <tr>
                                                <td
                                                  style="
                                                    padding: 14px 0px 14px 0px;
                                                    line-height: 22px;
                                                    text-align: inherit;
                                                  "
                                                  height="100%"
                                                  valign="top"
                                                  bgcolor=""
                                                  role="module-content"
                                                >
                                                  <div>
                                                    <div
                                                      style="
                                                        font-family: inherit;
                                                        text-align: inherit;
                                                      "
                                                    >
                                                      <span
                                                        style="
                                                          color: #000000;
                                                          font-family: Helvetica;
                                                          font-size: 14px;
                                                          font-style: normal;
                                                          font-variant-ligatures: normal;
                                                          font-variant-caps: normal;
                                                          font-weight: 400;
                                                          letter-spacing: normal;
                                                          text-align: start;
                                                          text-indent: 0px;
                                                          text-transform: none;
                                                          word-spacing: 0px;
                                                          background-color: rgb(
                                                            255,
                                                            255,
                                                            255
                                                          );
                                                          text-decoration-style: initial;
                                                          text-decoration-color: initial;
                                                          float: none;
                                                          display: inline;
                                                        "
                                                        >Your otp
                                                        passcode:</span
                                                      >
                                                    </div>
                                                    <div
                                                      style="
                                                        font-family: inherit;
                                                        text-align: inherit;
                                                      "
                                                    >
                                                      <br />
                                                    </div>
                                                    <div
                                                      style="
                                                        font-family: inherit;
                                                        text-align: inherit;
                                                      "
                                                    >
                                                      <span
                                                        style="
                                                          font-family: Helvetica;
                                                          letter-spacing: normal;
                                                          text-transform: none;
                                                          word-spacing: 0px;
                                                          text-decoration-line: none;
                                                          text-decoration-style: solid;
                                                          text-decoration-color: currentcolor;
                                                          font-weight: 600;
                                                          font-size: 24px;
                                                        "
                                                        >${content}</span
                                                      >
                                                    </div>
                                                    <div
                                                      style="
                                                        font-family: inherit;
                                                        text-align: inherit;
                                                      "
                                                    >
                                                      <br />
                                                    </div>
                                                    <div
                                                      style="
                                                        font-family: inherit;
                                                        text-align: inherit;
                                                      "
                                                    >
                                                      <span
                                                        style="
                                                          font-family: Helvetica;
                                                          letter-spacing: normal;
                                                          text-transform: none;
                                                          word-spacing: 0px;
                                                          text-decoration-line: none;
                                                          text-decoration-style: solid;
                                                          text-decoration-color: currentcolor;
                                                          font-size: 14px;
                                                        "
                                                        >This can only be used
                                                        once and expires in 10
                                                        minutes.</span
                                                      >
                                                    </div>
                                                    <div></div>
                                                  </div>
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                          <table
                                            role="module"
                                            border="0"
                                            cellpadding="0"
                                            cellspacing="0"
                                            width="100%"
                                            style="table-layout: fixed"
                                          >
                                            <tbody>
                                              <tr>
                                                <td
                                                  style="
                                                    padding: 18px 0px 12px 0px;
                                                  "
                                                  role="module-content"
                                                  height="100%"
                                                  valign="top"
                                                  bgcolor=""
                                                >
                                                  <table
                                                    border="0"
                                                    cellpadding="0"
                                                    cellspacing="0"
                                                    align="center"
                                                    width="100%"
                                                    height="1px"
                                                    style="
                                                      line-height: 1px;
                                                      font-size: 1px;
                                                    "
                                                  >
                                                    <tbody>
                                                      <tr>
                                                        <td
                                                          style="
                                                            padding: 0px 0px 1px
                                                              0px;
                                                          "
                                                          bgcolor="#dddddd"
                                                        ></td>
                                                      </tr>
                                                    </tbody>
                                                  </table>
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                          <table
                                            role="module"
                                            border="0"
                                            cellpadding="0"
                                            cellspacing="0"
                                            width="100%"
                                            style="table-layout: fixed"
                                          >
                                            <tbody>
                                              <tr>
                                                <td
                                                  style="
                                                    padding: 7px 0px 14px 0px;
                                                    line-height: 22px;
                                                    text-align: inherit;
                                                  "
                                                  height="100%"
                                                  valign="top"
                                                  role="module-content"
                                                >
                                                  <div>
                                                    <div
                                                      style="
                                                        font-family: inherit;
                                                        text-align: center;
                                                      "
                                                    >
                                                      <span
                                                        style="
                                                          font-family: Helvetica;
                                                          text-align: center;
                                                          font-size: 14px;
                                                          line-height: 20px;
                                                        "
                                                        >Any questions or need
                                                        help? Contact us at </span
                                                      ><a
                                                        href="mailto:support@waultdex.com"
                                                        title="mailto:support@waultdex.com"
                                                        target="_blank"
                                                        ><span
                                                          style="
                                                            font-family: Helvetica;
                                                            text-align: center;
                                                            font-size: 14px;
                                                            line-height: 20px;
                                                          "
                                                          >support@waultdex.com.</span
                                                        ></a
                                                      >&nbsp;
                                                    </div>
                                                    <div
                                                      style="
                                                        font-family: inherit;
                                                        text-align: center;
                                                      "
                                                    >
                                                      <span
                                                        style="
                                                          font-family: Helvetica;
                                                          text-align: center;
                                                          font-size: 14px;
                                                          line-height: 20px;
                                                        "
                                                        >View our </span
                                                      ><a
                                                        href="https://waultdex.com/privacy-policy"
                                                        target="_blank"
                                                        data-saferedirecturl="https://www.google.com/url?q=https://waultdex.com/privacy-policy"
                                                        ><span
                                                          style="
                                                            font-family: Helvetica;
                                                            text-align: center;
                                                            font-size: 14px;
                                                            line-height: 20px;
                                                          "
                                                          >Privacy Policy</span
                                                        ></a
                                                      ><span
                                                        style="
                                                          font-family: Helvetica;
                                                          text-align: center;
                                                          font-size: 14px;
                                                          line-height: 20px;
                                                        "
                                                      >
                                                        and </span
                                                      ><a
                                                        href="https://waultdex.com/user-agreement"
                                                        target="_blank"
                                                        data-saferedirecturl="https://www.google.com/url?q=https://waultdex.com/user-agreement"
                                                        ><span
                                                          style="
                                                            font-family: Helvetica;
                                                            text-align: center;
                                                            font-size: 14px;
                                                            line-height: 20px;
                                                          "
                                                          >User Agreement</span
                                                        ></a
                                                      ><span
                                                        style="
                                                          font-family: Helvetica;
                                                          text-align: center;
                                                          font-size: 14px;
                                                          line-height: 20px;
                                                        "
                                                        >.</span
                                                      >
                                                    </div>
                                                  </div>
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </center>
    </div>
  </div>
</div>
  `,
  });
}
