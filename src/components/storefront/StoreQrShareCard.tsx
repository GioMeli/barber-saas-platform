import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';

type StoreQrShareCardProps = {
  publicUrl: string;
  businessName: string;
  compact?: boolean;
};

export default function StoreQrShareCard({
  publicUrl,
  businessName,
  compact = false,
}: StoreQrShareCardProps) {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Store link copied');
    } catch {
      toast.error('Could not copy the store link');
    }
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: businessName,
          text: `View ${businessName} and book an appointment`,
          url: publicUrl,
        });
        return;
      }

      await copyLink();
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Could not share the store link');
      }
    }
  };

  const downloadQrCode = () => {
    const qrId = `store-public-qr-code-${businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}`;

    const svg = document.getElementById(qrId);
    if (!svg) {
      toast.error('QR code could not be downloaded');
      return;
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${businessName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-qr-code.svg`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);

    toast.success('QR code downloaded');
  };

  return (
    <Card>
      <CardContent
        className={
          compact
            ? 'flex flex-col items-center gap-5 p-5'
            : 'grid gap-6 p-6 md:grid-cols-[220px_1fr] md:items-center'
        }
      >
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <QRCodeSVG
            id={`store-public-qr-code-${businessName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')}`}
            value={publicUrl}
            size={compact ? 150 : 190}
            level="H"
            includeMargin
            title={`${businessName} booking QR code`}
          />
        </div>

        <div className={compact ? 'w-full text-center' : 'space-y-4'}>
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Share2 className="h-5 w-5 text-primary" />
              Share this store
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Scan the QR code or share the link to open {businessName},
              view services and book an appointment.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              readOnly
              value={publicUrl}
              className="min-w-0 bg-muted/40"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Copy link"
              onClick={() => void copyLink()}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div
            className={
              compact
                ? 'grid grid-cols-2 gap-2'
                : 'flex flex-wrap gap-2'
            }
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => void shareLink()}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={downloadQrCode}
            >
              <Download className="mr-2 h-4 w-4" />
              Download QR
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
