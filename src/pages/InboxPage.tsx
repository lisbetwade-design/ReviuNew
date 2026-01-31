import { useState, useEffect } from 'react';
import { Inbox, FolderOpen, MessageCircle, Snowflake, Flame, Plus } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { supabase } from '../lib/supabase';

interface FeedbackItem {
  id: string;
  design_id: string | null;
  stakeholder_name: string;
  stakeholder_email: string | null;
  stakeholder_role: string;
  content: string;
  rating: number | null;
  source_type: string;
  source_channel: string | null;
  source_channel_name: string | null;
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-green-100 text-green-700',
      'bg-purple-100 text-purple-700',
      'bg-pink-100 text-pink-700',
      'bg-orange-100 text-orange-700',
      'bg-cyan-100 text-cyan-700',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch design comments (comments linked to designs)
      const { data: designComments, error: designError } = await supabase
        .from('comments')
        .select(`
          id,
          design_id,
          author_name,
          author_email,
          content,
          rating,
          status,
          source_channel,
          source_channel_name,
          created_at,
          viewed_at,
          created_by,
          design:designs!inner(
            name,
            source_url,
            project_id,
            project:projects!inner(id, name, user_id)
          )
        `)
        .eq('design.project.user_id', user.id);

      if (designError) {
        console.error('Error fetching design comments:', designError);
        throw designError;
      }

      // Fetch standalone comments (comments not linked to designs, like Slack messages)
      const { data: standaloneComments, error: standaloneError } = await supabase
        .from('comments')
        .select(`
          id,
          design_id,
          author_name,
          author_email,
          content,
          rating,
          status,
          source_channel,
          source_channel_name,
          created_at,
          viewed_at,
          created_by
        `)
        .is('design_id', null)
        .eq('created_by', user.id);

      if (standaloneError) {
        console.error('Error fetching standalone comments:', standaloneError);
        throw standaloneError;
      }

      // Combine both types of comments
      const data = [...(designComments || []), ...(standaloneComments || [])];

      // Sort by created_at descending
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log('Fetched comments:', data);

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
          source_channel: comment.source_channel,
          source_channel_name: comment.source_channel_name,
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
    const designKey = item.design?.name || (item.source_channel_name ? `Slack: #${item.source_channel_name}` : 'Inbox Messages');
    if (!acc[designKey]) {
      acc[designKey] = [];
    }
    acc[designKey].push(item);
    return acc;
  }, {} as Record<string, FeedbackItem[]>);

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">Inbox</h2>
          <p className="text-sm text-gray-600 mt-1">Loading...</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading feedback...</div>
        </div>
      </div>
    );
  }

  if (feedbackItems.length === 0) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">Inbox</h2>
          <p className="text-sm text-gray-600 mt-1">0</p>
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
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {Object.entries(groupedByDesign).map(([designName, items], groupIndex) => (
            <div key={designName}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
                <h2 className="text-xl font-bold text-gray-900">{designName}</h2>
                <p className="text-sm text-gray-600 mt-1">{items.length}</p>
              </div>

              <div className="divide-y divide-gray-100">
                {items.map((item, itemIndex) => (
                  <div
                    key={item.id}
                    onClick={() => item.design_id && handleDesignClick(item.design_id, item.id, !!item.viewed_at)}
                    className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                      item.design_id ? 'cursor-pointer' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 text-sm text-gray-500 w-6 text-center pt-1">
                        {item.rating || '0'}
                      </div>

                      <div className="flex-shrink-0 relative">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold ${getAvatarColor(item.stakeholder_name)}`}>
                          {getInitials(item.stakeholder_name)}
                        </div>
                        {item.source_type === 'slack' && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            P
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {!item.viewed_at && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                          <span className="font-semibold text-gray-900">{item.stakeholder_name}</span>
                        </div>

                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.content}</p>

                        <div className="flex flex-wrap items-center gap-2">
                          {item.rating && item.rating <= 2 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-600">
                              <Snowflake size={12} />
                              Cold
                            </span>
                          )}
                          {item.rating && item.rating >= 4 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-orange-50 text-orange-600">
                              <Flame size={12} />
                              Hot
                            </span>
                          )}
                          {!item.viewed_at && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-600">
                              <Plus size={12} />
                              New
                            </span>
                          )}
                          {item.source_channel_name && (
                            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                              S: {item.source_channel_name}
                            </span>
                          )}
                          {item.stakeholder_role && (
                            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                              S: {item.stakeholder_role}
                            </span>
                          )}
                          {item.is_processed ? (
                            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                              Resolved
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                              Open
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-sm text-gray-500 pt-1">
                        {getTimeAgo(item.created_at)}
                      </div>
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
