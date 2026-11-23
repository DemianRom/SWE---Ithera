import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function requireMailEnv(key: string): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} no está configurada`);
  }

  return value;
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);

    transporter = nodemailer.createTransport({
      host: requireMailEnv('SMTP_HOST'),
      port,
      // 465 usa TLS directo; 587 negocia STARTTLS.
      secure: port === 465,
      auth: {
        user: requireMailEnv('SMTP_USER'),
        pass: requireMailEnv('SMTP_PASS'),
      },
    });
  }

  return transporter;
}

function getMailFrom(): string {
  const mailFrom = requireMailEnv('MAIL_FROM');

  // Acepta:
  // 1) email@dominio.com
  // 2) Nombre <email@dominio.com>
  const emailOnlyRegex = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
  const namedEmailRegex = /^.+\s<[^<>\s@]+@[^\s@<>]+\.[^\s@<>]+>$/;

  if (!emailOnlyRegex.test(mailFrom) && !namedEmailRegex.test(mailFrom)) {
    throw new Error(
      'MAIL_FROM debe tener formato "email@dominio.com" o "Nombre <email@dominio.com>"'
    );
  }

  return mailFrom;
}

export const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  try {
    return await getTransporter().sendMail({
      from: getMailFrom(),
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Error enviando correo:', error);
    throw error;
  }
};
