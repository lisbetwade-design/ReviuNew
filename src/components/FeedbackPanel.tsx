import { useState, useEffect } from 'react';
import { Search, MoreVertical, MessageCircle, Sparkles, X, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Plus, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Comment {
  id: string;
  content: string;
  author_name: string;
  author_email: string | null;
  rating: number | null;
  status: string;
  created_at: string;
}

interface FeedbackPanelProps {
  designId: string;
}

export function FeedbackPanel({ designId }: FeedbackPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [addingToBoard, setAddingToBoard] = useState<string | null>(null);
  const [boardItems, setBoardItems] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);

  useEffect(() => {
    loadData();
  }, [designId]);

  const loadData = async () => {
    try {
      const { data: design, error: designError } = await supabase
        .from('designs')
        .select('project_id')
        .eq('id', designId)
        .single();

      if (designError) throw designError;
      setProjectId(design.project_id);

      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('design_id', designId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);

      if (design.project_id) {
        const { data: summaryData, error: summaryError } = await supabase
          .from('feedback_summaries')
          .select('*')
          .eq('project_id', design.project_id)
          .eq('design_id', designId)
          .maybeSingle();

        if (!summaryError && summaryData) {
          setSummary(summaryData);
        }

        const { data: boardItemsData, error: boardError } = await supabase
          .from('board_items')
          .select('*')
          .eq('design_id', designId);

        if (!boardError && boardItemsData) {
          setBoardItems(boardItemsData);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!projectId || generatingSummary) return;

    setGeneratingSummary(true);
    setShowSummary(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-summary`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            designId,
            projectId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('API error response:', result);
        throw new Error(result.error || 'Failed to generate summary');
      }

      console.log('Summary generated successfully:', result);
      setSummary(result.summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary. Please try again.';
      console.error('Full error details:', errorMessage);
      alert(errorMessage);
      setShowSummary(false);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleAddToBoard = async (insight: any) => {
    if (!projectId || addingToBoard) return;

    setAddingToBoard(insight.title);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const priorityMap: Record<string, string> = {
        urgent: 'high',
        critical: 'high',
        high: 'high',
        medium: 'medium',
        low: 'low',
      };

      const { error } = await supabase
        .from('board_items')
        .insert({
          user_id: user.id,
          project_id: projectId,
          design_id: designId,
          title: insight.title,
          description: insight.description,
          status: 'open',
          priority: priorityMap[insight.priority] || 'medium',
          stakeholder_role: insight.tag || 'Other',
        });

      if (error) throw error;

      await loadData();
      alert('Task added to board successfully!');
    } catch (error) {
      console.error('Error adding to board:', error);
      alert('Failed to add task to board. Please try again.');
    } finally {
      setAddingToBoard(null);
    }
  };

  const isInBoard = (stepTitle: string) => {
    return boardItems.some(item => item.title === stepTitle);
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !projectId) return;

    setSendingComment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to comment');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', user.id)
        .maybeSingle();

      const { error } = await supabase
        .from('comments')
        .insert({
          design_id: designId,
          project_id: projectId,
          created_by: user.id,
          author_name: profile?.display_name || user.email || 'Team Member',
          author_email: user.email || '',
          content: newComment.trim(),
          status: 'open',
        });

      if (error) throw error;

      setNewComment('');
      setShowCommentInput(false);
      await loadData();
    } catch (error) {
      console.error('Error sending comment:', error);
      alert('Failed to send comment. Please try again.');
    } finally {
      setSendingComment(false);
    }
  };

  const getSourceBadge = (email: string | null) => {
    if (!email) return { label: 'Guest', color: 'bg-gray-100 text-gray-600', icon: null };
    if (email.includes('figma')) return {
      label: 'Figma',
      color: 'bg-purple-50 text-purple-700',
      icon: '🎨'
    };
    return { label: 'Client', color: 'bg-purple-50 text-purple-700', icon: null };
  };

  const getRoleBadge = (email: string | null) => {
    if (!email) return null;
    if (email.includes('pm') || email.toLowerCase().includes('manager')) {
      return { label: 'PM', color: 'bg-blue-100 text-blue-700' };
    }
    if (email.includes('designer')) {
      return { label: 'Designer', color: 'bg-pink-100 text-pink-700' };
    }
    return { label: 'Client', color: 'bg-purple-100 text-purple-700' };
  };

  const getStatusBadge = (status: string) => {
    if (status === 'resolved') return { label: 'Resolved', color: 'bg-green-100 text-green-700' };
    if (status === 'archived') return { label: 'Under Review', color: 'bg-gray-100 text-gray-700' };
    return { label: 'Open', color: 'bg-orange-100 text-orange-700' };
  };

  const getRatingEmoji = (rating: number | null) => {
    if (!rating) return null;
    const emojis = ['😞', '😕', '😐', '😊', '😍'];
    return emojis[rating - 1];
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 604800)}w ago`;
  };

  const getSentimentIcon = (sentiment: string) => {
    if (sentiment === 'positive') return <TrendingUp size={20} className="text-green-600" />;
    if (sentiment === 'negative') return <TrendingDown size={20} className="text-red-600" />;
    return <AlertCircle size={20} className="text-orange-600" />;
  };

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === 'positive') return 'bg-green-50 text-green-700 border-green-200';
    if (sentiment === 'negative') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-orange-50 text-orange-700 border-orange-200';
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'critical' || priority === 'urgent') return 'bg-red-100 text-red-700';
    if (priority === 'high') return 'bg-orange-100 text-orange-700';
    if (priority === 'low') return 'bg-gray-100 text-gray-700';
    return 'bg-blue-100 text-blue-700';
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-700',
      urgent: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-blue-100 text-blue-700',
      low: 'bg-gray-100 text-gray-700',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const filteredComments = comments.filter(comment =>
    comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comment.author_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const summaryData = summary?.summary_data;

  return (
    <div className={`flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-full transition-all duration-300 ${showSummary ? 'w-[800px]' : 'w-80'}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Feedback</h3>
          {summary && !showSummary ? (
            <button
              onClick={() => setShowSummary(true)}
              className="text-[#2563EB] text-sm font-medium hover:underline transition-colors"
            >
              Open summary
            </button>
          ) : !summary && (
            <button
              onClick={handleGenerateSummary}
              disabled={generatingSummary || !projectId || comments.length === 0}
              className="flex items-center gap-1.5 text-[#2563EB] text-sm font-medium hover:text-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={14} className={generatingSummary ? 'animate-pulse' : ''} />
              {generatingSummary ? 'Generating...' : 'Generate summary'}
            </button>
          )}
        </div>

        {!showSummary && (
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search feedback..."
              className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-gray-50"
            />
          </div>
        )}
      </div>

      {showSummary && summaryData ? (
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Identified Patterns</h2>
              <button
                onClick={() => setShowSummary(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {generatingSummary ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Sparkles size={48} className="text-[#2563EB] animate-pulse mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">Analyzing feedback...</p>
                <p className="text-sm text-gray-500">This may take a moment</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-4">
                    AI detected these repeating topics across feedback
                  </p>
                  
                  {summaryData.identifiedPatterns && summaryData.identifiedPatterns.length > 0 ? (
                    <div className="space-y-4">
                      {summaryData.identifiedPatterns.map((pattern: any, i: number) => (
                        <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-gray-900 text-base">{pattern.title}</h4>
                            <span className={`text-xs px-2 py-1 rounded-md font-medium ${getPriorityBadge(pattern.priority)}`}>
                              {pattern.priority.charAt(0).toUpperCase() + pattern.priority.slice(1)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{pattern.description}</p>
                          {pattern.examples && pattern.examples.length > 0 && (
                            <div className="space-y-2 mb-3">
                              {pattern.examples.map((example: string, j: number) => (
                                <p key={j} className="text-xs text-gray-500 italic pl-2 border-l-2 border-gray-200">
                                  "{example}"
                                </p>
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            {pattern.mentions} {pattern.mentions === 1 ? 'mention' : 'mentions'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No patterns identified yet</p>
                  )}
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Critical Issues</h3>
                  {summaryData.criticalIssues && summaryData.criticalIssues.length > 0 ? (
                    <div className="space-y-2">
                      {summaryData.criticalIssues.map((issue: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-3 bg-red-50 rounded-xl">
                          <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-700">{issue}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No critical issues identified</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Actionable Next Steps</h3>
                  {summaryData.actionableNextSteps && summaryData.actionableNextSteps.length > 0 ? (
                    <div className="space-y-3">
                      {summaryData.actionableNextSteps.map((step: any, i: number) => (
                        <div key={i} className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-[#2563EB] transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-gray-900 flex-1">{step.title}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-md font-medium">
                                {step.tag}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-md font-medium ${getPriorityBadge(step.priority)}`}>
                                {step.priority.charAt(0).toUpperCase() + step.priority.slice(1)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{step.description}</p>
                          {isInBoard(step.title) ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium">
                              <CheckCircle size={14} />
                              In Task Board
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddToBoard(step)}
                              disabled={addingToBoard === step.title}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                            >
                              <Plus size={14} />
                              {addingToBoard === step.title ? 'Adding...' : 'Add to Board'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No actionable next steps generated</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          ) : filteredComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <p className="text-sm text-gray-500">No feedback yet</p>
            </div>
          ) : (
            <>
            <div className="space-y-4">
              {filteredComments.map((comment, idx) => {
                const sourceBadge = getSourceBadge(comment.author_email);
                const roleBadge = getRoleBadge(comment.author_email);
                const statusBadge = getStatusBadge(comment.status);
                const emoji = getRatingEmoji(comment.rating);

                return (
                  <div
                    key={comment.id}
                    className="bg-white rounded-xl p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-[#2563EB] rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm text-gray-900 leading-relaxed pr-2">
                            {comment.content}
                          </p>
                          {emoji && (
                            <span className="text-xl flex-shrink-0">{emoji}</span>
                          )}
                          <button className="text-gray-400 hover:text-gray-600 ml-1 flex-shrink-0">
                            <MoreVertical size={16} />
                          </button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {sourceBadge.icon && (
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium ${sourceBadge.color}`}>
                              <span>{sourceBadge.icon}</span>
                              {sourceBadge.label}
                            </span>
                          )}
                          {!sourceBadge.icon && (
                            <span className={`text-xs px-2 py-1 rounded-md font-medium ${sourceBadge.color}`}>
                              {sourceBadge.label}
                            </span>
                          )}
                          {roleBadge && (
                            <span className={`text-xs px-2 py-1 rounded-md font-medium ${roleBadge.color}`}>
                              {roleBadge.label}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded-md font-medium ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">
                            {getTimeAgo(comment.created_at)}
                          </span>
                        </div>

                        <div className="mt-1 text-sm text-gray-600 font-medium">
                          {comment.author_name}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!showSummary && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                {showCommentInput ? (
                  <div className="space-y-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add your feedback..."
                      rows={3}
                      autoFocus
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-sm text-gray-900 placeholder:text-gray-400"
                    />
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          setShowCommentInput(false);
                          setNewComment('');
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSendComment}
                        disabled={!newComment.trim() || sendingComment}
                        className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send size={14} />
                        {sendingComment ? 'Sending...' : 'Post'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCommentInput(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm text-gray-600 font-medium border border-gray-200"
                  >
                    <MessageCircle size={16} />
                    Add feedback
                  </button>
                )}
              </div>
            )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
