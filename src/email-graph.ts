import { ClientSecretCredential } from "@azure/identity";
import type { Cumpleanero } from "./excel.js";
import { formatDayMonthSpanish } from "./paths.js";

/** Debe coincidir con `src="cid:…"` del HTML (adjunto en línea Graph). */
const INLINE_CARD_CID = "skillcumpleanos-tarjeta";

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

/** Split `MS_TO_EMAIL` on comma/semicolon; trims each part. */
export function parseToRecipients(toEmail: string): string[] {
  return toEmail
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildInlineImageBody(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f0f0;">
  <div style="text-align:center;padding:12px;">
    <img src="cid:${INLINE_CARD_CID}" alt="Tarjeta de cumpleaños" width="1080" style="max-width:100%;height:auto;display:block;margin:0 auto;border:0;"/>
  </div>
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
  void opts.fraseMotivacional;
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

  const toAddresses = parseToRecipients(config.toEmail);
  if (toAddresses.length === 0) {
    throw new Error("MS_TO_EMAIL no contiene ninguna dirección válida.");
  }

  const payload = {
    message: {
      subject: `🎂 ¡Feliz Cumpleaños! — ${fechaLabel} · ${nombresCortos}`,
      body: {
        contentType: "HTML",
        content: buildInlineImageBody(),
      },
      toRecipients: toAddresses.map((address) => ({
        emailAddress: { address },
      })),
      attachments: [
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: opts.imageFileName,
          contentType: opts.imageMimeType,
          contentBytes: opts.imageBase64,
          contentId: INLINE_CARD_CID,
          isInline: true,
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
      const body = (await response.json()) as { error?: { message?: string } };
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
