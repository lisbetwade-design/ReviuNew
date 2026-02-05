import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

async function decryptToken(encryptedToken: string): Promise<string> {
  if (!encryptedToken) return '';
  
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error('Token decryption failed:', error);
    throw new Error('Failed to decrypt token');
  }
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client for user authentication (validates user JWT)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Create admin client for database operations (uses service role)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("JWT verification failed:", {
        userError: userError?.message,
        hasUser: !!user,
        authHeader: authHeader.substring(0, 20) + "..."
      });
      return new Response(JSON.stringify({
        error: "Invalid JWT",
        details: userError?.message || "No user found"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("Received request body:", body);

    let { file_key, project_id } = body;
    const { file_id } = body;

    if (file_id && !file_key) {
      const { data: fileRecord, error: lookupError } = await supabaseAdmin
        .from('figma_tracked_files')
        .select('file_key, project_id')
        .eq('id', file_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (lookupError || !fileRecord) {
        return new Response(JSON.stringify({
          error: "File not found",
          file_id
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      file_key = fileRecord.file_key;
      if (!project_id) {
        project_id = fileRecord.project_id;
      }
    }

    if (!file_key) {
      console.error("Missing file_key in body:", body);
      return new Response(JSON.stringify({
        error: "Missing file_key or file_id",
        received: body
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use admin client for database queries
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("figma_connections")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connectionError || !connection) {
      return new Response(JSON.stringify({ error: "Figma not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = await decryptToken(connection.access_token);
    const refreshToken = connection.refresh_token ? await decryptToken(connection.refresh_token) : null;
    const expiresAt = new Date(connection.expires_at);
    const now = new Date();

    if (expiresAt <= now && refreshToken) {
      const clientId = Deno.env.get("FIGMA_CLIENT_ID");
      const clientSecret = Deno.env.get("FIGMA_CLIENT_SECRET");

      if (clientId && clientSecret) {
        const refreshResponse = await fetch("https://api.figma.com/v1/oauth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
          }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          accessToken = refreshData.access_token;

          await supabaseAdmin
            .from("figma_connections")
            .update({
              access_token: await encryptToken(refreshData.access_token),
              refresh_token: refreshData.refresh_token ? await encryptToken(refreshData.refresh_token) : null,
              expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)),
            })
            .eq("user_id", user.id);
        } else {
          return new Response(JSON.stringify({ error: "Figma authentication expired. Please reconnect." }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const figmaCommentsResponse = await fetch(
      `https://api.figma.com/v1/files/${file_key}/comments`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    if (!figmaCommentsResponse.ok) {
      const errorText = await figmaCommentsResponse.text();
      return new Response(JSON.stringify({ error: "Failed to fetch Figma comments", details: errorText }), {
        status: figmaCommentsResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const figmaData = await figmaCommentsResponse.json();
    const figmaComments = figmaData.comments || [];

    const { data: existingComments } = await supabaseAdmin
      .from("comments")
      .select("id, figma_comment_id")
      .eq("source_channel", "figma")
      .not("figma_comment_id", "is", null);

    const existingFigmaIds = new Set(
      (existingComments || []).map((c: any) => c.figma_comment_id)
    );

    let addedCount = 0;
    let skippedCount = 0;

    for (const comment of figmaComments) {
      if (existingFigmaIds.has(comment.id)) {
        skippedCount++;
        continue;
      }

      const { error: insertError } = await supabaseAdmin
        .from("comments")
        .insert({
          project_id: project_id || null,
          author_name: comment.user?.handle || "Figma User",
          author_email: comment.user?.email || "figma@figma.com",
          content: comment.message,
          position_x: comment.client_meta?.x || 0,
          position_y: comment.client_meta?.y || 0,
          source_channel: "figma",
          figma_comment_id: comment.id,
          created_by: user.id,
        });

      if (!insertError) {
        addedCount++;
      }
    }

    await supabaseAdmin
      .from('figma_tracked_files')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('file_key', file_key)
      .eq('user_id', user.id);

    return new Response(JSON.stringify({
      success: true,
      message: "Sync completed successfully",
      syncedCount: addedCount,
      summary: {
        added: addedCount,
        skipped: skippedCount,
        total: figmaComments.length,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error syncing comments:", error);
    return new Response(JSON.stringify({
      error: error.message || "Internal server error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});