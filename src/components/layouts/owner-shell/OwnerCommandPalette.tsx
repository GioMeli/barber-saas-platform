import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { OWNER_NAVIGATION_ITEMS } from './navigation';

export default function OwnerCommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const goTo = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-xl bg-card/80 text-muted-foreground shadow-sm xl:w-[280px] xl:justify-start xl:px-3"
        aria-label={t('navigation.search')}
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden truncate xl:inline">{t('navigation.search_placeholder')}</span>
        <span className="ml-auto hidden rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground xl:inline">
          Ctrl K
        </span>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t('navigation.search_placeholder')} />
        <CommandList>
          <CommandEmpty>{t('navigation.no_search_results')}</CommandEmpty>
          <CommandGroup heading={t('navigation.modules')}>
            {OWNER_NAVIGATION_ITEMS.map((item) => (
              <CommandItem
                key={item.key}
                value={`${t(item.labelKey)} ${item.keywords.join(' ')}`}
                onSelect={() => goTo(item.path)}
              >
                <item.icon className="h-4 w-4 text-primary" />
                <span>{t(item.labelKey)}</span>
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
