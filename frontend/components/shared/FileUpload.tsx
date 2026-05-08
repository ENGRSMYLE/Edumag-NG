'use client';

import { useState, useCallback } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Upload, X, FileText, ImageIcon, RefreshCw, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { uploadToCloudinary } from '@/lib/cloudinary';

interface FileUploadProps {
  onUpload: (url: string) => void;
  folder: 'students' | 'assignments' | 'schools';
  accept?: string;
  maxSize?: number;
  currentUrl?: string;
  label?: string;
}

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$/i.test(url);
}

export function FileUpload({
  onUpload,
  folder,
  accept,
  maxSize = 10 * 1024 * 1024,
  currentUrl,
  label,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(currentUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(null);

  const acceptMap: Record<string, string[]> = {};
  if (accept) {
    accept.split(',').map((a) => a.trim()).forEach((mime) => {
      if (mime.startsWith('image/') || mime === 'image/*') {
        acceptMap['image/*'] = [];
      } else if (mime === '.pdf') {
        acceptMap['application/pdf'] = ['.pdf'];
      } else if (mime === '.doc') {
        acceptMap['application/msword'] = ['.doc'];
      } else if (mime === '.docx') {
        acceptMap['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] = ['.docx'];
      }
    });
  }

  const onDrop = useCallback(
    async (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        const msg = rejected[0]?.errors[0]?.message ?? 'File rejected';
        setError(msg.includes('larger') ? `File exceeds ${Math.round(maxSize / 1024 / 1024)} MB limit` : msg);
        return;
      }
      const file = accepted[0];
      if (!file) return;

      setError(null);
      setUploading(true);
      setFileName(file.name);

      try {
        const result = await uploadToCloudinary(file, folder);
        setUploadedUrl(result.url);
        onUpload(result.url);
      } catch (err: any) {
        setError(err?.message ?? 'Upload failed. Please try again.');
        setFileName(null);
      } finally {
        setUploading(false);
      }
    },
    [folder, maxSize, onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize,
    accept: Object.keys(acceptMap).length > 0 ? acceptMap : undefined,
    disabled: uploading,
  });

  const handleClear = () => {
    setUploadedUrl(null);
    setFileName(null);
    setError(null);
    onUpload('');
  };

  const isImage = uploadedUrl && isImageUrl(uploadedUrl);

  // Uploaded state
  if (uploadedUrl) {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-[0.08em]">
            {label}
          </p>
        )}
        <div
          className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-xl',
            'bg-[var(--color-surface)] border border-emerald-200',
          )}
        >
          {isImage ? (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-[var(--color-border)]">
              <img
                src={uploadedUrl}
                alt="Uploaded file preview"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[var(--color-gold)]/12 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-[var(--color-gold)]" strokeWidth={1.5} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {fileName ?? (isImage ? 'Image uploaded' : 'File uploaded')}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Uploaded successfully</p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              {...getRootProps()}
              onClick={(e) => e.stopPropagation()}
              className={clsx(
                'p-1.5 rounded-md text-[var(--color-text-muted)] cursor-pointer',
                'hover:text-[var(--color-navy)] hover:bg-[var(--color-navy)]/8',
                'transition-all duration-150',
              )}
              aria-label="Replace file"
            >
              <input {...getInputProps()} />
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={handleClear}
              className={clsx(
                'p-1.5 rounded-md text-[var(--color-text-muted)] cursor-pointer',
                'hover:text-red-500 hover:bg-red-50',
                'transition-all duration-150',
              )}
              aria-label="Remove file"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Drop zone state
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-[0.08em]">
          {label}
        </p>
      )}

      <div
        {...getRootProps()}
        className={clsx(
          'flex flex-col items-center gap-2.5 px-6 py-8 rounded-xl border-2 border-dashed cursor-pointer',
          'transition-all duration-200',
          uploading && 'pointer-events-none opacity-70',
          error
            ? 'border-red-300 bg-red-50/50'
            : isDragActive
            ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5'
            : 'border-[var(--color-border)] hover:border-[var(--color-navy)]/30 hover:bg-[var(--color-surface)]',
        )}
      >
        <input {...getInputProps()} />

        <div
          className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            'border border-[var(--color-border)] bg-[var(--color-surface)]',
            uploading && 'animate-pulse',
          )}
        >
          {uploading ? (
            <div className="w-4 h-4 rounded-full border-2 border-[var(--color-navy)] border-t-transparent animate-spin" />
          ) : error ? (
            <AlertCircle className="w-4.5 h-4.5 text-red-500" strokeWidth={1.5} />
          ) : accept?.includes('image') ? (
            <ImageIcon className="w-4.5 h-4.5 text-[var(--color-text-muted)]" strokeWidth={1.5} />
          ) : (
            <Upload className="w-4.5 h-4.5 text-[var(--color-text-muted)]" strokeWidth={1.5} />
          )}
        </div>

        <div className="text-center">
          <p className={clsx('text-sm font-medium', error ? 'text-red-600' : 'text-[var(--color-text-primary)]')}>
            {uploading
              ? 'Uploading…'
              : error
              ? 'Upload failed'
              : isDragActive
              ? 'Drop file here'
              : 'Drag & drop or click to browse'}
          </p>
          <p className={clsx('text-xs mt-0.5', error ? 'text-red-500' : 'text-[var(--color-text-muted)]')}>
            {error ?? `Max ${Math.round(maxSize / 1024 / 1024)} MB`}
          </p>
        </div>
      </div>
    </div>
  );
}
