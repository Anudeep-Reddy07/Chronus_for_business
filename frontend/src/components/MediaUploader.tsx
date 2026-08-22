import React, { useRef, useState } from 'react';
import { Upload, X, Film, Image as ImageIcon, CheckCircle2, AlertCircle, FileVideo, Plus } from 'lucide-react';

interface MediaUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({ files, onFilesChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    const fileArray = Array.from(newFiles);
    // Append new files avoiding duplicates by name and size
    const merged = [...files];
    fileArray.forEach((nf) => {
      if (!merged.some((f) => f.name === nf.name && f.size === nf.size)) {
        merged.push(nf);
      }
    });
    onFilesChange(merged);
  };

  const handleRemoveFile = (index: number) => {
    const next = [...files];
    next.splice(index, 1);
    onFilesChange(next);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isVideo = (file: File) => file.type.startsWith('video/') || /\.(mp4|mov|avi|flv|mkv|webm)$/i.test(file.name);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,image/*,.mp4,.mov,.avi,.flv,.mkv,.webm,.jpg,.jpeg,.png,.webp"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Drag and Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFileSelect(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: isDragging
            ? '2px dashed #00DFD8'
            : '2px dashed rgba(255, 255, 255, 0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '44px 24px',
          textAlign: 'center',
          background: isDragging
            ? 'rgba(0, 223, 216, 0.12)'
            : 'rgba(255, 255, 255, 0.04)',
          boxShadow: isDragging ? '0 0 30px rgba(0, 223, 216, 0.3)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'var(--grad-sunset)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 30px rgba(255, 0, 122, 0.4)',
          transform: isDragging ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.2s',
        }}>
          <Upload size={30} color="#FFFFFF" />
        </div>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>
            Click or drag & drop product media
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '420px' }}>
            Upload raw video clips, product shoots, or high-res photos. We'll automatically blend them with HD stock footage.
          </p>
        </div>

        <div style={{
          display: 'inline-flex',
          gap: '8px',
          marginTop: '4px',
        }}>
          <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
            MP4, MOV, MKV
          </span>
          <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
            JPG, PNG, WEBP
          </span>
        </div>
      </div>

      {/* Selected Files Filmstrip Grid */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Uploaded Assets ({files.length})
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-glass"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              <Plus size={14} />
              <span>Add More</span>
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '14px',
          }}>
            {files.map((file, idx) => {
              const video = isVideo(file);
              return (
                <div
                  key={`${file.name}-${idx}`}
                  className="glass-card"
                  style={{
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: video ? 'rgba(0, 223, 216, 0.2)' : 'rgba(255, 0, 122, 0.2)',
                      border: video ? '1px solid #00DFD8' : '1px solid #FF007A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {video ? <FileVideo size={18} color="#00DFD8" /> : <ImageIcon size={18} color="#FF007A" />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'block',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {file.name}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {formatFileSize(file.size)} · {video ? 'Video' : 'Image'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        color: 'var(--text-muted)',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                        e.currentTarget.style.color = '#F87171';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
