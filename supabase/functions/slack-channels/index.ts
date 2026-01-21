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
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header received:", authHeader ? "Present" : "Missing");

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

    console.log("User auth result:", {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message,
      errorStatus: userError?.status
    });

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          details: userError?.message,
          hint: "Your session may have expired. Try signing out and back in."
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("slack_access_token, slack_listening_channels")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.slack_access_token) {
      return new Response(
        JSON.stringify({ error: "Slack not connected" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "GET") {
      const channelsResponse = await fetch(
        "https://slack.com/api/conversations.list?types=public_channel,private_channel",
        {
          headers: {
            Authorization: `Bearer ${profile.slack_access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const channelsData = await channelsResponse.json();

      if (!channelsData.ok) {
        console.error("Slack API error:", channelsData);
        return new Response(
          JSON.stringify({
            error: channelsData.error || "Failed to fetch channels",
            details: channelsData
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const channels = (channelsData.channels || []).filter((ch: any) =>
        !ch.is_archived
      );

      return new Response(
        JSON.stringify({
          channels: channels,
          listening_channels: JSON.parse(profile.slack_listening_channels || "[]"),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "POST") {
      const { channels } = await req.json();

      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { error: updateError } = await serviceClient
        .from("profiles")
        .update({
          slack_listening_channels: JSON.stringify(channels),
        })
        .eq("id", user.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update channels" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
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
