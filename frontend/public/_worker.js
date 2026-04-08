export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Try to serve the exact asset first
    const assetResponse = await env.ASSETS.fetch(request);

    // If the asset exists (not 404), return it
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // For 404s (SPA routes), serve index.html with 200 status
    const indexResponse = await env.ASSETS.fetch(new URL('/', request.url));
    return new Response(indexResponse.body, {
      status: 200,
      headers: indexResponse.headers,
    });
  }
};
