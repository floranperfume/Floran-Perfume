/**
 * Florane — Cloudflare Worker Order Backend
 * Handles POST /api/order and forwards notifications directly to Telegram.
 */

const LIMITS = {
  name:     { min: 2,  max: 80  },
  address:  { min: 5,  max: 300 },
  notes:    { min: 0,  max: 400 },
  items:    { max: 40 },
  qty:      { max: 99 },
  price:    { max: 100000000 },
  delivery: { max: 50000 }
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

const esc = s => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clean = (v, max) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

function validate(body) {
  if (!body || typeof body !== "object") return "bad payload";

  // Anti-Spam Honeypot Check
  if (body.hp) return "spam";

  const name     = clean(body.name, LIMITS.name.max);
  const address  = clean(body.address, LIMITS.address.max);
  const notes    = clean(body.notes, LIMITS.notes.max);
  const prov     = clean(body.province, 40);
  const city     = clean(body.city, 60) || prov; // Fallback city to province if empty
  
  // Normalize Eastern Arabic numerals (٠-٩) and formats (+9647..., 9647..., 7...)
  let rawPhone = String(body.phone || "").replace(/[٠-٩]/g, d => "٠١٢٣٥٦٧٨٩".indexOf(d));
  let phoneD   = rawPhone.replace(/\D/g, "");
  if (phoneD.startsWith("9647")) phoneD = "0" + phoneD.slice(3);
  if (phoneD.startsWith("7") && phoneD.length === 10) phoneD = "0" + phoneD;

  const delivery = Number(body.delivery) || 0;

  if (name.length    < LIMITS.name.min)    return "name";
  if (address.length < LIMITS.address.min) return "address";
  if (!/^07\d{9}$/.test(phoneD))           return "phone";
  if (!PROVINCES.includes(prov))            return "province";
  if (!city)                               return "city";
  if (!Number.isFinite(delivery) || delivery < 0 || delivery > LIMITS.delivery.max)
    return "delivery";

  if (!Array.isArray(body.items) || !body.items.length) return "items";
  if (body.items.length > LIMITS.items.max)             return "items";

  const items = [];
  for (const it of body.items) {
    const n    = clean(it && it.name, 80);
    const size = clean(it && it.size, 30);
    const qty  = Number(it && it.qty);
    const ml   = Number(it && it.ml);
    const sub  = Number(it && it.sub);
    if (!n) return "items";
    if (!Number.isFinite(qty) || qty < 1 || qty > LIMITS.qty.max)   return "items";
    if (!Number.isFinite(sub) || sub < 0 || sub > LIMITS.price.max) return "items";
    items.push({ name: n, size, qty, ml: Number.isFinite(ml) ? ml : 0, sub });
  }

  const sub   = items.reduce((s, i) => s + i.sub, 0);
  const total = sub + delivery;

  return {
    ok: true,
    ref: clean(body.ref, 16) || "—",
    lang: body.lang === "en" ? "en" : "ar",
    name, phone: phoneD, province: prov, city, address, notes,
    items, sub, delivery, total
  };
}

async function countOrder(env, phone) {
  if (!env.ORDERS) return null;
  try {
    const key  = "c:" + phone;
    const prev = Number(await env.ORDERS.get(key)) || 0;
    const n    = prev + 1;
    await env.ORDERS.put(key, String(n));
    return n;
  } catch (err) {
    console.warn("loyalty count failed:", err.message);
    return null;
  }
}

const GIFT_EVERY = 3;

function buildMessage(o, visit) {
  const cur = o.lang === "en" ? "IQD" : "د.ع";
  const money = n => n.toLocaleString("en-US") + " " + cur;

  let m = `🛒 <b>طلب جديد — Florane</b>\n`;
  m += `<code>${esc(o.ref)}</code>\n\n`;

  for (const i of o.items) {
    m += `• ${esc(i.name)}`;
    if (i.size)    m += ` (${esc(i.size)})`;
    else if (i.ml) m += ` (${i.ml} ml)`;
    m += ` × ${i.qty} — ${money(i.sub)}\n`;
  }

  m += `\nالمجموع الفرعي: ${money(o.sub)}\n`;
  m += `أجرة التوصيل: ${money(o.delivery)}\n`;
  m += `💰 <b>الإجمالي: ${money(o.total)}</b>\n`;
  m += `\n👤 <b>الزبون</b>\n`;
  m += `الاسم: ${esc(o.name)}\n`;
  m += `الهاتف: <code>${esc(o.phone)}</code>\n`;
  m += `المحافظة: ${esc(o.province)}${o.city !== o.province ? ' — ' + esc(o.city) : ''}\n`;
  m += `العنوان: ${esc(o.address)}\n`;
  if (o.notes) m += `ملاحظات: ${esc(o.notes)}\n`;

  if (visit) {
    m += `\n🔁 <b>الطلب رقم ${visit} لهذا الزبون</b>\n`;
    if (visit % GIFT_EVERY === 0) {
      m += `🎁 <b>يستحق هدية — قنينة ١٠ مل من اختياره</b>\n`;
    } else {
      const left = GIFT_EVERY - (visit % GIFT_EVERY);
      m += `باقي ${left} ${left === 1 ? "طلب" : "طلبات"} على الهدية\n`;
    }
  }

  m += `\n📱 <a href="https://wa.me/964${o.phone.slice(1)}">فتح واتساب الزبون</a>`;
  return m;
}

const recipients = env =>
  [env.TELEGRAM_CHAT_ID, env.TELEGRAM_CHAT_ID2, env.TELEGRAM_CHAT_ID3]
    .filter(id => id && String(id).trim());

async function sendToChat(env, chatId, text) {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: String(chatId).trim(),
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`chat ${chatId}: ${res.status} ${detail.slice(0, 200)}`);
  }
}

async function sendTelegram(env, text) {
  const ids = recipients(env);
  const results = await Promise.allSettled(
    ids.map(id => sendToChat(env, id, text))
  );

  const failed = results.filter(r => r.status === "rejected");
  if (failed.length === ids.length) {
    throw new Error(failed.map(f => f.reason.message).join(" | "));
  }
  if (failed.length) {
    console.warn("partial delivery:", failed.map(f => f.reason.message).join(" | "));
  }
  return { sent: ids.length - failed.length, total: ids.length };
}

async function handleOrder(request, env) {
  if (!env.TELEGRAM_TOKEN || !recipients(env).length) {
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
    if (o === "spam") return json({ ok: true, ref: body.ref || "" });
    return json({ ok: false, error: o }, 400);
  }

  const visit = await countOrder(env, o.phone);

  try {
    await sendTelegram(env, buildMessage(o, visit));
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

    return env.ASSETS.fetch(request);
  }
};
