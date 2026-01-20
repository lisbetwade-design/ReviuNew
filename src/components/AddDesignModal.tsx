import { useState } from 'react';
import { Upload, X, Image as ImageIcon, Link as LinkIcon, FileImage } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AddDesignModalProps {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type UploadMethod = 'upload' | 'figma' | 'url' | null;

export function AddDesignModal({ projectId, onClose, onSuccess }: AddDesignModalProps) {
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [designName, setDesignName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    );

    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(file =>
        file.type.startsWith('image/')
      );
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let folderId = null;

      if (files.length > 1) {
        const { data: folderData, error: folderError } = await supabase
          .from('design_folders')
          .insert({
            project_id: projectId,
            name: folderName || `Design Collection - ${new Date().toLocaleDateString()}`,
            description: folderDescription || null,
          })
          .select()
          .single();

        if (folderError) throw folderError;
        folderId = folderData.id;
      }

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('design-files')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('design-files')
          .getPublicUrl(fileName);

        const { error: insertError } = await supabase
          .from('designs')
          .insert({
            project_id: projectId,
            folder_id: folderId,
            name: files.length === 1 ? (designName || file.name) : file.name,
            source_type: 'manual',
            image_url: publicUrl,
          });

        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddFigma = async () => {
    if (!figmaUrl) return;

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/figma-import`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            figmaUrl,
            projectId,
            designName: designName || undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import from Figma');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding Figma link:', error);
      alert(error instanceof Error ? error.message : 'Failed to add Figma link. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!customUrl) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: insertError } = await supabase
        .from('designs')
        .insert({
          project_id: projectId,
          name: designName || 'Prototype Link',
          source_type: 'manual',
          source_url: customUrl,
        });

      if (insertError) throw insertError;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding URL:', error);
      alert('Failed to add URL. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadMethod === 'upload') {
      handleUploadFiles();
    } else if (uploadMethod === 'figma') {
      handleAddFigma();
    } else if (uploadMethod === 'url') {
      handleAddUrl();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Add Design</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {!uploadMethod ? (
            <div className="space-y-4">
              <p className="text-gray-600 mb-6">Choose how you'd like to add your design:</p>

              <button
                onClick={() => setUploadMethod('upload')}
                className="w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-2xl hover:border-[#2563EB] hover:bg-[#F6F8FE] transition-all group"
              >
                <div className="w-12 h-12 bg-[#F6F8FE] rounded-xl flex items-center justify-center group-hover:bg-[#2563EB] transition-colors">
                  <Upload size={24} className="text-[#2563EB] group-hover:text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-semibold text-gray-900 mb-1">Upload Files</h4>
                  <p className="text-sm text-gray-600">Upload PNG or JPG images from your computer</p>
                </div>
              </button>

              <button
                onClick={() => setUploadMethod('figma')}
                className="w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-2xl hover:border-[#2563EB] hover:bg-[#F6F8FE] transition-all group"
              >
                <div className="w-12 h-12 bg-[#F6F8FE] rounded-xl flex items-center justify-center group-hover:bg-[#2563EB] transition-colors">
                  <LinkIcon size={24} className="text-[#2563EB] group-hover:text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-semibold text-gray-900 mb-1">Add Figma Link</h4>
                  <p className="text-sm text-gray-600">Connect a Figma file to collect feedback</p>
                </div>
              </button>

              <button
                onClick={() => setUploadMethod('url')}
                className="w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-2xl hover:border-[#2563EB] hover:bg-[#F6F8FE] transition-all group"
              >
                <div className="w-12 h-12 bg-[#F6F8FE] rounded-xl flex items-center justify-center group-hover:bg-[#2563EB] transition-colors">
                  <LinkIcon size={24} className="text-[#2563EB] group-hover:text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-semibold text-gray-900 mb-1">Add Prototype URL</h4>
                  <p className="text-sm text-gray-600">Add a link to a prototype, website, or coded demo</p>
                </div>
              </button>

              <div className="relative">
                <button
                  disabled
                  className="w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-2xl opacity-50 cursor-not-allowed"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <FileImage size={24} className="text-gray-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-semibold text-gray-900 mb-1">Upload Video</h4>
                    <p className="text-sm text-gray-600">Share video walkthroughs of your design</p>
                  </div>
                </button>
                <span className="absolute top-4 right-4 px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          ) : uploadMethod === 'upload' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {files.length <= 1 ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Design Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={designName}
                    onChange={(e) => setDesignName(e.target.value)}
                    placeholder="E.g., Homepage V2, Dashboard Mockup"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Folder Name
                    </label>
                    <input
                      type="text"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      placeholder="E.g., Homepage Redesign, Dashboard Mockups"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Multiple files will be grouped in a folder
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={folderDescription}
                      onChange={(e) => setFolderDescription(e.target.value)}
                      placeholder="Brief description of this collection"
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Files
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-[#2563EB] bg-[#F6F8FE]'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-[#F6F8FE] rounded-full flex items-center justify-center mb-4">
                      <ImageIcon size={32} className="text-[#2563EB]" />
                    </div>
                    <p className="text-gray-700 font-medium mb-2">
                      Drag and drop your images here
                    </p>
                    <p className="text-sm text-gray-500 mb-4">or</p>
                    <label className="px-6 py-2 bg-[#2563EB] text-white rounded-xl font-medium hover:bg-[#1d4ed8] transition-colors cursor-pointer">
                      Browse Files
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-3">PNG, JPG up to 10MB each</p>
                  </div>
                </div>
              </div>

              {files.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selected Files ({files.length})
                  </label>
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-[#F6F8FE] rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <ImageIcon size={20} className="text-[#2563EB]" />
                          <span className="text-sm text-gray-700">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setUploadMethod(null)}
                  className="flex-1 px-6 py-3 border border-gray-200 rounded-2xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={files.length === 0 || uploading}
                  className="flex-1 px-6 py-3 bg-[#2563EB] text-white rounded-2xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : `Upload ${files.length} ${files.length === 1 ? 'File' : 'Files'}`}
                </button>
              </div>
            </form>
          ) : uploadMethod === 'figma' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Design Name (Optional)
                </label>
                <input
                  type="text"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="E.g., Homepage V2, Dashboard Mockup"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Figma URL
                </label>
                <input
                  type="url"
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                  required
                  placeholder="https://figma.com/file/..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Paste the link to your Figma file or frame
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setUploadMethod(null)}
                  className="flex-1 px-6 py-3 border border-gray-200 rounded-2xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!figmaUrl || uploading}
                  className="flex-1 px-6 py-3 bg-[#2563EB] text-white rounded-2xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Adding...' : 'Add Figma Link'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Design Name
                </label>
                <input
                  type="text"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  required
                  placeholder="E.g., Homepage Prototype, Mobile App Demo"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prototype URL
                </label>
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  required
                  placeholder="https://example.com/prototype"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Add a link to your prototype, coded demo, or live website
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setUploadMethod(null)}
                  className="flex-1 px-6 py-3 border border-gray-200 rounded-2xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!customUrl || uploading}
                  className="flex-1 px-6 py-3 bg-[#2563EB] text-white rounded-2xl font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Adding...' : 'Add Prototype'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
