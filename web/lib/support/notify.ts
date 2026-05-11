// Telegram notification helper for support escalations.
// Called when the AI responder can't confidently answer a ticket.

export async function notifyDanNewTicket(params: {
  ticketId:   string;
  clientName: string;
  title:      string;
  body:       string;
}): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn("[notify] Telegram env vars missing — skipping ping. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.");
    return;
  } // silently skip if not configured

  const preview = params.body.slice(0, 300) + (params.body.length > 300 ? "..." : "");
  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/support/${params.ticketId}`;

  const text = [
    `*New support ticket* — needs your attention`,
    ``,
    `*Client:* ${params.clientName}`,
    `*Subject:* ${params.title}`,
    ``,
    preview,
    ``,
    `[View ticket](${adminUrl})`,
  ].join("\n");

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:    chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
}

export type NotifyDiagnosis =
  | { state: "missing_env"; details: string }
  | { state: "ok"; httpStatus: number }
  | { state: "tg_failed"; httpStatus: number; body: string }
  | { state: "threw"; message: string };

export async function notifyDanNewApproval(params: {
  clientName: string;
  kind:       "action" | "code_change";
  toolName:   string;
  title:      string;
  description: string | null;
}): Promise<NotifyDiagnosis> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn("[notify] Telegram env vars missing — skipping ping. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.");
    return { state: "missing_env", details: `botToken=${!!botToken} chatId=${!!chatId}` };
  }

  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/support/approvals`;
  const text = [
    `*New approval needed* — ${params.kind === "code_change" ? "code change" : "action"}`,
    ``,
    `*Client:* ${params.clientName}`,
    `*Tool:* \`${params.toolName}\``,
    `*Request:* ${params.title}`,
    params.description ? `\n${params.description.slice(0, 300)}` : "",
    ``,
    `[Review queue](${adminUrl})`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[notify] tg status ${res.status}`);
      console.warn(`[notify] tg body ${body.slice(0, 300)}`);
      return { state: "tg_failed", httpStatus: res.status, body: body.slice(0, 500) };
    }
    console.log(`[notify] tg ok ${params.toolName}`);
    return { state: "ok", httpStatus: res.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[notify] Telegram approval ping threw: ${msg}`);
    return { state: "threw", message: msg };
  }
}
