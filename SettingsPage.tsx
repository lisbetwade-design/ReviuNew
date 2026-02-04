import React, { useState, useEffect } from "react";
import { supabase } from "./src/lib/supabase";

const loadSlackChannels = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error("Not authenticated - please sign in");
    }

    console.log("Using JWT from Supabase session");

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-channels`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Unauthorized - Your token is invalid or expired.");
      } else {
        throw new Error(`Error loading channels. Server error: ${response.status}`);
      }
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error during API request:", error.message || "Unknown error");
    throw error;
  }
};

// Main Component
const SettingsPage = () => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSlackChannels = async () => {
      setLoading(true);
      setError(null);

      try {
        const fetchedChannels = await loadSlackChannels();
        setChannels(fetchedChannels);
      } catch (err: any) {
        setError(err.message || "Failed to load channels.");
      } finally {
        setLoading(false);
      }
    };

    fetchSlackChannels();
  }, []); // Load channels on component mount

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Slack Channels</h1>
      {error && <div style={{ color: "red" }}>Error: {error}</div>}
      <ul>
        {channels.map((channel: any, index) => (
          <li key={index}>{channel.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default SettingsPage;