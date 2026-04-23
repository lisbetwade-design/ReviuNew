import { useState, useEffect } from 'react';
import { BarChart3, MessageSquare, Star, FolderKanban, Users, ImageIcon } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { supabase } from '../lib/supabase';

interface AnalyticsData {
  totalProjects: number;
  totalDesigns: number;
  totalComments: number;
  averageRating: number;
  feedbackByTheme: { theme: string; count: number; color: string; label: string }[];
  ratingDistribution: { rating: number; count: number }[];
  projectStats: { id: string; name: string; designCount: number; commentCount: number; avgRating: number }[];
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

      const cutoffDate = new Date();
      if (timeRange === '7d') cutoffDate.setDate(cutoffDate.getDate() - 7);
      else if (timeRange === '30d') cutoffDate.setDate(cutoffDate.getDate() - 30);
      else if (timeRange === '90d') cutoffDate.setDate(cutoffDate.getDate() - 90);
      else cutoffDate.setFullYear(2000);

      const [projectsResult, designsResult, commentsResult, projectStatsResult, stakeholderResult] =
        await Promise.all([
          supabase.from('projects').select('id').eq('user_id', user.id),
          supabase.from('designs').select('id, project:projects!inner(user_id)').eq('project.user_id', user.id),
          supabase.from('comments').select('id, rating, theme, created_at, design:designs!inner(project:projects!inner(user_id))').eq('design.project.user_id', user.id).gte('created_at', cutoffDate.toISOString()),
          supabase.from('projects').select('id, name, designs:designs(count), comments:designs(comments:comments(count))').eq('user_id', user.id),
          supabase.from('comments').select('author_name, design:designs!inner(project:projects!inner(user_id))').eq('design.project.user_id', user.id).not('author_name', 'is', null),
        ]);

      const comments = commentsResult.data || [];
      const ratings = comments.filter(c => c.rating !== null).map(c => c.rating);
      const avgRating = ratings.length > 0 ? ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length : 0;

      const themeConfig = [
        { theme: 'usability', label: 'Usability', color: '#5B5FEF' },
        { theme: 'visuals', label: 'Visuals', color: '#9D5FEF' },
        { theme: 'copy', label: 'Copy', color: '#EF5B9D' },
        { theme: 'development', label: 'Development', color: '#F59E0B' },
        { theme: 'other', label: 'Other', color: '#10B981' },
      ];
      const feedbackByTheme = themeConfig.map(c => ({
        ...c,
        count: comments.filter((cm: any) => (cm.theme || 'other') === c.theme).length,
      }));

      const ratingDist = [1, 2, 3, 4, 5].map(r => ({
        rating: r,
        count: comments.filter((c: any) => c.rating === r).length,
      }));

      const projectStats = (projectStatsResult.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        designCount: p.designs?.[0]?.count || 0,
        commentCount: p.comments?.reduce((s: number, d: any) => s + (d.comments?.[0]?.count || 0), 0) || 0,
        avgRating: 0,
      })).sort((a: any, b: any) => b.commentCount - a.commentCount);

      const stakeholderMap = new Map<string, number>();
      (stakeholderResult.data || []).forEach((c: any) => {
        const n = c.author_name || 'Anonymous';
        stakeholderMap.set(n, (stakeholderMap.get(n) || 0) + 1);
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
        projectStats: projectStats.slice(0, 8),
        stakeholderEngagement,
      });
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRatingEmoji = (r: number) => ['😞', '😕', '😐', '😊', '😍'][r - 1];

  const timeTabs = (
    <div className="flex gap-1">
      {(['7d', '30d', '90d', 'all'] as const).map(range => (
        <button
          key={range}
          onClick={() => setTimeRange(range)}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            timeRange === range ? 'bg-[#F5C430] text-gray-900' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          {range === 'all' ? 'All time' : range.toUpperCase()}
        </button>
      ))}
    </div>
  );

  if (loading || !analytics) {
    return (
      <div className="h-full flex flex-col bg-white">
        <PageHeader title="Analytics" icon={BarChart3} subtitle="Insights and metrics across your projects." rightContent={timeTabs} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">{loading ? 'Loading analytics...' : 'Failed to load analytics'}</div>
        </div>
      </div>
    );
  }

  const totalThemeCount = analytics.feedbackByTheme.reduce((s, t) => s + t.count, 0);
  const maxComments = Math.max(...analytics.projectStats.map(p => p.commentCount), 1);
  const maxRating = Math.max(...analytics.ratingDistribution.map(r => r.count), 1);

  // Donut arc chart helpers
  const DONUT_R = 70;
  const DONUT_CX = 90;
  const DONUT_CY = 90;
  const DONUT_STROKE = 22;
  const circumference = 2 * Math.PI * DONUT_R;

  const donutSegments = analytics.feedbackByTheme.filter(t => t.count > 0).map((t, idx, arr) => {
    const pct = t.count / totalThemeCount;
    const prevPct = arr.slice(0, idx).reduce((s, x) => s + x.count / totalThemeCount, 0);
    return { ...t, pct, prevPct };
  });

  return (
    <div className="h-full flex flex-col bg-white">
      <PageHeader
        title="Analytics"
        icon={BarChart3}
        subtitle="Insights and metrics across your projects."
        rightContent={timeTabs}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-5">

          {/* ── Top row ── */}
          <div className="grid grid-cols-12 gap-5">

            {/* Stacked stat cards */}
            <div className="col-span-3 flex flex-col gap-5">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                    <FolderKanban size={16} className="text-[#D4A017]" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Total Projects</span>
                </div>
                <p className="text-4xl font-black text-gray-900">{analytics.totalProjects}</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
                    <ImageIcon size={16} className="text-[#F5C430]" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Total Designs</span>
                </div>
                <p className="text-4xl font-black text-gray-900">{analytics.totalDesigns}</p>
              </div>
            </div>

            {/* Donut chart — Feedback by Theme */}
            <div className="col-span-4 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Feedback by Theme</h3>
              </div>

              <div className="flex items-center gap-6">
                {/* SVG donut */}
                <div className="relative flex-shrink-0">
                  <svg width="180" height="180" viewBox="0 0 180 180">
                    {/* Background ring */}
                    <circle cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R} fill="none" stroke="#F3F4F6" strokeWidth={DONUT_STROKE} />
                    {totalThemeCount === 0 ? null : donutSegments.map((seg, i) => (
                      <circle
                        key={seg.theme}
                        cx={DONUT_CX}
                        cy={DONUT_CY}
                        r={DONUT_R}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={DONUT_STROKE}
                        strokeDasharray={`${seg.pct * circumference} ${circumference}`}
                        strokeDashoffset={-seg.prevPct * circumference}
                        strokeLinecap="butt"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: `${DONUT_CX}px ${DONUT_CY}px` }}
                      />
                    ))}
                    <text x={DONUT_CX} y={DONUT_CY - 6} textAnchor="middle" className="text-xs" fill="#6B7280" fontSize="11">Total</text>
                    <text x={DONUT_CX} y={DONUT_CY + 14} textAnchor="middle" fill="#111827" fontSize="20" fontWeight="700">{totalThemeCount}</text>
                  </svg>
                </div>
                {/* Legend */}
                <div className="flex-1 space-y-2.5">
                  {analytics.feedbackByTheme.map(t => (
                    <div key={t.theme} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                        <span className="text-sm text-gray-600">{t.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {totalThemeCount > 0 ? Math.round((t.count / totalThemeCount) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rating distribution */}
            <div className="col-span-5 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-semibold text-gray-900">Rating Distribution</h3>
                <Star size={16} className="text-gray-400" />
              </div>
              <p className="text-xs text-gray-400 mb-5">Based on {analytics.totalComments} feedback responses</p>
              <div className="space-y-3">
                {[...analytics.ratingDistribution].reverse().map(item => (
                  <div key={item.rating} className="flex items-center gap-3">
                    <span className="text-base w-6">{getRatingEmoji(item.rating)}</span>
                    <span className="text-xs text-gray-500 w-10">{item.rating} star</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(item.count / maxRating) * 100}%`,
                          backgroundColor: item.rating >= 4 ? '#10B981' : item.rating === 3 ? '#F59E0B' : '#EF4444',
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-4 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Bottom row ── */}
          <div className="grid grid-cols-12 gap-5">

            {/* Projects table */}
            <div className="col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">All Projects</h3>
                <FolderKanban size={16} className="text-gray-400" />
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Designs</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-40">Feedback</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.projectStats.length > 0 ? analytics.projectStats.map((project, idx) => (
                    <tr key={project.id} className={`${idx !== analytics.projectStats.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors`}>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FolderKanban size={14} className="text-[#D4A017]" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{project.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-gray-500">{project.designCount}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#F5C430] rounded-full"
                              style={{ width: `${(project.commentCount / maxComments) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-8">
                            {maxComments > 0 ? Math.round((project.commentCount / maxComments) * 100) : 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold">
                          {project.commentCount}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-400">No projects yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Top contributors */}
            <div className="col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">Top Contributors</h3>
                <Users size={16} className="text-gray-400" />
              </div>

              {analytics.stakeholderEngagement.length > 0 ? (
                <div className="p-4 space-y-2">
                  {/* Top contributor featured */}
                  {analytics.stakeholderEngagement[0] && (
                    <div className="bg-gray-900 rounded-xl p-4 mb-3">
                      <div className="w-10 h-10 bg-[#F5C430] rounded-full flex items-center justify-center text-gray-900 font-black text-lg mb-2">
                        {analytics.stakeholderEngagement[0].author_name.charAt(0).toUpperCase()}
                      </div>
                      <p className="font-semibold text-white">{analytics.stakeholderEngagement[0].author_name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Star size={12} className="text-[#F5C430] fill-[#F5C430]" />
                        <span className="text-xs text-gray-400">{analytics.stakeholderEngagement[0].count} feedback items</span>
                      </div>
                    </div>
                  )}
                  {analytics.stakeholderEngagement.slice(1).map((s, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 bg-gray-100 border border-gray-200 rounded-full flex items-center justify-center text-gray-700 text-xs font-semibold flex-shrink-0">
                        {s.author_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.author_name}</p>
                        <p className="text-xs text-gray-500">{s.count} feedback</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-gray-400">No feedback yet</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
