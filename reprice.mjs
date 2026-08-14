// Netlify Function: refreshes the market price for an already-identified card.
// No image is sent, so this costs materially less than a full scan.

function buildPrompt(c) {
  const id = [c.year, c.set, c.subject, c.num ? "#" + c.num : "", c.variant,
    c.serial ? "/" + c.serial : ""].filter(Boolean).join(" ");
  const slab = c.graded ? `It is graded ${c.grader} ${c.grade}.` : "It is raw (ungraded).";

  return `Find the current market price for this trading card:

CARD: ${id}
CATEGORY: ${c.cat || "unknown"}
${slab}

Use web search to find recent SOLD prices — not asking prices, not guide values. Prefer eBay sold listings, PSA auction prices realized, Card Ladder, and Sports Card Investor. Search for sales within the last few months where possible.

Run SEPARATE searches for each price point. A search for the raw card will not tell you what the graded versions sell for.
- Search 1: the card in its current form (raw, or that grader at that grade)
- Search 2: the PSA 9 sold price
- Search 3: the PSA 10 sold price

Then set:
- vRaw: what this card is worth in its CURRENT form. If graded, the value of that slab at that grade from that grader. If raw, the raw value.
- v9: value if graded PSA 9.
- v10: value if graded PSA 10.

CRITICAL for RAW cards: v9 and v10 decide whether the card is worth grading, so they are the most important numbers here. Do NOT return 0 for them. If direct PSA 9 and PSA 10 sales exist, use those. If you genuinely cannot find graded sales after searching, estimate from the raw value and from comparable cards in the same set and era, then say clearly in the note that these are estimates rather than observed sales. Return 0 for v9 and v10 ONLY when the card is already graded.

Rules that matter:
- Off-brand graders (GCC, WCG, HGA and similar) carry little or no premium. Value close to raw.
- Junk-wax era cards (roughly 1987-1999) are mass produced. PSA 9s are usually cheap while PSA 10s can be worth many times more. Reflect that gap honestly.
- Never inflate a value to be encouraging. A low number is more useful than a flattering one.

Respond with ONLY a JSON object. No preamble, no markdown fences, nothing after.

{"vRaw":0,"v9":0,"v10":0,"confidence":"high","note":""}

confidence: "high", "medium" or "low" — how solid the sales data was.
note: one short sentence naming what the price is based on (e.g. "3 eBay sales in the last 60 days, $22-31").`;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({
      error: "No API key set. Add ANTHROPIC_API_KEY in Netlify, then redeploy."
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  let card;
  try { card = (await req.json()).card; }
  catch { return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 }); }

  if (!card || (!card.subject && !card.set)) {
    return new Response(JSON.stringify({ error: "Card has too little detail to price" }), { status: 400 });
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
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
        messages: [{ role: "user", content: buildPrompt(card) }],
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
    const m = text.replace(/```json/g, "").replace(/```/g, "").trim().match(/\{[\s\S]*\}/);
    if (!m) {
      return new Response(JSON.stringify({ error: "No usable price came back" }), {
        status: 422, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(JSON.parse(m[0])), {
      status: 200, headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: "Refresh failed: " + (e.message || "unknown") }), {
      status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const config = { path: "/api/reprice" };
