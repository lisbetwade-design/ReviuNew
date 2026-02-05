import { useState, useEffect } from 'react';
import { Inbox, FolderOpen, MessageCircle, Figma } from 'lucide-react';
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
  client: 'bg-gray-100 text-gray-700',
  pm: 'bg-gray-100 text-gray-700',
  developer: 'bg-gray-100 text-gray-700',
  designer: 'bg-gray-100 text-gray-700',
  other: 'bg-gray-100 text-gray-700',
  'Slack User': 'bg-gray-100 text-gray-700',
};

const statusColors: Record<string, string> = {
  open: 'bg-gray-100 text-gray-700',
  'under review': 'bg-gray-100 text-gray-700',
  resolved: 'bg-gray-100 text-gray-700',
};

const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d`;
  return `${Math.floor(diffInSeconds / 2592000)}mo`;
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
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
        const isSlack = comment.source_channel === 'slack' || comment.author_email?.includes('slack.com');
        const isFigma = comment.source_channel === 'figma' || comment.author_email?.includes('figma');

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
      let unassignedCount = 0;

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
        } else {
          unassignedCount++;
        }
      });

      const projectList = Array.from(projectMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        feedbackCount: data.count,
      }));

      // Add unassigned filter if there are standalone comments
      if (unassignedCount > 0) {
        projectList.push({
          id: 'unassigned',
          name: 'Unassigned',
          feedbackCount: unassignedCount,
        });
      }

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
    ? activeProjectId === 'unassigned'
      ? feedbackItems.filter((item) => !item.design?.project?.id)
      : feedbackItems.filter((item) => item.design?.project?.id === activeProjectId)
    : feedbackItems;

  const groupedByDesign = filteredFeedback.reduce((acc, item) => {
    let designKey: string;
    if (item.design?.name) {
      designKey = item.design.name;
    } else if (item.source_type === 'figma') {
      designKey = 'Figma Comments';
    } else if (item.source_channel_name) {
      designKey = `Slack: #${item.source_channel_name}`;
    } else {
      designKey = 'Inbox Messages';
    }

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
                {project.id === 'unassigned' ? (
                  <Inbox size={16} />
                ) : (
                  <FolderOpen size={16} />
                )}
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

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl">
          {Object.entries(groupedByDesign).map(([designName, items]) => {
            const isFigmaGroup = designName === 'Figma Comments';
            const isSlackGroup = designName.startsWith('Slack:');

            return (
              <div key={designName} className="border-b border-gray-100">
                <div className="bg-white px-6 py-3 border-b border-gray-100">
                  {items[0]?.design_id ? (
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
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      {isFigmaGroup && <Figma size={16} className="text-purple-500" />}
                      {isSlackGroup && <MessageCircle size={16} className="text-orange-500" />}
                      <h2 className="font-semibold text-gray-900">{designName}</h2>
                      <span className="text-gray-500">{items.length}</span>
                    </div>
                  )}
                </div>

              <div>
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    onClick={() => item.design_id && handleDesignClick(item.design_id, item.id, !!item.viewed_at)}
                    className={`flex gap-3 px-6 py-4 hover:bg-gray-50 transition-colors ${
                      item.design_id ? 'cursor-pointer' : ''
                    } ${index !== items.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                        {getInitials(item.stakeholder_name)}
                        {item.source_type === 'slack' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                            <MessageCircle size={10} className="text-white" />
                          </div>
                        )}
                        {item.source_type === 'figma' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                            <Figma size={10} className="text-white" />
                          </div>
                        )}
                      </div>
                      {item.rating && (
                        <span className="text-xs text-gray-600 mt-1">
                          {item.rating}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        {!item.viewed_at && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                        <span className="font-semibold text-gray-900 text-[15px]">
                          {item.stakeholder_name}
                        </span>
                        <span className="text-gray-500 text-sm flex-shrink-0">
                          {getRelativeTime(item.created_at)}
                        </span>
                      </div>

                      <p className="text-gray-700 text-[15px] mb-2 line-clamp-2">
                        {item.content}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        {!item.is_processed && (
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            + New
                          </span>
                        )}
                        {item.source_channel_name && (
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            #{item.source_channel_name}
                          </span>
                        )}
                        {item.design?.project?.name && (
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            {item.design.project.name}
                          </span>
                        )}
                        {item.stakeholder_role && item.stakeholder_role !== 'Slack User' && (
                          <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium ${roleColors[item.stakeholder_role] || roleColors.other}`}>
                            {item.stakeholder_role}
                          </span>
                        )}
                        {item.is_processed && (
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
