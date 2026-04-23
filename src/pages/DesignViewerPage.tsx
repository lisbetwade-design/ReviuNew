import { useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FeedbackPanel, Comment } from '../components/FeedbackPanel';

interface Design {
  id: string;
  name: string;
  image_url: string | null;
  source_url: string | null;
  source_type: string;
}

interface DesignViewerPageProps {
  designId: string;
  projectName: string;
  onBack: () => void;
}

export function DesignViewerPage({ designId, projectName, onBack }: DesignViewerPageProps) {
  const [design, setDesign] = useState<Design | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [designId]);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('designs')
        .select('*')
        .eq('id', designId)
        .single();

      if (error) throw error;
      setDesign(data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Only comments that have position data
  const pinnedComments = comments.filter(c => c.x_position != null && c.y_position != null);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Design not found</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{design.name}</h1>
            <p className="text-sm text-gray-500">{projectName}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Design canvas */}
        <div className="flex-1 bg-[#F0F0F3] flex items-center justify-center p-8 overflow-auto">
          {design.image_url ? (
            <div className="relative max-w-full max-h-full" onClick={() => setActiveCommentId(null)}>
              <img
                src={design.image_url}
                alt={design.name}
                className="max-w-full max-h-full object-contain rounded-xl shadow-lg"
              />
              {/* Position markers */}
              {pinnedComments.map((comment) => {
                const idx = comments.indexOf(comment);
                const isActive = activeCommentId === comment.id;
                return (
                  <button
                    key={comment.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCommentId(isActive ? null : comment.id);
                    }}
                    style={{
                      left: `${comment.x_position}%`,
                      top: `${comment.y_position}%`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md border-2 transition-all z-10 ${
                      isActive
                        ? 'bg-gray-900 text-white border-white scale-125'
                        : 'bg-[#F5C430] text-gray-900 border-white hover:scale-110'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          ) : design.source_url ? (
            design.source_type === 'figma' ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white mb-4 shadow-sm">
                  <MessageSquare size={40} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Figma Design</h3>
                <p className="text-gray-600 mb-4">This design is linked from Figma</p>
                <a
                  href={design.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 bg-[#F5C430] text-gray-900 rounded-xl font-medium hover:bg-[#E8B820] transition-colors"
                >
                  Open in Figma
                </a>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col gap-4">
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl shadow-sm">
                  <span className="text-sm text-gray-600 truncate flex-1">{design.source_url}</span>
                  <a
                    href={design.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-4 flex items-center gap-2 px-4 py-2 bg-[#F5C430] text-gray-900 rounded-lg text-sm font-medium hover:bg-[#E8B820] transition-colors"
                  >
                    <ExternalLink size={16} />
                    Open in New Tab
                  </a>
                </div>
                <div className="flex-1 bg-white rounded-xl shadow-lg overflow-hidden">
                  <iframe
                    src={design.source_url}
                    className="w-full h-full border-0"
                    title={design.name}
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  />
                </div>
              </div>
            )
          ) : (
            <div className="text-gray-500">No preview available</div>
          )}
        </div>

        <FeedbackPanel
          designId={designId}
          onCommentsLoaded={setComments}
          activeCommentId={activeCommentId}
          onCommentClick={(id) => setActiveCommentId(prev => prev === id ? null : id)}
        />
      </div>
    </div>
  );
}
