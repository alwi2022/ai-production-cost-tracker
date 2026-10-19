# Design reference

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
