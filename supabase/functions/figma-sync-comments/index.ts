import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncCommentsRequest {
  file_id: string;
}

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
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({
        error: "Unauthorized",
        details: userError?.message || "Invalid token"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file_id }: SyncCommentsRequest = await req.json();

    const { data: trackedFile, error: trackedFileError } = await supabaseClient
      .from("figma_tracked_files")
      .select("*")
      .eq("id", file_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (trackedFileError || !trackedFile) {
      return new Response(
        JSON.stringify({ error: "Tracked file not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!trackedFile.project_id) {
      return new Response(
        JSON.stringify({ error: "Tracked file must be associated with a project" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let designId = null;
    const { data: existingDesign } = await supabaseClient
      .from("designs")
      .select("id")
      .eq("project_id", trackedFile.project_id)
      .eq("source_url", trackedFile.file_url)
      .maybeSingle();

    if (existingDesign) {
      designId = existingDesign.id;
    } else {
      const { data: newDesign, error: createError } = await supabaseClient
        .from("designs")
        .insert({
          project_id: trackedFile.project_id,
          name: trackedFile.file_name,
          source_type: "figma",
          source_url: trackedFile.file_url,
        })
        .select("id")
        .single();

      if (createError || !newDesign) {
        return new Response(
          JSON.stringify({ error: "Failed to create design" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      designId = newDesign.id;
    }

    const fileKey = trackedFile.file_key;

    const { data: figmaConnection, error: connectionError } = await supabaseClient
      .from("figma_connections")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connectionError || !figmaConnection?.access_token) {
      return new Response(
        JSON.stringify({ error: "Figma not connected. Please connect your Figma account in Settings." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let accessToken = await decryptToken(figmaConnection.access_token);
    const refreshToken = figmaConnection.refresh_token ? await decryptToken(figmaConnection.refresh_token) : null;
    const expiresAt = new Date(figmaConnection.expires_at);
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
          if (refreshData.access_token) {
            accessToken = refreshData.access_token;

            await supabaseClient
              .from("figma_connections")
              .update({
                access_token: await encryptToken(refreshData.access_token),
                refresh_token: refreshData.refresh_token ? await encryptToken(refreshData.refresh_token) : figmaConnection.refresh_token,
                expires_at: new Date(Date.now() + (refreshData.expires_in || 7776000) * 1000).toISOString(),
              })
              .eq("user_id", user.id);
          }
        }
      }
    }

    const commentsUrl = `https://api.figma.com/v1/files/${fileKey}/comments`;
    let figmaResponse = await fetch(commentsUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!figmaResponse.ok && refreshToken) {
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
          if (refreshData.access_token) {
            accessToken = refreshData.access_token;

            await supabaseClient
              .from("figma_connections")
              .update({
                access_token: await encryptToken(refreshData.access_token),
                refresh_token: refreshData.refresh_token ? await encryptToken(refreshData.refresh_token) : figmaConnection.refresh_token,
                expires_at: new Date(Date.now() + (refreshData.expires_in || 7776000) * 1000).toISOString(),
              })
              .eq("user_id", user.id);

            figmaResponse = await fetch(commentsUrl, {
              headers: {
                "Authorization": `Bearer ${accessToken}`,
              },
            });
          }
        }
      }
    }

    if (!figmaResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch comments from Figma API" }),
        {
          status: figmaResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { comments } = await figmaResponse.json();

    let syncedCount = 0;
    const errors = [];

    for (const comment of comments || []) {
      try {
        const { data: existingComment } = await supabaseClient
          .from("comments")
          .select("id")
          .eq("design_id", designId)
          .eq("author_email", `figma:${comment.user?.id || "unknown"}`)
          .eq("content", comment.message)
          .maybeSingle();

        if (existingComment) {
          continue;
        }

        const { error: insertError } = await supabaseClient
          .from("comments")
          .insert({
            design_id: designId,
            project_id: trackedFile.project_id,
            user_id: user.id,
            created_by: user.id,
            content: comment.message,
            author_name: comment.user?.handle || "Figma User",
            author_email: `figma:${comment.user?.id || "unknown"}`,
            status: comment.resolved ? "resolved" : "open",
            x_position: comment.client_meta?.x || 0,
            y_position: comment.client_meta?.y || 0,
          });

        if (insertError) {
          errors.push({ comment: comment.message, error: insertError.message });
          console.error("Error syncing comment:", insertError);
        } else {
          syncedCount++;
        }
      } catch (error) {
        errors.push({ comment: comment.message, error: error.message });
        console.error("Error processing comment:", error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount,
        totalComments: comments?.length || 0,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error syncing comments:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});