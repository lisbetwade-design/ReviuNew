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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error("User verification failed:", userError?.message || "No user found");
      return new Response(JSON.stringify({
        error: "Unauthorized",
        details: userError?.message || "Invalid token"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const action = url.searchParams.get("action");

      if (action === "file-info") {
        const fileUrl = url.searchParams.get("url");
        if (!fileUrl) {
          return new Response(JSON.stringify({ error: "Missing file URL" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const fileKeyMatch = fileUrl.match(/(?:file|design)\/([a-zA-Z0-9]+)/);
        if (!fileKeyMatch) {
          return new Response(JSON.stringify({ error: "Invalid Figma URL" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const fileKey = fileKeyMatch[1];

        const { data: connection } = await supabaseClient
          .from("figma_connections")
          .select("access_token, refresh_token, expires_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!connection) {
          return new Response(JSON.stringify({ error: "Figma not connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let accessToken = connection.access_token;
        const expiresAt = new Date(connection.expires_at);
        const now = new Date();

        if (expiresAt <= now && connection.refresh_token) {
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
                refresh_token: connection.refresh_token,
              }),
            });

            if (refreshResponse.ok) {
              const tokenData = await refreshResponse.json();
              accessToken = tokenData.access_token;

              await supabaseClient
                .from("figma_connections")
                .update({
                  access_token: tokenData.access_token,
                  expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
                })
                .eq("user_id", user.id);
            } else {
              return new Response(JSON.stringify({ error: "Figma token expired. Please reconnect your Figma account." }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        }

        console.log("Attempting to fetch Figma file:", fileKey);
        let fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!fileResponse.ok) {
          const errorData = await fileResponse.json();
          console.error("Figma API error:", fileResponse.status, errorData);

          if ((errorData.err === "Invalid token" || errorData.status === 403) && connection.refresh_token) {
            console.log("Token invalid, attempting refresh...");
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
                  refresh_token: connection.refresh_token,
                }),
              });

              const refreshData = await refreshResponse.json();
              console.log("Refresh response:", refreshResponse.status, refreshData);

              if (refreshResponse.ok && refreshData.access_token) {
                accessToken = refreshData.access_token;

                await supabaseClient
                  .from("figma_connections")
                  .update({
                    access_token: refreshData.access_token,
                    refresh_token: refreshData.refresh_token || connection.refresh_token,
                    expires_at: new Date(Date.now() + (refreshData.expires_in || 7776000) * 1000).toISOString(),
                  })
                  .eq("user_id", user.id);

                console.log("Token refreshed, retrying file fetch...");
                fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                });

                if (fileResponse.ok) {
                  const fileData = await fileResponse.json();
                  return new Response(JSON.stringify({
                    file_key: fileKey,
                    file_name: fileData.name,
                    file_url: fileUrl,
                  }), {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
              } else {
                console.error("Token refresh failed:", refreshData);
                return new Response(JSON.stringify({
                  error: "Figma authentication expired. Please reconnect your Figma account in Settings.",
                  details: refreshData.error || "Refresh token invalid"
                }), {
                  status: 401,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
          }

          const errorMessage = errorData.err === "Invalid token" || errorData.status === 403
            ? "Figma token is invalid or has been revoked. Please disconnect and reconnect your Figma account in Settings."
            : errorData.err || errorData.message || "Failed to fetch file info";
          return new Response(JSON.stringify({ error: errorMessage, details: errorData }), {
            status: fileResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const fileData = await fileResponse.json();

        return new Response(JSON.stringify({
          file_key: fileKey,
          file_name: fileData.name,
          file_url: fileUrl,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: trackedFiles, error } = await supabaseClient
        .from("figma_tracked_files")
        .select(`
          *,
          project:projects(id, name),
          preferences:figma_sync_preferences(*)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ files: trackedFiles }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const { file_key, file_name, file_url, project_id, preferences } = await req.json();

      if (!file_key || !file_name || !file_url || !project_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: trackedFile, error: insertError } = await supabaseClient
        .from("figma_tracked_files")
        .insert({
          user_id: user.id,
          project_id,
          file_key,
          file_name,
          file_url,
          sync_enabled: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (preferences) {
        await supabaseClient
          .from("figma_sync_preferences")
          .insert({
            user_id: user.id,
            tracked_file_id: trackedFile.id,
            ...preferences,
          });
      }

      return new Response(JSON.stringify({ success: true, file: trackedFile }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const fileId = url.searchParams.get("id");

      if (!fileId) {
        return new Response(JSON.stringify({ error: "Missing file ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseClient
        .from("figma_tracked_files")
        .delete()
        .eq("id", fileId)
        .eq("user_id", user.id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
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
