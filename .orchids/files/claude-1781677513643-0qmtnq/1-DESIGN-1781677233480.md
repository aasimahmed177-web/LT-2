---
name: Precision CRM Narrative
colors:
  surface: '#f9f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f9f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeef'
  surface-container-high: '#e8e8e9'
  surface-container-highest: '#e2e2e3'
  on-surface: '#1a1c1d'
  on-surface-variant: '#424655'
  inverse-surface: '#2f3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0054d7'
  primary: '#0052d1'
  on-primary: '#ffffff'
  primary-container: '#2c6bf2'
  on-primary-container: '#fefcff'
  inverse-primary: '#b3c5ff'
  secondary: '#5e5e60'
  on-secondary: '#ffffff'
  secondary-container: '#e0dfe2'
  on-secondary-container: '#626265'
  tertiary: '#575c66'
  on-tertiary: '#ffffff'
  tertiary-container: '#70757f'
  on-tertiary-container: '#fdfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b3c5ff'
  on-primary-fixed: '#001849'
  on-primary-fixed-variant: '#003fa5'
  secondary-fixed: '#e3e2e4'
  secondary-fixed-dim: '#c7c6c8'
  on-secondary-fixed: '#1b1c1e'
  on-secondary-fixed-variant: '#464749'
  tertiary-fixed: '#dee2ee'
  tertiary-fixed-dim: '#c2c6d2'
  on-tertiary-fixed: '#171c24'
  on-tertiary-fixed-variant: '#424750'
  background: '#f9f9fa'
  on-background: '#1a1c1d'
  surface-variant: '#e2e2e3'
  obsidian: '#1C1D1F'
  border-subtle: '#E4E7EC'
  surface-background: '#FFFFFF'
  surface-muted: '#F2F4F7'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.005em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  space-xs: 4px
  space-sm: 8px
  space-md: 16px
  space-lg: 24px
  space-xl: 48px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is engineered for high-performance productivity, emphasizing a "Data-as-Design" philosophy. It targets sophisticated teams who require clarity, speed, and deep customizability. The brand personality is clinical, reliable, and premium, avoiding unnecessary ornamentation in favor of structural integrity.

The design style is **Ultra-Minimalist** with a focus on **Information Architecture**. By utilizing heavy whitespace (macro-spacing) combined with dense data tables (micro-spacing), the UI creates a hierarchy where the data itself serves as the primary visual interest. The aesthetic relies on "Obsidian" accents to anchor the eye and "Attio-Blue" for surgical precision in calls to action. The interface should feel like a high-end tool—efficient, sharp, and intentional.

## Colors

The palette is monochromatic and functional. **Primary Blue (#316FF6)** is reserved strictly for primary interactive states and critical notifications. **Obsidian (#1C1D1F)** is the base for typography and high-contrast components, ensuring maximum legibility.

Backgrounds utilize a tiered system of whites: `#FFFFFF` for primary cards and workspace surfaces, and `#FAFAFB` for the underlying application chrome. Borders use a precise `#E4E7EC` to define structure without creating visual noise. Use neutral grays sparingly to denote disabled states or secondary metadata.

## Typography

This design system utilizes **Inter** exclusively to maintain a systematic, utilitarian aesthetic. Tight letter-spacing (negative tracking) is applied to larger headlines to provide a high-end "Display" feel, while labels utilize slightly increased tracking and a semi-bold weight to ensure legibility at small scales (11px-12px).

Hierarchy is established through weight and color rather than excessive size differences. Use `label-sm` for technical metadata and table headers. All body copy should default to `body-md` for standard data entry, optimizing for density.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. Navigation and sidebars are fixed widths (e.g., 240px), while the central data workspace is fluid to maximize information visibility. 

A strict **4px grid** governs all spacing. For data-heavy views (spreadsheets, CRM lists), use `space-xs` and `space-sm` for internal cell padding. For layout structure and card separation, use `space-md` and `space-lg`. Large-scale sections should be separated by `space-xl` to provide visual "breathing room" in an otherwise dense interface.

## Elevation & Depth

Depth is achieved through **Tonal Layers** and **Refined Borders** rather than traditional shadows. 

1.  **Level 0 (Base):** The main application background (#FAFAFB).
2.  **Level 1 (Surface):** Content cards and panels (#FFFFFF) with a 1px solid border (#E4E7EC).
3.  **Level 2 (Overlay):** Modals and dropdowns. These use a very subtle, diffused shadow (0px 4px 20px rgba(0,0,0,0.05)) to separate them from the surface level, combined with a slightly darker border.

Avoid using heavy blurs or colorful glows. The interface should feel flat and "pressed," emphasizing the tactile nature of a workspace.

## Shapes

The shape language is **Soft** but disciplined. A universal `0.25rem` (4px) radius is applied to buttons, input fields, and small UI components. This ensures the interface feels approachable while maintaining a professional, geometric rigor. 

Larger containers like cards or modals may use a `rounded-lg` (8px) corner to soften the overall layout. Avatars and specific status indicators may use a pill-shape for immediate visual differentiation from data fields.

## Components

-   **Buttons:** Primary buttons use Attio-Blue with white text. Secondary buttons are "ghost" style with an Obsidian border (#E4E7EC) and Obsidian text. 
-   **Input Fields:** Minimalist design with 1px borders. Focus states use a 1px Attio-Blue border and a subtle 2px Blue-tinted outer glow (30% opacity).
-   **Data Cells:** High-density alignment. Text should be vertically centered. Use `body-md` for values and `label-sm` for headers.
-   **Chips/Tags:** Used for status and categorization. These should have a subtle background (e.g., light blue for "active") with high-contrast text. Use a 2px radius for tags.
-   **Lists:** Hover states on list items should utilize a simple `#F2F4F7` background fill without changing border colors.
-   **Navigation:** Left-hand navigation uses subtle icons (20px) paired with `body-md` text. Active states are indicated by an Obsidian text color and a vertical Attio-Blue bar (2px wide) on the far left.