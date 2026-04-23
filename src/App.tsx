import { useState, useEffect, useRef } from 'react';
import { Inbox, LayoutDashboard, FolderKanban, BarChart3, User, Settings, LogOut } from 'lucide-react';

const ReviuLogo = () => (
  <svg width="40" height="40" viewBox="0 0 107 107" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#rlogo-clip)">
      <path d="M53.0976 0C82.4227 0 106.195 23.7726 106.195 53.0976C106.195 82.4227 82.4227 106.195 53.0976 106.195C52.4261 106.195 51.7577 106.179 51.0926 106.154C50.899 106.178 50.7018 106.195 50.5015 106.195H4.71864C2.1129 106.194 0.000666283 104.082 0 101.477V55.6937C0 55.4923 0.013562 55.2937 0.0380256 55.099C0.0134123 54.4349 0 53.7677 0 53.0976C0 23.7726 23.7726 0 53.0976 0Z" fill="#F5C430"/>
      <path d="M53.0977 10.6203C76.5572 10.6207 95.5757 29.6386 95.5757 53.0983C95.5754 76.5579 76.5572 95.576 53.0977 95.5764C52.5596 95.5764 52.0233 95.5615 51.4902 95.5417C51.3362 95.5612 51.1794 95.5764 51.0201 95.5764H14.3945C12.3099 95.5764 10.6204 93.8861 10.6196 91.8015V55.1759C10.6196 55.0113 10.6303 54.8477 10.6507 54.6884C10.6313 54.161 10.6197 53.6307 10.6196 53.0983C10.6196 29.6384 29.6377 10.6203 53.0977 10.6203Z" fill="#F5C430"/>
      <circle cx="34.87" cy="52.31" r="6.34" fill="white"/>
      <circle cx="52.31" cy="52.31" r="6.34" fill="white"/>
      <circle cx="69.74" cy="52.31" r="6.34" fill="white"/>
    </g>
    <defs>
      <clipPath id="rlogo-clip">
        <rect width="106.195" height="106.195" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);
import { InboxPage } from './pages/InboxPage';
import { BoardPage } from './pages/BoardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { PublicFeedbackPage } from './pages/PublicFeedbackPage';
import { DesignViewerPage } from './pages/DesignViewerPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { supabase } from './lib/supabase';

type Page = 'inbox' | 'board' | 'projects' | 'analytics' | 'profile' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('inbox');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [viewingDesignId, setViewingDesignId] = useState<string | null>(null);
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null);
  const [viewingProjectName, setViewingProjectName] = useState<string>('');

  const publicToken = window.location.pathname.startsWith('/feedback/')
    ? window.location.pathname.split('/feedback/')[1]
    : null;

  useEffect(() => {
    if (!publicToken) {
      checkAuth();
    } else {
      setLoading(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, [publicToken]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Auth error:', error);
        setError(error.message);
      }
      setIsAuthenticated(!!session);
    } catch (err) {
      console.error('Error checking auth:', err);
      setError(err instanceof Error ? err.message : 'Failed to check authentication');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="text-red-600 mb-4">Error: {error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#F5C430] text-gray-900 rounded-2xl font-medium hover:bg-[#E8B820] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (publicToken) {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen bg-white">
          <div className="text-gray-500">Loading...</div>
        </div>
      );
    }
    return <PublicFeedbackPage token={publicToken} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  const menuItems = [
    { id: 'inbox' as Page, label: 'Inbox', icon: Inbox },
    { id: 'board' as Page, label: 'Board', icon: LayoutDashboard },
    { id: 'projects' as Page, label: 'Projects', icon: FolderKanban },
    { id: 'analytics' as Page, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-[#F0F0F3]">
      <aside className="w-[72px] bg-[#F0F0F3] flex flex-col items-center py-5 gap-2">
        {/* Logo */}
        <div className="mb-4">
          <ReviuLogo />
        </div>

        {/* Nav items */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                title={item.label}
                className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </nav>

        {/* Settings + Profile at bottom */}
        <div className="flex flex-col items-center gap-1" ref={dropdownRef}>
          <button
            onClick={() => setCurrentPage('settings')}
            title="Settings"
            className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-colors ${
              currentPage === 'settings'
                ? 'bg-gray-900 text-white'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <Settings size={20} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              title="Profile"
              className="w-11 h-11 flex items-center justify-center rounded-2xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <User size={20} />
            </button>

            {showProfileDropdown && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setIsAuthenticated(false);
                    setShowProfileDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={18} />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-4 pl-0">
        <div className="bg-white rounded-3xl h-full overflow-auto">
        {viewingDesignId ? (
          <DesignViewerPage
            designId={viewingDesignId}
            projectName={viewingProjectName}
            onBack={() => {
              setViewingDesignId(null);
              setViewingProjectId(null);
              setViewingProjectName('');
            }}
          />
        ) : viewingProjectId ? (
          <ProjectDetailPage
            projectId={viewingProjectId}
            projectName={viewingProjectName}
            onBack={() => {
              setViewingProjectId(null);
              setViewingProjectName('');
            }}
          />
        ) : (
          <>
            {currentPage === 'inbox' && (
              <InboxPage
                onNavigateToDesign={async (designId) => {
                  // Load design and project info
                  const { data } = await supabase
                    .from('designs')
                    .select('id, project:projects(id, name)')
                    .eq('id', designId)
                    .maybeSingle();

                  if (data?.project) {
                    setViewingProjectName(data.project.name);
                  }
                  setViewingDesignId(designId);
                }}
                onNavigateToProject={async (projectId) => {
                  // Load project name
                  const { data } = await supabase
                    .from('projects')
                    .select('id, name')
                    .eq('id', projectId)
                    .maybeSingle();

                  if (data) {
                    setViewingProjectName(data.name);
                    setViewingProjectId(projectId);
                  }
                }}
              />
            )}
            {currentPage === 'board' && <BoardPage />}
            {currentPage === 'projects' && <ProjectsPage />}
            {currentPage === 'analytics' && <AnalyticsPage />}
            {currentPage === 'profile' && <ProfilePage />}
            {currentPage === 'settings' && <SettingsPage />}
          </>
        )}
        </div>
      </main>
    </div>
  );
}

function AuthScreen({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: data.user.email!,
            });

          if (profileError) {
            console.error('Error creating profile:', profileError);
          }
        }

        onAuthSuccess();
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!profile) {
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: data.user.email!,
              });

            if (profileError) {
              console.error('Error creating profile:', profileError);
            }
          }
        }

        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F6F7F9]">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Reviu
          </h1>
          <p className="text-gray-600">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5C430]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5C430]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-[#F5C430] text-gray-900 rounded-2xl font-medium hover:bg-[#E8B820] transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[#D4A017] hover:underline text-sm"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
