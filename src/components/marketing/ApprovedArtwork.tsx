import { cn } from '@/lib/utils';

type ApprovedArtworkProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
};

/**
 * Renders approved marketing artwork exactly as supplied, without adding a
 * second device frame or a visible image background. Transparent assets remain
 * transparent so the hardware can sit naturally inside the existing page UI.
 */
export function ApprovedArtwork({ src, alt, className, loading = 'lazy' }: ApprovedArtworkProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      className={cn('mx-auto block h-auto w-full select-none object-contain', className)}
    />
  );
}
