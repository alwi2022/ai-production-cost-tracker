# Design reference (updated 2026-10-19)

Latest UX instruction: remove redundant controls and notes and follow researched dashboard patterns. Import is localized to Sources & import, export to the transaction toolbar, and theme switching to the global top bar. Page subtitles/eyebrows, workspace card, repeated footer notes, duplicated chart totals and project metrics are removed. Source diagnostics and mock notifications are progressively disclosed. Native transaction detail dialogs replace repeated project-select/save controls in table rows. Research and rationale: docs/ux-decisions.md. Data ownership review: docs/unassigned-review.md.

Current user instruction supersedes the initial visual direction below: use **x.ai as the primary reference**, with clean modern typography, layout, and components. Use the supplied KU Creatives logo and proper icons such as Lucide. No emoji or text glyphs as UI icons.

The implemented revision uses neutral white/black/zinc surfaces, Geist variable typography, a monochrome line/area chart, restrained border radii, and more deliberate spacing. Dark is the default for a new browser preference, with an equally supported light theme. Status exceptions alone use amber/red. Budget values and transaction logic are unchanged.

Lucide icons are explicitly authorized by the user and selected for their semantic function: folders for projects, arrows for transactions, database for sources, bell for notifications, and download/upload for data actions. This instruction overrides the optional skill's caution against Lucide chosen only for its visual style.

The logo is the original transparent image used by https://www.kucreatives.com/ and is bundled locally. It replaces the previous invented monogram and working brand. Source and license attribution for the logo, Geist, and Lucide is recorded in public/assets/SOURCES.md. No avatar or fictional person is shown.

Energy 2 / Rhythm 2 / Motion 1 remains appropriate: the work is financial scanning rather than marketing. A large page title leads to totals, then weekly/vendor comparison, then project detail. Motion is limited to a line fade and interaction state transitions, with reduced-motion support. Focus is restored on common filters and moved to the heading on navigation. Charts and transaction references provide native expandable text details.

Primary sources: https://x.ai/ and https://www.kucreatives.com/ . The redesign is inspired by the requested reference, not an assertion that its exact proprietary font or component system has been reproduced.

## Initial direction (historical)

User direction: clean, modern, minimalist, premium, with a clear visual character.

User-provided references:

- Linear: dark theme, typography, subtle animation.
- Vercel: monochrome, grid, clean layout.
- Raycast: gradients, glow, product presentation.
- Anthropic: editorial composition, whitespace, warm colors.
- Resend: simplicity and focused interface.
- Stripe: hierarchy, gradients, storytelling.
- Framer: typography and restrained interaction.

The user chose **antislop audit after implementation**, rather than applying the filter during construction.

Implementation interpretation: a quiet operational ledger, with warm neutral surfaces, forest-green spending bars, and amber/red reserved for budget exceptions. Light is the initial operations view; a persistent dark toggle supports the supplied dark-theme reference. References inform the vocabulary without copying a particular site.

Energy 2 / Rhythm 2 / Motion 1. The focal point is the spend total; the wide weekly chart and compact vendor breakdown have different proportions because their information needs differ. Tables carry financial detail. System typography keeps the local tool independent of network font loading. A textual working name, Production Ledger, identifies the prototype; it is not an approved brand identity. No generated bitmap assets or external visual assets are used.

Motion is limited to a short panel entrance and control-state transitions, disabled when reduced motion is requested. SVG is used for data marks, with accessible text labels and no purely decorative illustration.
