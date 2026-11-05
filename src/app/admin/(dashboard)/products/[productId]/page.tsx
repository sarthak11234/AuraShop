import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading } from '../../_components';
import { ProductEditor } from '../product-editor';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requireAdminPage();
  const { productId } = await params;
  const [product, categories] = await Promise.all([
    db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        slug: true,
        subtitle: true,
        categoryId: true,
        description: true,
        details: true,
        images: true,
        price: true,
        version: true,
        isNew: true,
        isPublished: true,
        variants: { select: { size: true } },
      },
    }),
    db.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);
  if (!product) notFound();

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalogue / products"
        title="Edit product"
        description="Existing size variants are retained; manage variant stock under Inventory."
        action={<Link href="/admin/products" className="border border-line px-4 py-3 text-sm">Back to products</Link>}
      />
      <ProductEditor categories={categories} initial={{ ...product, price: Number(product.price) }} />
    </>
  );
}
