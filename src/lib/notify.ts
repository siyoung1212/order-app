import nodemailer from "nodemailer";

// ---- 이메일 발송 (Gmail SMTP) ----
// 환경변수: GMAIL_USER (보내는/앱 비밀번호 소유 계정), GMAIL_APP_PASSWORD
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("GMAIL_USER 또는 GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다.");
  }
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const t = getTransporter();
  const from = process.env.GMAIL_USER!;
  await t.sendMail({
    from: `발주 자동화 시스템 <${from}>`,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

// John(운영자)에게 보내는 알림 전용 헬퍼
export async function notifyJohn(subject: string, text: string, html?: string): Promise<void> {
  const to = process.env.JOHN_NOTIFY_EMAIL;
  if (!to) {
    throw new Error("JOHN_NOTIFY_EMAIL 환경변수가 설정되지 않았습니다.");
  }
  await sendEmail({ to, subject, text, html });
}
