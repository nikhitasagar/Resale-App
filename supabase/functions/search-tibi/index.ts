// supabase/functions/search-tibi/index.ts
//
// Proxies Tibi's public Shopify search endpoint so the static frontend can query it without
// hitting CORS restrictions. No API key needed — Tibi's search/suggest.json endpoint is public.
//
// Deploy with: supabase functions deploy search-tibi --no-verify-jwt
// Call from the frontend with: supabase.functions.invoke('search-tibi', { body: { q: 'blazer' } })

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        JSON.stringify({ error: `Tibi search failed with status ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const products = data?.resources?.results?.products ?? [];

    const results = products.map((p: any) => ({
      shopify_product_id: p.handle,
      item_name: p.title,
      image_url: p.image ?? null,
      item_type: p.type ?? null,
    }));

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
