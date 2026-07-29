import React from 'react';
import { cn } from '@/lib/utils';
import { LaptopDevice, PhoneDevice, TabletDevice } from './DeviceFrame';

type ResponsiveDeviceShowcaseProps = {
  laptopImage: string;
  laptopAlt: string;
  phoneImage?: string;
  phoneAlt?: string;
  tabletImage?: string;
  tabletAlt?: string;
  className?: string;
  priority?: boolean;
};

export function ResponsiveDeviceShowcase({
  laptopImage,
  laptopAlt,
  phoneImage,
  phoneAlt = 'Velliqo mobile experience',
  tabletImage,
  tabletAlt = 'Velliqo tablet experience',
  className,
  priority = false,
}: ResponsiveDeviceShowcaseProps) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[980px]', className)}>
      <div className="absolute inset-x-[12%] top-[8%] h-[70%] rounded-full bg-violet-400/20 blur-3xl" />
      <div className="relative mx-auto w-full max-w-[780px]">
        <LaptopDevice
          image={laptopImage}
          alt={laptopAlt}
          fit="fill"
          loading={priority ? 'eager' : 'lazy'}
        />
      </div>

      {(phoneImage || tabletImage) && (
        <div className="relative z-20 mx-auto -mt-3 grid max-w-[720px] grid-cols-1 items-end justify-items-center gap-5 sm:-mt-10 sm:grid-cols-2 lg:pointer-events-none lg:absolute lg:inset-x-0 lg:bottom-[-9%] lg:flex lg:items-end lg:justify-between lg:px-1">
          {phoneImage && (
            <div className="w-[42%] min-w-[150px] max-w-[220px] sm:w-full lg:w-[22%]">
              <PhoneDevice image={phoneImage} alt={phoneAlt} fit="fill" loading={priority ? 'eager' : 'lazy'} />
            </div>
          )}
          {tabletImage && (
            <div className="w-full max-w-[390px] lg:w-[34%]">
              <TabletDevice image={tabletImage} alt={tabletAlt} fit="fill" loading={priority ? 'eager' : 'lazy'} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
