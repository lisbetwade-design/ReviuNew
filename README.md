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

### GitHub Integration
- `GITHUB_CLIENT_ID` - Your GitHub OAuth app or GitHub App client ID
- `GITHUB_CLIENT_SECRET` - Your GitHub OAuth app or GitHub App client secret
- `GITHUB_APP_ID` - (Optional, if using GitHub App) Your GitHub App ID
- `GITHUB_PRIVATE_KEY` - (Optional, if using GitHub App) Your GitHub App private key
- `GITHUB_WEBHOOK_SECRET` - Secret for validating webhook payloads

To get these:
1. Go to https://github.com/settings/developers (for OAuth Apps) or https://github.com/settings/apps (for GitHub Apps)
2. Create a new OAuth App or GitHub App
3. Set the callback URL to: `https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/github-oauth-callback`
4. Set the webhook URL to: `https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/github-webhook`
5. Configure the following permissions:
   - **User Profile Access** (`read:user`) - Read user profile information (name, email, profile image)
   - **Repository Access** (`repo` scope) - Read file comments and repository contents
   - **Project Access** (`read:project`) - Read project structure, including private projects
   - **Webhook Management** (`admin:repo_hook`, `admin:org_hook`) - Read, create, modify, and delete webhooks

For detailed setup instructions, see [.github/GITHUB_INTEGRATION.md](.github/GITHUB_INTEGRATION.md)

### Optional
- `APP_URL` - Your application URL (defaults to https://reviu-jmxo.bolt.host)

### Frontend Environment Variables
Add to `.env`:
- `VITE_FIGMA_CLIENT_ID` - Same as FIGMA_CLIENT_ID above
- `VITE_SLACK_CLIENT_ID` - Same as SLACK_CLIENT_ID above
- `VITE_GITHUB_CLIENT_ID` - Same as GITHUB_CLIENT_ID above
