import { supabase } from '@/db/supabase';

export const SERVICE_IMAGE_BUCKET = 'services';
export const SERVICE_IMAGE_MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const SERVICE_IMAGE_WIDTH = 800;
export const SERVICE_IMAGE_HEIGHT = 600;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read the selected image.'));
    };
    image.src = objectUrl;
  });
}

export function validateServiceImage(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Only JPG, PNG and WebP images are supported.');
  }
  if (file.size > SERVICE_IMAGE_MAX_INPUT_BYTES) {
    throw new Error('The selected image must be 5 MB or smaller.');
  }
}

export async function prepareServiceImage(file: File) {
  validateServiceImage(file);

  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = SERVICE_IMAGE_WIDTH;
  canvas.height = SERVICE_IMAGE_HEIGHT;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is not available.');

  const sourceRatio = image.width / image.height;
  const targetRatio = SERVICE_IMAGE_WIDTH / SERVICE_IMAGE_HEIGHT;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    SERVICE_IMAGE_WIDTH,
    SERVICE_IMAGE_HEIGHT,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Unable to create the optimized image.'))),
      'image/webp',
      0.84,
    );
  });

  return new File([blob], 'service-cover.webp', {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}

export function serviceImagePath(businessId: string, serviceId: string) {
  return `${businessId}/${serviceId}/cover.webp`;
}

export async function uploadServiceImage({
  businessId,
  serviceId,
  file,
}: {
  businessId: string;
  serviceId: string;
  file: File;
}) {
  const optimized = await prepareServiceImage(file);
  const path = serviceImagePath(businessId, serviceId);
  const { error } = await supabase.storage.from(SERVICE_IMAGE_BUCKET).upload(path, optimized, {
    cacheControl: '31536000',
    contentType: 'image/webp',
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(SERVICE_IMAGE_BUCKET).getPublicUrl(path);
  const cacheBuster = `v=${Date.now()}`;
  return {
    path,
    publicUrl: `${data.publicUrl}${data.publicUrl.includes('?') ? '&' : '?'}${cacheBuster}`,
  };
}

export async function removeServiceImage(path: string | null | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(SERVICE_IMAGE_BUCKET).remove([path]);
  if (error && !/not found/i.test(error.message)) throw error;
}
