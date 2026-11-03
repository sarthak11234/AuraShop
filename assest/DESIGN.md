---
name: Neo-Maison Editorial
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1c1b1d'
  surface-container: '#201f21'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#e5bdbb'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#ab8887'
  outline-variant: '#5c403e'
  surface-tint: '#ffb3b0'
  primary: '#ffb3b0'
  on-primary: '#680010'
  primary-container: '#ff5358'
  on-primary-container: '#5b000c'
  inverse-primary: '#bd0b28'
  secondary: '#6cd6df'
  on-secondary: '#00363a'
  secondary-container: '#289fa8'
  on-secondary-container: '#002f32'
  tertiary: '#c8c5cc'
  on-tertiary: '#303035'
  tertiary-container: '#919096'
  on-tertiary-container: '#29292e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad8'
  primary-fixed-dim: '#ffb3b0'
  on-primary-fixed: '#410006'
  on-primary-fixed-variant: '#93001a'
  secondary-fixed: '#8af3fc'
  secondary-fixed-dim: '#6cd6df'
  on-secondary-fixed: '#002022'
  on-secondary-fixed-variant: '#004f54'
  tertiary-fixed: '#e4e1e8'
  tertiary-fixed-dim: '#c8c5cc'
  on-tertiary-fixed: '#1b1b20'
  on-tertiary-fixed-variant: '#47464c'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 84px
    fontWeight: '600'
    lineHeight: 92px
    letterSpacing: -0.04em
  display-hero-mobile:
    fontFamily: Space Grotesk
    fontSize: 44px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 52px
    fontWeight: '500'
    lineHeight: 58px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '500'
    lineHeight: 42px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.01em
  tech-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.08em
  tech-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0.12em
  label-action:
    fontFamily: Space Grotesk
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  gutter-lg: 2rem
  margin: 2rem
  margin-sm: 1rem
  margin-lg: 4rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system defines a luxury, futuristic streetwear maison. The aesthetic balances three distinct energies: 60% high-fashion minimalism, 25% technical precision, and 15% raw contemporary streetwear tension.

### Identity & Feel
- **Architectural Rigor:** Visual weight is achieved through stark proportions, deliberate void space, and geometric balance rather than ornamental clutter.
- **Editorial Presence:** Large-scale, expressive headlines communicate status and craft, counterweighted by sparse, monospaced metadata that evokes atelier garment tagging and technical garment specifications.
- **Controlled Futurism:** Avoid sci-fi tropes, glowing outlines, faux data visualizers, and heavy neon. Technology is communicated strictly through surgical spacing, high contrast, seamless transitions, and laser-precise typography.

## Colors

The system uses a dark tonal architecture structured to make garments and product imagery the primary focal points, illuminated by calculated energetic accents.

### Color Tokens & Roles
- **Canvas Base:**
  - `Background Primary` (`#0B0B0D`): Deep obsidian base for full-bleed viewport backgrounds.
  - `Background Secondary` (`#121215`): Section alternation and contextual canvas bands.
- **Surfaces:**
  - `Surface Primary` (`#18181C`): Standard baseline for product cards, containers, and table rows.
  - `Surface Elevated` (`#202025`): Floating draw-outs, quick-shop modals, flyout carts, and popovers.
  - `Surface Hover` (`#29292F`): Interactive state feedback for surface elements.
- **Borders & Dividers:**
  - `Border Subtle` (`#29292E`): Hairline rules, metadata partitions, and structural cell borders.
  - `Border Strong` (`#3A3A42`): Emphasized boundaries, active focus rings, and outer structural rails.
- **Typography:**
  - `Text Primary` (`#F4F2F0`): Bone-white tone for editorial titles, product names, and vital data.
  - `Text Secondary` (`#A6A3A3`): Balanced gray for body copy, garment descriptions, and specifications.
  - `Text Muted` (`#77747A`): Subdued gray for SKU tags, technical coordinates, dates, and measurement guides.
- **Accents:**
  - `Accent Red` (`#FF454F`): Primary CTA, scarcity alerts, high-energy buy triggers.
  - `Accent Red Hover` (`#E8323D`): Active down-state and interactive hover for primary CTA.
  - `Accent Red Soft` (`rgba(255, 69, 79, 0.10)`): Low-impact badge backgrounds, cart pill counters, and subtle highlights.
  - `Accent Cyan` (`#72DCE5`): Reserved for technical tooling, 3D interactive viewer indicators, fabric matrix highlights, and digital authenticity proofs.
- **Feedback:**
  - `Success`: `#70C99B` | `Warning`: `#E9B76B` | `Error`: `#FF555F`

## Typography

The typographic hierarchy juxtaposes Swiss modernist discipline with machine-readable telemetry.

### Font Pairings & Application
- **Display & Headlines (`Space Grotesk`):** Defined by structural geometric curves and modified letterforms. Used for editorial collection banners, garment names, campaign drops, and category entry points. Must always utilize negative tracking on large viewport sizes.
- **Body & Narrative (`Inter`):** Neutral, unobtrusive, highly legible at micro-scales. Handles technical composition lists, material properties, care guidelines, and transactional checkout flows.
- **Technical Telemetry (`JetBrains Mono`):** Applied to garment IDs, pricing, system timestamps, stock availability indicators, edition numbers (`ED. 001/100`), sizing matrices, and material specs. All technical mono strings are set in uppercase with tracked spacing (`0.08em` to `0.12em`).

## Layout & Spacing

Layout is structured around a mathematical 4px spatial baseline and an editorial grid inspired by Swiss poster design.

### Grid Discipline
- **Desktop (>= 1280px):** 12-column layout with `2rem` gutters and `4rem` outer canvas margins. Allows asymmetrical editorial compositions: multi-column fashion lookbooks paired with single-column technical sidebars.
- **Tablet (768px - 1279px):** 8-column layout with `1.5rem` gutters and `2rem` outer margins.
- **Mobile (< 768px):** 4-column layout with `1rem` gutters and `1rem` edge margins.

### Spatial Rhythm
- Density changes contextually: transactional elements (drawers, bag summaries, sizing guides) employ compact, high-density layouts (`space-xs` to `space-md`), while editorial collection showcases leverage dramatic voids (`space-xl` and higher) to communicate prestige.

## Elevation & Depth

Visual hierarchy is achieved through distinct tonal layering and sharp architectural containment rather than traditional diffuse drop shadows.

### Elevation Levels
- **Ground Floor (Base Canvas):** `#0B0B0D`. Pure background layer for infinite scroll lists and wide-angle hero viewports.
- **Tier 1 (Surface Primary):** `#18181C`. Static product cards, media modules, technical specification tables. Separated from the base strictly via 1px hairline borders (`#29292E`).
- **Tier 2 (Surface Elevated):** `#202025`. Sticky navigation rails, floating action capsules, active modals, and popover flyouts. Receives a precision drop boundary: `0 8px 32px rgba(0, 0, 0, 0.65)` bordered by `#3A3A42`.
- **Tier 3 (Overlays & 3D Tools):** `#202025` with `backdrop-filter: blur(16px)` at 85% opacity. Used for interactive 3D model controls, inspection loupes, and contextual image zooming.

## Shapes

The design system uses precise, architectural corner radii to evoke precision manufacturing and high-end industrial design.

### Corner Radii
- **Sharp Technical Inputs & Controls (4px):** Form inputs, size selectors, checkboxes, technical badges, and system alerts.
- **Interactive Buttons & Badges (4px - 6px):** Primary CTAs, secondary action triggers, and filter tags.
- **Cards & Structural Enclosures (6px - 8px):** Product display tiles, modal containers, and editorial viewports.
- **Full Radii (Pill / 9999px):** Restricted purely to status chips (e.g., `IN STOCK`, `ARCHIVE`) and round icon-only action triggers.

## Components

### Buttons
- **Primary CTA:** Background `#FF454F`, text `#0B0B0D` (or `#F4F2F0`), radius `4px`, font `Space Grotesk` Medium, uppercase with subtle letter tracking. Hover shifts to `#E8323D` with smooth 150ms ease.
- **Secondary (Ghost Outline):** Transparent background, 1px border `#3A3A42`, text `#F4F2F0`. Hover shifts background to `#18181C` and border to `#F4F2F0`.
- **Technical Action (Monospace):** Background `#18181C`, 1px border `#29292E`, text `#A6A3A3`, font `JetBrains Mono`. Features micro-indicator dot (4px circle in `#72DCE5`).

### Product Cards
- **Structure:** Surface `#18181C`, 1px border `#29292E`, radius `6px`.
- **Media Canvas:** High-contrast imagery set against `#121215` with an aspect ratio of 3:4 or 4:5. Hover triggers an instant swap to secondary runway/fit angle.
- **Metadata Block:** Positioned flush beneath media. Garment title in `Space Grotesk` 16px, price and collection serial formatted in `JetBrains Mono` 13px muted gray (`#A6A3A3`).

### Form Inputs & Selectors
- **Fields:** Background `#121215`, 1px border `#29292E`, text `#F4F2F0`, font `Inter` 14px, radius `4px`. Focused state transitions border to `#FF454F` without glow rings.
- **Size Grid Selectors:** Square micro-buttons (44x44px). Background `#18181C`, 1px border `#29292E`, font `JetBrains Mono` 12px. Active selection adopts `#F4F2F0` background with `#0B0B0D` text. Disabled or out-of-stock items feature a thin diagonal 45-degree strike line.

### Badges & Status Chips
- **Telemetry Pills:** Height 22px, padding 0 8px, font `JetBrains Mono` 11px uppercase.
  - *Standard Release:* Background `#18181C`, text `#A6A3A3`, border `#29292E`.
  - *Limited Edition:* Background `rgba(255, 69, 79, 0.10)`, text `#FF454F`, border `rgba(255, 69, 79, 0.30)`.
  - *Technical/3D:* Background `rgba(114, 220, 229, 0.10)`, text `#72DCE5`, border `rgba(114, 220, 229, 0.30)`.

### Lists & Atelier Specifications
- Border-bottom separators in `#29292E`. Each spec row consists of a fixed left key in `JetBrains Mono` (`#77747A`, e.g., `COMPOSITION //`) and a dynamic right value in `Inter` (`#F4F2F0`, e.g., `100% CORDURA® 500D`).