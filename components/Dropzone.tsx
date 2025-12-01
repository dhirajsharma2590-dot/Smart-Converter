import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
  accept: string;
  multiple: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFilesAdded, accept, multiple }) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    
    // Basic validation could go here, but strictly relying on the file extension/type 
    // is complex with drag-n-drop. We pass valid files to the parent.
    if (files.length > 0) onFilesAdded(files);
  }, [onFilesAdded]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length > 0) onFilesAdded(files);
    }
  };

  // Helper to display readable format
  const getReadableFormat = (acceptStr: string) => {
    if (acceptStr === 'image/*') return 'Images (JPG, PNG, WEBP)';
    if (acceptStr.includes('.pdf')) return 'PDF Documents';
    if (acceptStr.includes('.zip')) return 'ZIP Archives';
    return acceptStr.replace(/\./g, ' ').toUpperCase() + ' files';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="group relative border-2 border-dashed border-slate-600 hover:border-indigo-500 bg-slate-800/50 rounded-2xl p-12 transition-all duration-300 cursor-pointer text-center"
    >
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-slate-700/50 rounded-full group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
          <UploadCloud className="w-10 h-10 text-slate-300 group-hover:text-indigo-400" />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-200">
            Click to upload or drag & drop
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Supported: <span className="text-indigo-300">{getReadableFormat(accept)}</span>
          </p>
          {!multiple && (
            <p className="text-xs text-slate-500 mt-1">(Single file only)</p>
          )}
        </div>
      </div>
    </div>
  );
};