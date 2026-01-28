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
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
      console.error("Auth error:", userError);
      console.error("User:", user);
      console.error("Auth header received:", authHeader);
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          details: userError?.message || "No user found"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { file_id } = await req.json();

    const { data: connection, error: connError } = await supabaseClient
      .from("figma_connections")
      .select("access_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "Figma not connected" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accessToken = await decryptToken(connection.access_token);

    const query = file_id
      ? supabaseClient.from("figma_tracked_files").select("*").eq("id", file_id).eq("user_id", user.id)
      : supabaseClient.from("figma_tracked_files").select("*").eq("user_id", user.id).eq("sync_enabled", true);

    const { data: trackedFiles, error: filesError } = await query;

    if (filesError || !trackedFiles || trackedFiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files to sync" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let totalCommentsSynced = 0;
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    for (const trackedFile of trackedFiles) {
      try {
        const commentsResponse = await fetch(
          `https://api.figma.com/v1/files/${trackedFile.file_key}/comments`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!commentsResponse.ok) {
          console.error(`Failed to fetch comments for ${trackedFile.file_key}:`, await commentsResponse.text());
          continue;
        }

        const commentsData = await commentsResponse.json();
        const comments = commentsData.comments || [];

        const { data: preferences } = await serviceClient
          .from("figma_sync_preferences")
          .select("*")
          .eq("tracked_file_id", trackedFile.id)
          .maybeSingle();

        const { data: existingDesign } = await serviceClient
          .from("designs")
          .select("id")
          .eq("project_id", trackedFile.project_id)
          .eq("source_type", "figma")
          .eq("source_url", trackedFile.file_url)
          .maybeSingle();

        let designId = existingDesign?.id;

        if (!designId) {
          const { data: newDesign, error: designError } = await serviceClient
            .from("designs")
            .insert({
              project_id: trackedFile.project_id,
              user_id: trackedFile.user_id,
              name: trackedFile.file_name,
              source_url: trackedFile.file_url,
              source_type: "figma",
            })
            .select()
            .single();

          if (designError) {
            console.error("Error creating design:", designError);
            continue;
          }

          designId = newDesign.id;
        }

        for (const comment of comments) {
          const shouldSync = !preferences ||
            (preferences.sync_all_comments ||
             (preferences.sync_unresolved_only && comment.resolved_at === null));

          if (!shouldSync) continue;

          const { data: existing } = await serviceClient
            .from("comments")
            .select("id")
            .eq("author_email", `figma:${comment.user?.id || "unknown"}`)
            .eq("design_id", designId)
            .eq("content", comment.message)
            .maybeSingle();

          if (existing) continue;

          await serviceClient.from("comments").insert({
            design_id: designId,
            project_id: trackedFile.project_id,
            created_by: trackedFile.user_id,
            content: comment.message,
            author_name: comment.user?.handle || "Anonymous",
            author_email: `figma:${comment.user?.id || "unknown"}`,
            status: comment.resolved_at ? "resolved" : "open",
            x_position: comment.client_meta?.x || 0,
            y_position: comment.client_meta?.y || 0,
            source_channel: "figma",
          });

          totalCommentsSynced++;
        }

        await serviceClient
          .from("figma_tracked_files")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", trackedFile.id);
      } catch (error) {
        console.error(`Error syncing file ${trackedFile.file_key}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        files_synced: trackedFiles.length,
        comments_synced: totalCommentsSynced,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
