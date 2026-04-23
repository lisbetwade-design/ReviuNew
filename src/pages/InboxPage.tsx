import { useState, useEffect } from 'react';
import { Inbox, FolderOpen } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
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

const getAvatarColor = (_name: string) => 'bg-gray-100 text-gray-700 border border-gray-200';

const sourceLabel = (sourceType: string, channelName: string | null): { text: string; className: string } => {
  if (sourceType === 'slack') return { text: channelName ? `#${channelName}` : 'Slack', className: 'bg-orange-50 text-orange-600 border border-orange-200' };
  if (sourceType === 'figma') return { text: 'Figma', className: 'bg-purple-50 text-purple-600 border border-purple-200' };
  return { text: 'Web', className: 'bg-gray-100 text-gray-500 border border-gray-200' };
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

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      if (designError) throw designError;

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

      if (standaloneError) throw standaloneError;

      const data = [...(designComments || []), ...(standaloneComments || [])];
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
      setUnviewedCount(mappedData.filter((item: FeedbackItem) => !item.viewed_at).length);

      const projectMap = new Map<string, { name: string; count: number }>();
      let unassignedCount = 0;

      mappedData.forEach((item) => {
        if (item.design?.project?.id) {
          const projectId = item.design.project.id;
          const existing = projectMap.get(projectId);
          if (existing) {
            existing.count++;
          } else {
            projectMap.set(projectId, { name: item.design.project.name, count: 1 });
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

      if (unassignedCount > 0) {
        projectList.push({ id: 'unassigned', name: 'Unassigned', feedbackCount: unassignedCount });
      }

      setProjects(projectList);
    } catch (error) {
      console.error('Error loading feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: FeedbackItem) => {
    if (!item.viewed_at) {
      await supabase.from('comments').update({ viewed_at: new Date().toISOString() }).eq('id', item.id);
      setFeedbackItems(prev => prev.map(f => f.id === item.id ? { ...f, viewed_at: new Date().toISOString() } : f));
      setUnviewedCount(prev => Math.max(0, prev - 1));
    }
    if (item.design_id && onNavigateToDesign) {
      onNavigateToDesign(item.design_id);
    }
  };

  const filteredFeedback = activeProjectId
    ? activeProjectId === 'unassigned'
      ? feedbackItems.filter(item => !item.design?.project?.id)
      : feedbackItems.filter(item => item.design?.project?.id === activeProjectId)
    : feedbackItems;

  // Group by project
  const groups: { key: string; label: string; items: FeedbackItem[] }[] = [];

  if (activeProjectId) {
    groups.push({ key: activeProjectId, label: projects.find(p => p.id === activeProjectId)?.name || 'Feedback', items: filteredFeedback });
  } else {
    const projectGroups = new Map<string, { label: string; items: FeedbackItem[] }>();
    filteredFeedback.forEach(item => {
      const key = item.design?.project?.id || 'unassigned';
      const label = item.design?.project?.name || (item.source_channel_name ? `Slack: #${item.source_channel_name}` : 'Unassigned');
      if (!projectGroups.has(key)) projectGroups.set(key, { label, items: [] });
      projectGroups.get(key)!.items.push(item);
    });
    projectGroups.forEach((val, key) => groups.push({ key, label: val.label, items: val.items }));
  }

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
        <PageHeader icon={Inbox} title="Inbox" subtitle="View and manage all feedback across your projects." badge={0} />
        <EmptyState
          icon={Inbox}
          title="No feedback yet"
          description="Your inbox will show all feedback and comments from stakeholders across your projects."
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={Inbox}
        title="Inbox"
        subtitle="View and manage all feedback across your projects."
        badge={unviewedCount}
      />

      {/* Project filter tabs */}
      {projects.length > 1 && (
        <div className="border-b border-gray-100 px-8">
          <div className="flex gap-1 overflow-x-auto py-2">
            <button
              onClick={() => setActiveProjectId(null)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeProjectId === null ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              All
              <span className={`text-xs px-1.5 py-0.5 rounded ${activeProjectId === null ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {feedbackItems.length}
              </span>
            </button>
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => setActiveProjectId(project.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeProjectId === project.id ? 'bg-[#F5C430] text-gray-900' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {project.name}
                <span className={`text-xs px-1.5 py-0.5 rounded ${activeProjectId === project.id ? 'bg-[#E8B820] text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
                  {project.feedbackCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feedback list */}
      <div className="flex-1 overflow-auto">
        {groups.map(group => (
          <div key={group.key} className="mb-2">
            {/* Group header */}
            <div className="flex items-center gap-3 px-8 py-3">
              {group.key === 'unassigned' ? <Inbox size={15} className="text-gray-400" /> : <FolderOpen size={15} className="text-gray-400" />}
              <span className="text-sm font-semibold text-gray-700">{group.label}</span>
              <span className="text-xs text-gray-400">{group.items.length}</span>
            </div>

            {/* Rows */}
            <div className="border-t border-b border-gray-100">
              {group.items.map((item, idx) => {
                const isUnread = !item.viewed_at;
                const tag = item.design?.name;
                const src = sourceLabel(item.source_type, item.source_channel_name);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`flex items-center gap-4 px-8 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 ${
                      idx !== group.items.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    {/* Unread dot */}
                    <div className="w-2 flex-shrink-0">
                      {isUnread && <div className="w-2 h-2 rounded-full bg-[#F5C430]" />}
                    </div>

                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${getAvatarColor(item.stakeholder_name)}`}>
                      {getInitials(item.stakeholder_name)}
                    </div>

                    {/* Sender name */}
                    <div className="w-36 flex-shrink-0">
                      <span className={`text-sm truncate block ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {item.stakeholder_name}
                      </span>
                    </div>

                    {/* Source label */}
                    <div className="w-24 flex-shrink-0">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium truncate max-w-full ${src.className}`}>
                        {src.text}
                      </span>
                    </div>

                    {/* Design tag */}
                    {tag && (
                      <div className="w-28 flex-shrink-0">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 truncate max-w-full">
                          {tag}
                        </span>
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
                      <span className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {item.content.split(' ').slice(0, 8).join(' ')}{item.content.split(' ').length > 8 ? '!' : ''}
                      </span>
                      <span className="text-sm text-gray-400 truncate hidden md:block">
                        {item.content.split(' ').slice(8, 16).join(' ')}
                        {item.content.split(' ').length > 16 ? '...' : ''}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="flex-shrink-0 text-xs text-gray-400 w-20 text-right">
                      {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
