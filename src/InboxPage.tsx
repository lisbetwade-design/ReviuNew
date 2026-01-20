const checkAuthState = async () => {
  const { data: user, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Authentication state error:", error.message);
    return;
  }
  console.log("Authenticated user info:", user);
};

checkAuthState();

const loadSlackChannels = async () => {
  try {
    const user = supabase.auth.user();
    const myToken = user?.access_token;

    // Extended debug logs
    console.log("User Info:", user);
    console.log("Retrieved JWT Token:", myToken);

    if (!myToken) {
      throw new Error("Unable to retrieve a valid token. Please ensure the user is authenticated.");
    }

    console.log("Attempting to call Slack channels function with token:", myToken);

    const response = await fetch("https://gqliajboufsrwkwezhvs.supabase.co/functions/v1/slack-channels", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${myToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorMessage = await response.json();
      console.error("Response error:", errorMessage);
      throw new Error(errorMessage.message || "Failed to fetch Slack channels.");
    }

    const channels = await response.json();
    console.log("Slack channels successfully loaded:", channels);

    return channels; // Return loaded channels
  } catch (error) {
    console.error("Error loading Slack channels:", error);
  }
};

loadSlackChannels();