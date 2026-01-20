import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, MoreVertical, ExternalLink, Share2, Trash2, Folder, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AddDesignModal } from '../components/AddDesignModal';
import { DesignViewerPage } from './DesignViewerPage';
import { FolderViewerPage } from './FolderViewerPage';

interface Design {
  id: string;
  name: string;
  source_type: string;
  source_url: string | null;
  image_url: string | null;
  shareable_token: string | null;
  folder_id: string | null;
  created_at: string;
}

interface DesignFolder {
  id: string;
  name: string;
  description: string | null;
  shareable_token: string;
  created_at: string;
  designs: Design[];
}

interface ProjectDetailPageProps {
  projectId: string;
  projectName: string;
  onBack: () => void;
}

export function ProjectDetailPage({ projectId, projectName, onBack }: ProjectDetailPageProps) {
  const [folders, setFolders] = useState<DesignFolder[]>([]);
  const [standaloneDesigns, setStandaloneDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<{ id: string; name: string } | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  useEffect(() => {
    loadDesigns();
  }, [projectId]);

  const loadDesigns = async () => {
    try {
      const [foldersResult, designsResult] = await Promise.all([
        supabase
          .from('design_folders')
          .select('*, designs(*)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('designs')
          .select('*')
          .eq('project_id', projectId)
          .is('folder_id', null)
          .order('created_at', { ascending: false }),
      ]);

      if (foldersResult.error) throw foldersResult.error;
      if (designsResult.error) throw designsResult.error;

      setFolders(foldersResult.data || []);
      setStandaloneDesigns(designsResult.data || []);
    } catch (error) {
      console.error('Error loading designs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDesign = async (designId: string) => {
    if (!confirm('Are you sure you want to delete this design?')) return;

    try {
      const { error } = await supabase
        .from('designs')
        .delete()
        .eq('id', designId);

      if (error) throw error;
      loadDesigns();
    } catch (error) {
      console.error('Error deleting design:', error);
      alert('Failed to delete design. Please try again.');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder and all its designs?')) return;

    try {
      const { error } = await supabase
        .from('design_folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;
      loadDesigns();
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Failed to delete folder. Please try again.');
    }
  };

  const getShareableUrl = (token: string | null) => {
    if (!token) return null;
    return `${window.location.origin}/feedback/${token}`;
  };

  const copyShareableLink = (token: string | null) => {
    const url = getShareableUrl(token);
    if (url) {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  if (selectedFolder) {
    return (
      <FolderViewerPage
        folderId={selectedFolder}
        projectName={projectName}
        onBack={() => setSelectedFolder(null)}
      />
    );
  }

  if (selectedDesign) {
    return (
      <DesignViewerPage
        designId={selectedDesign.id}
        projectName={projectName}
        onBack={() => setSelectedDesign(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-8 py-6 border-b border-gray-200">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            <span>Back to Projects</span>
          </button>
          <h2 className="text-3xl font-bold text-gray-900">{projectName}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-gray-200">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Projects</span>
        </button>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-900">{projectName}</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-2xl font-medium hover:bg-[#1d4ed8] transition-colors"
          >
            <Plus size={20} />
            <span>Add Design</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {folders.length === 0 && standaloneDesigns.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F6F8FE] mb-6">
                <Plus size={32} className="text-[#2563EB]" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">No designs yet</h3>
              <p className="text-gray-600 mb-6">
                Add your first design file to start collecting feedback from stakeholders.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-[#2563EB] text-white rounded-2xl font-medium hover:bg-[#1d4ed8] transition-colors"
              >
                Add Design
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {folders.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Folders</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-[#2563EB] transition-all cursor-pointer"
                      onClick={() => setSelectedFolder(folder.id)}
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 bg-[#F6F8FE] rounded-xl flex items-center justify-center flex-shrink-0">
                              <Folder size={24} className="text-[#2563EB]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate">{folder.name}</h4>
                              {folder.description && (
                                <p className="text-sm text-gray-600 line-clamp-2 mt-1">{folder.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(activeMenu === folder.id ? null : folder.id);
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <MoreVertical size={18} className="text-gray-600" />
                            </button>
                            {activeMenu === folder.id && (
                              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-10">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyShareableLink(folder.shareable_token);
                                    setActiveMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Share2 size={16} />
                                  Copy Share Link
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFolder(folder.id);
                                    setActiveMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 size={16} />
                                  Delete Folder
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500 pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-1">
                            <ImageIcon size={16} />
                            <span>{folder.designs?.length || 0} designs</span>
                          </div>
                          <span className="text-xs">
                            {new Date(folder.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {standaloneDesigns.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Individual Designs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {standaloneDesigns.map((design) => (
              <div
                key={design.id}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedDesign({ id: design.id, name: design.name })}
              >
                <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative">
                  {design.image_url ? (
                    <img
                      src={design.image_url}
                      alt={design.name}
                      className="w-full h-full object-cover"
                    />
                  ) : design.source_url ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center">
                        <ExternalLink size={28} className="text-[#2563EB]" />
                      </div>
                      <p className="text-sm text-gray-600 text-center font-medium">Prototype Link</p>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ExternalLink size={32} className="text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === design.id ? null : design.id);
                        }}
                        className="p-2 bg-white/90 backdrop-blur rounded-lg hover:bg-white transition-colors"
                      >
                        <MoreVertical size={18} className="text-gray-700" />
                      </button>
                      {activeMenu === design.id && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-10">
                          {design.source_type === 'manual' && design.shareable_token && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyShareableLink(design.shareable_token);
                                setActiveMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Share2 size={16} />
                              Copy Share Link
                            </button>
                          )}
                          {design.source_url && (
                            <a
                              href={design.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(null);
                              }}
                            >
                              <ExternalLink size={16} />
                              {design.source_type === 'figma' ? 'Open in Figma' : 'Open Link'}
                            </a>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDesign(design.id);
                              setActiveMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <h4 className="font-semibold text-gray-900 mb-2 truncate">{design.name}</h4>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="capitalize">{design.source_type}</span>
                    <span>
                      {new Date(design.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddDesignModal
          projectId={projectId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            loadDesigns();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}
