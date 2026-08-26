import React, { useRef, useState } from 'react';
import { Upload, X, ImageIcon, FileVideo, Plus } from 'lucide-react';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
            ? '2px dashed var(--brand-accent)'
            : '2px dashed var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px 24px',
          textAlign: 'center',
          background: isDragging
            ? 'var(--brand-accent-subtle)'
            : 'var(--bg-card)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '14px',
          background: 'var(--brand-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-sm)',
          transform: isDragging ? 'scale(1.08)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}>
          <Upload size={24} color="#FFFFFF" />
        </div>

        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Click or drag & drop product media
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', maxWidth: '440px', margin: '0 auto' }}>
            Upload raw video clips, product shoots, or high-res photos. We'll automatically blend them with HD stock footage.
          </p>
        </div>

        <div style={{
          display: 'inline-flex',
          gap: '8px',
          marginTop: '4px',
        }}>
          <span className="badge badge-draft">MP4, MOV, MKV</span>
          <span className="badge badge-draft">JPG, PNG, WEBP</span>
        </div>
      </div>

      {/* Selected Files Grid */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Uploaded Assets ({files.length})
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              <Plus size={14} />
              <span>Add More</span>
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '12px',
          }}>
            {files.map((file, idx) => {
              const video = isVideo(file);
              return (
                <div
                  key={`${file.name}-${idx}`}
                  className="sub-card"
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    position: 'relative',
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: video ? 'var(--brand-accent-subtle)' : '#F3F4F6',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {video ? <FileVideo size={18} color="var(--brand-accent)" /> : <ImageIcon size={18} color="#4B5563" />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'block',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
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
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#FEF2F2';
                      e.currentTarget.style.color = '#EF4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
