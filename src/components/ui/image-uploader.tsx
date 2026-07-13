import React, { useState, useRef } from 'react';
import { Button } from './button';
import { Progress } from './progress';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
}

export function ImageUploader({ value, onChange, folder = 'general' }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const MAX_SIZE = 1024 * 1024; // 1MB
      
      if (file.size <= MAX_SIZE) {
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        // Max 1080p
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
              // Convert blob to file
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }
          }, 'image/webp', quality);
        };
        
        processCanvas();
      };
      
      img.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    let file = e.target.files[0];
    const originalSize = file.size;
    
    setUploading(true);
    setProgress(10);
    
    try {
      if (file.size > 1024 * 1024) {
        toast.info('File too large, compressing...');
        file = await compressImage(file);
        setProgress(30);
        toast.success(`Compressed to ${(file.size / 1024).toFixed(2)} KB`);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

      setProgress(60);
      
      const { data, error } = await supabase.storage
        .from('images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      setProgress(90);

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      onChange(publicUrlData.publicUrl);
      setProgress(100);
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 500);
    }
  };

  return (
    <div className="space-y-4">
      {value ? (
        <div className="relative inline-block border rounded-md overflow-hidden bg-muted">
          <img src={value} alt="Uploaded" className="max-h-40 max-w-full object-contain" />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 w-6 h-6 rounded-full"
            onClick={() => onChange('')}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div 
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 hover:bg-muted/30 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="w-8 h-8 mb-2" />
          <p className="text-sm font-medium">Click to upload image</p>
          <p className="text-xs mt-1">Supports JPG, PNG, WEBP (Max 1MB auto-compress)</p>
        </div>
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
          <p className="text-xs text-center text-muted-foreground">Uploading... {progress}%</p>
        </div>
      )}
    </div>
  );
}