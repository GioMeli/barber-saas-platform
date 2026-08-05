import { ExternalLink, Video as VideoIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VideoPlayer from '@/components/ui/video';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { TrainingVideoProvider } from '@/training/catalog';
import { buildTrainingVideoEmbedUrl, detectTrainingVideoProvider } from '@/training/catalog';

type TrainingVideoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  videoUrl: string | null | undefined;
  videoProvider?: TrainingVideoProvider;
  posterUrl?: string | null;
};

export function TrainingVideoDialog({
  open,
  onOpenChange,
  title,
  description,
  videoUrl,
  videoProvider,
  posterUrl,
}: TrainingVideoDialogProps) {
  const { t } = useTranslation();
  if (!videoUrl) return null;

  const provider = videoProvider ?? detectTrainingVideoProvider(videoUrl);
  const embedUrl = buildTrainingVideoEmbedUrl(videoUrl, provider);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pt-6">
          <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-700">
            <VideoIcon className="h-3.5 w-3.5" />
            {t('training.videoLesson')}
          </div>
          <DialogTitle className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</DialogTitle>
          {description && <DialogDescription className="max-w-3xl leading-6">{description}</DialogDescription>}
        </DialogHeader>

        <div className="bg-slate-950 p-2 sm:p-4">
          {provider === 'direct' ? (
            <VideoPlayer src={videoUrl} poster={posterUrl || undefined} controls aspectRatio="16:9" className="overflow-hidden rounded-xl" />
          ) : (
            <div className="aspect-video overflow-hidden rounded-xl bg-black">
              <iframe
                src={embedUrl}
                title={title}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pb-6">
          <p className="text-xs leading-5 text-muted-foreground">{t('training.videoPlaybackHint')}</p>
          <Button asChild variant="outline" className="shrink-0 rounded-xl">
            <a href={videoUrl} target="_blank" rel="noreferrer">
              {t('training.openVideoExternally')} <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
