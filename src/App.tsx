import { useState, useEffect, useRef } from 'react';
import { Inbox, LayoutDashboard, FolderKanban, BarChart3, User, Settings, LogOut, ChevronDown } from 'lucide-react';
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
            className="px-6 py-3 bg-[#2563EB] text-white rounded-2xl font-medium hover:bg-[#1d4ed8] transition-colors"
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
    <div className="flex h-screen bg-white">
      <aside className="w-64 bg-[#F6F7F9] border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inria Sans, sans-serif' }}>
            Reviu
          </h1>
        </div>

        <nav className="flex-1 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl mb-1 transition-colors ${
                  isActive
                    ? 'bg-[#EDEDED] text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200 relative" ref={dropdownRef}>
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors text-gray-600 hover:bg-gray-100"
          >
            <User size={20} />
            <span className="font-medium flex-1 text-left">Profile</span>
            <ChevronDown size={16} className={`transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showProfileDropdown && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => {
                  setCurrentPage('settings');
                  setShowProfileDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Settings size={18} />
                <span className="font-medium">Settings</span>
              </button>
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
      </aside>

      <main className="flex-1 overflow-auto">
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Inria Sans, sans-serif' }}>
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
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
            className="w-full px-6 py-3 bg-[#2563EB] text-white rounded-2xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[#2563EB] hover:underline text-sm"
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
