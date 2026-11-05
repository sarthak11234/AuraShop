import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading } from '../../_components';
import { ProductEditor } from '../product-editor';

export default async function NewProductPage() {
  await requireAdminPage();
  const categories = await db.category.findMany({
    where: { isPublished: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalogue / products"
        title="New product"
        description="Product images use existing URL-based media; uploaded files are not configured."
        action={<Link href="/admin/products" className="border border-line px-4 py-3 text-sm">Back to products</Link>}
      />
      <ProductEditor categories={categories} />
    </>
  );
}
