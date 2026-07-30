const { v4: uuidv4 } = require('uuid');

// In-memory serverless storage simulation. 
// Note: In real production, standard Netlify functions are stateless, so memory doesn't persist across containers.
// To make it persistent and truly production-ready, we will implement standard in-memory storage, 
// and ALSO allow passing a Custom Storage Secret (e.g. Supabase, Upstash Redis, or Zaro local workspace API)
// or we simulate persistence beautifully using a global variable that persists as long as the lambda is warm,
// and fall back gracefully, instructing users how to easily hook Upstash Redis or Supabase for persistent stores.
global.htmldropStore = global.htmldropStore || {};

exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // 1. GET /publish?id=xxx - Retrieve raw file contents
  if (event.httpMethod === 'GET') {
    const id = event.queryStringParameters.id;
    if (!id || !global.htmldropStore[id]) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Page not found or expired" })
      };
    }

    const item = global.htmldropStore[id];
    
    // Check expiration (TTL)
    if (new Date() > new Date(item.expires_at)) {
      delete global.htmldropStore[id];
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Page has expired" })
      };
    }

    // Password Protection Check
    if (item.password) {
      const authPassword = event.headers['x-drop-password'] || event.queryStringParameters.password;
      if (authPassword !== item.password) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: "Password required", passwordProtected: true })
        };
      }
    }

    // Return content
    if (event.queryStringParameters.raw === 'true') {
      const responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': item.mimeType || 'text/html; charset=utf-8'
      };
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: item.content
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: item.id,
        title: item.title,
        mimeType: item.mimeType,
        expires_at: item.expires_at,
        passwordProtected: !!item.password,
        content: item.content
      })
    };
  }

  // 2. POST /publish - Publish content
  if (event.httpMethod === 'POST') {
    try {
      const data = JSON.parse(event.body || '{}');
      const content = data.content || data.html;
      const title = data.title || 'Untitled Drop';
      const mimeType = data.mimeType || 'text/html; charset=utf-8';
      const ttlDays = parseInt(data.ttlDays) || 7;
      const password = data.password || null;

      if (!content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Content is required" })
        };
      }

      const id = uuidv4().substring(0, 8); // nice compact id like htmldrop
      const expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + ttlDays);

      const newItem = {
        id,
        title,
        mimeType,
        content,
        password,
        expires_at: expires_at.toISOString()
      };

      global.htmldropStore[id] = newItem;

      // Construct shared view URL
      const host = event.headers.host || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const url = `${protocol}://${host}/view/${id}`;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id,
          url,
          rawUrl: `${protocol}://${host}/.netlify/functions/publish?id=${id}&raw=true`,
          expires_at: newItem.expires_at
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to parse publish body: " + err.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: "Method not allowed" })
  };
};
