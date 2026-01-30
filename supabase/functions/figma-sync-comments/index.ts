import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--31fc58ec.local-credentialless.webcontainer-api.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Other helper methods: getEncryptionKey, decryptToken, encryptToken (remains unchanged)

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    // Handle preflight response
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      // Return 401 if Authorization is missing
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: user, error: userError } = await supabaseClient.auth.getUser();
    if (!user || userError) {
      // Handle case where user lookup fails
      return new Response(JSON.stringify({ error: "Invalid token or user not authenticated" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Rest of the function logic remains unchanged - validate file_id, fetch Figma comments, and sync
  } catch (error) {
    console.error("Error syncing comments:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
