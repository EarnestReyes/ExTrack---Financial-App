import emailjs from "@emailjs/browser";

interface LowBalanceEmailParams {
  email: string;
  userName: string;
  balance: number;
}

/**
 * Sends a negative balance email notification using EmailJS.
 */
export const sendNegativeBalanceEmail = async ({
  email,
  userName,
  balance,
}: LowBalanceEmailParams): Promise<boolean> => {
  try {
    const templateParams = {
      to_email: email,
      user_name: userName,
      current_balance: `₱${balance.toLocaleString()}`,
    };

    const SERVICE_ID = "service_ny70f6n";
    const TEMPLATE_ID = "template_yo64sj9"; // Replace with your EmailJS Template ID
    const PUBLIC_KEY = "l5XzvBJoXTXPa7e_K";   // Replace with your EmailJS Public Key

    await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

    console.log("Negative balance email sent successfully.");
    return true;
  } catch (error) {
    console.error("Error sending email notification:", error);
    return false;
  }
};