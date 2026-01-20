import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SlackNotifyRequest {
  commentId: string;
  designId: string;
  authorName: string;
  content: string;
  rating?: number;
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { commentId, designId, authorName, content, rating }: SlackNotifyRequest = await req.json();

    // Get design and project info
    const { data: design, error: designError } = await supabaseClient
      .from("designs")
      .select("name, project_id, projects(name, user_id)")
      .eq("id", designId)
      .maybeSingle();

    if (designError || !design) {
      return new Response(
        JSON.stringify({ error: "Design not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get project owner's Slack settings
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("slack_webhook_url, slack_channel")
      .eq("id", design.projects.user_id)
      .maybeSingle();

    if (profileError || !profile?.slack_webhook_url) {
      return new Response(
        JSON.stringify({ success: false, message: "Slack not configured" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare Slack message
    const ratingText = rating ? ` (${"⭐".repeat(rating)})` : "";
    const slackMessage = {
      channel: profile.slack_channel || "#design-feedback",
      username: "Reviu",
      icon_emoji: ":art:",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `New Feedback on ${design.name}${ratingText}`,
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Project:*\n${design.projects.name}`,
            },
            {
              type: "mrkdwn",
              text: `*From:*\n${authorName}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Feedback:*\n${content}`,
          },
        },
        {
          type: "divider",
        },
      ],
    };

    // Send to Slack
    const slackResponse = await fetch(profile.slack_webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    if (!slackResponse.ok) {
      console.error("Slack notification failed:", await slackResponse.text());
      return new Response(
        JSON.stringify({ success: false, message: "Failed to send Slack notification" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Slack notification sent" }),
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
