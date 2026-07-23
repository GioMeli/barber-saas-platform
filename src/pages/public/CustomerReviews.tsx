import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CheckCircle2, MessageSquareText, RefreshCcw, ShieldCheck, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';

type StoreContext = {
  business: any;
  openCustomerSignIn: () => void;
  openCustomerSignUp: () => void;
};

export default function CustomerReviews() {
  const { business, openCustomerSignIn } = useOutletContext<StoreContext>();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business?.id) void loadReviews();
  }, [business?.id, user?.id]);

  const loadReviews = async () => {
    if (!business?.id) return;
    setLoading(true);

    try {
      const { data: publishedData, error: publishedError } = await supabase
        .rpc('get_public_business_reviews', { p_business_id: business.id });

      if (publishedError) throw publishedError;
      setReviews(publishedData ?? []);

      if (user) {
        const [{ data: appointmentData, error: appointmentError }, { data: ownReviewData, error: ownReviewError }] = await Promise.all([
          supabase.rpc('get_my_business_appointments', { p_business_id: business.id }),
          supabase
            .from('business_reviews')
            .select('*')
            .eq('business_id', business.id)
            .eq('user_id', user.id),
        ]);

        if (appointmentError) throw appointmentError;
        if (ownReviewError) throw ownReviewError;
        setAppointments(appointmentData ?? []);
        setMyReviews(ownReviewData ?? []);
      } else {
        setAppointments([]);
        setMyReviews([]);
      }
    } catch (error: any) {
      console.error('Customer reviews load error:', error);
      toast.error(error.message || t('customerReviews.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const averageRating = useMemo(
    () => reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length : 0,
    [reviews]
  );

  const eligibleAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'completed'),
    [appointments]
  );

  const openReviewDialog = (appointment: any) => {
    const existing = myReviews.find((review) => review.appointment_id === appointment.appointment_id);
    setSelectedAppointment(appointment);
    setRating(existing?.rating ?? 5);
    setTitle(existing?.title ?? '');
    setComment(existing?.comment ?? '');
    setReviewDialogOpen(true);
  };

  const submitReview = async () => {
    if (!business?.id || !selectedAppointment) return;
    setSaving(true);

    try {
      const { error } = await supabase.rpc('submit_business_review', {
        p_business_id: business.id,
        p_appointment_id: selectedAppointment.appointment_id,
        p_rating: rating,
        p_title: title.trim() || null,
        p_comment: comment.trim() || null,
      });
      if (error) throw error;

      toast.success(t('customerReviews.messages.submitted'));
      setReviewDialogOpen(false);
      await loadReviews();
    } catch (error: any) {
      toast.error(error.message || t('customerReviews.messages.submitFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center"><RefreshCcw className="mx-auto h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">{t('customerReviews.status.loading')}</p></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 pb-28 sm:px-6 md:pb-12">
      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
          <CardContent className="p-6 sm:p-8">
            <Badge className="bg-white/10 text-white hover:bg-white/10"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />{t('customerReviews.verifiedBadge')}</Badge>
            <h1 className="mt-5 text-3xl font-extrabold">{t('customerReviews.title')}</h1>
            <p className="mt-3 text-sm leading-7 text-white/65">{t('customerReviews.description', { business: business.name })}</p>
            <div className="mt-8 flex items-end gap-4">
              <div className="text-5xl font-extrabold">{averageRating ? averageRating.toFixed(1) : '—'}</div>
              <div className="pb-1">
                <StarRating value={Math.round(averageRating)} readOnly />
                <div className="mt-1 text-xs text-white/55">{t('customerReviews.reviewCount', { count: reviews.length })}</div>
              </div>
            </div>
            <div className="mt-8 rounded-2xl bg-white/5 p-4">
              <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-sm leading-6 text-white/70">{t('customerReviews.verifiedExplanation')}</p></div>
            </div>
            <Button asChild variant="secondary" className="mt-6 h-11 rounded-xl"><Link to={`/app/${business.slug}/book`}><CalendarDays className="mr-2 h-4 w-4" />{t('customerReviews.bookAppointment')}</Link></Button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-card">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-xl font-extrabold">{t('customerReviews.shareExperience')}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t('customerReviews.shareDescription')}</p></div>
              <MessageSquareText className="h-6 w-6 text-primary" />
            </div>

            {!user ? (
              <div className="mt-6 rounded-2xl border bg-muted/20 p-5">
                <p className="text-sm text-muted-foreground">{t('customerReviews.signInRequired')}</p>
                <Button className="mt-4" onClick={openCustomerSignIn}>{t('customerReviews.signIn')}</Button>
              </div>
            ) : eligibleAppointments.length === 0 ? (
              <div className="mt-6 rounded-2xl border bg-muted/20 p-5 text-sm text-muted-foreground">{t('customerReviews.noEligibleAppointments')}</div>
            ) : (
              <div className="mt-6 space-y-3">
                {eligibleAppointments.slice(0, 5).map((appointment) => {
                  const existing = myReviews.find((review) => review.appointment_id === appointment.appointment_id);
                  return (
                    <button key={appointment.appointment_id} type="button" onClick={() => openReviewDialog(appointment)} className="flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition hover:border-primary/30 hover:bg-primary/[0.03]">
                      <div>
                        <div className="font-semibold">{appointment.services?.map((service: any) => service.name).join(', ') || t('customerReviews.appointment')}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(appointment.start_time))}</div>
                      </div>
                      <Badge variant={existing ? 'secondary' : 'outline'}>{existing ? t(`customerReviews.statuses.${existing.status}`) : t('customerReviews.writeReview')}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-extrabold">{t('customerReviews.communityTitle')}</h2><p className="mt-2 text-sm text-muted-foreground">{t('customerReviews.communityDescription')}</p></div></div>
        {reviews.length === 0 ? (
          <Card className="mt-5 rounded-3xl"><CardContent className="p-12 text-center"><Star className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-bold">{t('customerReviews.emptyTitle')}</h3><p className="mt-2 text-sm text-muted-foreground">{t('customerReviews.emptyDescription')}</p></CardContent></Card>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reviews.map((review) => (
              <Card key={review.id} className="rounded-3xl shadow-card"><CardContent className="p-5"><StarRating value={review.rating} readOnly /><h3 className="mt-4 font-bold">{review.title || t('customerReviews.defaultReviewTitle')}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{review.comment || t('customerReviews.noComment')}</p><div className="mt-5 border-t pt-4"><div className="text-sm font-semibold">{review.customer_display_name || t('customerReviews.verifiedCustomer')}</div><div className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(review.created_at))}</div></div>{review.owner_response && <div className="mt-4 rounded-2xl bg-primary/[0.06] p-4"><div className="text-xs font-bold uppercase tracking-wide text-primary">{t('customerReviews.ownerResponse')}</div><p className="mt-2 text-sm leading-6">{review.owner_response}</p></div>}</CardContent></Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader><DialogTitle>{t('customerReviews.dialog.title')}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2"><Label>{t('customerReviews.dialog.rating')}</Label><StarRating value={rating} onChange={setRating} /></div>
            <div className="space-y-2"><Label>{t('customerReviews.dialog.reviewTitle')}</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('customerReviews.dialog.titlePlaceholder')} /></div>
            <div className="space-y-2"><Label>{t('customerReviews.dialog.comment')}</Label><Textarea rows={6} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t('customerReviews.dialog.commentPlaceholder')} /></div>
            <div className="rounded-2xl bg-muted/35 p-4 text-xs leading-5 text-muted-foreground">{t('customerReviews.dialog.moderationNote')}</div>
          </div>
          <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setReviewDialogOpen(false)}>{t('common.cancel')}</Button><Button disabled={saving} onClick={() => void submitReview()}>{saving ? t('common.saving') : t('customerReviews.dialog.submit')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StarRating({ value, onChange, readOnly = false }: { value: number; onChange?: (value: number) => void; readOnly?: boolean }) {
  return <div className="flex gap-1 text-amber-500" aria-label={`${value} / 5`}>{Array.from({ length: 5 }).map((_, index) => { const starValue = index + 1; return readOnly ? <Star key={starValue} className={`h-5 w-5 ${starValue <= value ? 'fill-current' : 'text-muted'}`} /> : <button key={starValue} type="button" onClick={() => onChange?.(starValue)} aria-label={`${starValue}`}><Star className={`h-7 w-7 transition hover:scale-110 ${starValue <= value ? 'fill-current' : 'text-muted'}`} /></button>; })}</div>;
}
