import React from 'react';
import { ExternalLink, ListVideo, PlayCircle, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VideoPlayer from '@/components/ui/video';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { buildTrainingVideoEmbedUrl, detectTrainingVideoProvider, type TrainingVideoAsset } from '@/training/catalog';
import { cn } from '@/lib/utils';

type ResolvedVideo = TrainingVideoAsset & { url: string };

export function TrainingVideoLibraryDialog({
  open,
  onOpenChange,
  courseTitle,
  videos,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle: string;
  videos: ResolvedVideo[];
}) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = React.useState(videos[0]?.id || '');

  React.useEffect(() => {
    if (open) setSelectedId(videos[0]?.id || '');
  }, [open, videos]);

  const selected = videos.find((video) => video.id === selectedId) || videos[0];
  if (!selected) return null;

  const provider = selected.provider ?? detectTrainingVideoProvider(selected.url);
  const embedUrl = buildTrainingVideoEmbedUrl(selected.url, provider);
  const title = t(`training.videos.${selected.titleKey}`);
  const description = t(`training.videos.${selected.descriptionKey}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[94dvh] w-[97vw] max-w-[1460px] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-white px-5 py-4 pr-14 sm:px-7 sm:py-5">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-700">
            <ListVideo className="h-3.5 w-3.5" />
            {t('training.videoLibrary')}
          </div>
          <DialogTitle className="mt-2 text-xl font-black tracking-tight sm:text-2xl">{courseTitle}</DialogTitle>
          <DialogDescription>{t('training.videoLibraryReadyDescription', { count: videos.length })}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="min-h-0 border-b bg-slate-50 lg:border-b-0 lg:border-r">
            <ScrollArea className="h-full">
              <div className="space-y-2 p-3 sm:p-4">
                {videos.map((video, index) => {
                  const active = video.id === selected.id;
                  return (
                    <button
                      key={video.id}
                      type="button"
                      onClick={() => setSelectedId(video.id)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition',
                        active ? 'border-violet-300 bg-white shadow-sm ring-2 ring-violet-100' : 'border-transparent hover:border-slate-200 hover:bg-white',
                      )}
                    >
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', active ? 'bg-violet-700 text-white' : 'bg-violet-100 text-violet-700')}>
                        {active ? <PlayCircle className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{t('training.videoNumber', { number: index + 1 })}</span>
                        <span className="mt-1 block text-xs font-black leading-5 text-slate-900">{t(`training.videos.${video.titleKey}`)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          <ScrollArea className="min-h-0 bg-white">
            <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-600">{t('training.videoLesson')}</div>
                <h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-slate-950">{title}</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{description}</p>
              </div>

              <div className="overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-950 p-2 shadow-[0_24px_70px_rgba(15,23,42,.24)] sm:p-4">
                {provider === 'direct' ? (
                  <VideoPlayer key={selected.url} src={selected.url} poster={selected.posterUrl || undefined} controls aspectRatio="16:9" className="overflow-hidden rounded-xl" />
                ) : (
                  <div className="aspect-video overflow-hidden rounded-xl bg-black">
                    <iframe
                      key={embedUrl}
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

              <div className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-violet-900/75">{t('training.storagePlaybackHint')}</p>
                <Button asChild variant="outline" className="shrink-0 rounded-xl border-violet-200 bg-white">
                  <a href={selected.url} target="_blank" rel="noreferrer">
                    {t('training.openVideoExternally')} <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
