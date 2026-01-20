import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, MessageSquare, Star, FolderKanban, Calendar, Users, Activity } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { supabase } from '../lib/supabase';

interface AnalyticsData {
  totalProjects: number;
  totalDesigns: number;
  totalComments: number;
  averageRating: number;
  feedbackByTheme: { theme: string; count: number; color: string; label: string }[];
  ratingDistribution: { rating: number; count: number }[];
  commentsBySource: { source: string; count: number }[];
  projectStats: { id: string; name: string; designCount: number; commentCount: number }[];
  recentActivity: {
    id: string;
    content: string;
    author_name: string;
    design_name: string;
    project_name: string;
    created_at: string;
    rating: number | null;
  }[];
  stakeholderEngagement: { author_name: string; count: number }[];
}

export function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const cutoffDate = new Date();

      if (timeRange === '7d') {
        cutoffDate.setDate(now.getDate() - 7);
      } else if (timeRange === '30d') {
        cutoffDate.setDate(now.getDate() - 30);
      } else if (timeRange === '90d') {
        cutoffDate.setDate(now.getDate() - 90);
      } else {
        cutoffDate.setFullYear(2000);
      }

      const [
        projectsResult,
        designsResult,
        commentsResult,
        projectStatsResult,
        recentActivityResult,
        stakeholderResult,
      ] = await Promise.all([
        supabase
          .from('projects')
          .select('id')
          .eq('user_id', user.id),

        supabase
          .from('designs')
          .select('id, project:projects!inner(user_id)')
          .eq('project.user_id', user.id),

        supabase
          .from('comments')
          .select('id, rating, theme, created_at, design:designs!inner(project:projects!inner(user_id))')
          .eq('design.project.user_id', user.id)
          .gte('created_at', cutoffDate.toISOString()),

        supabase
          .from('projects')
          .select(`
            id,
            name,
            designs:designs(count),
            comments:designs(comments:comments(count))
          `)
          .eq('user_id', user.id),

        supabase
          .from('comments')
          .select(`
            id,
            content,
            author_name,
            rating,
            created_at,
            design:designs!inner(
              name,
              project:projects!inner(name, user_id)
            )
          `)
          .eq('design.project.user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),

        supabase
          .from('comments')
          .select('author_name, design:designs!inner(project:projects!inner(user_id))')
          .eq('design.project.user_id', user.id)
          .not('author_name', 'is', null)
      ]);

      const comments = commentsResult.data || [];
      const ratings = comments.filter(c => c.rating !== null).map(c => c.rating);
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;

      const feedbackByTheme = getFeedbackByTheme(comments);
      const ratingDist = getRatingDistribution(comments);
      const commentsBySource = [
        { source: 'Public Link', count: comments.filter(c => c.author_name).length },
        { source: 'Internal', count: comments.filter(c => !c.author_name).length },
      ];

      const projectStats = (projectStatsResult.data || []).map((project: any) => ({
        id: project.id,
        name: project.name,
        designCount: project.designs?.[0]?.count || 0,
        commentCount: project.comments?.reduce((sum: number, d: any) =>
          sum + (d.comments?.[0]?.count || 0), 0) || 0,
      })).sort((a, b) => b.commentCount - a.commentCount);

      const stakeholderMap = new Map<string, number>();
      (stakeholderResult.data || []).forEach((comment: any) => {
        const name = comment.author_name || 'Anonymous';
        stakeholderMap.set(name, (stakeholderMap.get(name) || 0) + 1);
      });

      const stakeholderEngagement = Array.from(stakeholderMap.entries())
        .map(([author_name, count]) => ({ author_name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setAnalytics({
        totalProjects: projectsResult.data?.length || 0,
        totalDesigns: designsResult.data?.length || 0,
        totalComments: comments.length,
        averageRating: avgRating,
        feedbackByTheme,
        ratingDistribution: ratingDist,
        commentsBySource,
        projectStats: projectStats.slice(0, 5),
        recentActivity: (recentActivityResult.data || []).map((item: any) => ({
          id: item.id,
          content: item.content,
          author_name: item.author_name || 'Anonymous',
          design_name: item.design?.name || '',
          project_name: item.design?.project?.name || '',
          created_at: item.created_at,
          rating: item.rating,
        })),
        stakeholderEngagement,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFeedbackByTheme = (comments: any[]) => {
    const themeConfig = [
      { theme: 'usability', label: 'Usability', color: '#5B5FEF' },
      { theme: 'visuals', label: 'Visuals', color: '#9D5FEF' },
      { theme: 'copy', label: 'Copy', color: '#EF5B9D' },
      { theme: 'development', label: 'Development', color: '#F59E0B' },
      { theme: 'other', label: 'Other', color: '#10B981' },
    ];

    return themeConfig.map(config => ({
      ...config,
      count: comments.filter(c => (c.theme || 'other') === config.theme).length,
    }));
  };

  const getRatingDistribution = (comments: any[]) => {
    const dist = [1, 2, 3, 4, 5].map(rating => ({
      rating,
      count: comments.filter(c => c.rating === rating).length,
    }));
    return dist;
  };

  const getRatingEmoji = (rating: number) => {
    const emojis = ['😞', '😕', '😐', '😊', '😍'];
    return emojis[rating - 1];
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader title="Analytics" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader title="Analytics" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Failed to load analytics</div>
        </div>
      </div>
    );
  }

  const maxRating = Math.max(...analytics.ratingDistribution.map(r => r.count), 1);
  const totalThemeCount = analytics.feedbackByTheme.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="h-full flex flex-col bg-[#F6F7F9]">
      <PageHeader title="Analytics" />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
              <p className="text-sm text-gray-600 mt-1">Track your feedback metrics and project insights</p>
            </div>
            <div className="flex gap-2">
              {(['7d', '30d', '90d', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {range === 'all' ? 'All Time' : range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Projects</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.totalProjects}</p>
                </div>
                <div className="bg-blue-100 rounded-xl p-3">
                  <FolderKanban size={24} className="text-[#2563EB]" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Designs</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.totalDesigns}</p>
                </div>
                <div className="bg-green-100 rounded-xl p-3">
                  <BarChart3 size={24} className="text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Feedback</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.totalComments}</p>
                </div>
                <div className="bg-orange-100 rounded-xl p-3">
                  <MessageSquare size={24} className="text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Rating</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {analytics.averageRating > 0 ? analytics.averageRating.toFixed(1) : 'N/A'}
                  </p>
                </div>
                <div className="bg-yellow-100 rounded-xl p-3">
                  <Star size={24} className="text-yellow-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Feedback by theme</h3>
              <div className="flex items-center justify-center mb-6">
                <svg width="240" height="240" viewBox="0 0 240 240" className="transform -rotate-90">
                  {totalThemeCount > 0 ? (
                    analytics.feedbackByTheme.map((theme, idx) => {
                      const prevSum = analytics.feedbackByTheme
                        .slice(0, idx)
                        .reduce((sum, t) => sum + t.count, 0);
                      const percentage = theme.count / totalThemeCount;
                      const prevPercentage = prevSum / totalThemeCount;

                      const startAngle = prevPercentage * 360;
                      const endAngle = startAngle + percentage * 360;

                      const x1 = 120 + 100 * Math.cos((startAngle * Math.PI) / 180);
                      const y1 = 120 + 100 * Math.sin((startAngle * Math.PI) / 180);
                      const x2 = 120 + 100 * Math.cos((endAngle * Math.PI) / 180);
                      const y2 = 120 + 100 * Math.sin((endAngle * Math.PI) / 180);

                      const largeArc = percentage > 0.5 ? 1 : 0;

                      return (
                        <path
                          key={theme.theme}
                          d={`M 120 120 L ${x1} ${y1} A 100 100 0 ${largeArc} 1 ${x2} ${y2} Z`}
                          fill={theme.color}
                          stroke="white"
                          strokeWidth="2"
                        />
                      );
                    })
                  ) : (
                    <circle cx="120" cy="120" r="100" fill="#E5E7EB" />
                  )}
                </svg>
              </div>
              <div className="space-y-3">
                {analytics.feedbackByTheme.map((theme) => (
                  <div key={theme.theme} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: theme.color }}
                      />
                      <span className="text-sm text-gray-700">{theme.label}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{theme.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Rating Distribution</h3>
                <Star size={20} className="text-gray-400" />
              </div>
              <div className="space-y-4">
                {analytics.ratingDistribution.map((item) => (
                  <div key={item.rating} className="flex items-center gap-4">
                    <span className="text-2xl">{getRatingEmoji(item.rating)}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{item.rating} Star</span>
                        <span className="text-sm text-gray-500">{item.count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all"
                          style={{ width: `${(item.count / maxRating) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Top Projects</h3>
                <FolderKanban size={20} className="text-gray-400" />
              </div>
              <div className="space-y-4">
                {analytics.projectStats.length > 0 ? (
                  analytics.projectStats.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{project.name}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {project.designCount} designs • {project.commentCount} feedback
                        </p>
                      </div>
                      <div className="bg-[#2563EB] text-white px-3 py-1 rounded-lg text-sm font-medium">
                        {project.commentCount}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No projects yet</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Top Contributors</h3>
                <Users size={20} className="text-gray-400" />
              </div>
              <div className="space-y-4">
                {analytics.stakeholderEngagement.length > 0 ? (
                  analytics.stakeholderEngagement.map((stakeholder, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#3B82F6] rounded-full flex items-center justify-center text-white font-bold">
                        {stakeholder.author_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{stakeholder.author_name}</p>
                        <p className="text-sm text-gray-600">{stakeholder.count} feedback items</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No feedback yet</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <Activity size={20} className="text-gray-400" />
            </div>
            <div className="space-y-3">
              {analytics.recentActivity.length > 0 ? (
                analytics.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white font-bold">
                      {activity.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900">{activity.author_name}</p>
                        {activity.rating && (
                          <span className="text-lg">{getRatingEmoji(activity.rating)}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-2 line-clamp-2">{activity.content}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{activity.project_name}</span>
                        <span>•</span>
                        <span>{activity.design_name}</span>
                        <span>•</span>
                        <span>{new Date(activity.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
