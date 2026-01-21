import React, { useState, useEffect } from "react";

const loadSlackChannels = async () => {
  try {
    // Dynamically fetch your JWT (replace with your actual implementation)
    const token = await fetchJWT(); // Function to retrieve a valid JWT dynamically
    console.log("Using JWT:", token); // Debugging token

    const response = await fetch(
      "https://gqliajboufsrwkwezhvs.supabase.co/functions/v1/slack-channels",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`, // Add dynamically retrieved JWT
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

const fetchJWT = async (): Promise<string> => {
  // Replace this block with the logic to fetch/generate a JWT from your backend
  const response = await fetch("https://your-auth-api.com/generate-jwt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: "your-user-id", // Replace with your app's logic
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch JWT: " + response.status);
  }

  const data = await response.json();
  return data.token; // Extract token from API response
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