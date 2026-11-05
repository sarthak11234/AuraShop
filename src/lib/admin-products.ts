import { Prisma } from '@prisma/client';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validImage(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateProductBody(body: unknown) {
  if (!isRecord(body)) return { error: 'Invalid request body' } as const;
  const { title, slug, subtitle, categoryId, description, details, images, price, version, sizes } = body;

  if (typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 160) {
    return { error: 'Title must be between 2 and 160 characters' } as const;
  }
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    return { error: 'Slug must contain lowercase letters, numbers, and hyphens' } as const;
  }
  if (
    typeof subtitle !== 'string' || subtitle.trim().length > 240 ||
    typeof description !== 'string' || description.trim().length < 1 ||
    description.length > 10_000 ||
    typeof categoryId !== 'string' ||
    typeof version !== 'string' || version.trim().length > 60
  ) {
    return { error: 'Invalid product text or category' } as const;
  }

  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice > 10_000_000) {
    return { error: 'Price must be greater than zero and within the supported range' } as const;
  }
  if (
    !Array.isArray(details) || details.length > 30 ||
    !details.every((item) => typeof item === 'string' && item.length <= 300)
  ) {
    return { error: 'Product details must be a list of up to 30 short strings' } as const;
  }
  if (
    !Array.isArray(images) || images.length < 1 || images.length > 20 ||
    !images.every((item) => typeof item === 'string' && item.length <= 2048 && validImage(item))
  ) {
    return { error: 'Images must contain safe HTTPS, local, or hex color values' } as const;
  }
  if (
    !Array.isArray(sizes) || sizes.length > 20 ||
    !sizes.every((item) => typeof item === 'string' && /^[A-Za-z0-9 ._-]{1,32}$/.test(item.trim()))
  ) {
    return { error: 'Sizes must be a list of up to 20 valid labels' } as const;
  }
  if (new Set(sizes.map((size) => String(size).trim().toLowerCase())).size !== sizes.length) {
    return { error: 'Product sizes must be unique' } as const;
  }
  if (typeof body.isPublished !== 'boolean' || typeof body.isNew !== 'boolean') {
    return { error: 'Publication and featured values must be specified' } as const;
  }

  return {
    data: {
      title: title.trim(),
      slug,
      subtitle: subtitle.trim(),
      categoryId,
      description: description.trim(),
      details: details.map((item) => String(item).trim()),
      images: images.map((item) => String(item).trim()) as Prisma.InputJsonValue,
      price: numericPrice,
      version: version.trim() || '01',
      isNew: body.isNew,
      isPublished: body.isPublished,
      sizes: sizes.map((size) => String(size).trim()),
    },
  } as const;
}
