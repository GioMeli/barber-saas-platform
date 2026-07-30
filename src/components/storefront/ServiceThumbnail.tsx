import React from 'react';
import { BriefcaseBusiness } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
};

export function ServiceThumbnail({ src, alt, className, imageClassName }: Props) {
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/15 via-background to-muted shadow-sm',
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={cn('h-full w-full object-cover', imageClassName)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-primary">
          <BriefcaseBusiness className="h-1/3 w-1/3" aria-hidden />
        </div>
      )}
    </div>
  );
}
