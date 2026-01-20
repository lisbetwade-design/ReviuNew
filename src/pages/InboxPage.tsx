import { useState, useEffect } from 'react';
import { Inbox, FolderOpen, MessageCircle } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { supabase } from '../lib/supabase';

interface FeedbackItem {
  id: string;
  design_id: string;
  stakeholder_name: string;
  stakeholder_email: string | null;
  stakeholder_role: string;
  content: string;
  rating: number | null;
  source_type: string;
  is_processed: boolean;
  created_at: string;
  viewed_at: string | null;
  design?: {
    name: string;
    source_url: string | null;
    project_id: string;
    project?: {
      id: string;
      name: string;
    };
  };
}

interface Project {
  id: string;
  name: string;
  feedbackCount: number;
}

const roleColors: Record<string, string> = {
  client: 'bg-purple-50 text-purple-600 border-purple-200',
  pm: 'bg-blue-50 text-blue-600 border-blue-200',
  developer: 'bg-green-50 text-green-600 border-green-200',
  designer: 'bg-pink-50 text-pink-600 border-pink-200',
  other: 'bg-gray-50 text-gray-600 border-gray-200',
  'Slack User': 'bg-blue-50 text-blue-600 border-blue-200',
};

const statusColors: Record<string, string> = {
  open: 'bg-orange-50 text-orange-600 border-orange-200',
  'under review': 'bg-yellow-50 text-yellow-600 border-yellow-200',
  resolved: 'bg-green-50 text-green-600 border-green-200',
};

interface InboxPageProps {
  onNavigateToDesign?: (designId: string) => void;
  onNavigateToProject?: (projectId: string) => void;
}

export function InboxPage({ onNavigateToDesign, onNavigateToProject }: InboxPageProps = {}) {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unviewedCount, setUnviewedCount] = useState(0);

  const getRatingEmoji = (rating: number | null) => {
    if (!rating) return null;
    const emojis = ['😞', '😕', '😐', '😊', '😍'];
    return emojis[rating - 1];
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          design_id,
          author_name,
          author_email,
          content,
          rating,
          status,
          created_at,
          viewed_at,
          design:designs(
            name,
            source_url,
            project_id,
            project:projects(id, name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedData = (data || []).map((comment: any) => {
        const isSlack = comment.author_email?.includes('slack.com');
        const isFigma = comment.author_email?.includes('figma');

        return {
          id: comment.id,
          design_id: comment.design_id,
          stakeholder_name: comment.author_name,
          stakeholder_email: comment.author_email,
          stakeholder_role: isSlack ? 'Slack User' : (isFigma ? 'designer' : 'client'),
          content: comment.content,
          rating: comment.rating,
          source_type: isSlack ? 'slack' : (isFigma ? 'figma' : 'web'),
          is_processed: comment.status !== 'open',
          created_at: comment.created_at,
          viewed_at: comment.viewed_at,
          design: comment.design,
        };
      });

      setFeedbackItems(mappedData);

      // Count unviewed feedback
      const unviewed = mappedData.filter((item: FeedbackItem) => !item.viewed_at).length;
      setUnviewedCount(unviewed);

      const projectMap = new Map<string, { name: string; count: number }>();
      mappedData.forEach((item) => {
        if (item.design?.project?.id) {
          const projectId = item.design.project.id;
          const existing = projectMap.get(projectId);
          if (existing) {
            existing.count++;
          } else {
            projectMap.set(projectId, {
              name: item.design.project.name,
              count: 1,
            });
          }
        }
      });

      const projectList = Array.from(projectMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        feedbackCount: data.count,
      }));

      setProjects(projectList);
      if (projectList.length > 0 && !activeProjectId) {
        setActiveProjectId(projectList[0].id);
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDesignClick = async (designId: string, feedbackId: string, hasViewed: boolean) => {
    // Mark as viewed if not already viewed
    if (!hasViewed) {
      await supabase
        .from('comments')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', feedbackId);

      // Update local state
      setFeedbackItems(prev =>
        prev.map(item =>
          item.id === feedbackId
            ? { ...item, viewed_at: new Date().toISOString() }
            : item
        )
      );

      setUnviewedCount(prev => Math.max(0, prev - 1));
    }

    // Navigate to design page
    if (onNavigateToDesign) {
      onNavigateToDesign(designId);
    }
  };

  const handleProjectClick = (projectId: string) => {
    if (onNavigateToProject) {
      onNavigateToProject(projectId);
    }
  };

  const filteredFeedback = activeProjectId
    ? feedbackItems.filter((item) => item.design?.project?.id === activeProjectId)
    : feedbackItems;

  const groupedByDesign = filteredFeedback.reduce((acc, item) => {
    const designKey = `${item.design?.name || 'Unknown Design'}`;
    if (!acc[designKey]) {
      acc[designKey] = [];
    }
    acc[designKey].push(item);
    return acc;
  }, {} as Record<string, FeedbackItem[]>);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (feedbackItems.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white p-8 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative">
              <Inbox size={28} className="text-gray-700" />
              {unviewedCount > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#2563EB] rounded-full" />
              )}
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Inbox</h1>
          </div>
          <p className="text-gray-600">View and manage all feedback across your projects.</p>
        </div>
        <EmptyState
          icon={Inbox}
          title="No feedback yet"
          description="Your inbox will show all feedback and comments from stakeholders across your projects. Upload designs and share them to start collecting feedback."
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="bg-white p-8 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="relative">
            <Inbox size={28} className="text-gray-700" />
            {unviewedCount > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#2563EB] rounded-full" />
            )}
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Inbox</h1>
        </div>
        <p className="text-gray-600">View and manage all feedback across your projects.</p>
      </div>

      {projects.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-8">
          <div className="flex gap-2 overflow-x-auto py-2">
            <button
              onClick={() => setActiveProjectId(null)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeProjectId === null
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>All Projects</span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                activeProjectId === null
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                {feedbackItems.length}
              </span>
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setActiveProjectId(project.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeProjectId === project.id
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FolderOpen size={16} />
                <span>{project.name}</span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                  activeProjectId === project.id
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {project.feedbackCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {Object.entries(groupedByDesign).map(([designName, items]) => (
            <div key={designName} className="space-y-4">
              <button
                onClick={() => {
                  if (items[0]) {
                    handleDesignClick(items[0].design_id, items[0].id, !!items[0].viewed_at);
                  }
                }}
                className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
              >
                <h2 className="font-semibold text-gray-900">{designName}</h2>
                <span className="text-gray-500">{items.length}</span>
              </button>

              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                <FolderOpen size={14} />
                {items[0]?.design?.project?.id ? (
                  <button
                    onClick={() => handleProjectClick(items[0].design!.project!.id)}
                    className="hover:text-gray-700 hover:underline transition-colors"
                  >
                    {items[0]?.design?.project?.name}
                  </button>
                ) : (
                  <span>{items[0]?.design?.project?.name}</span>
                )}
                <span>•</span>
                <span>{designName}</span>
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleDesignClick(item.design_id, item.id, !!item.viewed_at)}
                    className={`border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-all cursor-pointer ${
                      item.viewed_at ? 'bg-white' : 'bg-[#F0F9FF]'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <MessageCircle size={16} className="text-gray-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 mb-3">{item.content}</p>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${roleColors[item.stakeholder_role] || roleColors.other}`}>
                            {item.stakeholder_role}
                          </span>
                          <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                            item.is_processed ? statusColors.resolved : statusColors.open
                          }`}>
                            {item.is_processed ? 'Resolved' : 'Open'}
                          </span>
                        </div>

                        <div className="mt-3 text-sm text-gray-500">
                          {item.stakeholder_name}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {item.rating && (
                          <span className="text-xl">{getRatingEmoji(item.rating)}</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
