'use client';

import { useRef, useState, ChangeEvent } from 'react';
import Image from 'next/image';
import { Camera, X, Loader2 } from 'lucide-react';
import { cn, compressImage } from '@/lib/utils/helpers';
import { getSupabaseClient } from '@/lib/supabase/client';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  maxSize?: number;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  bucket = 'produtos',
  folder = '',
  maxSize = 5 * 1024 * 1024, // 5MB
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize) {
      setError(`Arquivo muito grande. Máximo: ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Apenas imagens são permitidas');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Compress image before upload
      const compressedBlob = await compressImage(file, 800, 0.8);
      
      // Generate unique filename
      const timestamp = Date.now();
      const ext = 'jpg'; // Always save as jpg after compression
      const filename = folder 
        ? `${folder}/${timestamp}.${ext}`
        : `${timestamp}.${ext}`;

      const supabase = getSupabaseClient();
      
      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filename, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      onChange(publicUrl);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Erro ao fazer upload da imagem');
    } finally {
      setIsUploading(false);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  return (
    <div className={cn('w-full', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment" // Opens camera on iOS
        onChange={handleChange}
        className="hidden"
      />

      {value ? (
        <div className="relative aspect-square w-full max-w-[200px] mx-auto rounded-2xl overflow-hidden bg-gray-100">
          <Image
            src={value}
            alt="Produto"
            fill
            className="object-cover"
            sizes="200px"
          />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={handleClick}
          disabled={isUploading}
          className={cn(
            'w-full aspect-square max-w-[200px] mx-auto',
            'flex flex-col items-center justify-center gap-2',
            'border-2 border-dashed border-gray-300 rounded-2xl',
            'bg-gray-50 text-gray-500',
            'hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600',
            'transition-colors duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Enviando...</span>
            </>
          ) : (
            <>
              <Camera className="w-8 h-8" />
              <span className="text-sm font-medium">Tirar Foto</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="mt-2 text-sm text-danger-600 text-center">{error}</p>
      )}
    </div>
  );
}
