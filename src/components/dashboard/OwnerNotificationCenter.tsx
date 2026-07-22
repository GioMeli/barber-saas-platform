import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, CheckCheck, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
import { cn } from '@/lib/utils';

type OwnerNotification = {
  id: string;
  business_id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'new_appointment' | 'new_customer';
  is_read: boolean;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type Props = {
  businessId: string;
  onUnreadCountChange?: (count: number) => void;
  variant?: 'default' | 'icon';
};

export default function OwnerNotificationCenter({
  businessId,
  onUnreadCountChange,
  variant = 'default',
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);

  const unread = useMemo(
    () => notifications.filter((item) => !item.is_read),
    [notifications]
  );

  useEffect(() => {
    onUnreadCountChange?.(unread.length);
  }, [onUnreadCountChange, unread.length]);

  useEffect(() => {
    if (!businessId) return;

    void fetchNotifications();

    const channel = supabase
      .channel(`owner-notifications-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const item = payload.new as OwnerNotification;
          setNotifications((current) => {
            if (current.some((entry) => entry.id === item.id)) return current;
            return [item, ...current].slice(0, 30);
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId]);

  const fetchNotifications = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('notifications')
      .select('id, business_id, user_id, title, message, type, is_read, created_at, metadata')
      .eq('business_id', businessId)
      .in('type', ['new_appointment', 'new_customer'])
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      toast.error(error.message || t('notifications.errors.load'));
    } else {
      setNotifications((data ?? []) as OwnerNotification[]);
    }

    setLoading(false);
  };

  const markRead = async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.is_read) return;

    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, is_read: true } : item
      )
    );

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_read: false } : item
        )
      );
      toast.error(t('notifications.errors.update'));
    }
  };

  const markAllRead = async () => {
    const ids = unread.map((item) => item.id);
    if (ids.length === 0) return;

    setNotifications((current) =>
      current.map((item) => ({ ...item, is_read: true }))
    );

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids);

    if (error) {
      void fetchNotifications();
      toast.error(t('notifications.errors.mark_all'));
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size={variant === 'icon' ? 'icon' : 'default'}
          aria-label={t('notifications.title')}
          className={cn(
            'relative rounded-xl',
            variant === 'default' && 'w-full sm:w-auto',
            variant === 'icon' && 'h-10 w-10 bg-card/80 shadow-sm',
          )}
        >
          <Bell className={cn('h-4 w-4', variant === 'default' && 'mr-2')} />
          {variant === 'default' && t('notifications.title')}
          {unread.length > 0 && (
            <span
              className={cn(
                'inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white',
                variant === 'default' ? 'ml-2' : 'absolute -right-1.5 -top-1.5 border-2 border-background',
              )}
            >
              {unread.length > 99 ? '99+' : unread.length}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-[94vw] max-w-[420px] flex-col gap-0 p-0 sm:max-w-[420px] [&>button]:hidden"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="font-extrabold">{t('notifications.title')}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {t('notifications.unread_count', { count: unread.length })}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unread.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
                <CheckCheck className="mr-1.5 h-4 w-4" />
                {t('notifications.read_all')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              aria-label={t('notifications.close')}
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              {t('notifications.loading')}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Bell className="h-6 w-6" />
              </div>
              <div className="mt-4 font-semibold">{t('notifications.empty_title')}</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t('notifications.empty_description')}
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => void markRead(notification.id)}
                className={`flex w-full gap-3 border-b px-5 py-4 text-left transition last:border-b-0 hover:bg-muted/50 ${
                  notification.is_read ? 'bg-card' : 'bg-primary/[0.06]'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    notification.type === 'new_appointment'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {notification.type === 'new_appointment' ? (
                    <CalendarDays className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-bold">
                      {t(`notifications.types.${notification.type}.title`)}
                    </div>
                    {!notification.is_read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {t(`notifications.types.${notification.type}.message`)}
                  </p>
                  <div className="mt-2 text-[11px] font-medium text-muted-foreground">
                    {formatNotificationTime(notification.created_at, locale, t)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function formatNotificationTime(value: string, locale: string, t: (key: string, options?: any) => string) {
  const date = new Date(value);
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60_000)
  );

  if (minutes < 1) return t('notifications.just_now');
  if (minutes < 60) return t('notifications.minutes_ago', { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.hours_ago', { count: hours });

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
