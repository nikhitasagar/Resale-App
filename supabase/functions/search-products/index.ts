// supabase/functions/search-products/index.ts
//
// Proxies a Shopify storefront's public search endpoint so the static frontend can query it
// without hitting CORS restrictions. No API key needed — the search/suggest.json endpoint is
// public.
//
// Deploy with: supabase functions deploy search-products --no-verify-jwt
// Call from the frontend with: supabase.functions.invoke('search-products', { body: { q: 'blazer' } })

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The storefront's search results don't have dedicated fields for style number or material —
// both are embedded as <li> bullet points inside the HTML `body` description, e.g.:
//   <ul><li>53% Polyester, 43% Wool, 4% Elastane</li><li>Style Number: T000TW8013</li></ul>
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractListItems(bodyHtml: string): string[] {
  const items: string[] = [];
  const liRegex = /<li>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRegex.exec(bodyHtml)) !== null) {
    items.push(stripTags(match[1]));
  }
  return items;
}

function extractStyleNumber(items: string[]): string | null {
  for (const item of items) {
    const m = item.match(/Style Number:\s*(\S+)/i);
    if (m) return m[1];
  }
  return null;
}

function extractMaterial(items: string[]): string | null {
  for (const item of items) {
    if (/style number/i.test(item)) continue;
    if (/\d{1,3}%/.test(item)) return item;
  }
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { q } = await req.json();

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Missing search query" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url =
      `https://www.tibi.com/search/suggest.json?q=${encodeURIComponent(q)}` +
      `&resources[type]=product&resources[limit]=10`;

    const res = await fetch(url);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Product search failed with status ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const products = data?.resources?.results?.products ?? [];

    const results = products.map((p: any) => {
      const items = extractListItems(p.body ?? "");
      return {
        shopify_product_id: p.handle,
        item_name: p.title,
        image_url: p.image ?? null,
        item_type: p.type ?? null,
        style_number: extractStyleNumber(items),
        material: extractMaterial(items),
      };
    });

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
