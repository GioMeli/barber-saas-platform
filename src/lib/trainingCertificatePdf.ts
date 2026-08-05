import type { TrainingAudience } from '@/training/curriculum';

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

function createImagePdf(jpeg: Uint8Array, width: number, height: number) {
  const objects: Uint8Array[] = [];
  objects[1] = textBytes('<< /Type /Catalog /Pages 2 0 R >>');
  objects[2] = textBytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects[3] = textBytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
  const content = textBytes('q\n842 0 0 595 0 0 cm\n/Im0 Do\nQ');
  objects[4] = concatBytes([textBytes(`<< /Length ${content.length} >>\nstream\n`), content, textBytes('\nendstream')]);
  objects[5] = concatBytes([
    textBytes(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    textBytes('\nendstream'),
  ]);

  const header = textBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const bodyParts: Uint8Array[] = [header];
  const offsets = [0];
  let offset = header.length;

  for (let index = 1; index <= 5; index += 1) {
    offsets[index] = offset;
    const objectBytes = concatBytes([
      textBytes(`${index} 0 obj\n`),
      objects[index],
      textBytes('\nendobj\n'),
    ]);
    bodyParts.push(objectBytes);
    offset += objectBytes.length;
  }

  const xrefOffset = offset;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let index = 1; index <= 5; index += 1) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  bodyParts.push(textBytes(xref), textBytes(trailer));
  return concatBytes(bodyParts);
}

async function loadImage(src: string) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = src;
  await image.decode();
  return image;
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, minSize: number) {
  let size = startSize;
  while (size > minSize) {
    context.font = `800 ${size}px Inter, Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

export async function downloadTrainingCertificatePdf({
  participantName,
  businessName,
  audience,
  score,
  certificateNumber,
  certifiedAt,
  language,
}: {
  participantName: string;
  businessName: string;
  audience: TrainingAudience;
  score: number;
  certificateNumber: string;
  certifiedAt: string;
  language?: string | null;
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1131;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Certificate canvas is unavailable.');

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#f8f7ff');
  gradient.addColorStop(0.5, '#ffffff');
  gradient.addColorStop(1, '#f3e8ff');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#130829';
  context.fillRect(0, 0, canvas.width, 92);
  context.fillStyle = '#7c3aed';
  context.fillRect(0, 92, canvas.width, 10);

  context.strokeStyle = '#7c3aed';
  context.lineWidth = 4;
  context.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);
  context.strokeStyle = '#d8b4fe';
  context.lineWidth = 1.5;
  context.strokeRect(68, 68, canvas.width - 136, canvas.height - 136);

  context.globalAlpha = 0.08;
  context.fillStyle = '#7c3aed';
  context.beginPath();
  context.arc(1400, 170, 250, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(180, 980, 290, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  try {
    const logo = await loadImage('/brand/velliqo-logo-transparent.png');
    const ratio = Math.min(300 / logo.width, 110 / logo.height);
    context.drawImage(logo, (canvas.width - logo.width * ratio) / 2, 132, logo.width * ratio, logo.height * ratio);
  } catch {
    context.fillStyle = '#7c3aed';
    context.font = '900 58px Inter, Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText('VELLIQO', canvas.width / 2, 205);
  }

  context.textAlign = 'center';
  context.fillStyle = '#6d28d9';
  context.font = '800 24px Inter, Arial, sans-serif';
  context.fillText('OFFICIAL APPLICATION CERTIFICATION', canvas.width / 2, 300);

  context.fillStyle = '#111827';
  context.font = '900 64px Inter, Arial, sans-serif';
  context.fillText('Certificate of Achievement', canvas.width / 2, 385);

  context.fillStyle = '#64748b';
  context.font = '500 25px Inter, Arial, sans-serif';
  context.fillText('This professional certification is proudly presented to', canvas.width / 2, 445);

  const nameSize = fitText(context, participantName, 1260, 72, 40);
  context.fillStyle = '#2e1065';
  context.font = `800 ${nameSize}px Inter, Arial, sans-serif`;
  context.fillText(participantName, canvas.width / 2, 545);

  context.strokeStyle = '#c4b5fd';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(350, 570);
  context.lineTo(1250, 570);
  context.stroke();

  context.fillStyle = '#334155';
  context.font = '500 25px Inter, Arial, sans-serif';
  const audienceText = audience === 'owner' ? 'Velliqo Owner Workspace' : 'Velliqo Staff App';
  context.fillText(`for completing 100% of the ${audienceText} training curriculum`, canvas.width / 2, 635);
  context.fillText('and passing the 50-question certification assessment.', canvas.width / 2, 675);

  const date = new Intl.DateTimeFormat(language || 'en', { dateStyle: 'long' }).format(new Date(certifiedAt));
  const boxes = [
    { label: 'BUSINESS', value: businessName },
    { label: 'SCORE', value: `${score}%` },
    { label: 'ISSUED', value: date },
  ];
  boxes.forEach((box, index) => {
    const x = 250 + index * 385;
    context.fillStyle = 'rgba(124,58,237,.06)';
    context.strokeStyle = '#ddd6fe';
    context.lineWidth = 1.5;
    context.beginPath();
    context.roundRect(x, 735, 330, 120, 18);
    context.fill();
    context.stroke();
    context.fillStyle = '#7c3aed';
    context.font = '800 15px Inter, Arial, sans-serif';
    context.fillText(box.label, x + 165, 775);
    context.fillStyle = '#1e293b';
    const boxFont = fitText(context, box.value, 285, 24, 15);
    context.font = `700 ${boxFont}px Inter, Arial, sans-serif`;
    context.fillText(box.value, x + 165, 818);
  });

  context.fillStyle = '#475569';
  context.font = '600 17px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(`Certificate ID: ${certificateNumber}`, canvas.width / 2, 925);

  context.fillStyle = '#94a3b8';
  context.font = '500 16px Inter, Arial, sans-serif';
  context.fillText('Issued by Velliqo · Book. Manage. Grow.', canvas.width / 2, 1000);
  context.fillText('This certificate confirms successful completion of the application training assessment.', canvas.width / 2, 1035);

  const jpeg = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.94));
  const pdf = createImagePdf(jpeg, canvas.width, canvas.height);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeName = participantName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'participant';
  anchor.href = url;
  anchor.download = `Velliqo-Certificate-${safeName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
