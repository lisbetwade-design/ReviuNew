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
    const payload = await req.json();
    console.log("Received Figma webhook:", JSON.stringify(payload, null, 2));

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (payload.event_type === "FILE_COMMENT") {
      const fileKey = payload.file_key;
      const comment = payload.comment;

      const { data: trackedFile, error: fileError } = await supabaseClient
        .from("figma_tracked_files")
        .select("*, figma_connections!inner(access_token, user_id)")
        .eq("file_key", fileKey)
        .eq("sync_enabled", true)
        .maybeSingle();

      if (fileError || !trackedFile) {
        console.log("File not tracked or error:", fileError);
        return new Response(JSON.stringify({ message: "File not tracked" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: preferences } = await supabaseClient
        .from("figma_sync_preferences")
        .select("*")
        .eq("tracked_file_id", trackedFile.id)
        .maybeSingle();

      const shouldSync = !preferences ||
        (preferences.sync_all_comments ||
         (preferences.sync_unresolved_only && !comment.resolved));

      if (!shouldSync) {
        return new Response(JSON.stringify({ message: "Comment filtered by preferences" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: design } = await supabaseClient
        .from("designs")
        .select("id")
        .eq("project_id", trackedFile.project_id)
        .eq("name", trackedFile.file_name)
        .maybeSingle();

      let designId = design?.id;

      if (!designId) {
        const { data: newDesign, error: designError } = await supabaseClient
          .from("designs")
          .insert({
            project_id: trackedFile.project_id,
            user_id: trackedFile.user_id,
            name: trackedFile.file_name,
            file_url: trackedFile.file_url,
            source_type: "figma",
          })
          .select()
          .single();

        if (designError) {
          console.error("Error creating design:", designError);
          throw designError;
        }

        designId = newDesign.id;
      }

      const { error: commentError } = await supabaseClient
        .from("comments")
        .insert({
          design_id: designId,
          content: comment.message,
          author_name: comment.user?.handle || "Anonymous",
          author_email: `figma:${comment.user?.id || "unknown"}`,
          status: comment.resolved ? "resolved" : "open",
          x_position: comment.client_meta?.x || 0,
          y_position: comment.client_meta?.y || 0,
        });

      if (commentError) {
        console.error("Error creating comment:", commentError);
        throw commentError;
      }

      await supabaseClient
        .from("figma_tracked_files")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", trackedFile.id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Event type not handled" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
