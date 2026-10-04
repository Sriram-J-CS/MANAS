import React, { useRef, useState } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';
import { saveMascotModel } from '../../lib/mascot/mascotModelStorage';

interface MascotUploaderProps {
  onUploadSuccess: (result: {
    id: string;
    name: string;
    fileType: 'glb' | 'gltf' | 'fbx' | 'obj' | 'image';
    objectUrl: string;
  }) => void;
  onError?: (msg: string) => void;
}

export const MascotUploader: React.FC<MascotUploaderProps> = ({
  onUploadSuccess,
  onError,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProgress(15);

    try {
      // Simulate stepped validation progress
      const p1 = setTimeout(() => setProgress(45), 100);
      const p2 = setTimeout(() => setProgress(80), 250);

      const result = await saveMascotModel(file);

      clearTimeout(p1);
      clearTimeout(p2);
      setProgress(100);

      setTimeout(() => {
        setIsProcessing(false);
        onUploadSuccess(result);
      }, 200);
    } catch (err: any) {
      setIsProcessing(false);
      setProgress(0);
      const msg = err.message || 'Failed to process mascot file. Please ensure it is a valid 3D model.';
      setErrorMessage(msg);
      onError?.(msg);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full space-y-3 font-sans">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-[#8B5CF6] bg-[#8B5CF6]/5'
            : 'border-[#0A0A0A]/15 hover:border-[#0A0A0A]/30 bg-[#FDFBF7]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf,.fbx,.obj,.png,.jpg,.jpeg"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0A0A0A]/5 flex items-center justify-center text-[#8B5CF6]">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div>
            <div className="text-sm font-bold text-[#0A0A0A]">
              Drop your 3D Mascot model here, or click to browse
            </div>
            <div className="text-xs text-[#0A0A0A]/60 font-mono mt-1">
              Supports GLB, GLTF (recommended), FBX, OBJ, or PNG/JPG fallback
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="px-2 py-0.5 rounded-full bg-[#FFFFFF] border border-[#0A0A0A]/10 text-[10px] font-mono text-[#0A0A0A]/70">
              Max 50MB
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#FFFFFF] border border-[#0A0A0A]/10 text-[10px] font-mono text-[#0A0A0A]/70">
              Draco & Morph Targets Supported
            </span>
          </div>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {isProcessing && (
        <div className="space-y-1.5 p-3 rounded-2xl bg-[#FFFFFF] border border-[#0A0A0A]/10 shadow-xs">
          <div className="flex justify-between text-xs font-mono text-[#0A0A0A]">
            <span>Validating & Storing Mascot...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#0A0A0A]/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#8B5CF6] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs font-sans">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}
    </div>
  );
};
