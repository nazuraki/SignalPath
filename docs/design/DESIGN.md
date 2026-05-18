---
name: Technical Minimalist Linear Flow
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1b1b1e'
  surface-container: '#1f1f22'
  surface-container-high: '#2a2a2d'
  surface-container-highest: '#353437'
  on-surface: '#e4e1e5'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e4e1e5'
  inverse-on-surface: '#303033'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#f5fff4'
  on-secondary: '#00391f'
  secondary-container: '#16ff9e'
  on-secondary-container: '#007243'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#56ffa8'
  secondary-fixed-dim: '#00e38b'
  on-secondary-fixed: '#002110'
  on-secondary-fixed-variant: '#00522f'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#131316'
  on-background: '#e4e1e5'
  surface-variant: '#353437'
typography:
  display-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  status-pill:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 12px
spacing:
  unit: 4px
  gutter: 16px
  workstream-height: 64px
  track-thickness: 1px
  margin-desktop: 24px
  margin-mobile: 16px
---

## Brand & Style
The design system focuses on the "Technical Minimalist" aesthetic, prioritizing information density and structural clarity for high-velocity engineering environments. It rejects the ornamental nature of glassmorphism in favor of rigid, wireframe-like structures that emphasize the logic of the pipeline.

The brand personality is precise, industrial, and hyper-functional. It evokes a "Command Center" emotional response—users should feel in control of complex, moving parts. The UI serves as a high-fidelity instrument where visual weight is strictly reserved for active states and critical blockers. The movement of data is linear and predictable, reducing cognitive load during incident response or rapid deployment cycles.

## Colors
This design system utilizes a high-contrast palette optimized for legibility. The primary interface is defined by deep charcoal and obsidian tones, while the light mode provides a crisp, paper-white alternative. 

Semantic colors are the only "vibrant" elements in the UI. **Neon Mint** signals a clear path or successful deployment. **Electric Blue** identifies the current point of focus and active work. **Amber** indicates a transition state or human intervention (Review), and **Crimson** provides immediate visual friction to highlight bottlenecks or failed builds. Backgrounds remain flat to ensure these semantic indicators pop with maximum "signal-to-noise" efficiency.

## Typography
The typographic system is a dual-font architecture. **Inter** handles the standard UI elements, breadcrumbs, and settings to provide a neutral, professional foundation. **JetBrains Mono** is utilized for all data-dense areas including Commit IDs, build logs, status labels, and task IDs. 

Hierarchy is established through weight and color rather than excessive scale. For mobile devices, typography remains consistent in size to maintain data density, but line-heights are slightly increased (+2px) to improve touch-target legibility. Use uppercase sparingly, reserved only for small status tags or column headers.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. Navigation and sidebars are fixed, while the central dashboard uses a horizontal scrolling 'Workstream' view. 

- **Workstream Rows:** Each row is exactly 64px in height, separated by a 1px border. 
- **The Track:** A 1px horizontal line runs through the vertical center of every row, acting as the linear spine for task chips.
- **Rhythm:** All spacing is based on a 4px grid. Task chips are spaced 12px apart on the horizontal track.
- **Breakpoints:** On desktop, the full pipeline is visible. On mobile, the workstream collapses into a vertical list of stages, with chips expanding to full-width.

## Elevation & Depth
Depth is created through **Tonal Layering** and **Low-Contrast Outlines** rather than shadows. 
- **Level 0 (Background):** Base color (#0C0C0E).
- **Level 1 (Workstreams):** Surface color (#16161A) with 1px borders.
- **Level 2 (Active Tasks/Popovers):** Surface color with a 1px border using the accent color (e.g., Electric Blue). 

Dependency connectors are drawn as high-contrast, 1px paths using the Electric Blue or Crimson colors. These connectors use "Square-cornered Routing" (right angles only) and are hidden by default at 0% opacity, appearing at 100% only on hover or when a task is blocked.

## Shapes
The shape language is strictly geometric and architectural. A **2px border radius** is applied globally to task chips and buttons to provide just enough softness to prevent visual vibration on high-DPI displays while maintaining a "hard-coded" look. All containers, input fields, and workstream rows use sharp corners to reinforce the grid-based structure of the system.

## Components
- **Workstream Rows:** Horizontal containers with a 1px track line. Active workstreams should have a subtle 2% opacity glow of the accent color across the row.
- **Task Chips:** The primary unit. 
    - *Default:* 28px height, 1px border, Mono text.
    - *Active/Review:* Height expands to 32px; border weight increases to 1.5px; gains a subtle inner shadow of the accent color.
- **Dependency Connectors:** 1px stroke lines that connect the "output" side of one chip to the "input" side of another. Use a terminal dot (3px) at the entry point.
- **Input Fields:** Flat #0C0C0E background, 1px Border #27272A. Focus state changes border to Electric Blue.
- **Status Indicators:** Small 6px squares of solid accent color. Never use circles; maintain the square/geometric motif throughout.
- **Buttons:** Text-only or Icon+Text. No background fill for secondary actions; solid accent background for primary "Deploy" actions with black (#000000) text.