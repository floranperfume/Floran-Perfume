/**
 * Florane — order backend
 * ------------------------------------------------------------------
 * Serves the website, and receives orders at POST /api/order.
 * Orders are forwarded to Telegram.
 *
 * Two secrets must be set in Cloudflare (Worker → Settings → Variables
 * and Secrets). They are NEVER written in this file or in the website:
 *
 *   TELEGRAM_TOKEN     the token BotFather gave you
 *   TELEGRAM_CHAT_ID   first person who gets the orders
 *   TELEGRAM_CHAT_ID2  second person (optional)
 *   TELEGRAM_CHAT_ID3  third person (optional)
 *
 * Everyone listed must press START on the bot, or Telegram refuses to
 * deliver to them.
 * ------------------------------------------------------------------
 */

const LIMITS = {
  name:    { min: 2,  max: 80  },
  address: { min: 5,  max: 300 },
  notes:   { min: 0,  max: 400 },
  items:   { max: 40 },
  qty:     { max: 99 },
  price:   { max: 100000000 },
  delivery:{ max: 50000 }
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
  const city    = clean(body.city, 60);
  const phoneD  = String(body.phone || "").replace(/\D/g, "");
  const delivery = Number(body.delivery);

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

  // المجموع يُحسب هنا من جديد، لا نثق بالرقم القادم من المتصفح
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

/**
 * كم مرة طلب هذا الرقم من قبل.
 * يعمل فقط إذا ربطت مساحة KV باسم ORDERS — وبدونها يستمر كل شيء بشكل طبيعي.
 *
 * How many times this phone number has ordered before.
 * Only runs if a KV namespace named ORDERS is bound; without it everything
 * else still works exactly the same.
 */
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

const GIFT_EVERY = 3;   // هدية مع كل طلب ثالث / a gift on every third order

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
  m += `المحافظة: ${esc(o.province)} — ${esc(o.city)}\n`;
  m += `العنوان: ${esc(o.address)}\n`;
  if (o.notes) m += `ملاحظات: ${esc(o.notes)}\n`;

  // عدّاد الولاء
  if (visit) {
    m += `\n🔁 <b>الطلب رقم ${visit} لهذا الزبون</b>\n`;
    if (visit % GIFT_EVERY === 0) {
      m += `🎁 <b>يستحق هدية — قنينة ١٠ مل من اختياره</b>\n`;
    } else {
      const left = GIFT_EVERY - (visit % GIFT_EVERY);
      m += `باقي ${left} ${left === 1 ? "طلب" : "طلبات"} على الهدية\n`;
    }
  }

  // رابط يفتح محادثة واتساب مع الزبون مباشرة
  m += `\n📱 <a href="https://wa.me/964${o.phone.slice(1)}">فتح واتساب الزبون</a>`;
  return m;
}

/* كل من يستلم الطلب — أضف TELEGRAM_CHAT_ID3 وهكذا إذا احتجت المزيد
   Everyone who receives the order — add TELEGRAM_CHAT_ID3 etc. if you need more */
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

/**
 * يُرسل لكل الأرقام. ينجح إذا وصل لواحد على الأقل، حتى لا يضيع الطلب
 * لو كان أحد المستلمين لم يضغط START على البوت.
 *
 * Sends to everyone. Succeeds if at least one delivery works, so an order is
 * never lost just because one recipient hasn't pressed START on the bot.
 */
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
    // وصل لواحد على الأقل — نسجّل الباقي في سجل Cloudflare فقط
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
    // الفخ يرد بنجاح كاذب حتى لا يعرف البوت أنه انكشف
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

    // كل شيء آخر: الموقع نفسه
    return env.ASSETS.fetch(request);
  }
};
