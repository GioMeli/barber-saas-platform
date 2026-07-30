import React from 'react';
import { cn } from '@/lib/utils';

type FinalProductVisualProps = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  surface?: 'light' | 'dark' | 'transparent';
};

export function FinalProductVisual({
  src,
  alt,
  className,
  imageClassName,
  priority = false,
  surface = 'light',
}: FinalProductVisualProps) {
  return (
    <figure
      className={cn(
        'relative isolate flex w-full items-center justify-center overflow-hidden rounded-[2rem]',
        surface === 'light' && 'border border-slate-200/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,.14)]',
        surface === 'dark' && 'border border-white/10 bg-white/[.055] shadow-[0_32px_100px_rgba(0,0,0,.32)] backdrop-blur',
        surface === 'transparent' && 'bg-transparent',
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={cn('block h-auto max-h-full w-full object-contain', imageClassName)}
      />
    </figure>
  );
}

type FinalProductPairProps = {
  desktopSrc: string;
  desktopAlt: string;
  mobileSrc: string;
  mobileAlt: string;
  className?: string;
  priority?: boolean;
  dark?: boolean;
  mobileSide?: 'left' | 'right';
};

export function FinalProductPair({
  desktopSrc,
  desktopAlt,
  mobileSrc,
  mobileAlt,
  className,
  priority = false,
  dark = false,
  mobileSide = 'left',
}: FinalProductPairProps) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[980px] pb-2 sm:pb-10 lg:pb-14', className)}>
      <div
        className={cn(
          'pointer-events-none absolute inset-x-[10%] top-[8%] h-[72%] rounded-full blur-3xl',
          dark ? 'bg-violet-500/25' : 'bg-violet-300/35',
        )}
      />

      <FinalProductVisual
        src={desktopSrc}
        alt={desktopAlt}
        priority={priority}
        surface={dark ? 'dark' : 'light'}
        className="relative mx-auto w-full max-w-[850px] p-2 sm:p-3"
        imageClassName="rounded-[1.3rem]"
      />

      <div
        className={cn(
          'relative z-10 mx-auto -mt-2 w-[52%] min-w-[170px] max-w-[260px] sm:-mt-16 lg:absolute lg:bottom-0 lg:mt-0 lg:w-[26%]',
          mobileSide === 'left' ? 'lg:left-0' : 'lg:right-0',
        )}
      >
        <FinalProductVisual
          src={mobileSrc}
          alt={mobileAlt}
          priority={priority}
          surface="transparent"
          className="rounded-none"
          imageClassName="drop-shadow-[0_28px_36px_rgba(15,23,42,.28)]"
        />
      </div>
    </div>
  );
}

type FinalProductGalleryProps = {
  items: Array<{
    src: string;
    alt: string;
    label: string;
  }>;
  className?: string;
};

export function FinalProductGallery({ items, className }: FinalProductGalleryProps) {
  return (
    <div className={cn('grid gap-5 md:grid-cols-2 xl:grid-cols-3', className)}>
      {items.map((item) => (
        <article
          key={item.src}
          className="group overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.055] p-4 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-violet-300/30"
        >
          <div className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-[1.45rem] bg-white p-3">
            <img
              src={item.src}
              alt={item.alt}
              loading="lazy"
              decoding="async"
              className="h-auto max-h-[320px] w-full object-contain transition duration-500 group-hover:scale-[1.015]"
            />
          </div>
          <div className="px-2 pb-1 pt-4 text-sm font-extrabold text-white">{item.label}</div>
        </article>
      ))}
    </div>
  );
}
