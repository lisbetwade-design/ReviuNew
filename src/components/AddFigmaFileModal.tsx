import { useState, useEffect } from 'react';
import { X, Link2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AddFigmaFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileAdded: () => void;
}

interface Project {
  id: string;
  name: string;
}

export function AddFigmaFileModal({ isOpen, onClose, onFileAdded }: AddFigmaFileModalProps) {
  const [fileUrl, setFileUrl] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingFile, setFetchingFile] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ file_key: string; file_name: string; file_url: string } | null>(null);
  const [preferences, setPreferences] = useState({
    sync_all_comments: true,
    sync_only_mentions: false,
    sync_unresolved_only: false,
  });

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setProjects(data || []);
      if (data && data.length > 0) {
        setSelectedProject(data[0].id);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const handleFetchFileInfo = async () => {
    if (!fileUrl.trim()) {
      alert('Please enter a Figma file URL');
      return;
    }

    setFetchingFile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/figma-files?action=file-info&url=${encodeURIComponent(fileUrl)}`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch file info');
      }

      const data = await response.json();
      setFileInfo(data);
    } catch (error) {
      console.error('Error fetching file info:', error);
      alert(error instanceof Error ? error.message : 'Failed to fetch file info. Make sure you have access to this file.');
      setFileInfo(null);
    } finally {
      setFetchingFile(false);
    }
  };

  const handleAddFile = async () => {
    if (!fileInfo || !selectedProject) {
      alert('Please fetch file info and select a project');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/figma-files`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_key: fileInfo.file_key,
          file_name: fileInfo.file_name,
          file_url: fileInfo.file_url,
          project_id: selectedProject,
          preferences,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add file');
      }

      const result = await response.json();

      const syncUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/figma-sync-comments`;
      const syncResponse = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_key: fileInfo.file_key,
          project_id: selectedProject,
        }),
      });

      if (syncResponse.ok) {
        const syncResult = await syncResponse.json();
        alert(`File added successfully! ${syncResult.summary?.added || 0} comments synced.`);
      } else {
        const errorData = await syncResponse.json();
        console.error('Sync error:', errorData);
        alert('File added but failed to sync comments. Please try syncing manually.');
      }

      onFileAdded();
      handleClose();
    } catch (error) {
      console.error('Error adding file:', error);
      alert(error instanceof Error ? error.message : 'Failed to add file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFileUrl('');
    setFileInfo(null);
    setPreferences({
      sync_all_comments: true,
      sync_only_mentions: false,
      sync_unresolved_only: false,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add Figma File to Track</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Figma File URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://www.figma.com/file/..."
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                disabled={fetchingFile}
              />
              <button
                onClick={handleFetchFileInfo}
                disabled={fetchingFile || !fileUrl.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fetchingFile ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Link2 size={18} />
                    Fetch
                  </>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Paste a Figma file URL to track comments from that file
            </p>
          </div>

          {fileInfo && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <h4 className="font-semibold text-gray-900 mb-1">{fileInfo.file_name}</h4>
              <p className="text-sm text-gray-600">File key: {fileInfo.file_key}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              disabled={projects.length === 0}
            >
              {projects.length === 0 ? (
                <option>No projects available</option>
              ) : (
                projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Comments from this file will be associated with this project
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Comment Tracking Rules</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={preferences.sync_all_comments}
                  onChange={() => setPreferences({
                    sync_all_comments: true,
                    sync_only_mentions: false,
                    sync_unresolved_only: false,
                  })}
                  className="w-4 h-4 text-[#2563EB]"
                />
                <span className="text-sm text-gray-700">Track all comments</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={preferences.sync_unresolved_only}
                  onChange={() => setPreferences({
                    sync_all_comments: false,
                    sync_only_mentions: false,
                    sync_unresolved_only: true,
                  })}
                  className="w-4 h-4 text-[#2563EB]"
                />
                <span className="text-sm text-gray-700">Only unresolved comments</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-6 py-2 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddFile}
            disabled={loading || !fileInfo || !selectedProject || projects.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-[#2563EB] text-white rounded-xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Adding...
              </>
            ) : (
              'Add File'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
