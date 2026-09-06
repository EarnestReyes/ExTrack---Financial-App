import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "extrack961@gmail.com",
    pass: "zqogwzejqcfqtdfp",
  },
});

export const sendLowBalanceAlert = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const {toEmail, userName, currentBalance} = req.body;

  if (!toEmail || currentBalance === undefined) {
    res.status(400).send("Missing required parameters");
    return;
  }

  const balanceText = "₱" + currentBalance.toLocaleString();
  const mailOptions = {
    from: "\"ExTrack Finance\" <extrack961@gmail.com>",
    to: toEmail,
    subject: "⚠️ Alert: Your ExTrack Balance is Negative",
    text: "Hello " + userName + ",\n\n" +
          "Your account balance has dropped to " + balanceText + ".\n" +
          "Please top up your account.\n\n" +
          "Best regards,\nExTrack Team",
    html: "<h3>Hello " + userName + ",</h3>" +
          "<p>Your account balance has dropped to " +
          "<b style=\"color: red;\">" + balanceText + "</b>.</p>" +
          "<p>Please top up your account to avoid issues.</p>" +
          "<br><p>Best regards,<br><b>ExTrack Team</b></p>",
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Negative balance email sent to ${toEmail}`);
    res.status(200).json({success: true, message: "Email sent successfully"});
  } catch (error) {
    const err = error as Error;
    logger.error("Error sending email:", err);
    res.status(500).json({success: false, error: err.message});
  }
});
