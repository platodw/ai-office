import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

// Admin-only debug endpoint: pings Telegram with a test message and returns
// the full status + body so we can see exactly why notifications are failing.
// Remove once the Telegram setup is stable.

export async function POST() {
  await requireAdmin();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_CHAT_ID;

  if (!botToken) return NextResponse.json({ ok: false, reason: "TELEGRAM_BOT_TOKEN not set" });
  if (!chatId)   return NextResponse.json({ ok: false, reason: "TELEGRAM_CHAT_ID not set" });

  // Don't echo the secrets — just say how they look.
  const debug = {
    bot_token_length: botToken.length,
    bot_token_prefix: botToken.slice(0, 10),
    chat_id_value:    chatId,
    chat_id_is_numeric: /^-?\d+$/.test(chatId),
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Test ping from AI Office debug endpoint",
      }),
    });
    const body = await res.text();
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      body: body.slice(0, 1000),
      debug,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      threw: err instanceof Error ? err.message : String(err),
      debug,
    });
  }
}
