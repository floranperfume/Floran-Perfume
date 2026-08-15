# Getting orders in Telegram — one-time setup

**Time needed:** about 15 minutes. You only do this once.

After this, an order arriving on your website pings your phone instantly, with the
customer's name, phone, governorate and address — and a link that opens WhatsApp
with *that customer* in one tap.

The customer never sees Telegram, never installs anything, never signs into anything.
They just fill the form and see "✓ Order received".

---

## Part 1 — Restructure the repo

Your repo currently has `index.html` sitting at the root. The Worker needs a slightly
different layout:

```
Floran-Perfume/
├── wrangler.jsonc        ← new (settings)
├── src/
│   └── index.js          ← new (the order backend)
└── public/
    ├── index.html        ← moved here
    └── images/           ← your photos go here
```

### Step 1 — Move index.html into public/

On GitHub, click `index.html` → **pencil** icon. At the top there's a box with the
filename. Change it from:

```
index.html
```

to:

```
public/index.html
```

GitHub creates the folder automatically. Commit the change.

*(While you're in there, paste in the new version of the file I sent — it has the
order-sending code.)*

### Step 2 — Add the two new files

**Add file → Create new file.** For the filename type:

```
src/index.js
```

Paste in the contents of `src/index.js` I sent you. Commit.

Repeat for:

```
wrangler.jsonc
```

Commit.

Your repo should now match the tree above.

⚠️ **The deploy will break until you finish Part 3.** That's expected — the Worker
starts up, finds no Telegram credentials, and returns an error for orders. The website
itself keeps working, and orders fall back to WhatsApp. Don't panic if you check
mid-way.

---

## Part 2 — Create the bot

### Step 3 — Talk to BotFather

Open Telegram and search for **@BotFather** (the one with the blue verified tick).

Send: `/newbot`

It asks two things:

1. **A display name** — anything, e.g. `Flouran Orders`
2. **A username** — must end in `bot` and be globally unique, e.g. `flouran_orders_bot`

BotFather replies with a token that looks like:

```
8123456789:AAHf9k2Lm-xYzQwErTyUiOpAsDfGhJkL
```

**Copy it and keep it private.** Anyone with this token can send messages as your bot.
Never put it in the website file or paste it in a public place.

### Step 4 — Press Start on your own bot

Open your new bot (BotFather gives you a link) and press **START**, or send it `/start`.

**Don't skip this.** Telegram blocks bots from messaging people who haven't started a
chat with them first. Skip it and every order will silently fail.

### Step 5 — Get your chat ID

Search Telegram for **@userinfobot** and send it any message. It replies with your ID —
a number like `987654321`.

That's your chat ID. Copy it.

---

## Part 3 — Give Cloudflare the credentials

These go into Cloudflare as **secrets** — encrypted, invisible in the dashboard after
saving, and never stored in your public GitHub repo.

### Step 6 — Add them

In Cloudflare: **Compute** → your `shop` Worker → **Settings** → find
**Variables and Secrets** → **Add**.

Add two, each with **Type: Secret** (not "Text"):

| Name | Value |
|---|---|
| `TELEGRAM_TOKEN` | the token from BotFather |
| `TELEGRAM_CHAT_ID` | the number from userinfobot |

The names must match exactly — capitals and underscores included.

Save. Cloudflare redeploys automatically.

---

## Part 4 — Test it

1. Open your site **on your phone**
2. Add a perfume, tap Checkout
3. Fill in the form with your own details
4. Tap **إرسال الطلب**

You should see "✓ تم استلام طلبك" with an order number — and your Telegram should
buzz within a second or two.

### If nothing arrives

| What you see | What it means |
|---|---|
| WhatsApp opened instead of the success screen | The backend rejected it. Secrets are missing, misspelled, or set as "Text" instead of "Secret" |
| Success screen, but no Telegram message | You skipped Step 4 — go press START on your bot |
| Success screen, still nothing | Chat ID is wrong. Re-check with @userinfobot |

To see the actual error: Cloudflare → your Worker → **Logs** → **Live**, then place
another test order and watch what appears.

---

## What you get for each order

```
🛒 طلب جديد — Flouran
FL-B2T99

• عود ملكي (100 ml) × 2 — 90,000 د.ع

💰 المجموع: 90,000 د.ع

👤 الزبون
الاسم: أحمد علي
الهاتف: 07508274568
المحافظة: بغداد
العنوان: المنصور، قرب جامع الرحمن
ملاحظات: يفضل الاتصال بعد الساعة ٥

📱 فتح واتساب الزبون   ← tap to open WhatsApp with this customer
```

The phone number is tappable to copy, and that last link opens a WhatsApp chat with
the customer directly — so you can confirm the order in one tap without typing
their number.

---

## Things worth knowing

**The order is captured before WhatsApp.** Even if the customer changes their mind at
the WhatsApp step, you already have their order and their number. You can call them.
This is the main reason this is worth the 15 minutes.

**If the backend ever fails, nothing is lost.** The site automatically falls back to
opening WhatsApp with the order text, exactly like before.

**Spam protection is basic.** There's a hidden trap field that catches crude bots, and
the server rejects malformed orders, fake governorates, and impossible quantities. But
the endpoint is public — if someone deliberately targets you, they could send junk
orders to your Telegram. Unlikely for a local shop, and easy to fix later if it ever
happens.

**Prices come from the customer's browser.** Someone technical could in theory submit
an order claiming a perfume costs 1,000 IQD. You'd spot it immediately when you call
to confirm, and you're not taking payment online, so nothing is at risk. Just don't
treat the total in the message as gospel without a glance.

**Cost: still zero.** Cloudflare's free plan allows 100,000 Worker requests per day.
Telegram's bot API is free with no limits that you could realistically reach.
