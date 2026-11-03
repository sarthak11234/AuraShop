import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import { ProductGrid } from '@/components/product/ProductGrid';
import type { ProductCardData } from '@/lib/products';
import { getFeaturedProducts } from '@/lib/products';

const LOOKS = [
  {
    number: '01',
    name: 'CRIMSON PROTOCOL',
    image: '/images/products/look-crimson-protocol.webp',
    alt: 'Model in a crimson technical jacket and black utility trousers',
    description:
      'A vivid outer layer meets dark utility forms. Crimson, black and precise hardware bring a sharper energy to the silhouette.',
    href: '/collections?category=GEAR',
    tone: 'text-brand',
  },
  {
    number: '02',
    name: 'OBSIDIAN MINIMAL',
    image: '/images/products/look-obsidian-minimal-portrait.webp',
    alt: 'Model in structured charcoal outerwear against an architectural backdrop',
    description:
      'A study in restraint: charcoal layers, relaxed tailoring and a quiet interplay of shadow and texture.',
    href: '/collections?category=OUTERWEAR',
    tone: 'text-ink-secondary',
  },
  {
    number: '03',
    name: 'CHROME DISTRICT',
    image: '/images/products/look-chrome-district-portrait.webp',
    alt: 'Model wearing a reflective silver technical jacket',
    description:
      'Reflective surfaces shift with the light, set against dark utility layers and a cool, architectural palette.',
    href: '/collections?category=TECH',
    tone: 'text-cyan',
  },
  {
    number: '04',
    name: 'EARTH FREQUENCY',
    image: '/images/products/look-earth-frequency-portrait.webp',
    alt: 'Model in olive utility layers in a rugged outdoor landscape',
    description:
      'Muted olive and grounded layers bring a softer register to the VEXO wardrobe without losing its edge.',
    href: '/collections?category=OUTERWEAR',
    tone: 'text-ink-secondary',
  },
];

const MATERIALS = [
  {
    name: 'MATTE TECHNICAL NYLON',
    image: '/images/editorial/material-technical-nylon.webp',
    alt: 'Macro photograph of a dark technical nylon weave with water droplets',
  },
  {
    name: 'HEAVYWEIGHT WASHED COTTON',
    image: '/images/editorial/material-washed-cotton.webp',
    alt: 'Close view of the soft, irregular surface of washed cotton fleece',
  },
  {
    name: 'REFLECTIVE PRISMATIC TEXTILE',
    image: '/images/editorial/material-prismatic-textile.webp',
    alt: 'Reflective textile catching cool silver light',
  },
  {
    name: 'DIAMOND RIPSTOP WEAVE',
    image: '/images/editorial/material-diamond-ripstop-detail.webp',
    alt: 'Close detail of a black diamond-pattern ripstop weave',
  },
  {
    name: 'QUILTED THERMAL NEOPRENE',
    image: '/images/editorial/material-quilted-neoprene-detail.webp',
    alt: 'Quilted dark neoprene with sculpted seam lines',
  },
  {
    name: 'MATTE METALLIC HARDWARE',
    image: '/images/editorial/material-titanium-hardware.webp',
    alt: 'Close detail of a dark metal buckle and woven strap',
  },
];

const COLOUR_STORIES = [
  {
    name: 'OBSIDIAN BLACK',
    silhouette: 'ARCHITECTURAL TRENCH',
    colour: '#0B0B0D',
    image: '/images/products/color-obsidian-black.webp',
    alt: 'Black architectural trench coat on a minimal dark studio set',
  },
  {
    name: 'CRIMSON RED',
    silhouette: 'TECHNICAL FIELD SHELL',
    colour: '#FF454F',
    image: '/images/products/color-crimson-red.webp',
    alt: 'Crimson red technical shell jacket',
  },
  {
    name: 'GRAPHITE GREY',
    silhouette: 'MODULAR UTILITY VEST',
    colour: '#424248',
    image: '/images/products/color-graphite-grey.webp',
    alt: 'Graphite modular utility vest with layered pockets',
  },
  {
    name: 'METALLIC SILVER',
    silhouette: 'REFLECTIVE ANORAK',
    colour: '#C8C9CE',
    image: '/images/products/color-metallic-silver.webp',
    alt: 'Model in a metallic silver reflective anorak',
  },
  {
    name: 'OLIVE GREEN',
    silhouette: 'ARTICULATED CARGO',
    colour: '#59634D',
    image: '/images/products/color-olive-green.webp',
    alt: 'Olive utility cargo trousers with articulated panels',
  },
  {
    name: 'SAND BEIGE',
    silhouette: 'TEXTURED KNIT',
    colour: '#B8A99A',
    image: '/images/products/color-sand-beige.webp',
    alt: 'Sand beige textured oversized knit',
  },
  {
    name: 'DEEP BURGUNDY',
    silhouette: 'BONDED BOMBER',
    colour: '#641A2A',
    image: '/images/products/color-deep-burgundy.webp',
    alt: 'Deep burgundy bomber jacket with dark hardware',
  },
  {
    name: 'BONE WHITE',
    silhouette: 'ARCHITECTURAL PARKA',
    colour: '#E8E4DC',
    image: '/images/products/color-bone-white.webp',
    alt: 'Bone white technical parka with dark seam detailing',
  },
];

function SectionHeading({
  index,
  eyebrow,
  title,
  description,
  titleId,
}: {
  index: string;
  eyebrow: string;
  title: string;
  description?: string;
  titleId: string;
}) {
  return (
    <div className="mb-10 flex flex-col justify-between gap-6 border-b border-line pb-6 sm:mb-14 sm:flex-row sm:items-end">
      <div className="max-w-3xl">
        <p className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-brand">
          <span aria-hidden="true" className="h-1.5 w-1.5 bg-brand" />
          {index} / {eyebrow}
        </p>
        <h2 id={titleId} className="font-display text-3xl font-semibold uppercase leading-[0.98] tracking-[-0.04em] text-ink-primary sm:text-5xl lg:text-6xl">
          {title}
        </h2>
      </div>
      {description && (
        <p className="max-w-md text-sm leading-6 text-ink-secondary sm:text-right">{description}</p>
      )}
    </div>
  );
}

function CampaignHero() {
  return (
    <section
      aria-labelledby="campaign-title"
      className="relative isolate min-h-screen overflow-hidden bg-canvas pt-20"
    >
      <figure className="relative aspect-[1376/716] w-full overflow-hidden bg-[#3A0710] lg:h-[74svh] lg:min-h-[34rem] lg:aspect-auto">
        <Image
          src="/images/products/campaign-hero.webp"
          alt="Two VEXO models seated together in technical outerwear against a crimson campaign backdrop"
          fill
          preload
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10"
          aria-hidden="true"
        />
        <figcaption className="absolute bottom-3 left-4 font-mono text-[9px] tracking-[0.16em] text-white/75 sm:bottom-5 sm:left-8 sm:text-[10px]">
          CAMPAIGN 001 <span className="px-1 text-brand">/</span> NEURAL SERIES
        </figcaption>
      </figure>

      <div className="mx-auto grid max-w-[1800px] gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-10 lg:px-12 lg:py-8">
        <div className="max-w-2xl">
          <p className="mb-3 font-mono text-[10px] tracking-[0.2em] text-ink-secondary">
            THE VEXO EDIT <span className="text-brand">/</span> CAMPAIGN 001
          </p>
          <h1
            id="campaign-title"
            className="font-display text-4xl font-semibold uppercase leading-[0.98] tracking-[-0.045em] text-ink-primary sm:text-5xl lg:text-6xl"
          >
            THE FUTURE HAS <span className="text-brand">FORM.</span>
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-ink-secondary sm:text-base">
            A new perspective on form, function and expression.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Link
            href="#four-expressions"
            className="inline-flex min-h-12 items-center justify-center gap-3 bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-canvas transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
          >
            Explore the edit <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <Link
            href="#four-expressions"
            className="inline-flex min-h-12 items-center justify-center gap-3 border border-line px-5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-ink-primary transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
          >
            Discover the looks <ArrowDown size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ManifestoSection() {
  return (
    <section id="manifesto" aria-labelledby="manifesto-title" className="bg-canvas px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto grid max-w-[1600px] gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="relative aspect-[16/10] overflow-hidden bg-surface lg:col-span-7">
          <Image
            src="/images/editorial/manifesto-nylon.webp"
            alt="Technical fabric in close-up, lit with a restrained crimson highlight"
            fill
            sizes="(max-width: 1023px) 100vw, 58vw"
            className="object-cover"
          />
          <span className="absolute bottom-4 left-4 font-mono text-[9px] tracking-[0.15em] text-white/75">
            FORM / MATERIAL / EXPRESSION
          </span>
        </div>
        <div className="lg:col-span-5 lg:pl-5">
          <p className="mb-4 font-mono text-[10px] tracking-[0.18em] text-brand">A VEXO POINT OF VIEW</p>
          <h2
            id="manifesto-title"
            className="font-display text-4xl font-semibold uppercase leading-[0.96] tracking-[-0.04em] text-ink-primary sm:text-6xl"
          >
            STYLE IS
            <br />
            <span className="font-normal italic text-brand">NOT STATIC.</span>
          </h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-ink-secondary">
            An evolving expression of identity. Designed through unexpected silhouettes, technical
            materials and a different perspective on everyday fashion.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-line pt-4">
            <span className="font-mono text-[9px] tracking-wider text-ink-muted">VEXO / THE EDIT</span>
            <span className="text-right font-mono text-[9px] tracking-wider text-ink-secondary">IDENTITY IN MOTION</span>
          </div>
        </div>
        <div className="relative hidden aspect-[16/7] overflow-hidden bg-surface lg:col-span-5 lg:col-start-8 lg:block">
          <Image
            src="/images/products/manifesto-silk-harness-detail.webp"
            alt="Crimson fabric and a sculptural dark shoulder harness in an editorial close-up"
            fill
            sizes="(max-width: 1023px) 100vw, 42vw"
            className="object-cover"
          />
        </div>
        <p className="hidden self-end pb-2 font-mono text-[9px] leading-5 tracking-wider text-ink-muted lg:col-span-6 lg:col-start-2 lg:block">
          A wardrobe is never a fixed point.
          <br />
          It changes with the person who wears it.
        </p>
      </div>
    </section>
  );
}

function ExpressionsSection() {
  return (
    <section
      id="four-expressions"
      aria-labelledby="expressions-title"
      className="border-y border-line bg-canvas-secondary px-5 py-20 sm:px-8 lg:px-12 lg:py-28"
    >
      <div className="mx-auto max-w-[1600px]">
        <SectionHeading
          index="01"
          eyebrow="THE LOOKBOOK"
          title="THE FOUR EXPRESSIONS."
          description="Different identities. One vision."
          titleId="expressions-title"
        />
        <div className="space-y-16 sm:space-y-24 lg:space-y-32">
          {LOOKS.map((look, index) => {
            const imageFirst = index % 2 === 0;
            return (
              <article
                key={look.number}
                className="grid gap-7 lg:grid-cols-12 lg:items-center lg:gap-12"
              >
                <div
                  className={`relative aspect-[3/4] overflow-hidden bg-surface lg:col-span-7 ${
                    imageFirst ? 'lg:order-1' : 'lg:order-2'
                  }`}
                >
                  <Image
                    src={look.image}
                    alt={look.alt}
                    fill
                    sizes="(max-width: 1023px) 100vw, 60vw"
                    className="object-cover transition-transform duration-700 hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
                  />
                  <span className="absolute left-4 top-4 border border-white/20 bg-canvas/80 px-3 py-2 font-mono text-[9px] tracking-[0.14em] text-white backdrop-blur-sm">
                    LOOK {look.number}
                  </span>
                </div>
                <div
                  className={`lg:col-span-5 ${
                    imageFirst ? 'lg:order-2 lg:pl-2' : 'lg:order-1 lg:pr-2'
                  }`}
                >
                  <p className={`font-mono text-[10px] tracking-[0.2em] ${look.tone}`}>
                    EXPRESSION {look.number}
                  </p>
                  <h3 className="mt-3 font-display text-3xl font-semibold uppercase leading-none tracking-[-0.04em] text-ink-primary sm:text-4xl lg:text-5xl">
                    {look.name}
                  </h3>
                  <p className="mt-5 max-w-xl text-sm leading-6 text-ink-secondary sm:text-base sm:leading-7">
                    {look.description}
                  </p>
                  <Link
                    href={look.href}
                    className="mt-7 inline-flex min-h-11 items-center gap-3 border-b border-brand pb-1 font-mono text-[10px] font-bold tracking-[0.15em] text-ink-primary transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand motion-reduce:transition-none"
                  >
                    DISCOVER LOOK <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MaterialsSection() {
  return (
    <section id="materials" aria-labelledby="materials-title" className="bg-canvas px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1600px]">
        <SectionHeading
          index="02"
          eyebrow="SURFACE STUDIES"
          title="MATERIAL MATTERS."
          description="Built through texture. Defined by detail."
          titleId="materials-title"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MATERIALS.map((material, index) => (
            <figure key={material.name} className="group border border-line bg-surface">
              <div className="relative aspect-[16/10] overflow-hidden bg-canvas-secondary">
                <Image
                  src={material.image}
                  alt={material.alt}
                  fill
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
                <span className="absolute left-3 top-3 font-mono text-[9px] tracking-[0.16em] text-white/70">
                  MATERIAL / {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <figcaption className="border-t border-line px-4 py-4 font-mono text-[9px] leading-5 tracking-[0.1em] text-ink-secondary sm:text-[10px]">
                {material.name}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function ColourSection() {
  return (
    <section
      aria-labelledby="colour-title"
      className="border-y border-line bg-surface px-5 py-20 sm:px-8 lg:px-12 lg:py-28"
    >
      <div className="mx-auto max-w-[1600px]">
        <SectionHeading
          index="03"
          eyebrow="THE SPECTRUM"
          title="COLOUR WITHOUT CONVENTION."
          description="Beyond black. Beyond expectation."
          titleId="colour-title"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {COLOUR_STORIES.map((story, index) => (
            <figure key={story.name} className="group overflow-hidden border border-line bg-canvas">
              <div className="relative aspect-[4/5] overflow-hidden bg-canvas-secondary">
                <Image
                  src={story.image}
                  alt={story.alt}
                  fill
                  sizes="(max-width: 639px) 50vw, (max-width: 1023px) 25vw, 20vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
                <span className="absolute left-2 top-2 inline-flex items-center gap-2 bg-canvas/85 px-2 py-1 font-mono text-[8px] tracking-wider text-ink-primary backdrop-blur-sm sm:left-3 sm:top-3 sm:text-[9px]">
                  <span
                    className="h-2 w-2 border border-white/30"
                    style={{ backgroundColor: story.colour }}
                    aria-hidden="true"
                  />
                  {story.colour}
                </span>
              </div>
              <figcaption className="space-y-1 border-t border-line p-3 sm:p-4">
                <span className="block font-mono text-[8px] text-ink-muted sm:text-[9px]">
                  CHROMATIC STUDY / {String(index + 1).padStart(2, '0')}
                </span>
                <span className="block font-display text-[10px] font-bold leading-4 text-ink-primary sm:text-xs">
                  {story.name}
                </span>
                <span className="block font-mono text-[8px] leading-4 text-ink-secondary sm:text-[9px]">
                  {story.silhouette}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductDiscoverySkeleton() {
  return (
    <section className="bg-canvas px-5 py-20 sm:px-8 lg:px-12 lg:py-28" aria-label="Loading VEXO products">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-10 h-24 animate-pulse border-b border-line bg-surface" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="aspect-[4/5] animate-pulse bg-surface" />
          ))}
        </div>
      </div>
    </section>
  );
}

async function ProductDiscoverySection() {
  await connection();
  const products: ProductCardData[] = await getFeaturedProducts(8);

  return (
    <section
      id="collection"
      aria-labelledby="products-title"
      className="bg-canvas px-5 py-20 sm:px-8 lg:px-12 lg:py-28"
    >
      <div className="mx-auto max-w-[1600px]">
        <SectionHeading
          index="04"
          eyebrow="THE CATALOGUE"
          title="DISCOVER YOUR NEXT FORM."
          description="Explore technical layers, experimental silhouettes and accessories designed beyond convention."
          titleId="products-title"
        />
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <p className="border border-line bg-surface p-8 text-sm text-ink-secondary">
            The catalogue is currently unavailable.
          </p>
        )}
        <div className="mt-10 flex justify-center">
          <Link
            href="/collections"
            className="inline-flex min-h-12 items-center gap-3 border border-line px-6 font-mono text-[10px] font-bold tracking-[0.15em] text-ink-primary transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand motion-reduce:transition-none"
          >
            EXPLORE ALL COLLECTIONS <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ClosingCampaign() {
  return (
    <section aria-labelledby="closing-title" className="relative isolate overflow-hidden bg-canvas">
      <div className="relative h-[55svh] min-h-[24rem] sm:h-[65svh]">
        <Image
          src="/images/products/campaign-hero.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/20 to-canvas/10" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1600px] px-5 pb-10 sm:px-8 sm:pb-14 lg:px-12 lg:pb-16">
          <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-brand">
            VEXO / THE EDIT
          </p>
          <h2
            id="closing-title"
            className="max-w-4xl font-display text-4xl font-semibold uppercase leading-[0.95] tracking-[-0.045em] text-ink-primary sm:text-6xl lg:text-7xl"
          >
            THE FUTURE HAS <span className="text-brand">FORM.</span>
          </h2>
          <p className="mt-4 text-sm text-ink-secondary sm:text-base">
            Your identity. Your form. Your future.
          </p>
          <Link
            href="/collections"
            className="mt-7 inline-flex min-h-12 items-center gap-3 bg-brand px-5 font-mono text-[10px] font-bold tracking-[0.15em] text-canvas transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
          >
            ENTER THE VEXO WORLD <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function TheEditPage() {
  return (
    <>
      <CampaignHero />
      <ManifestoSection />
      <ExpressionsSection />
      <MaterialsSection />
      <ColourSection />
      <Suspense fallback={<ProductDiscoverySkeleton />}>
        <ProductDiscoverySection />
      </Suspense>
      <ClosingCampaign />
    </>
  );
}
