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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("figma_token")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.figma_token) {
      return new Response(
        JSON.stringify({ error: "Figma token not configured. Please add it in Settings." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const commentsUrl = `https://api.figma.com/v1/files/${fileKey}/comments`;
    const figmaResponse = await fetch(commentsUrl, {
      headers: {
        "X-Figma-Token": profile.figma_token,
      },
    });

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
            project_id: design.project_id,
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