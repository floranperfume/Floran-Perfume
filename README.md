# Flouran / فلوران — Setup & Update Guide

A single-file bilingual (Arabic + English) perfume store. No server, no database,
no monthly cost. Orders arrive on your WhatsApp with the customer's full details.

**Live at:** `shop.floranperfume.workers.dev`
**Source:** GitHub repo `Floran-Perfume` → auto-deploys to Cloudflare in ~30 seconds

---

## What's already set for you

- WhatsApp number: **9647508274568** ✅
- Brand: **فلوران للعطور** / **Florane Perfumes** ✅
- Instagram: **instagram.com/floran.perfume** ✅
- Your logo: header mark, tab icon, hero emblem, and link-preview image ✅
- Arabic is the default; English is one tap away via the ع / EN switch ✅
- All 18 Iraqi governorates in the dropdown ✅

Only thing left is your real perfumes and photos.

### Your logo files (in `public/images/`)

| File | Where it's used |
|---|---|
| `mark.png` | the small round mark in the header |
| `emblem.png` | the large logo at the top of the page |
| `favicon.ico` / `favicon-64.png` | the browser tab icon |
| `apple-touch-icon.png` | when someone saves the site to their phone home screen |
| `og.jpg` | the preview picture when you share the link on WhatsApp or Instagram |

If you ever change your logo, regenerate these and keep the same filenames —
nothing in the code needs editing.

**Note on the share image:** `og.jpg` is referenced by full web address, so if you
later move to a real domain, update the four `og:` and `twitter:` lines near the top
of `index.html` to the new address or the preview will break.

---

## How to change anything

Open `index.html` on GitHub → click the **pencil** icon → edit → **Commit changes**.
Wait 30 seconds, refresh the site. That's the whole loop.

Everything you'd want to change is inside one block marked:

```
★★★  الإعدادات — عدّل هذا القسم فقط  /  SETTINGS — edit only this block  ★★★
```

Nothing below that block needs touching.

---

## Adding your perfumes

Each perfume is one entry. Copy an existing one and change the values:

```js
{ id:9, inStock:true, image:"", price:40000, oldPrice:0, ml:100,
  name:{ar:"اسم العطر",   en:"Perfume Name"},
  cat:{ar:"شرقي",         en:"Oriental"},
  notes:{ar:"عود · مسك",  en:"Oud · Musk"},
  tag:{ar:"جديد",         en:"New"} },
```

| Field | What it does |
|---|---|
| `id` | Any number — but **must be unique** for every perfume |
| `inStock` | `false` greys the card out and disables the button |
| `image` | `"images/oud.jpg"` — or `""` for the default gold bottle |
| `price` | Numbers only, no commas: `40000` not `40,000` |
| `oldPrice` | Crossed-out "before" price. `0` hides it |
| `ml` | Just the number — the unit shows as مل or ml automatically |
| `name` / `notes` / `cat` / `tag` | Arabic + English. Leave `en:""` and it falls back to Arabic |

**About `cat`:** the filter buttons build themselves from whatever categories you use.
Add a perfume with `cat:{ar:"عنبر", en:"Amber"}` and an عنبر button appears by itself.
Keep the Arabic spelling identical across perfumes in the same category, or you'll
get two separate buttons.

---

## Photos

Put them in the `images` folder on GitHub (**Add file → Upload files**), then point to them:

```js
image:"images/oud.jpg"
```

Three rules that save pain:

1. **Square photos (1:1)** look best in the grid.
2. **Under 200 KB each.** A photo straight from a phone is 4 MB and will make the
   site crawl on mobile data. Shrink them free at [squoosh.app](https://squoosh.app).
3. **Filenames are case-sensitive.** `Oud.JPG` and `oud.jpg` are different files as
   far as the server is concerned. Lowercase everything and avoid spaces.

---

## How an order reaches you

The customer picks perfumes, then **must** fill in:

- Full name
- Phone number — validated; `07XX XXX XXXX`, `+964...` and `00964...` all accepted
  and normalised to `07XXXXXXXXX`
- Governorate — dropdown of all 18
- Full address

The send button refuses to work until those are valid, so you'll never get a message
you can't act on. Notes are optional.

You receive something like:

```
*طلب جديد — فلوران*

• عود ملكي (100 مل) × 1 — 45,000 د.ع
• عنبر الشرق (100 مل) × 2 — 76,000 د.ع

*المجموع: 121,000 د.ع*

———————————
*بيانات الزبون*
الاسم: أحمد علي
الهاتف: 07701234567
المحافظة: بغداد
العنوان: المنصور، قرب جامع الرحمن
```

If the customer is browsing in English, you get the same message in English.

---

## Changing the text

Every word on the site lives in the `T` object — `T.ar` for Arabic, `T.en` for English.
Find the line you want and change the text between the quotes. Change both languages
or the English version will still say the old thing.

For example the delivery promise:

```js
f1t:"توصيل لكل المحافظات", f1s:"خلال ٢٤ إلى ٤٨ ساعة",
```

The three numbers in the About section (`s1n`, `s2n`, `s3n`) are placeholders —
"+٥٠٠ customers", "4.9 rating". Set them to something true or the section will
undercut your credibility rather than build it.

---

## Before you share the link

- [ ] Open on your **phone**
- [ ] Add 2 perfumes, tap Checkout
- [ ] Try sending with the form empty — it should refuse and highlight the fields
- [ ] Fill it in properly and send — WhatsApp should open **on your own number**
      with the full order and customer details
- [ ] Tap **EN** and check the English side reads correctly
- [ ] Confirm every price and photo

---

## Adding a real domain later

`shop.floranperfume.workers.dev` works fine, but a domain like `floran.shop`
(~$10–15/year) removes Cloudflare's name from your address and looks far more
trustworthy to someone about to pay you.

Buy it, then in your Worker → **Settings → Domains & Routes → Add custom domain**.
The site itself doesn't change and nothing needs rebuilding.

---

## Notes

- The cart lives in browser memory only. If a customer refreshes mid-order it empties.
  This is deliberate — no cookies, no tracking, nothing to maintain.
- Animations respect the phone's "reduce motion" accessibility setting.
- Don't move this to **GitHub Pages** — its terms of service ban running an online store.
