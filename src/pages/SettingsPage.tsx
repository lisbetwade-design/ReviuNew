import { useState, useEffect } from 'react';
import { User, Link2, Settings as SettingsIcon, Save, Key, CreditCard, CheckCircle, XCircle, Hash } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { AddFigmaFileModal } from '../components/AddFigmaFileModal';
import { supabase } from '../lib/supabase';

type Tab = 'profile' | 'integrations' | 'settings' | 'subscription';

interface ProfileData {
  email: string;
  full_name: string;
  figma_token: string;
  slack_webhook_url: string;
  slack_channel: string;
  slack_access_token: string;
  slack_team_name: string;
  slack_connected_at: string;
  slack_listening_channels: string;
}

interface FigmaConnection {
  id: string;
  figma_user_email: string;
  created_at: string;
}

interface FigmaTrackedFile {
  id: string;
  file_key: string;
  file_name: string;
  file_url: string;
  project_id: string;
  sync_enabled: boolean;
  last_synced_at: string | null;
  project?: {
    id: string;
    name: string;
  };
}

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    email: '',
    full_name: '',
    figma_token: '',
    slack_webhook_url: '',
    slack_channel: '',
    slack_access_token: '',
    slack_team_name: '',
    slack_connected_at: '',
    slack_listening_channels: '',
  });
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [showChannelSelector, setShowChannelSelector] = useState(false);
  const [figmaConnection, setFigmaConnection] = useState<FigmaConnection | null>(null);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [trackedFiles, setTrackedFiles] = useState<FigmaTrackedFile[]>([]);

  useEffect(() => {
    loadProfile();
    loadFigmaConnection();
    loadTrackedFiles();
  }, []);

  useEffect(() => {
    if (profileData.slack_access_token && selectedChannels.length > 0 && slackChannels.length === 0) {
      loadSlackChannelsQuietly();
    }
  }, [profileData.slack_access_token, selectedChannels.length]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfileData({
          email: data.email || '',
          full_name: data.full_name || '',
          figma_token: data.figma_token || '',
          slack_webhook_url: data.slack_webhook_url || '',
          slack_channel: data.slack_channel || '',
          slack_access_token: data.slack_access_token || '',
          slack_team_name: data.slack_team_name || '',
          slack_connected_at: data.slack_connected_at || '',
          slack_listening_channels: data.slack_listening_channels || '',
        });

        if (data.slack_listening_channels) {
          try {
            setSelectedChannels(JSON.parse(data.slack_listening_channels));
          } catch (e) {
            setSelectedChannels([]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFigmaConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('figma_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setFigmaConnection(data);
    } catch (error) {
      console.error('Error loading Figma connection:', error);
    }
  };

  const loadTrackedFiles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('figma_tracked_files')
        .select(`
          *,
          project:projects(id, name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrackedFiles(data || []);
    } catch (error) {
      console.error('Error loading tracked files:', error);
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to stop tracking this file?')) return;

    try {
      const { error } = await supabase
        .from('figma_tracked_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      await loadTrackedFiles();
      alert('File removed successfully!');
    } catch (error) {
      console.error('Error removing file:', error);
      alert('Failed to remove file. Please try again.');
    }
  };

  const handleConnectFigma = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        alert('Please sign in to connect Figma.');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/figma-oauth-start`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OAuth start error:', response.status, errorText);
        let errorMessage = 'Failed to start Figma OAuth';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const { authorization_url } = await response.json();

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authorization_url,
        'Figma OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'figma-oauth-success') {
          window.removeEventListener('message', handleMessage);
          if (popup && !popup.closed) {
            popup.close();
          }
          loadFigmaConnection();
          alert('Successfully connected to Figma!');
        } else if (event.data?.type === 'figma-oauth-error') {
          window.removeEventListener('message', handleMessage);
          alert(`Figma connection failed: ${event.data.error}`);
        }
      };

      window.addEventListener('message', handleMessage);

      const pollInterval = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(pollInterval);
          window.removeEventListener('message', handleMessage);
          loadFigmaConnection();
        }
      }, 500);

      setTimeout(() => {
        clearInterval(pollInterval);
        window.removeEventListener('message', handleMessage);
      }, 300000);
    } catch (error) {
      console.error('Error connecting to Figma:', error);
      alert(`Failed to connect to Figma: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  const handleDisconnectFigma = async () => {
    if (!confirm('Are you sure you want to disconnect Figma? This will stop tracking all files.')) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('figma_connections')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      const { error: tokenError } = await supabase
        .from('profiles')
        .update({ figma_token: null })
        .eq('id', user.id);

      if (tokenError) console.error('Error clearing token:', tokenError);

      setFigmaConnection(null);
      setProfileData({ ...profileData, figma_token: '' });
      alert('Figma disconnected successfully!');
    } catch (error) {
      console.error('Error disconnecting Figma:', error);
      alert('Failed to disconnect Figma. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMcpToken = async () => {
    if (!confirm('Are you sure you want to remove your Figma MCP token?')) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ figma_token: null })
        .eq('id', user.id);

      if (error) throw error;

      setProfileData({ ...profileData, figma_token: '' });
      alert('MCP token removed successfully!');
    } catch (error) {
      console.error('Error removing MCP token:', error);
      alert('Failed to remove MCP token. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          figma_token: profileData.figma_token,
          slack_webhook_url: profileData.slack_webhook_url,
          slack_channel: profileData.slack_channel,
        })
        .eq('id', user.id);

      if (error) throw error;

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      alert('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Failed to change password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleConnectSlack = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const clientId = import.meta.env.VITE_SLACK_CLIENT_ID;
      const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-oauth-callback`;

      const scopes = [
        'incoming-webhook',
        'chat:write',
        'channels:read',
        'channels:history',
        'groups:read',
        'groups:history',
        'im:read',
        'im:history',
        'mpim:read',
        'mpim:history',
        'users:read',
      ].join(',');

      const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${user.id}`;

      // Open OAuth in a new window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'Slack OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for profile updates
      const pollInterval = setInterval(async () => {
        const { data } = await supabase
          .from('profiles')
          .select('slack_access_token, slack_team_name, slack_connected_at')
          .eq('id', user.id)
          .maybeSingle();

        if (data?.slack_access_token) {
          clearInterval(pollInterval);
          if (popup && !popup.closed) {
            popup.close();
          }
          await loadProfile();
          alert('Successfully connected to Slack!');
        }
      }, 1000);

      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 300000);
    } catch (error) {
      console.error('Error connecting to Slack:', error);
      alert('Failed to connect to Slack. Please try again.');
    }
  };

  const handleDisconnectSlack = async () => {
    if (!confirm('Are you sure you want to disconnect Slack?')) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          slack_access_token: null,
          slack_team_id: null,
          slack_team_name: null,
          slack_connected_at: null,
          slack_listening_channels: null,
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfileData({
        ...profileData,
        slack_access_token: '',
        slack_team_name: '',
        slack_connected_at: '',
        slack_listening_channels: '',
      });
      setSelectedChannels([]);
      setSlackChannels([]);

      alert('Slack disconnected successfully!');
    } catch (error) {
      console.error('Error disconnecting Slack:', error);
      alert('Failed to disconnect Slack. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const loadSlackChannelsQuietly = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-channels`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSlackChannels(data.channels || []);
      }
    } catch (error) {
      console.error('Error loading channels quietly:', error);
    }
  };

  const loadSlackChannels = async () => {
    setLoadingChannels(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      console.log('Session result:', {
        hasSession: !!session,
        hasError: !!sessionError,
        errorMessage: sessionError?.message,
        userId: session?.user?.id
      });

      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        throw new Error('Please sign in again to manage Slack channels');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-channels`;

      console.log('Calling edge function:', {
        url: apiUrl,
        hasToken: !!session.access_token,
        tokenPreview: session.access_token.substring(0, 20) + '...'
      });

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Failed to load channels' };
        }

        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Success! Received data:', {
        channelsCount: data.channels?.length,
        listeningCount: data.listening_channels?.length
      });

      setSlackChannels(data.channels || []);
      setSelectedChannels(data.listening_channels || []);
      setShowChannelSelector(true);
    } catch (error) {
      console.error('Error loading channels:', error);
      alert(`Failed to load Slack channels: ${error.message || 'Please try again.'}`);
    } finally {
      setLoadingChannels(false);
    }
  };

  const saveListeningChannels = async () => {
    setSaving(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Please sign in again to save channels');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-channels`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channels: selectedChannels }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save channels' }));
        console.error('Response error:', errorData);
        throw new Error(errorData.error || 'Failed to save channels');
      }

      setProfileData({
        ...profileData,
        slack_listening_channels: JSON.stringify(selectedChannels),
      });

      alert('Listening channels saved successfully!');
      setShowChannelSelector(false);
    } catch (error) {
      console.error('Error saving channels:', error);
      alert('Failed to save channels. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'integrations' as Tab, label: 'Integrations', icon: Link2 },
    { id: 'settings' as Tab, label: 'Security', icon: Key },
    { id: 'subscription' as Tab, label: 'Subscription', icon: CreditCard },
  ];

  if (loading) {
    return (
      <div className="h-full">
        <PageHeader title="Settings" />
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F6F7F9]">
      <PageHeader title="Settings" />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-blue-50'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-8">
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={profileData.email}
                          disabled
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={profileData.full_name}
                          onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          placeholder="Enter your full name"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-2xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                    >
                      <Save size={18} />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'integrations' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Figma Integration</h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Connect your Figma account to track comments from your design files.
                    </p>

                    {figmaConnection ? (
                      <div className="space-y-6">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              <div className="bg-green-500 rounded-xl p-3">
                                <CheckCircle size={24} className="text-white" />
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                  Connected to Figma (OAuth)
                                </h4>
                                <p className="text-sm text-gray-600 mb-2">
                                  Account: <span className="font-medium">{figmaConnection.figma_user_email}</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                  Connected {new Date(figmaConnection.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={handleDisconnectFigma}
                              disabled={saving}
                              className="flex items-center gap-2 px-4 py-2 border-2 border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              <XCircle size={18} />
                              Disconnect
                            </button>
                          </div>
                        </div>

                        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                Tracked Files
                              </h4>
                              <p className="text-sm text-gray-600">
                                Add Figma files to track comments automatically.
                              </p>
                            </div>
                            <button
                              onClick={() => setShowAddFileModal(true)}
                              className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-xl font-medium hover:bg-[#1d4ed8] transition-colors"
                            >
                              <Link2 size={18} />
                              Add File
                            </button>
                          </div>

                          {trackedFiles.length > 0 ? (
                            <div className="mt-4 space-y-3">
                              {trackedFiles.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex items-start justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <a
                                        href={file.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-gray-900 hover:text-[#2563EB] transition-colors truncate"
                                      >
                                        {file.file_name}
                                      </a>
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                        file.sync_enabled
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-gray-200 text-gray-600'
                                      }`}>
                                        {file.sync_enabled ? 'Syncing' : 'Paused'}
                                      </span>
                                    </div>
                                    {file.project && (
                                      <p className="text-sm text-gray-600">
                                        Project: {file.project.name}
                                      </p>
                                    )}
                                    {file.last_synced_at && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        Last synced: {new Date(file.last_synced_at).toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleRemoveFile(file.id)}
                                    className="ml-4 text-red-600 hover:text-red-700 transition-colors"
                                  >
                                    <XCircle size={20} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-4 p-6 bg-gray-50 border border-gray-200 rounded-xl text-center">
                              <p className="text-sm text-gray-600">
                                No files tracked yet. Click "Add File" to get started.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : profileData.figma_token ? (
                      <div className="space-y-6">
                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              <div className="bg-blue-500 rounded-xl p-3">
                                <CheckCircle size={24} className="text-white" />
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                  Connected to Figma (MCP)
                                </h4>
                                <p className="text-sm text-gray-600 mb-2">
                                  Using Personal Access Token
                                </p>
                                <p className="text-xs text-gray-500">
                                  Token: {profileData.figma_token.substring(0, 20)}...
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={handleRemoveMcpToken}
                              disabled={saving}
                              className="flex items-center gap-2 px-4 py-2 border-2 border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              <XCircle size={18} />
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
                          <div className="flex items-start gap-3 mb-4">
                            <div className="bg-blue-100 rounded-xl p-2.5">
                              <SettingsIcon size={20} className="text-[#2563EB]" />
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                Update MCP Token
                              </h4>
                              <p className="text-sm text-gray-600 mb-4">
                                Change your Figma personal access token.
                              </p>
                              <div className="bg-gray-50 rounded-xl p-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  New Token
                                </label>
                                <input
                                  type="password"
                                  value={profileData.figma_token}
                                  onChange={(e) => setProfileData({ ...profileData, figma_token: e.target.value })}
                                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] mb-3"
                                  placeholder="figd_..."
                                />
                                <button
                                  onClick={saveProfile}
                                  disabled={saving}
                                  className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                                >
                                  <Save size={18} />
                                  {saving ? 'Updating...' : 'Update Token'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-200 rounded-2xl p-6">
                          <div className="flex items-start gap-4 mb-6">
                            <div className="bg-gray-300 rounded-xl p-3">
                              <Link2 size={24} className="text-gray-600" />
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                Connect via OAuth (Recommended)
                              </h4>
                              <p className="text-sm text-gray-600 mb-4">
                                Quick and secure connection with automatic token management.
                              </p>
                              <ul className="space-y-2 text-sm text-gray-600 mb-4">
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                                  Track comments from specific Figma files
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                                  Automatic sync of new comments
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                                  Secure with automatic token refresh
                                </li>
                              </ul>
                            </div>
                          </div>
                          <button
                            onClick={handleConnectFigma}
                            className="flex items-center gap-3 px-6 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-all hover:shadow-lg"
                          >
                            <svg width="20" height="20" viewBox="0 0 38 57" fill="currentColor">
                              <path d="M19 28.5C19 25.18 21.69 22.5 25 22.5C28.31 22.5 31 25.18 31 28.5C31 31.82 28.31 34.5 25 34.5C21.69 34.5 19 31.82 19 28.5Z"/>
                              <path d="M7 46.5C7 43.18 9.69 40.5 13 40.5H19V46.5C19 49.82 16.31 52.5 13 52.5C9.69 52.5 7 49.82 7 46.5Z"/>
                              <path d="M19 4.5V16.5H25C28.31 16.5 31 13.82 31 10.5C31 7.18 28.31 4.5 25 4.5H19Z"/>
                              <path d="M7 10.5C7 13.82 9.69 16.5 13 16.5H19V4.5H13C9.69 4.5 7 7.18 7 10.5Z"/>
                              <path d="M7 28.5C7 31.82 9.69 34.5 13 34.5H19V22.5H13C9.69 22.5 7 25.18 7 28.5Z"/>
                            </svg>
                            Connect via OAuth
                          </button>
                        </div>

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                          </div>
                          <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-[#F6F7F9] text-gray-500">or</span>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl p-6">
                          <div className="flex items-start gap-4 mb-6">
                            <div className="bg-blue-500 rounded-xl p-3">
                              <Key size={24} className="text-white" />
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                Connect via MCP (Personal Access Token)
                              </h4>
                              <p className="text-sm text-gray-600 mb-4">
                                Use your Figma personal access token for direct API access.
                              </p>
                              <ul className="space-y-2 text-sm text-gray-600 mb-4">
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                                  Direct API access without OAuth
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                                  Full control over token permissions
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                                  Manual token management
                                </li>
                              </ul>
                              <div className="bg-white rounded-xl p-4 mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Figma Personal Access Token
                                </label>
                                <input
                                  type="password"
                                  value={profileData.figma_token}
                                  onChange={(e) => setProfileData({ ...profileData, figma_token: e.target.value })}
                                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                  placeholder="figd_..."
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                  Get your token from{' '}
                                  <a
                                    href="https://www.figma.com/developers/api#access-tokens"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#2563EB] hover:underline"
                                  >
                                    Figma Settings
                                  </a>
                                </p>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={saveProfile}
                            disabled={saving || !profileData.figma_token}
                            className="flex items-center gap-3 px-6 py-3 bg-[#2563EB] text-white rounded-xl font-medium hover:bg-[#1d4ed8] transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Save size={18} />
                            {saving ? 'Saving...' : 'Save MCP Token'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Slack Integration</h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Connect Slack to receive notifications when new feedback is submitted.
                    </p>

                    {profileData.slack_access_token ? (
                      <div className="space-y-6">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              <div className="bg-green-500 rounded-xl p-3">
                                <CheckCircle size={24} className="text-white" />
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                  Connected to Slack
                                </h4>
                                <p className="text-sm text-gray-600 mb-2">
                                  Workspace: <span className="font-medium">{profileData.slack_team_name}</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                  Connected {new Date(profileData.slack_connected_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={handleDisconnectSlack}
                              disabled={saving}
                              className="flex items-center gap-2 px-4 py-2 border-2 border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              <XCircle size={18} />
                              Disconnect
                            </button>
                          </div>
                          {profileData.slack_channel && (
                            <div className="mt-4 pt-4 border-t border-green-200">
                              <p className="text-sm text-gray-600">
                                Notifications will be sent to: <span className="font-mono bg-white px-2 py-1 rounded">{profileData.slack_channel}</span>
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-3">
                              <div className="bg-blue-100 rounded-xl p-2.5">
                                <Hash size={20} className="text-[#2563EB]" />
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                  Receive Feedback from Slack
                                </h4>
                                <p className="text-sm text-gray-600">
                                  Select channels to monitor for feedback. Messages from these channels will automatically appear in your inbox.
                                </p>
                              </div>
                            </div>
                          </div>

                          {selectedChannels.length > 0 && !showChannelSelector && (
                            <div className="mb-4 p-4 bg-blue-50 rounded-xl">
                              <p className="text-sm font-medium text-gray-700 mb-2">Listening to:</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedChannels.map((channelId) => {
                                  const channel = slackChannels.find(c => c.id === channelId);
                                  return (
                                    <span key={channelId} className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm font-medium">
                                      <Hash size={14} />
                                      {channel?.name || channelId}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {showChannelSelector ? (
                            <div className="space-y-4">
                              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl">
                                {slackChannels.map((channel) => (
                                  <div
                                    key={channel.id}
                                    onClick={() => toggleChannel(channel.id)}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedChannels.includes(channel.id)}
                                      onChange={() => toggleChannel(channel.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-4 h-4 text-[#2563EB] rounded focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
                                    />
                                    <Hash size={16} className="text-gray-400 pointer-events-none" />
                                    <span className="flex-1 text-sm font-medium text-gray-900 pointer-events-none">
                                      {channel.name}
                                      {channel.is_private && (
                                        <span className="ml-2 text-xs text-gray-500">(private)</span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center gap-3">
                                <button
                                  onClick={saveListeningChannels}
                                  disabled={saving}
                                  className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                                >
                                  <Save size={18} />
                                  {saving ? 'Saving...' : 'Save Channels'}
                                </button>
                                <button
                                  onClick={() => setShowChannelSelector(false)}
                                  className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={loadSlackChannels}
                              disabled={loadingChannels}
                              className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                            >
                              <Hash size={18} />
                              {loadingChannels ? 'Loading...' : 'Manage Channels'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-200 rounded-2xl p-6">
                        <div className="flex items-start gap-4 mb-6">
                          <div className="bg-gray-300 rounded-xl p-3">
                            <Link2 size={24} className="text-gray-600" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">
                              Connect your Slack workspace
                            </h4>
                            <p className="text-sm text-gray-600 mb-4">
                              Click the button below to authorize Reviu to send notifications to your Slack workspace.
                              You'll be able to choose which channel receives the notifications.
                            </p>
                            <ul className="space-y-2 text-sm text-gray-600 mb-4">
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                                Get instant notifications for new feedback
                              </li>
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                                See feedback ratings and comments in real-time
                              </li>
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                                Keep your team in the loop automatically
                              </li>
                            </ul>
                          </div>
                        </div>
                        <button
                          onClick={handleConnectSlack}
                          className="flex items-center gap-3 px-6 py-3 bg-[#611F69] text-white rounded-xl font-medium hover:bg-[#4A154B] transition-all hover:shadow-lg"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                          </svg>
                          Connect to Slack
                        </button>
                      </div>
                    )}

                    {!profileData.slack_access_token && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <details className="group">
                          <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                            Advanced: Manual webhook setup
                          </summary>
                          <div className="mt-4 space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Slack Webhook URL
                              </label>
                              <input
                                type="text"
                                value={profileData.slack_webhook_url}
                                onChange={(e) => setProfileData({ ...profileData, slack_webhook_url: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                placeholder="https://hooks.slack.com/services/..."
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Slack Channel
                              </label>
                              <input
                                type="text"
                                value={profileData.slack_channel}
                                onChange={(e) => setProfileData({ ...profileData, slack_channel: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                placeholder="#design-feedback"
                              />
                            </div>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-2xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                    >
                      <Save size={18} />
                      {saving ? 'Saving...' : 'Save Integrations'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Change Password</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Update your password to keep your account secure.
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          placeholder="Enter current password"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          placeholder="Enter new password (min 6 characters)"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          placeholder="Confirm new password"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={handleChangePassword}
                      disabled={changingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                      className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-2xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Key size={18} />
                      {changingPassword ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'subscription' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscription Plan</h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Manage your subscription and billing settings.
                    </p>

                    <div className="bg-gradient-to-br from-[#2563EB] to-[#1d4ed8] rounded-2xl p-6 text-white mb-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-2xl font-bold mb-1">Free Plan</h4>
                          <p className="text-blue-100 text-sm">Currently active</p>
                        </div>
                        <div className="bg-white/20 px-4 py-2 rounded-lg">
                          <p className="text-2xl font-bold">$0</p>
                          <p className="text-xs text-blue-100">per month</p>
                        </div>
                      </div>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                          Up to 3 projects
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                          Unlimited designs
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                          Basic feedback management
                        </li>
                      </ul>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border-2 border-gray-200 rounded-2xl p-6 hover:border-[#2563EB] transition-colors">
                        <h4 className="text-lg font-bold text-gray-900 mb-2">Pro Plan</h4>
                        <div className="mb-4">
                          <span className="text-3xl font-bold text-gray-900">$29</span>
                          <span className="text-gray-600 ml-2">per month</span>
                        </div>
                        <ul className="space-y-2 text-sm text-gray-600 mb-6">
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                            Unlimited projects
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                            Advanced analytics
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                            Priority support
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                            Custom branding
                          </li>
                        </ul>
                        <button className="w-full py-2.5 border-2 border-[#2563EB] text-[#2563EB] rounded-xl font-medium hover:bg-[#2563EB] hover:text-white transition-colors">
                          Upgrade to Pro
                        </button>
                      </div>

                      <div className="border-2 border-gray-200 rounded-2xl p-6 hover:border-[#2563EB] transition-colors">
                        <h4 className="text-lg font-bold text-gray-900 mb-2">Team Plan</h4>
                        <div className="mb-4">
                          <span className="text-3xl font-bold text-gray-900">$99</span>
                          <span className="text-gray-600 ml-2">per month</span>
                        </div>
                        <ul className="space-y-2 text-sm text-gray-600 mb-6">
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                            Everything in Pro
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                            Up to 10 team members
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                            Advanced permissions
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"></span>
                            Dedicated support
                          </li>
                        </ul>
                        <button className="w-full py-2.5 border-2 border-[#2563EB] text-[#2563EB] rounded-xl font-medium hover:bg-[#2563EB] hover:text-white transition-colors">
                          Upgrade to Team
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddFigmaFileModal
        isOpen={showAddFileModal}
        onClose={() => setShowAddFileModal(false)}
        onFileAdded={() => {
          loadFigmaConnection();
          loadTrackedFiles();
        }}
      />
    </div>
  );
}
