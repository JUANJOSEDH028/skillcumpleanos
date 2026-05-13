import { ClientSecretCredential } from "@azure/identity";
import type { Cumpleanero } from "./excel.js";
import { formatDayMonthSpanish } from "./paths.js";

export interface EmailConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderEmail: string;
  toEmail: string;
}

export function resolveEmailConfig(): EmailConfig | null {
  const tenantId = process.env.MS_TENANT_ID?.trim();
  const clientId = process.env.MS_CLIENT_ID?.trim();
  const clientSecret = process.env.MS_CLIENT_SECRET?.trim();
  const senderEmail = process.env.MS_SENDER_EMAIL?.trim();
  const toEmail = process.env.MS_TO_EMAIL?.trim();
  if (!tenantId || !clientId || !clientSecret || !senderEmail || !toEmail) return null;
  return { tenantId, clientId, clientSecret, senderEmail, toEmail };
}

function buildEmailHtml(opts: {
  people: Cumpleanero[];
  fraseMotivacional: string;
  today: Date;
}): string {
  const fechaLabel = formatDayMonthSpanish(opts.today);
  const filas = opts.people
    .map(
      (p) => `
      <tr>
        <td style="padding:8px 12px;font-size:16px;font-weight:600;color:#1a1a2e;">${p.nombre}</td>
        <td style="padding:8px 12px;font-size:14px;color:#555;">${p.cargo}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);padding:40px 40px 32px;text-align:center;">
            <div style="font-size:42px;margin-bottom:8px;">🎂</div>
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">¡Feliz Cumpleaños!</h1>
            <p style="margin:8px 0 0;color:#a0b4cc;font-size:15px;">${fechaLabel}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 24px;">
            <p style="margin:0 0 20px;color:#333;font-size:15px;">Celebramos este día especial junto a nuestro equipo:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f8f9ff;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#e8ecf8;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Nombre</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Cargo</th>
                </tr>
              </thead>
              <tbody>${filas}</tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 32px;">
            <blockquote style="margin:0;padding:16px 20px;background:#f0f4ff;border-left:4px solid #0f3460;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:15px;font-style:italic;color:#333;">"${opts.fraseMotivacional}"</p>
            </blockquote>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 32px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;">Tarjeta generada automáticamente · skillcumpleanos MCP</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendBirthdayEmail(opts: {
  config: EmailConfig;
  people: Cumpleanero[];
  fraseMotivacional: string;
  imageBase64: string;
  imageMimeType: string;
  imageFileName: string;
  today: Date;
}): Promise<void> {
  const { config } = opts;

  const credential = new ClientSecretCredential(
    config.tenantId,
    config.clientId,
    config.clientSecret,
  );

  const tokenResponse = await credential.getToken(
    "https://graph.microsoft.com/.default",
  );
  if (!tokenResponse?.token) {
    throw new Error("No se pudo obtener el token de Microsoft Graph.");
  }

  const fechaLabel = formatDayMonthSpanish(opts.today);
  const nombresCortos = opts.people.map((p) => p.nombre).join(", ");

  const payload = {
    message: {
      subject: `🎂 ¡Feliz Cumpleaños! — ${fechaLabel} · ${nombresCortos}`,
      body: {
        contentType: "HTML",
        content: buildEmailHtml({
          people: opts.people,
          fraseMotivacional: opts.fraseMotivacional,
          today: opts.today,
        }),
      },
      toRecipients: [{ emailAddress: { address: config.toEmail } }],
      attachments: [
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: opts.imageFileName,
          contentType: opts.imageMimeType,
          contentBytes: opts.imageBase64,
        },
      ],
    },
    saveToSentItems: true,
  };

  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.senderEmail)}/sendMail`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResponse.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status !== 202) {
    let detail = "";
    try {
      const body = await response.json() as { error?: { message?: string } };
      detail = body?.error?.message ?? JSON.stringify(body);
    } catch {
      detail = await response.text();
    }
    throw new Error(
      `Graph API respondió ${response.status}: ${detail}. ` +
        "Verifica que el app registration tenga el permiso Mail.Send con consentimiento de administrador.",
    );
  }
}
