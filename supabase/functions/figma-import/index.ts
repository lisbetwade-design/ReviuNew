import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FigmaImportRequest {
  figmaUrl: string;
  projectId: string;
  designName?: string;
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

    const { figmaUrl, projectId, designName }: FigmaImportRequest = await req.json();

    // Get user's Figma token
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

    // Parse Figma URL to extract file key and node id
    const fileKeyMatch = figmaUrl.match(/file\/([a-zA-Z0-9]+)/);
    const nodeIdMatch = figmaUrl.match(/node-id=([^&]+)/);
    
    if (!fileKeyMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid Figma URL" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const fileKey = fileKeyMatch[1];
    const nodeId = nodeIdMatch ? decodeURIComponent(nodeIdMatch[1]) : null;

    // Fetch file metadata from Figma API
    const figmaApiUrl = `https://api.figma.com/v1/files/${fileKey}`;
    const figmaResponse = await fetch(figmaApiUrl, {
      headers: {
        "X-Figma-Token": profile.figma_token,
      },
    });

    if (!figmaResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch from Figma API. Check your token." }),
        {
          status: figmaResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const figmaData = await figmaResponse.json();
    
    // Get thumbnail URL
    let imageUrl = null;
    if (nodeId) {
      const imageResponse = await fetch(
        `https://api.figma.com/v1/images/${fileKey}?ids=${nodeId}&format=png&scale=2`,
        {
          headers: {
            "X-Figma-Token": profile.figma_token,
          },
        }
      );

      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        imageUrl = imageData.images?.[nodeId] || null;
      }
    }

    // Create design record
    const { data: design, error: designError } = await supabaseClient
      .from("designs")
      .insert({
        project_id: projectId,
        name: designName || figmaData.name || "Figma Design",
        source_type: "figma",
        source_url: figmaUrl,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (designError) {
      return new Response(
        JSON.stringify({ error: designError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, design }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
