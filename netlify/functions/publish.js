const { v4: uuidv4 } = require('uuid');

// In-memory serverless storage simulation. 
// Note: In real production, standard Netlify functions are stateless, so memory doesn't persist across containers.
// To make it persistent and truly production-ready, we will implement standard in-memory storage, 
// and ALSO allow passing a Custom Storage Secret (e.g. Supabase, Upstash Redis, or Zaro local workspace API)
// or we simulate persistence beautifully using a global variable that persists as long as the lambda is warm,
// and fall back gracefully, instructing users how to easily hook Upstash Redis or Supabase for persistent stores.
global.htmldropStore = global.htmldropStore || {};

// MIME type to Content-Type mapping for raw responses
// For text types: include charset=utf-8. For binary types: no charset.
function getRawContentType(mimeType) {
  const binaryTypes = [
    'application/pdf',
    'application/haansofthwp',
    'application/haansofthwpx',
    'application/octet-stream',
    'image/',
  ];

  const isBinary = binaryTypes.some(t => mimeType.startsWith(t));
  
  if (isBinary) {
    return mimeType;
  }
  
  // Text types: ensure charset
  if (mimeType.includes('charset')) {
    return mimeType;
  }
  
  return `${mimeType}; charset=utf-8`;
}

// Check if content is a Base64 data URI
function isDataUri(content) {
  return content && typeof content === 'string' && content.startsWith('data:');
}

// Convert data URI to raw Base64 content (strip the prefix)
function stripDataUriPrefix(dataUri) {
  const commaIndex = dataUri.indexOf(',');
  if (commaIndex === -1) return dataUri;
  return dataUri.substring(commaIndex + 1);
}

// Check if mimeType is a HWP/HWPX file (eligible for rhwp editor)
function isHwpMime(mimeType) {
  return mimeType && (mimeType.includes('haansofthwp') || mimeType.includes('haansoft'));
}

exports.handler = async (event, context) => {
  // CORS Headers
  const jsonHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-drop-password',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: jsonHeaders, body: '' };
  }

  // 1. GET /publish?id=xxx - Retrieve raw file contents
  if (event.httpMethod === 'GET') {
    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id || !global.htmldropStore[id]) {
      return {
        statusCode: 404,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Page not found or expired" })
      };
    }

    const item = global.htmldropStore[id];
    
    // Check expiration (TTL)
    if (new Date() > new Date(item.expires_at)) {
      delete global.htmldropStore[id];
      return {
        statusCode: 404,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Page has expired" })
      };
    }

    // Password Protection Check
    if (item.password) {
      const authPassword = event.headers['x-drop-password'] || (event.queryStringParameters && event.queryStringParameters.password);
      if (authPassword !== item.password) {
        return {
          statusCode: 401,
          headers: jsonHeaders,
          body: JSON.stringify({ error: "Password required", passwordProtected: true })
        };
      }
    }

    // Return raw content (for direct file access)
    if (event.queryStringParameters && event.queryStringParameters.raw === 'true') {
      const mimeType = item.mimeType || 'text/html; charset=utf-8';
      const rawContentType = getRawContentType(mimeType);
      
      let bodyContent = item.content;
      let isBase64 = false;

      // For binary files stored as data URIs, decode to raw binary
      if (isDataUri(item.content)) {
        bodyContent = stripDataUriPrefix(item.content);
        isBase64 = true;
      }

      const responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': rawContentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(item.title || 'document')}"`,
      };

      if (isBase64) {
        responseHeaders['Content-Transfer-Encoding'] = 'base64';
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: bodyContent,
        isBase64Encoded: isBase64,
      };
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
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
          headers: jsonHeaders,
          body: JSON.stringify({ error: "Content is required" })
        };
      }

      // Validate content size (prevent excessively large uploads)
      // Data URIs are ~33% larger than raw binary, so allow up to ~15MB raw = ~20MB data URI
      const MAX_SIZE = 20 * 1024 * 1024; // 20MB
      if (content.length > MAX_SIZE) {
        return {
          statusCode: 413,
          headers: jsonHeaders,
          body: JSON.stringify({ error: "File too large. Maximum size is 20MB." })
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
      const rawUrl = `${protocol}://${host}/.netlify/functions/publish?id=${id}&raw=true`;

      const response = {
        id,
        url,
        rawUrl,
        expires_at: newItem.expires_at
      };

      // If HWP/HWPX, also include rhwp editor URL
      if (isHwpMime(mimeType)) {
        response.rhwpUrl = `${protocol}://${host}/rhwp-view/${id}`;
      }

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify(response)
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Failed to parse publish body: " + err.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers: jsonHeaders,
    body: JSON.stringify({ error: "Method not allowed" })
  };
};
