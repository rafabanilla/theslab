// Netlify Function: reads a card photo, returns a structured record with prices.
// Your API key lives here as an environment variable and never reaches the browser.

const PROMPT = `You are a trading card cataloguer. Read this card photo and identify it, then price it.

STEP 1 — IDENTIFY. Read every piece of text visible on the card:
- year (copyright or season year, 4 digits)
- set (brand and product line, e.g. "Topps Chrome", "Upper Deck Collector's Choice", "Pokemon Base Set")
- subject (player name, or character name for TCG)
- num (card number, no # sign)
- variant (parallel, insert or subset name, e.g. "Refractor", "1st Edition Holo", "All-Star". Empty string for a plain base card)
- serial (print run denominator if serial numbered, e.g. "99" for /99, else empty)
- cat (exactly one of: NBA, NFL, MLB, NHL, Soccer, Boxing/MMA, Pokemon, Magic, Yu-Gi-Oh, Other TCG, Entertainment, Other)
- If the card sits inside a graded slab, read the label: graded=true, plus grader (PSA/BGS/SGC/CGC/GCC/WCG/HGA/TAG/Other), grade, and cert number.

STEP 2 — PRICE. Use web search to find what this card sells for now. Search for recent SOLD prices, not asking prices. Prefer eBay sold listings, PSA auction prices realized, Card Ladder, Sports Card Investor. Then set:
- vRaw: value in its CURRENT form. For a slab, the value of that slab at that grade from that grader. For a raw card, the raw value.
- v9: value if graded PSA 9. Raw cards only; 0 if already graded.
- v10: value if graded PSA 10. Raw cards only; 0 if already graded.

Pricing rules that matter:
- Off-brand graders (GCC, WCG, HGA and similar) carry little or no premium. Value close to raw.
- Junk-wax era cards (roughly 1987-1999) are mass produced. PSA 9s are usually cheap while PSA 10s can be worth many times more. Reflect that gap honestly.
- If you find no real sales data, estimate conservatively and say so in the note.

Respond with ONLY a JSON object. No preamble, no markdown fences, nothing after.

{"cat":"","year":"","set":"","subject":"","num":"","variant":"","serial":"","graded":false,"grader":"","grade":"","cert":"","vRaw":0,"v9":0,"v10":0,"confidence":"high","note":""}

confidence: "high", "medium" or "low" — how sure you are of the identification.
note: one short sentence on what the price is based on, or what you could not determine.
Empty strings for unknown text, 0 for unknown numbers. Never invent a cert number.`;

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({
      error: "No API key set. In Netlify: Site configuration → Environment variables → add ANTHROPIC_API_KEY, then redeploy."
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 }); }

  const { image, mediaType } = body;
  if (!image) {
    return new Response(JSON.stringify({ error: "No image received" }), { status: 400 });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1200,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return new Response(JSON.stringify({
        error: r.status === 401 ? "API key rejected — check it in Netlify env vars"
             : r.status === 429 ? "Rate limited — wait a moment and retry"
             : r.status === 400 && /credit/i.test(detail) ? "Out of API credit — top up in the Claude Console"
             : `Claude API error ${r.status}`,
      }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const data = await r.json();
    const text = (data.content || [])
      .map(i => (i.type === "text" ? i.text : ""))
      .filter(Boolean).join("\n");
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) {
      return new Response(JSON.stringify({ error: "Couldn't read that card — try a sharper photo" }), {
        status: 422, headers: { "Content-Type": "application/json" } });
    }

    const parsed = JSON.parse(m[0]);
    const usage = data.usage || {};
    parsed._cost = {
      in: usage.input_tokens || 0,
      out: usage.output_tokens || 0,
      searches: (usage.server_tool_use && usage.server_tool_use.web_search_requests) || 0,
    };
    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: "Scan failed: " + (e.message || "unknown") }), {
      status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const config = { path: "/api/scan" };
