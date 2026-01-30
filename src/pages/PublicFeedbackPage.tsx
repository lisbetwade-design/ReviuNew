import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, ExternalLink, User, Clock, Star, Hand } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StakeholderWelcomeModal } from '../components/StakeholderWelcomeModal';
import { TrackingScriptModal } from '../components/TrackingScriptModal';

interface Design {
  id: string;
  name: string;
  image_url: string | null;
  source_url: string | null;
  source_type: string;
  folder_id: string | null;
}

interface Comment {
  id: string;
  content: string;
  author_name: string;
  author_email: string;
  rating: number | null;
  x_position: number | null;
  y_position: number | null;
  page_url: string | null;
  element_selector: string | null;
  element_text: string | null;
  created_at: string;
}

interface Project {
  name: string;
}

interface PublicFeedbackPageProps {
  token: string;
}

interface CommentPin {
  id?: string;
  x: number;
  y: number;
  number: number;
  comment?: Comment;
}

export function PublicFeedbackPage({ token }: PublicFeedbackPageProps) {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [currentDesignIndex, setCurrentDesignIndex] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [stakeholder, setStakeholder] = useState<{ name: string; surname: string; role: string; email: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [folder, setFolder] = useState<any>(null);
  const [commentPins, setCommentPins] = useState<CommentPin[]>([]);
  const [activePin, setActivePin] = useState<CommentPin | null>(null);
  const [isCommentActive, setIsCommentActive] = useState(false);
  const [commentMode, setCommentMode] = useState(true);
  const [currentPageUrl, setCurrentPageUrl] = useState<string>('');
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const designContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const ensureAnonymousSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.signOut();
      }
    };

    ensureAnonymousSession().then(() => {
      loadData();
    });
  }, [token]);

  useEffect(() => {
    if (designs.length > 0) {
      const currentDesign = designs[currentDesignIndex];
      // Initialize with the base URL, automatic detection will update this
      const baseUrl = currentDesign.source_url || '';
      try {
        const url = new URL(baseUrl);
        const pagePath = url.pathname + url.hash + url.search;
        setCurrentPageUrl(pagePath);
        loadComments(currentDesign.id, pagePath);
      } catch {
        setCurrentPageUrl('');
        loadComments(currentDesign.id, '');
      }
    }
  }, [currentDesignIndex, designs]);

  useEffect(() => {
    const pins: CommentPin[] = comments
      .filter(c => c.x_position !== null && c.y_position !== null)
      .map((c, idx) => ({
        id: c.id,
        x: c.x_position!,
        y: c.y_position!,
        number: idx + 1,
        comment: c
      }));
    setCommentPins(pins);
  }, [comments]);

  // Listen for page changes from embedded content via postMessage
  useEffect(() => {
    if (!designs.length) return;

    const handleMessage = (event: MessageEvent) => {
      // Accept messages from any origin for flexibility
      if (!event.data) return;

      // Handle page change messages: { type: 'reviuPageChange', url: '/page-path' }
      if (event.data.type === 'reviuPageChange' && event.data.url) {
        const newUrl = event.data.url;
        if (newUrl !== currentPageUrl) {
          setCurrentPageUrl(newUrl);
          loadComments(designs[currentDesignIndex].id, newUrl);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [designs, currentDesignIndex, currentPageUrl]);

  // Monitor iframe URL for same-origin content or hash changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !designs.length) return;

    const checkIframeUrl = () => {
      try {
        // Try to access same-origin iframe URL
        const iframeUrl = iframe.contentWindow?.location.href;
        if (iframeUrl) {
          const url = new URL(iframeUrl);
          const pagePath = url.pathname + url.hash + url.search;
          if (pagePath !== currentPageUrl) {
            setCurrentPageUrl(pagePath);
            loadComments(designs[currentDesignIndex].id, pagePath);
          }
        }
      } catch (e) {
        // Cross-origin - can't access directly, will rely on postMessage
      }
    };

    // Check on load and periodically (for SPAs with hash routing)
    iframe.addEventListener('load', checkIframeUrl);
    const interval = setInterval(checkIframeUrl, 1000);

    return () => {
      iframe.removeEventListener('load', checkIframeUrl);
      clearInterval(interval);
    };
  }, [designs, currentDesignIndex]);

  const loadData = async () => {
    try {
      const folderResult = await supabase
        .from('design_folders')
        .select('*, designs(*), projects(name)')
        .eq('shareable_token', token)
        .maybeSingle();

      if (folderResult.data) {
        setFolder(folderResult.data);
        setDesigns(folderResult.data.designs || []);
        setProjectName(folderResult.data.projects?.name || 'Project');
        setLoading(false);
        return;
      }

      const designResult = await supabase
        .from('designs')
        .select('*, projects(name)')
        .eq('shareable_token', token)
        .maybeSingle();

      if (designResult.data) {
        setDesigns([designResult.data]);
        setProjectName(designResult.data.projects?.name || 'Project');
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (designId: string, pageUrl: string = '') => {
    try {
      let query = supabase
        .from('comments')
        .select('*')
        .eq('design_id', designId);

      // Filter by page_url if provided (for embedded content with multiple pages)
      if (pageUrl.trim()) {
        // Show comments for this specific page OR comments without a page_url (legacy/general comments)
        query = query.or(`page_url.eq.${pageUrl},page_url.is.null`);
      }
      // If no page URL specified, show all comments for this design

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleDesignClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!designContainerRef.current) return;

    const rect = designContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newPin: CommentPin = {
      x,
      y,
      number: commentPins.length + 1
    };

    setActivePin(newPin);
    setIsCommentActive(true);
    setNewComment('');
    setRating(null);
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !stakeholder || designs.length === 0 || !activePin) return;

    setSending(true);
    try {
      const insertData: any = {
        design_id: designs[currentDesignIndex].id,
        author_name: `${stakeholder.name} ${stakeholder.surname}`,
        author_email: stakeholder.email,
        content: newComment.trim(),
        status: 'open',
        user_id: null,
        x_position: activePin.x,
        y_position: activePin.y,
        page_url: currentPageUrl.trim() || null,
      };

      if (rating) {
        insertData.rating = rating;
      }

      const { data, error } = await supabase.from('comments').insert(insertData).select();

      if (error) {
        console.error('Insert error details:', error);
        alert(`Failed to send comment: ${error.message}`);
        throw error;
      }

      if (data && data[0]) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            commentId: data[0].id,
            designId: designs[currentDesignIndex].id,
            authorName: `${stakeholder.name} ${stakeholder.surname}`,
            content: newComment.trim(),
            rating: rating || undefined,
          }),
        }).catch(err => console.error('Failed to send Slack notification:', err));
      }

      setNewComment('');
      setRating(null);
      setActivePin(null);
      setIsCommentActive(false);

      setTimeout(() => {
        loadComments(designs[currentDesignIndex].id, currentPageUrl);
      }, 500);
    } catch (error) {
      console.error('Error sending comment:', error);
    } finally {
      setSending(false);
    }
  };

  const handlePinClick = (pin: CommentPin, e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePin(pin);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F6F7F9]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (designs.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F6F7F9]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Not Found</h2>
          <p className="text-gray-600">This design could not be found.</p>
        </div>
      </div>
    );
  }

  if (!stakeholder) {
    return <StakeholderWelcomeModal onComplete={setStakeholder} />;
  }

  const currentDesign = designs[currentDesignIndex];

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const getRatingEmoji = (rating: number | null) => {
    if (!rating) return null;
    const emojis = ['😞', '😕', '😐', '😊', '😍'];
    return emojis[rating - 1];
  };

  const generalComments = comments.filter(c => c.x_position === null || c.y_position === null);

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center">
              <MessageSquare size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{projectName}</h1>
              <p className="text-xs text-gray-500">{currentDesign.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock size={14} />
            <span>Viewing as {stakeholder.name} {stakeholder.surname}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 border-r border-gray-200 flex flex-col bg-gray-50">
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Feedback</h2>
              <span className="text-xs text-gray-500">{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {commentPins.length === 0 && generalComments.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">No feedback yet</p>
                <p className="text-xs text-gray-400 mt-1">Click on the design to add feedback</p>
              </div>
            ) : (
              <>
                {activePin && !activePin.id && (
                  <div className="bg-[#EEF2FF] rounded-xl p-4 border-2 border-[#2563EB]">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        {activePin.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#2563EB] font-medium">New comment pin placed</p>
                        <p className="text-xs text-gray-600 mt-1">Add your feedback below</p>
                      </div>
                    </div>
                  </div>
                )}
                {commentPins.map((pin) => (
                  <div
                    key={pin.id}
                    className={`bg-white rounded-xl p-4 border-2 transition-all cursor-pointer ${
                      activePin?.id === pin.id
                        ? 'border-[#2563EB] shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => pin.comment && setActivePin(pin)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        {pin.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        {pin.comment && (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-gray-900">{pin.comment.author_name}</span>
                              {pin.comment.rating && (
                                <span className="text-base">{getRatingEmoji(pin.comment.rating)}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mb-2">{getTimeAgo(pin.comment.created_at)}</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{pin.comment.content}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {generalComments.map((comment, idx) => (
                  <div key={comment.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        {commentPins.length + idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-gray-900">{comment.author_name}</span>
                          {comment.rating && (
                            <span className="text-base">{getRatingEmoji(comment.rating)}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{getTimeAgo(comment.created_at)}</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="border-t border-gray-200 bg-white p-4">
            {isCommentActive ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">Rate:</span>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => setRating(value)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        rating === value
                          ? 'bg-[#2563EB] scale-110'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <Star
                        size={14}
                        className={rating === value ? 'text-white fill-white' : 'text-gray-400'}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your feedback..."
                  rows={3}
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-sm text-gray-900 placeholder:text-gray-400"
                />
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setIsCommentActive(false);
                      setNewComment('');
                      setRating(null);
                      setActivePin(null);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendComment}
                    disabled={!newComment.trim() || sending}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={14} />
                    {sending ? 'Sending...' : 'Post'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCommentActive(true)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm text-gray-600 font-medium"
              >
                <MessageSquare size={16} />
                Add feedback...
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 relative bg-gray-100">
          <div
            ref={designContainerRef}
            className="absolute inset-0 overflow-auto p-8"
          >
            {currentDesign.image_url ? (
              <div
                className="flex items-center justify-center h-full relative"
                onClick={commentMode ? handleDesignClick : undefined}
                style={commentMode ? { cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(37,99,235)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>') 12 12, pointer` } : undefined}
              >
                <img
                  src={currentDesign.image_url}
                  alt={currentDesign.name}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                />
                {commentPins.map((pin) => (
                  <button
                    key={pin.id || `${pin.x}-${pin.y}`}
                    className={`absolute w-8 h-8 rounded-full bg-[#2563EB] text-white font-bold text-sm flex items-center justify-center shadow-lg transition-all border-2 border-white ${
                      activePin?.id === pin.id ? 'scale-125 ring-4 ring-[#2563EB]/30' : 'hover:scale-110'
                    }`}
                    style={{
                      left: `${pin.x}%`,
                      top: `${pin.y}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    onClick={(e) => handlePinClick(pin, e)}
                  >
                    {pin.number}
                  </button>
                ))}
                {activePin && !activePin.id && (
                  <div
                    className="absolute w-8 h-8 rounded-full bg-[#2563EB] text-white font-bold text-sm flex items-center justify-center shadow-lg border-2 border-white animate-pulse"
                    style={{
                      left: `${activePin.x}%`,
                      top: `${activePin.y}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    {activePin.number}
                  </div>
                )}
              </div>
            ) : currentDesign.source_url ? (
              currentDesign.source_type === 'figma' ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center bg-white rounded-2xl p-12 shadow-lg">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#F6F8FE] mb-4">
                      <MessageSquare size={40} className="text-[#2563EB]" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Figma Design</h3>
                    <p className="text-gray-600 mb-6 max-w-sm">This design is linked from Figma. Click below to view it.</p>
                    <a
                      href={currentDesign.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl font-medium hover:bg-[#1d4ed8] transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={18} />
                      Open in Figma
                    </a>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col gap-4">
                  <div className="bg-white px-4 py-3 rounded-xl shadow-sm" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-600 truncate flex-1">{currentDesign.source_url}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
                          <button
                            onClick={() => setCommentMode(true)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                              commentMode
                                ? 'bg-[#2563EB] text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            <MessageSquare size={16} />
                            Comment
                          </button>
                          <button
                            onClick={() => setCommentMode(false)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                              !commentMode
                                ? 'bg-[#2563EB] text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            <Hand size={16} />
                            Interact
                          </button>
                        </div>
                        <a
                          href={currentDesign.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                        >
                          <ExternalLink size={16} />
                          Open
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 bg-white rounded-xl shadow-lg overflow-hidden relative">
                    <iframe
                      ref={iframeRef}
                      src={currentDesign.source_url}
                      className="w-full h-full border-0"
                      title={currentDesign.name}
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                    />
                    {commentMode && (
                      <div
                        className="absolute inset-0 z-[5]"
                        style={{ cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(37,99,235)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>') 12 12, pointer` }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = ((e.clientX - rect.left) / rect.width) * 100;
                          const y = ((e.clientY - rect.top) / rect.height) * 100;

                          const newPin: CommentPin = {
                            x,
                            y,
                            number: commentPins.length + 1
                          };

                          setActivePin(newPin);
                          setIsCommentActive(true);
                          setNewComment('');
                          setRating(null);
                        }}
                      />
                    )}
                    {commentPins.map((pin) => (
                      <button
                        key={pin.id || `${pin.x}-${pin.y}`}
                        className={`absolute w-8 h-8 rounded-full bg-[#2563EB] text-white font-bold text-sm flex items-center justify-center shadow-lg transition-all border-2 border-white z-10 ${
                          activePin?.id === pin.id ? 'scale-125 ring-4 ring-[#2563EB]/30' : 'hover:scale-110'
                        }`}
                        style={{
                          left: `${pin.x}%`,
                          top: `${pin.y}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                        onClick={(e) => handlePinClick(pin, e)}
                      >
                        {pin.number}
                      </button>
                    ))}
                    {activePin && !activePin.id && (
                      <div
                        className="absolute w-8 h-8 rounded-full bg-[#2563EB] text-white font-bold text-sm flex items-center justify-center shadow-lg border-2 border-white z-10 animate-pulse"
                        style={{
                          left: `${activePin.x}%`,
                          top: `${activePin.y}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        {activePin.number}
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare size={64} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No preview available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showTrackingModal && (
        <TrackingScriptModal onClose={() => setShowTrackingModal(false)} />
      )}
    </div>
  );
}
