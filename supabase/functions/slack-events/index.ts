import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Type definitions
interface Profile {
  id: string;
  slack_team_id: string;
  slack_listening_channels: string;
  slack_access_token: string | null;
}

interface SlackEvent {
  type: string;
  channel: string;
  user: string;
  text: string;
  bot_id?: string;
  subtype?: string;
}

interface SlackPayload {
  type: string;
  challenge?: string;
  team_id?: string;
  event?: SlackEvent;
}

// Helper function to fetch profiles by team ID
async function fetchProfiles(
  supabaseClient: SupabaseClient,
  teamId: string
): Promise<Profile[]> {
  console.log(`[DB] Fetching profiles for team_id: ${teamId}`);
  
  const { data: profiles, error } = await supabaseClient
    .from("profiles")
    .select("id, slack_team_id, slack_listening_channels, slack_access_token")
    .eq("slack_team_id", teamId);

  if (error) {
    console.error(`[DB] Error fetching profiles:`, error);
    throw error;
  }

  console.log(`[DB] Found ${profiles?.length || 0} profile(s)`);
  return profiles || [];
}

// Helper function to batch fetch Slack channel information
async function fetchChannelNames(
  channelIds: string[],
  accessToken: string
): Promise<Map<string, string>> {
  const channelMap = new Map<string, string>();

  console.log(`[Slack API] Batch fetching info for ${channelIds.length} channel(s): ${channelIds.join(", ")}`);

  // Fetch channel info for each unique channel
  const promises = channelIds.map(async (channelId) => {
    try {
      const response = await fetch(
        `https://slack.com/api/conversations.info?channel=${channelId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const channelInfo = await response.json();

      if (channelInfo.ok && channelInfo.channel) {
        const channelName = channelInfo.channel.name;
        channelMap.set(channelId, channelName);
        console.log(`[Slack API] Channel ${channelId} -> ${channelName}`);
      } else {
        console.warn(`[Slack API] Failed to fetch info for channel ${channelId}:`, channelInfo.error);
        channelMap.set(channelId, channelId); // Fallback to channel ID
      }
    } catch (error) {
      console.error(`[Slack API] Error fetching channel ${channelId}:`, error);
      channelMap.set(channelId, channelId); // Fallback to channel ID
    }
  });

  await Promise.all(promises);
  return channelMap;
}

// Helper function to fetch Slack user information
async function fetchUserName(
  userId: string,
  accessToken: string
): Promise<string> {
  console.log(`[Slack API] Fetching user info for ${userId}`);

  try {
    const response = await fetch(
      `https://slack.com/api/users.info?user=${userId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const userInfo = await response.json();

    if (userInfo.ok && userInfo.user) {
      // Try to get real name first, fall back to display name, then username
      const name = userInfo.user.real_name ||
                   userInfo.user.profile?.display_name ||
                   userInfo.user.name ||
                   userId;
      console.log(`[Slack API] User ${userId} -> ${name}`);
      return name;
    } else {
      console.warn(`[Slack API] Failed to fetch info for user ${userId}:`, userInfo.error);
      return userId; // Fallback to user ID
    }
  } catch (error) {
    console.error(`[Slack API] Error fetching user ${userId}:`, error);
    return userId; // Fallback to user ID
  }
}

// Helper function to insert a comment
async function insertComment(
  supabaseClient: SupabaseClient,
  userId: string,
  event: SlackEvent,
  channelName: string,
  userName: string
): Promise<void> {
  console.log(`[DB] Inserting Slack message from user ${userName} to inbox`);

  const { error } = await supabaseClient.from("comments").insert({
    created_by: userId,
    author_name: userName,
    author_email: `slack-${event.user}@slack.com`,
    content: event.text,
    status: "open",
    source_channel: event.channel,
    source_channel_name: channelName,
  });

  if (error) {
    console.error(`[DB] Error inserting comment:`, error);
    throw error;
  }

  console.log(`[DB] Successfully inserted Slack message from channel ${channelName}`);
}

// Helper function to create consistent JSON response
function createJsonResponse(data: unknown, status: number): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("[Request] CORS preflight request");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Parse and log incoming payload
    const body: SlackPayload = await req.json();
    console.log(`[Request] Received Slack event type: ${body.type}`);
    
    // Log sanitized payload (exclude sensitive data)
    const sanitizedPayload = {
      type: body.type,
      team_id: body.team_id,
      event: body.event ? {
        type: body.event.type,
        channel: body.event.channel,
        user: body.event.user,
        // Exclude message text for privacy
      } : undefined
    };
    console.log(`[Payload] Sanitized payload:`, JSON.stringify(sanitizedPayload, null, 2));

    // Handle Slack URL verification challenge
    if (body.type === "url_verification") {
      console.log(`[Slack] URL verification challenge: ${body.challenge}`);
      return createJsonResponse({ challenge: body.challenge }, 200);
    }

    // Handle event callbacks
    if (body.type === "event_callback") {
      const event = body.event;

      if (!event) {
        console.warn("[Event] No event found in callback");
        return createJsonResponse({ ok: true }, 200);
      }

      console.log(`[Event] Event type: ${event.type}, Channel: ${event.channel}`);

      // Process message events (excluding bot messages and subtypes)
      if (event.type === "message" && !event.bot_id && !event.subtype) {
        console.log(`[Event] Processing message from user ${event.user} in channel ${event.channel}`);

        // Initialize Supabase client
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Fetch profiles for the team
        const profiles = await fetchProfiles(supabaseClient, body.team_id || "");

        if (profiles.length === 0) {
          console.log("[Processing] No profiles found for team, skipping");
          return createJsonResponse({ ok: true }, 200);
        }

        // Collect unique channels that need info fetching
        const channelsToFetch = new Set<string>();
        const profilesListeningToChannel: Array<{ profile: Profile; listeningChannels: string[] }> = [];

        // First pass: determine which profiles are listening and collect channels
        for (const profile of profiles) {
          if (!profile.slack_listening_channels) {
            console.log(`[Processing] Profile ${profile.id} has no listening channels`);
            continue;
          }

          try {
            const listeningChannels = JSON.parse(profile.slack_listening_channels || "[]");
            console.log(`[Processing] Profile ${profile.id} listening to channels: ${listeningChannels.join(", ")}`);

            if (listeningChannels.includes(event.channel)) {
              console.log(`[Processing] Profile ${profile.id} is listening to channel ${event.channel}`);
              profilesListeningToChannel.push({ profile, listeningChannels });
              channelsToFetch.add(event.channel);
            }
          } catch (error) {
            console.error(`[Processing] Error parsing listening channels for profile ${profile.id}:`, error);
            continue;
          }
        }

        if (profilesListeningToChannel.length === 0) {
          console.log("[Processing] No profiles listening to this channel, skipping");
          return createJsonResponse({ ok: true }, 200);
        }

        // Second pass: process each profile and insert comments
        for (const { profile } of profilesListeningToChannel) {
          try {
            console.log(`[Processing] Processing message for profile ${profile.id}`);

            // Fetch channel name and user name using this profile's access token
            let channelName = event.channel;
            let userName = event.user || "Slack User";

            if (profile.slack_access_token) {
              const channelMap = await fetchChannelNames(
                [event.channel],
                profile.slack_access_token
              );
              channelName = channelMap.get(event.channel) || event.channel;

              // Fetch the actual user's name
              userName = await fetchUserName(event.user, profile.slack_access_token);
            } else {
              console.warn(`[Processing] No access token for profile ${profile.id}, using channel ID and user ID`);
            }

            await insertComment(supabaseClient, profile.id, event, channelName, userName);

            console.log(`[Processing] Successfully processed message for profile ${profile.id}`);
          } catch (error) {
            console.error(`[Processing] Error processing profile ${profile.id}:`, error);
            // Continue processing other profiles even if one fails
          }
        }

        console.log("[Processing] Completed processing all profiles");
      } else {
        console.log(`[Event] Skipping event - bot_id: ${event.bot_id}, subtype: ${event.subtype}`);
      }
    }

    return createJsonResponse({ ok: true }, 200);
  } catch (error) {
    console.error("[Error] Unhandled error:", error);
    console.error("[Error] Stack trace:", error.stack);
    
    return createJsonResponse(
      { 
        error: error.message || "Internal server error",
        ok: false 
      },
      500
    );
  }
});
