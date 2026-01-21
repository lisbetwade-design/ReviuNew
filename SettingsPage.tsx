import React, { useState, useEffect } from "react";

// Function to fetch Slack Channels using a JWT
const loadSlackChannels = async (token: string) => {
  try {
    const response = await fetch("https://your-api.com/slack/channels", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Unauthorized error - JWT might be invalid or expired
        throw new Error("Unauthorized - Your token is invalid or expired. Please refresh your session.");
      } else {
        throw new Error(`Error loading channels. Server responded with status: ${response.status}`);
      }
    }

    // Return the response as JSON
    return await response.json();
  } catch (error: any) {
    console.error("Error during API request:", error.message || "Unknown error");
    throw error;
  }
};

// Main SettingsPage Component
const SettingsPage = () => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSlackChannels = async () => {
      setLoading(true);
      setError(null);

      try {
        // Replace this with your dynamically generated JWT or hook into your authentication flow
        const jwtToken = "your-new-jwt"; // TODO: Replace with dynamic token retrieval
        const fetchedChannels = await loadSlackChannels(jwtToken);
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