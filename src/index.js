/**
 * Florane — order backend
 * ------------------------------------------------------------------
 * Serves the website, and receives orders at POST /api/order.
 * Orders are forwarded to Telegram.
 *
 * Two secrets must be set in Cloudflare (Worker → Settings → Variables
 * and Secrets). They are NEVER written in this file or in the website:
 *
 *   TELEGRAM_TOKEN    the token BotFather gave you
 *   TELEGRAM_CHAT_ID  your own chat id
 * ------------------------------------------------------------------
 */

const LIMITS = {
  name:    { min: 2,  max: 80  },
  address: { min: 5,  max: 300 },
  notes:   { min: 0,  max: 400 },
  items:   { max: 40 },
  qty:     { max: 99 },
  price:   { max: 100000000 }
};

const PROVINCES = [
  "بغداد","البصرة","نينوى","أربيل","السليمانية","دهوك","كركوك","الأنبار","بابل",
  "كربلاء","النجف","الديوانية","المثنى","ذي قار","ميسان","واسط","ديالى","صلاح الدين",
  "Baghdad","Basra","Nineveh","Erbil","Sulaymaniyah","Duhok","Kirkuk","Anbar","Babil",
  "Karbala","Najaf","Diwaniyah","Muthanna","Dhi Qar","Maysan","Wasit","Diyala","Salah al-Din"
];

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });

/* يمنع الحروف الخاصة من كسر رسالة تيليغرام */
const esc = s => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clean = (v, max) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

function validate(body) {
  if (!body || typeof body !== "object") return "bad payload";

  // فخ للبوتات: حقل مخفي يجب أن يبقى فارغاً
  if (body.hp) return "spam";

  const name    = clean(body.name, LIMITS.name.max);
  const address = clean(body.address, LIMITS.address.max);
  const notes   = clean(body.notes, LIMITS.notes.max);
  const prov    = clean(body.province, 40);
  const phoneD  = String(body.phone || "").replace(/\D/g, "");

  if (name.length    < LIMITS.name.min)    return "name";
  if (address.length < LIMITS.address.min) return "address";
  if (!/^07\d{9}$/.test(phoneD))           return "phone";
  if (!PROVINCES.includes(prov))            return "province";

  if (!Array.isArray(body.items) || !body.items.length) return "items";
  if (body.items.length > LIMITS.items.max)             return "items";

  const items = [];
  for (const it of body.items) {
    const n   = clean(it && it.name, 80);
    const qty = Number(it && it.qty);
    const ml  = Number(it && it.ml);
    const sub = Number(it && it.sub);
    if (!n) return "items";
    if (!Number.isFinite(qty) || qty < 1 || qty > LIMITS.qty.max)   return "items";
    if (!Number.isFinite(sub) || sub < 0 || sub > LIMITS.price.max) return "items";
    items.push({ name: n, qty, ml: Number.isFinite(ml) ? ml : 0, sub });
  }

  const total = items.reduce((s, i) => s + i.sub, 0);

  return {
    ok: true,
    ref: clean(body.ref, 16) || "—",
    lang: body.lang === "en" ? "en" : "ar",
    name, phone: phoneD, province: prov, address, notes,
    items, total
  };
}

function buildMessage(o) {
  const cur = o.lang === "en" ? "IQD" : "د.ع";
  const money = n => n.toLocaleString("en-US") + " " + cur;

  let m = `🛒 <b>طلب جديد — Florane</b>\n`;
  m += `<code>${esc(o.ref)}</code>\n\n`;

  for (const i of o.items) {
    m += `• ${esc(i.name)}`;
    if (i.ml) m += ` (${i.ml} ml)`;
    m += ` × ${i.qty} — ${money(i.sub)}\n`;
  }

  m += `\n💰 <b>المجموع: ${money(o.total)}</b>\n`;
  m += `\n👤 <b>الزبون</b>\n`;
  m += `الاسم: ${esc(o.name)}\n`;
  m += `الهاتف: <code>${esc(o.phone)}</code>\n`;
  m += `المحافظة: ${esc(o.province)}\n`;
  m += `العنوان: ${esc(o.address)}\n`;
  if (o.notes) m += `ملاحظات: ${esc(o.notes)}\n`;

  // رابط يفتح محادثة واتساب مع الزبون مباشرة
  m += `\n📱 <a href="https://wa.me/964${o.phone.slice(1)}">فتح واتساب الزبون</a>`;
  return m;
}

async function sendTelegram(env, text) {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`telegram ${res.status}: ${detail.slice(0, 300)}`);
  }
}

async function handleOrder(request, env) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json({ ok: false, error: "not_configured" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  const o = validate(body);
  if (typeof o === "string") {
    // الفخ يرد بنجاح كاذب حتى لا يعرف البوت أنه انكشف
    if (o === "spam") return json({ ok: true, ref: body.ref || "" });
    return json({ ok: false, error: o }, 400);
  }

  try {
    await sendTelegram(env, buildMessage(o));
  } catch (err) {
    return json({ ok: false, error: "send_failed", detail: String(err.message) }, 502);
  }

  return json({ ok: true, ref: o.ref });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/order") {
      if (request.method === "POST") return handleOrder(request, env);
      return json({ ok: false, error: "method" }, 405);
    }

    // كل شيء آخر: الموقع نفسه
    return env.ASSETS.fetch(request);
  }
};
