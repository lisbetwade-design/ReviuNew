import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, MessageSquare, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FeedbackPanel } from '../components/FeedbackPanel';

interface Design {
  id: string;
  name: string;
  image_url: string | null;
  source_url: string | null;
}


interface FolderViewerPageProps {
  folderId: string;
  projectName: string;
  onBack: () => void;
}

export function FolderViewerPage({ folderId, projectName, onBack }: FolderViewerPageProps) {
  const [folder, setFolder] = useState<any>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [commentRefreshKey, setCommentRefreshKey] = useState(0);

  useEffect(() => {
    loadData();
    getCurrentUser();
  }, [folderId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const loadData = async () => {
    try {
      const { data: folderData, error: folderError } = await supabase
        .from('design_folders')
        .select('*, designs(*)')
        .eq('id', folderId)
        .single();

      if (folderError) throw folderError;

      setFolder(folderData);
      setDesigns(folderData.designs || []);
    } catch (error) {
      console.error('Error loading folder:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !currentUser || designs.length === 0) return;

    setSending(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', currentUser.id)
        .maybeSingle();

      const { data, error } = await supabase.from('comments').insert({
        design_id: designs[currentIndex].id,
        user_id: currentUser.id,
        author_name: profile?.full_name || profile?.email || 'Anonymous',
        content: newComment.trim(),
        status: 'open',
      }).select();

      if (error) throw error;

      if (data && data[0]) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-notify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              commentId: data[0].id,
              designId: designs[currentIndex].id,
              authorName: profile?.full_name || profile?.email || 'Anonymous',
              content: newComment.trim(),
            }),
          }).catch(err => console.error('Failed to send Slack notification:', err));
        }
      }

      setNewComment('');
      // Trigger refresh of FeedbackPanel by updating the key
      setCommentRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error sending comment:', error);
      alert('Failed to send comment. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < designs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!folder || designs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Folder not found or empty</div>
      </div>
    );
  }

  const currentDesign = designs[currentIndex];

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{folder.name}</h1>
              <p className="text-sm text-gray-500">{projectName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <span className="text-sm text-gray-600 px-3">
              {currentIndex + 1} / {designs.length}
            </span>
            <button
              onClick={goToNext}
              disabled={currentIndex === designs.length - 1}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-[#F6F7F9] flex flex-col items-center justify-center p-8 overflow-auto">
          <div className="max-w-full max-h-full mb-4">
            {currentDesign.image_url ? (
              <img
                src={currentDesign.image_url}
                alt={currentDesign.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            ) : (
              <div className="text-gray-500">No preview available</div>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{currentDesign.name}</h3>
        </div>

        <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
          <FeedbackPanel key={`${currentDesign.id}-${commentRefreshKey}`} designId={currentDesign.id} />
          
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#4F46E5] bg-gray-50 text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>
            <div className="flex items-center justify-end mt-3">
              <button
                onClick={handleSendComment}
                disabled={!newComment.trim() || sending}
                className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white text-sm font-medium rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
