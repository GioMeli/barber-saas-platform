import type { CSSProperties, ReactNode } from 'react';
import { getIndustryConfig, type IndustryKey } from '@/config/industries';

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

export function IndustryThemeRoot({
  industryKey,
  children,
  className = '',
}: {
  industryKey?: IndustryKey | string | null;
  children: ReactNode;
  className?: string;
}) {
  const config = getIndustryConfig(industryKey);
  const palette = config.palette;

  const style: ThemeStyle = {
    '--primary': palette.primary,
    '--primary-foreground': palette.primaryForeground,
    '--accent': palette.accent,
    '--accent-foreground': palette.accentForeground,
    '--ring': palette.ring,
    '--sidebar-background': palette.sidebarBackground,
    '--sidebar-foreground': palette.sidebarForeground,
    '--sidebar-primary': palette.sidebarPrimary,
    '--sidebar-primary-foreground': palette.sidebarPrimaryForeground,
    '--sidebar-accent': palette.sidebarAccent,
    '--sidebar-accent-foreground': palette.sidebarAccentForeground,
    '--sidebar-border': palette.sidebarBorder,
  };

  return (
    <div data-industry={config.key} style={style} className={`min-h-screen ${className}`}>
      {children}
    </div>
  );
}
