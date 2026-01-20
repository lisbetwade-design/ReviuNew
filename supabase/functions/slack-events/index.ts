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
    const body = await req.json();

    if (body.type === "url_verification") {
      return new Response(
        JSON.stringify({ challenge: body.challenge }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (body.type === "event_callback") {
      const event = body.event;

      if (event.type === "message" && !event.bot_id && !event.subtype) {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: profiles } = await supabaseClient
          .from("profiles")
          .select("id, slack_team_id, slack_listening_channels")
          .eq("slack_team_id", body.team_id);

        if (!profiles || profiles.length === 0) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        for (const profile of profiles) {
          if (!profile.slack_listening_channels) continue;

          const listeningChannels = JSON.parse(profile.slack_listening_channels || "[]");

          if (listeningChannels.includes(event.channel)) {
            const { data: projects } = await supabaseClient
              .from("projects")
              .select("id, name")
              .eq("user_id", profile.id)
              .limit(1)
              .maybeSingle();

            if (projects) {
              const { data: slackDesign } = await supabaseClient
                .from("designs")
                .select("id")
                .eq("project_id", projects.id)
                .eq("name", "Slack Inbox")
                .maybeSingle();

              let designId = slackDesign?.id;

              if (!designId) {
                const { data: newDesign } = await supabaseClient
                  .from("designs")
                  .insert({
                    project_id: projects.id,
                    name: "Slack Inbox",
                    source_type: "slack",
                    source_url: null,
                  })
                  .select("id")
                  .single();

                designId = newDesign?.id;
              }

              if (designId) {
                await supabaseClient.from("comments").insert({
                  design_id: designId,
                  author_name: event.user || "Slack User",
                  author_email: `slack-${event.user}@slack.com`,
                  content: event.text,
                  status: "open",
                });
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
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
