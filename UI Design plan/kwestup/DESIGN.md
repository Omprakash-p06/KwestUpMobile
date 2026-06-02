---
name: KwestUp
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c6c6c6'
  on-secondary: '#303030'
  secondary-container: '#474747'
  on-secondary-container: '#b5b5b5'
  tertiary: '#ffffff'
  on-tertiary: '#303030'
  tertiary-container: '#e4e2e1'
  on-tertiary-container: '#656464'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 20px
---

## Brand & Style
The design system is engineered for high-performance productivity, blending the tactile reliability of analog tools with the cutting-edge precision of modern software. It targets power users who demand a distraction-free, high-utility environment for thought organization and knowledge management.

The style is **Tactile / Skeuomorphic** with an **Edgy, High-Contrast** twist. Unlike traditional soft skeuomorphism, this design system utilizes hard angles, sharp transitions, and aggressive contrast to create a "digital-industrial" aesthetic. It evokes an emotional response of focus, durability, and raw power. Surfaces are not just colors; they are materials—brushed steel, recycled paper, and obsidian glass—giving every interaction a physical weight.

## Colors
The palette is strictly monochromatic to maximize focus and visual impact. 

- **Primary:** Pure White (#FFFFFF) for maximum legibility and "active" states.
- **Secondary:** Pure Black (#000000) for deep backgrounds and structural anchors.
- **Tertiary:** Mid-tone Grays serve as texture overlays and subtle borders.

This design system supports three distinct modes:
1. **Light Mode:** Uses a "Paper" texture base with ink-black typography.
2. **Dark Mode:** Features "Brushed Metal" surfaces with white typography.
3. **AMOLED Mode:** High-contrast "Obsidian" surfaces with pure black backgrounds to save energy and provide infinite depth.

## Typography
The typography is sharp, technical, and modern. We use **Hanken Grotesk** for all primary communication due to its clean, geometric precision and high legibility at extreme weights. For metadata, technical labels, and AI-generated content, we utilize **JetBrains Mono** to reinforce the "industrial tool" aesthetic.

Headlines should use tight tracking and heavy weights to create a sense of structural authority. Body text maintains a generous line height to ensure readability against textured backgrounds.

## Layout & Spacing
The layout follows a rigorous **Fixed Grid** philosophy. Every element is aligned to a 4px baseline, ensuring that "hard edges" feel intentional and mathematically sound.

- **Mobile:** A 4-column grid with 20px outer margins and 16px gutters.
- **Desktop/Tablet:** A 12-column grid.
- **Philosophy:** Avoid fluid "squishiness." Components should snap to the grid. Use heavy 2px or 3px borders to define layout boundaries rather than relying on whitespace alone.

## Elevation & Depth
Depth is achieved through **Material Realism** rather than standard ambient shadows. 

1. **Inward Depth (Pressed):** Use inner shadows and grain textures to make containers look etched into the surface (e.g., input fields).
2. **Outward Depth (Raised):** Use 1px highlight "bevels" on the top-left edge and 1px "shadow" strokes on the bottom-right. This creates a machined, metallic look.
3. **Glass Layers:** For AI overlays and floating menus, use high-strength backdrop blurs (30px+) with a 10% white tint and a sharp 1px white border to simulate polished glass.
4. **Texture Overlays:** Apply a subtle 5% opacity noise or grain filter across all surfaces to eliminate digital flatness.

## Shapes
This design system uses a **Sharp (0px)** roundedness philosophy. Every button, card, and input field is a perfect rectangle. This reinforces the "industrial hardware" aesthetic.

The only exceptions are specific functional icons or status indicators. All structural containers must maintain 90-degree angles to ensure the layout feels architectural and uncompromising.

## Components
- **Buttons:** High-contrast blocks. The "Primary" button is pure white with black text; "Secondary" is black with a white 2px border. On press, use an "Invert" effect (White becomes Black) to simulate a physical mechanical switch.
- **Containers (Cards):** Use a "Brushed Metal" texture (fine horizontal gradients) or a "Paper" grain. Borders are mandatory—never rely on shadow alone to define a container.
- **Input Fields:** Styled as "etched" into the UI. Use a dark inner-shadow and a monospaced font for the cursor to emphasize the "typewriter" or "terminal" feel.
- **AI Elements:** AI-driven features (like suggestions or summaries) are housed in **Glassmorphic** containers with a subtle "scanning" animation—a 1px horizontal white line that moves vertically to signify processing.
- **Chips/Labels:** Small, sharp-edged rectangles using **JetBrains Mono**. They should look like physical dymo-labels or industrial stickers.
- **Checkboxes:** Square boxes. When checked, they are filled with a solid "X" mark rather than a checkmark, maintaining the "edgy" aesthetic.