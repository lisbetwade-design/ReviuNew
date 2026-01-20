// Updated loadSlackChannels function
async function loadSlackChannels() {
    try {
        const response = await fetch('https://api.supabase.io/v1/slack/channels', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${your_jwt_token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }

        const data = await response.json();
        console.log('Slack channels loaded successfully:', data);
        return data;
    } catch (error) {
        console.error('Error loading Slack channels:', error);
    }
}