import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading, EmptyState } from '../_components';
import { CategoryForm } from './category-form';

export default async function AdminCategoriesPage() {
  await requireAdminPage();
  const categories = await db.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isPublished: true,
      _count: { select: { products: true } },
    },
  });

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalogue"
        title="Categories"
        description="Category codes are unique. Collection paths currently use the category name; renaming it changes the storefront collection path."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-secondary">Create category</h2>
          <CategoryForm />
        </section>
        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-secondary">Existing categories</h2>
          {categories.length === 0 ? (
            <EmptyState>No categories found.</EmptyState>
          ) : (
            <div className="space-y-4">
              {categories.map((category) => (
                <CategoryForm
                  key={category.id}
                  category={{
                    id: category.id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description,
                    isPublished: category.isPublished,
                    productCount: category._count.products,
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
