# The Slab

Photograph a collectible, get the record and a current price. Cards, sealed product and Funko Pops. Installs to your phone's home screen; everything syncs across devices.

Current build: **55**

---

## What's in here

| File | What it is |
|---|---|
| `index.html` | The whole app — one file, no build step |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | Makes it installable on a phone |
| `schema-all.sql` | Run once in Supabase to create the database |
| `schema-v5.sql` | Later addition — the `verified` column |
| `supabase/functions/scan/index.ts` | Reads a photo and identifies the item |
| `supabase/functions/reprice/index.ts` | Looks up what it sells for |
| `brand/` | Logo files, not used by the app |

**Only the top group is served by the web host.** The two `.ts` files live inside Supabase — pasting them into GitHub does nothing on its own. The `.sql` files are run by hand, once.

If a `netlify/` folder is still present, it is left over from an earlier version and can be deleted. The serverless functions moved to Supabase.

---

## How it fits together

- **Static hosting** (GitHub Pages or Netlify) serves `index.html` and the icons. No build, no server.
- **Supabase** holds everything else: your items in Postgres, photos in Storage, your login, and the two Edge Functions.
- **Anthropic API** does the reading and the pricing. Your key is a Supabase secret, never in the browser.

---

## Setting it up from scratch

### 1. Supabase

1. Create a free project at supabase.com.
2. **SQL Editor → New query** → paste all of `schema-all.sql` → Run. Then do the same with `schema-v5.sql`.
3. **Authentication → Users → Add user** → your email and a password, tick **Auto Confirm User**.
4. **Authentication → Sign In / Providers** → turn off **Allow new users to sign up**, so only you can get in.
5. **Edge Functions → Secrets** → add `ANTHROPIC_API_KEY` with a key from console.anthropic.com.
6. **Edge Functions → Deploy a new function → Via Editor.** Name it exactly `scan`, paste `supabase/functions/scan/index.ts`. Repeat for `reprice`.
7. On each function's **Settings**, turn **off** "Verify JWT with legacy secret". The functions check your login themselves; leaving it on breaks the browser's preflight request.

### 2. The app

`index.html` has the Supabase project URL and anon key baked in near the top, in `const BAKED`. Replace them with your own from **Project Settings → API**. The anon key belongs in the browser — row-level security is what protects your data. Never put the `service_role` key there.

Then push the static files to your host.

### 3. Your phone

**iPhone:** open the site in Safari → Share → Add to Home Screen.
**Android:** Chrome → menu → Install app.

Sign in with the account from step 1.3. Same login on every device, same collection.

---

## What it costs

Scanning is about half a cent — one photo, no web search.

Pricing tries a free path first: it reads the item's page on SportsCardsPro (sports) or PriceCharting (everything else) and takes the published prices. That costs nothing. When that fails it falls back to a model lookup with web searches, at roughly 15–20 cents.

Your real average shows in **Setup → Spend**, measured from what the API actually reported. Any batch of five or more asks before it spends, using that measured figure.

Set a monthly cap in the Claude Console if you want a hard ceiling.

---

## How pricing works, and what to trust

Every price is labelled with what it rests on:

- **Checked by you** — you typed it. Bulk refreshes leave these alone.
- **Observed sales** — individual completed sales, with dates and sources.
- **Market guide** — a published value from SportsCardsPro or PriceCharting, computed from eBay sales.
- **Estimated** — reasoned from comparable items, shown as a range with its reasoning.

**Money → How solid is this** shows what share of your total sits in each. Estimates run high on stars and premium products; verify the big ones before treating the total as real.

Grading recommendations use the full published ladder — Grade 7 through PSA 10 — weighted by how clean you say the item looks, net of your grading fee. If the ladder can't be read, the app says so rather than guessing.

---

## Where things live

- **Items and settings:** Postgres tables in your Supabase project
- **Photos:** Supabase Storage, with public URLs so listing exports carry working image links
- **On the device:** a read cache and your sign-in

Free tier covers 500 MB of database and 1 GB of photos — thousands of items.

You can read your cached collection offline, but scanning, pricing and saving need a connection.

Export a CSV from Setup now and then. Supabase backs itself up, but a file you hold is one nobody can revoke.

---

## When something fails

| What you see | What it means |
|---|---|
| "No API key set" | Add `ANTHROPIC_API_KEY` under Edge Functions → Secrets |
| "Blocked before reaching scan" | Turn off Verify JWT on that function's settings |
| "API key rejected" | Wrong key, or it was added after the function deployed |
| "Out of API credit" | Top up in the Claude Console |
| "Timed out" | The lookup ran long. Retry; it usually succeeds |
| "free lookup missed: …" | The card's evidence panel says exactly why it fell back to the model |
| Prices identical across grades | An old build. Re-price; the parser was fixed in build 45 |

**Setup → Diagnostics** tests each link separately and costs nothing — app build, sign-in, which function versions are deployed, whether the API key is visible, and whether the database reads and writes.

---

## Updating

Upload the new `index.html` to your host. If a build changes an edge function, repaste that `.ts` into Supabase — uploading it to the repo has no effect. Schema changes are called out per build and run in the SQL Editor.

The build number in the footer tells you what is actually running. If it hasn't moved after an upload, you're on a cached copy — Setup has a **Clear cache and reload** button.
