# Florane Perfumes / فلوران للعطور

Bilingual (Arabic + English) perfume store. No database, no monthly cost.
Orders arrive in your Telegram; WhatsApp stays as a second contact option.

**Live at:** `shop.floranperfume.workers.dev`
**Source:** GitHub repo `Floran-Perfume` → auto-deploys to Cloudflare in ~30 seconds

---

## Current setup

| | |
|---|---|
| Perfumes | Coromandel, Ombre Nomade, Bois d'Argent, Baccarat Rouge 540 |
| Sizes | 30 ml — 15,000 IQD · 50 ml — 25,000 IQD |
| Delivery | 6,000 IQD everywhere · **3,000 IQD to Mosul** |
| Coverage | 18 governorates, 143 cities and districts |
| WhatsApp | 9647508274568 |
| Instagram | instagram.com/floran.perfume |

---

## How to change anything

Open `public/index.html` on GitHub → **pencil** icon → edit → **Commit changes**.
Wait 30 seconds, refresh. That's the whole loop.

Everything you'd want to change is in one block marked:

```
★★★  الإعدادات — عدّل هذا القسم فقط  /  SETTINGS — edit only this block  ★★★
```

---

## Prices and sizes

Each perfume carries its own sizes and prices:

```js
{ id:1, inStock:true, image:"",
  name:{ ar:"شانيل كورومندل", en:"Chanel Coromandel" },
  notes:{ ar:"باتشولي · بخور · فانيليا", en:"Patchouli · Incense · Vanilla" },
  tag:{ ar:"الأكثر مبيعاً", en:"Best seller" },
  sizes:[ {ml:30, price:15000}, {ml:50, price:25000} ] },
```

**To change a price** — edit the number in `sizes`. No commas: `15000`, not `15,000`.

**To add a third size** — add to the array:

```js
sizes:[ {ml:30, price:15000}, {ml:50, price:25000}, {ml:100, price:40000} ]
```

The buttons on the card build themselves from this list. Two sizes, three, or one —
it lays out either way.

**To add a perfume** — copy a whole block, change the values, and give it a **new
unique `id`**. Two perfumes sharing an id will misbehave in the cart.

**To mark something sold out** — `inStock:false`. The card greys out and the button
disables. Better than deleting it, because customers see you carry it.

---

## Delivery fees

The default sits in the settings block:

```js
delivery: { default: 6000 },
```

That applies to every city **except** ones given their own fee in the `REGIONS` list
further down. Right now only Mosul has one:

```js
{ar:"الموصل", en:"Mosul", fee:3000},
```

**To give another city a special rate**, add `fee:` to it the same way:

```js
{ar:"تلعفر", en:"Tal Afar", fee:4000},
```

**To change the rate everywhere**, edit `delivery.default`.

The customer sees "تُحدد حسب المدينة" until they pick a city, then delivery and the
grand total fill in. They always see the real total before ordering — no surprises at
the door, which is where arguments come from.

---

## Cities

Every governorate has its own city list. Picking a governorate filters the city
dropdown; changing the governorate clears the city so a mismatched pair can't be sent.

To add a city that's missing, find its governorate in `REGIONS` and add an entry:

```js
{ar:"اسم المدينة", en:"City Name"},
```

Add `fee:` only if it needs a rate different from the default.

---

## Photos

Put them in `public/images/` on GitHub, then point the perfume at one:

```js
image:"images/coromandel.jpg"
```

- **Square (1:1)** looks best
- **Under 200 KB each** — a phone photo is 4 MB and will make the site crawl on mobile
  data. Shrink free at [squoosh.app](https://squoosh.app)
- **Filenames are case-sensitive** — `Oud.JPG` ≠ `oud.jpg`. Lowercase, no spaces

Without photos the gold bottle placeholder shows, which looks fine but sells less.
Real photos are the single biggest thing you can add now.

---

## Your logo files

| File | Used for |
|---|---|
| `mark.png` | round mark in the header |
| `emblem.png` | large logo at the top of the page |
| `favicon.ico` / `favicon-64.png` | browser tab icon |
| `apple-touch-icon.png` | saved to phone home screen |
| `og.jpg` | preview picture when the link is shared |

Replacing your logo means regenerating these with the same filenames — no code changes.

**If you move to a real domain**, update the four `og:` and `twitter:` lines near the
top of `index.html`, or link previews will break.

---

## What an order looks like

```
🛒 طلب جديد — Florane
FL-B2T99

• شانيل كورومندل (50 ml) × 1 — 25,000 د.ع
• بكارات روج 540 (30 ml) × 1 — 15,000 د.ع

المجموع الفرعي: 40,000 د.ع
أجرة التوصيل: 3,000 د.ع
💰 الإجمالي: 43,000 د.ع

👤 الزبون
الاسم: أحمد علي
الهاتف: 07508274568
المحافظة: نينوى — الموصل
العنوان: ...

📱 فتح واتساب الزبون   ← one tap to message them
```

Telegram setup is in **TELEGRAM-SETUP.md**.

---

## Before sharing the link

- [ ] Open on your **phone**
- [ ] Switch a perfume between 30 and 50 ml — price should change
- [ ] Add both sizes of the same perfume — they should be two separate lines
- [ ] Pick نينوى → الموصل — delivery should read 3,000
- [ ] Pick any other city — should read 6,000
- [ ] Try sending with the form empty — should refuse and highlight fields
- [ ] Send a real test order — check Telegram
- [ ] Tap **EN** and read the English side

---

## Notes

- The cart lives in browser memory. A refresh mid-order empties it — deliberate, so
  there are no cookies and nothing to maintain.
- Totals are recalculated on the server before reaching your Telegram, so the numbers
  you receive are always internally consistent. Item prices still originate in the
  customer's browser, so glance at them when you call to confirm.
- Cost is still zero: Cloudflare allows 100,000 requests/day free, Telegram is free.
- Don't move this to **GitHub Pages** — its terms ban running an online store.
