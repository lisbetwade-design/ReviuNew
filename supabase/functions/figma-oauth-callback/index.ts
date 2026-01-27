import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: "Missing code or state parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const clientId = Deno.env.get("FIGMA_CLIENT_ID");
    const clientSecret = Deno.env.get("FIGMA_CLIENT_SECRET");
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/figma-oauth-callback`;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Figma OAuth not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Figma OAuth error:", tokenData);
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with Figma" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const userId = state;

    const userResponse = await fetch("https://api.figma.com/v1/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    const { error: upsertError } = await supabaseClient
      .from("figma_connections")
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        figma_user_id: userData.id,
        figma_user_email: userData.email,
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error("Database upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save Figma connection" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://reviu-jmxo.bolt.host";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Figma Connected</title>
        </head>
        <body>
          <h1>Successfully connected to Figma!</h1>
          <p>You can close this window and return to the app.</p>
          <script>
            window.close();
            setTimeout(() => {
              window.location.href = '${appUrl}/settings';
            }, 2000);
          </script>
        </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
