const loadSlackChannels = async () => {
  try {
    const user = supabase.auth.user();
    const myToken = user?.access_token;

    // Logging for debugging purposes
    console.log("User:", user);
    console.log("JWT:", myToken);

    if (!myToken) {
      throw new Error("Unable to load token from Supabase auth or token is missing.");
    }

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
      throw new Error(errorMessage.message || "Failed to fetch slack channels");
    }

    const channels = await response.json();
    console.log("Slack channels loaded successfully:", channels);
    return channels;
  } catch (error) {
    console.error("Error loading channels:", error);
  }
};

const loadFeedback = async () => {
    try {
        const response = await fetch(
            'https://gqliajboufsrwkwezhvs.supabase.co/rest/v1/comments?select=id,design_id,author_email,content,rating,status,source_channel,source_channel_name,created_at,viewed_at,design:designs(name,source_url,project_id,project:projects(id,name))&order=created_at.desc',
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${supabase.auth.session()?.access_token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            console.error('Response error:', error);
            throw new Error(error.message || 'Failed to load feedback');
        }

        const feedbackData = await response.json();
        console.log('Feedback data loaded successfully:', feedbackData);
        return feedbackData;
    } catch (error) {
        console.error('Error loading feedback:', error);
    }
};

loadSlackChannels();
loadFeedback();
