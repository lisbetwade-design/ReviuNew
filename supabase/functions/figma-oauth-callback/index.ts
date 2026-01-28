import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('ENCRYPTION_KEY');
  if (!keyString) {
    throw new Error('ENCRYPTION_KEY environment variable not set');
  }
  const keyData = new TextEncoder().encode(keyString.padEnd(32, '0').substring(0, 32));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptToken(token: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedToken = new TextEncoder().encode(token);

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedToken
  );

  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);

  return btoa(String.fromCharCode(...combined));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      const errorDescription = url.searchParams.get("error_description") || "Authorization cancelled";
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Authorization Failed</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 1rem;
                backdrop-filter: blur(10px);
                max-width: 400px;
              }
              h1 { margin: 0 0 1rem 0; }
              p { margin: 0; opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Authorization Failed</h1>
              <p>${errorDescription}</p>
              <p style="margin-top: 1rem; font-size: 0.9rem;">This window will close automatically...</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'figma-oauth-error', error: '${errorDescription}' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    if (!code || !state) {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Invalid Request</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 1rem;
                backdrop-filter: blur(10px);
                max-width: 400px;
              }
              h1 { margin: 0 0 1rem 0; }
              p { margin: 0; opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Invalid Request</h1>
              <p>Missing required parameters. Please try again.</p>
            </div>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: pkceData, error: pkceError } = await serviceClient
      .from("oauth_pkce_state")
      .select("*")
      .eq("state", state)
      .eq("provider", "figma")
      .maybeSingle();

    if (pkceError || !pkceData) {
      console.error("PKCE state verification failed:", pkceError);
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Invalid State</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 1rem;
                backdrop-filter: blur(10px);
                max-width: 400px;
              }
              h1 { margin: 0 0 1rem 0; }
              p { margin: 0; opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Invalid State</h1>
              <p>The authorization state is invalid or expired. Please try again.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'figma-oauth-error', error: 'Invalid state' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    if (new Date(pkceData.expires_at) < new Date()) {
      await serviceClient
        .from("oauth_pkce_state")
        .delete()
        .eq("id", pkceData.id);

      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>State Expired</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 1rem;
                backdrop-filter: blur(10px);
                max-width: 400px;
              }
              h1 { margin: 0 0 1rem 0; }
              p { margin: 0; opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>State Expired</h1>
              <p>The authorization state has expired. Please start over.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'figma-oauth-error', error: 'State expired' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    const clientId = Deno.env.get("FIGMA_CLIENT_ID");
    const clientSecret = Deno.env.get("FIGMA_CLIENT_SECRET");
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/figma-oauth-callback`;

    if (!clientId || !clientSecret) {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Configuration Error</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 1rem;
                backdrop-filter: blur(10px);
                max-width: 400px;
              }
              h1 { margin: 0 0 1rem 0; }
              p { margin: 0; opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Configuration Error</h1>
              <p>Figma OAuth is not properly configured on the server.</p>
            </div>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>`,
        {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    const tokenResponse = await fetch("https://api.figma.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: pkceData.code_verifier,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Figma token exchange error:", tokenData);

      await serviceClient
        .from("oauth_pkce_state")
        .delete()
        .eq("id", pkceData.id);

      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Authentication Failed</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 1rem;
                backdrop-filter: blur(10px);
                max-width: 400px;
              }
              h1 { margin: 0 0 1rem 0; }
              p { margin: 0; opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Authentication Failed</h1>
              <p>Failed to authenticate with Figma. Please try again.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'figma-oauth-error', error: 'Token exchange failed' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    const userResponse = await fetch("https://api.figma.com/v1/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok || !userData.id) {
      console.error("Figma user fetch error:", userData);

      await serviceClient
        .from("oauth_pkce_state")
        .delete()
        .eq("id", pkceData.id);

      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Profile Fetch Failed</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 1rem;
                backdrop-filter: blur(10px);
                max-width: 400px;
              }
              h1 { margin: 0 0 1rem 0; }
              p { margin: 0; opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Profile Fetch Failed</h1>
              <p>Failed to fetch Figma profile. Please try again.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'figma-oauth-error', error: 'Profile fetch failed' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    const encryptedAccessToken = await encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token
      ? await encryptToken(tokenData.refresh_token)
      : "";

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 7776000));

    const { error: upsertError } = await serviceClient
      .from("figma_connections")
      .upsert({
        user_id: pkceData.user_id,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt.toISOString(),
        figma_user_id: userData.id,
        figma_user_email: userData.email,
      }, {
        onConflict: 'user_id'
      });

    await serviceClient
      .from("oauth_pkce_state")
      .delete()
      .eq("id", pkceData.id);

    if (upsertError) {
      console.error("Database upsert error:", upsertError);
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Save Failed</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 1rem;
                backdrop-filter: blur(10px);
                max-width: 400px;
              }
              h1 { margin: 0 0 1rem 0; }
              p { margin: 0; opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Save Failed</h1>
              <p>Failed to save Figma connection. Please try again.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'figma-oauth-error', error: 'Failed to save connection' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>`,
        {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Figma Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 1rem;
              backdrop-filter: blur(10px);
            }
            h1 {
              margin: 0 0 1rem 0;
              font-size: 2rem;
            }
            p {
              margin: 0;
              opacity: 0.9;
            }
            .checkmark {
              font-size: 4rem;
              margin-bottom: 1rem;
              animation: scale-in 0.3s ease-out;
            }
            @keyframes scale-in {
              from { transform: scale(0); }
              to { transform: scale(1); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✓</div>
            <h1>Successfully Connected!</h1>
            <p>Connected as ${userData.email || userData.handle || 'Figma User'}</p>
            <p style="margin-top: 0.5rem; font-size: 0.9rem;">This window will close automatically...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'figma-oauth-success',
                user: {
                  email: '${userData.email || ''}',
                  handle: '${userData.handle || ''}',
                  id: '${userData.id}'
                }
              }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 1rem;
              backdrop-filter: blur(10px);
              max-width: 400px;
            }
            h1 { margin: 0 0 1rem 0; }
            p { margin: 0; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Unexpected Error</h1>
            <p>An unexpected error occurred. Please try again.</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'figma-oauth-error', error: 'Unexpected error' }, '*');
            }
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
});
