import React, { useRef, useState } from 'react';
import { Button } from './button';
import { Progress } from './progress';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { UploadCloud, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
}

export function ImageUploader({ value, onChange, folder = 'general' }: ImageUploaderProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const MAX_SIZE = 1024 * 1024;

      if (file.size <= MAX_SIZE) {
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        img.src = event.target?.result as string;
      };

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > 1920 || height > 1080) {
          const ratio = Math.min(1920 / width, 1080 / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        let quality = 0.8;
        const processCanvas = () => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas to Blob failed'));
              return;
            }
            if (blob.size > MAX_SIZE && quality > 0.1) {
              quality -= 0.1;
              processCanvas();
            } else {
              const compressedFile = new File(
                [blob],
                `${file.name.replace(/\.[^/.]+$/, '')}.webp`,
                {
                  type: 'image/webp',
                  lastModified: Date.now(),
                }
              );
              resolve(compressedFile);
            }
          }, 'image/webp', quality);
        };

        processCanvas();
      };

      img.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    let file = event.target.files[0];

    setUploading(true);
    setProgress(10);

    try {
      if (file.size > 1024 * 1024) {
        toast.info(t('common.imageUploader.fileTooLarge'));
        file = await compressImage(file);
        setProgress(30);
        toast.success(
          t('common.imageUploader.compressedTo', {
            size: (file.size / 1024).toFixed(2),
          })
        );
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Math.random()
        .toString(36)
        .substring(2, 15)}_${Date.now()}.${fileExt}`;

      setProgress(60);

      const { error } = await supabase.storage
        .from('images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      setProgress(90);

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      onChange(publicUrlData.publicUrl);
      setProgress(100);
      toast.success(t('common.imageUploader.uploaded'));
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(t('common.imageUploader.uploadFailed'));
    } finally {
      window.setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 500);
    }
  };

  return (
    <div className="space-y-4">
      {value ? (
        <div className="relative inline-block overflow-hidden rounded-md border bg-muted">
          <img
            src={value}
            alt={t('common.imageUploader.uploadedAlt')}
            className="max-h-40 max-w-full object-contain"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute right-1 top-1 h-6 w-6 rounded-full"
            aria-label={t('common.imageUploader.removeImage')}
            onClick={() => onChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 p-6 text-muted-foreground transition-colors hover:bg-muted/30"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="mb-2 h-8 w-8" />
          <span className="text-sm font-medium">
            {t('common.imageUploader.clickToUpload')}
          </span>
          <span className="mt-1 text-xs">
            {t('common.imageUploader.supportedFormats')}
          </span>
        </button>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {uploading && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-center text-xs text-muted-foreground">
            {t('common.imageUploader.uploading', { progress })}
          </p>
        </div>
      )}
    </div>
  );
}
