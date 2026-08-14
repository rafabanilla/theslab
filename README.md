# The Slab — scan-first card inventory

Photograph a card, get the card record and current prices. Installs to your phone's home screen. Photos stay on your device.

## What's in here

| File | What it is |
|---|---|
| `index.html` | The app |
| `netlify/functions/scan.mjs` | Reads card photos — holds your API key server-side |
| `netlify.toml` | Build config |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | Makes it installable and offline-capable |

## 1. Get an API key

1. Go to **console.anthropic.com**, sign up
2. Billing → add credit ($10 goes a long way)
3. API Keys → Create Key → copy it

This is separate from any Claude.ai subscription. It bills per use.

## 2. Deploy

Netlify Drop won't work this time — functions need a real site. Two options:

**Netlify web UI (no terminal)**

1. Put this folder in a GitHub repo (github.com → New repository → upload files)
2. app.netlify.com → Add new site → Import an existing project → pick the repo
3. Leave build settings as-is, click Deploy

**Netlify CLI (if you have a terminal)**

```
npm install -g netlify-cli
netlify deploy --prod
```

## 3. Add your key

In Netlify: **Site configuration → Environment variables → Add a variable**

- Key: `ANTHROPIC_API_KEY`
- Value: your key from step 1

Then **Deploys → Trigger deploy → Deploy site**. The key has to be set before the deploy that uses it.

## 4. Install on your phone

**iPhone:** open the site in Safari → Share → Add to Home Screen
**Android:** Chrome → menu → Install app

## What it costs

Each scan sends one photo to Claude Sonnet and runs a few web searches. Roughly **3-8 cents per card** — about $30-80 for a thousand. Set a monthly spend limit in the Claude Console if you want a hard ceiling.

## Where things live

- **Card data:** localStorage on the device
- **Photos:** IndexedDB on the device, about 250KB each
- **Neither syncs** between your phone and laptop

Setup shows how much storage you're using and lets you ask the browser to protect it from automatic cleanup. Export a CSV regularly anyway — that's your real backup.

Photos are device-local, so they won't appear in listing exports. For selling, host images in one folder named by SKU (`C-0001-front.jpg`) and paste the folder URL in Setup.

## When a scan fails

- **"API key rejected"** — the env var is wrong, or you didn't redeploy after adding it
- **"Out of API credit"** — top up in the Console
- **"Couldn't read that card"** — glare or blur. Shoot flat, indirect light, no flash
- **Wrong identification** — amber dot means low confidence. Base cards from big sets look alike; fix it by hand and save

## Updating

Push to the repo and Netlify redeploys automatically. The service worker is network-first, so reopening picks up changes.
