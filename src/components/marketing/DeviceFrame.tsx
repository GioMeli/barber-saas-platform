import React from 'react';
import { cn } from '@/lib/utils';

export type DeviceKind = 'laptop' | 'desktop' | 'tablet' | 'phone';

type DeviceConfig = {
  frame: string;
  width: number;
  height: number;
  screen: { x: number; y: number; width: number; height: number; radius: number };
  shadow: string;
};

const DEVICE_CONFIG: Record<DeviceKind, DeviceConfig> = {
  laptop: {
    frame: '/marketing/devices/laptop-original.png',
    width: 538,
    height: 308,
    screen: { x: 57, y: 13, width: 417, height: 265, radius: 5 },
    shadow: 'drop-shadow-[0_28px_42px_rgba(15,23,42,.22)]',
  },
  desktop: {
    frame: '/marketing/devices/desktop-original.png',
    width: 728,
    height: 646,
    screen: { x: 27, y: 30, width: 679, height: 356, radius: 1 },
    shadow: 'drop-shadow-[0_30px_46px_rgba(15,23,42,.18)]',
  },
  tablet: {
    frame: '/marketing/devices/tablet-original.png',
    width: 485,
    height: 342,
    screen: { x: 20, y: 20, width: 446, height: 308, radius: 15 },
    shadow: 'drop-shadow-[0_24px_36px_rgba(15,23,42,.22)]',
  },
  phone: {
    frame: '/marketing/devices/phone-original.png',
    width: 296,
    height: 592,
    screen: { x: 17, y: 15, width: 262, height: 562, radius: 40 },
    shadow: 'drop-shadow-[0_22px_32px_rgba(15,23,42,.24)]',
  },
};

export type DeviceFrameProps = {
  kind: DeviceKind;
  image: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  fit?: 'cover' | 'contain' | 'fill';
  position?: 'top left' | 'top center' | 'center' | 'center left';
  loading?: 'eager' | 'lazy';
};

function preserveAspectRatio(
  fit: NonNullable<DeviceFrameProps['fit']>,
  position: NonNullable<DeviceFrameProps['position']>,
) {
  if (fit === 'fill') return 'none';
  const align = {
    'top left': 'xMinYMin',
    'top center': 'xMidYMin',
    center: 'xMidYMid',
    'center left': 'xMinYMid',
  }[position];
  return `${align} ${fit === 'contain' ? 'meet' : 'slice'}`;
}

export function DeviceFrame({
  kind,
  image,
  alt,
  className,
  fit = 'fill',
  position = 'top center',
  loading = 'lazy',
}: DeviceFrameProps) {
  const config = DEVICE_CONFIG[kind];
  const clipId = React.useId().replace(/:/g, '');

  return (
    <figure
      className={cn('relative isolate w-full max-w-full', config.shadow, className)}
      style={{ aspectRatio: `${config.width} / ${config.height}` }}
      aria-label={alt}
      data-device-kind={kind}
    >
      <svg
        viewBox={`0 0 ${config.width} ${config.height}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={alt}
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <rect
              x={config.screen.x}
              y={config.screen.y}
              width={config.screen.width}
              height={config.screen.height}
              rx={config.screen.radius}
              ry={config.screen.radius}
            />
          </clipPath>
        </defs>
        <rect
          x={config.screen.x}
          y={config.screen.y}
          width={config.screen.width}
          height={config.screen.height}
          rx={config.screen.radius}
          ry={config.screen.radius}
          fill="#ffffff"
        />
        <image
          href={image}
          x={config.screen.x}
          y={config.screen.y}
          width={config.screen.width}
          height={config.screen.height}
          preserveAspectRatio={preserveAspectRatio(fit, position)}
          clipPath={`url(#${clipId})`}
          aria-hidden="true"
        />
      </svg>
      <img
        src={config.frame}
        alt=""
        aria-hidden="true"
        loading={loading}
        className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none object-contain"
      />
      <span className="sr-only">{alt}</span>
    </figure>
  );
}

export function LaptopDevice(props: Omit<DeviceFrameProps, 'kind'>) {
  return <DeviceFrame kind="laptop" {...props} />;
}

export function DesktopDevice(props: Omit<DeviceFrameProps, 'kind'>) {
  return <DeviceFrame kind="desktop" {...props} />;
}

export function TabletDevice(props: Omit<DeviceFrameProps, 'kind'>) {
  return <DeviceFrame kind="tablet" {...props} />;
}

export function PhoneDevice(props: Omit<DeviceFrameProps, 'kind'>) {
  return <DeviceFrame kind="phone" {...props} />;
}
