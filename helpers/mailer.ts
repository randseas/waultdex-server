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
    subject: "Your OTP Code",
    text: `Your OTP verification code is: ${content}`,
    html: `<b>Your OTP verification code is: <span style="color: red;">${content}</span></b>`,
  });
  console.log("sended OTP: ", content);
}
