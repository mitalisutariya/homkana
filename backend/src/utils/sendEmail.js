import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: parseInt(process.env.SMTP_PORT, 10) === 465,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Gmail requires the 'from' address to match the authenticated user
  const message = {
    from: `${process.env.FROM_NAME || 'HomeKana'} <${process.env.SMTP_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || undefined,
  };

  console.log(`[Email] Sending to: ${options.email}, Subject: ${options.subject}`);

  const info = await transporter.sendMail(message);
  console.log('[Email] Message sent successfully:', info.messageId);
  return info;
};

export default sendEmail;
