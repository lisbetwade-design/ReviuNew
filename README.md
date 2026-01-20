reviu

## Required Secrets

The following secrets need to be configured in your Supabase project for full functionality:

### Figma Integration
- `FIGMA_CLIENT_ID` - Your Figma OAuth app client ID
- `FIGMA_CLIENT_SECRET` - Your Figma OAuth app client secret

To get these:
1. Go to https://www.figma.com/developers/apps
2. Create a new app or use an existing one
3. Set the callback URL to: `https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/figma-oauth-callback`

### Slack Integration
- `SLACK_CLIENT_ID` - Your Slack app client ID
- `SLACK_CLIENT_SECRET` - Your Slack app client secret

To get these:
1. Go to https://api.slack.com/apps
2. Create a new app or use an existing one
3. Set the redirect URL to: `https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/slack-oauth-callback`
4. Add the following OAuth scopes: `chat:write`, `channels:read`, `incoming-webhook`

### Optional
- `APP_URL` - Your application URL (defaults to http://localhost:5173)

### Frontend Environment Variables
Add to `.env`:
- `VITE_FIGMA_CLIENT_ID` - Same as FIGMA_CLIENT_ID above
- `VITE_SLACK_CLIENT_ID` - Same as SLACK_CLIENT_ID above
