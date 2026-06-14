export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const body = await request.json();
    const apiKey = process.env.ANTHROPIC_API_KEY || body.apiKey;
    if (!apiKey) throw new Error("Clé Anthropic manquante");

    const { apiKey: _, ...cleanBody } = body;

    // Timeout 25 secondes côté fetch pour éviter le 504 Netlify
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(cleanBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    const msg = error.name === "AbortError"
      ? "Délai dépassé — la recherche web prend trop de temps. Essayez une requête plus courte."
      : error.message;
    return new Response(JSON.stringify({ error: { message: msg } }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
};

export const config = { path: "/api/claude" };
