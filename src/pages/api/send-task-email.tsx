import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { toEmail, userName, taskTitle, dueDate } = req.body;

  if (!toEmail || !userName || !taskTitle || !dueDate) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: toEmail,
      subject: `Task Assigned: ${taskTitle}`,
      text: `Hello ${userName},\n\nYou have been assigned a task titled "${taskTitle}" with a due date of ${dueDate}.\n\nPlease check your dashboard.`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent" });
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    res.status(500).json({ message: "Failed to send email" });
  }
}
