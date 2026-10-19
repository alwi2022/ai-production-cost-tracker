# Dashboard UX consolidation

The user's concern: repeated actions, excessive notes, and unnecessary controls make financial scanning harder. The existing x.ai-inspired neutral visual direction and KU Creatives brand are retained.

## Research

- [GOV.UK Button guidance](https://design-system.service.gov.uk/components/button/): competing primary calls to action make the next step harder to identify. Use a primary action only where it belongs.
- [Carbon data table usage](https://v10.carbondesignsystem.com/components/data-table/usage/): group table-level search, filters, and export in a table toolbar. Row actions concern individual records.
- [Nielsen Norman Group, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): keep common tasks prominent and defer secondary detail until requested.

These principles inform the following implementation decisions. They are not a claim of a usability study conducted with the operations team.

## Final organization

| Location | Visible actions | Details available on demand |
| --- | --- | --- |
| Global top bar | One theme toggle | Accessible label/title describes target theme |
| Overview | Project filter; one actionable unassigned-cost notice | Weekly data table |
| Projects | Project filter; project links to transactions | Spend, budget, percentage, and status in one table |
| Transactions | One toolbar: search, project/status filters, export | Click record ID to open full details and the assignment form |
| Sources & import | One import action | Source paths, conversion rates, duplicate counts, setup guidance |
| Notifications | Retry only while messages are pending | Mock receiver inbox |

## Removed duplication

- Import and export buttons no longer appear on every page.
- Theme switching exists only in the top bar; mobile and desktop use the same control.
- Removed the workspace card, navigation caption, decorative staff/footer notes, page eyebrows, and repeated explanatory subtitles.
- Overview metric values are no longer repeated above the weekly chart. The Projects page no longer repeats the Overview metrics.
- Removed repeated unresolved banners from the transactions page and repeated per-row project dropdown/save controls.
- Removed the table footer explaining refunds/reconciliation and redundant "view transactions" navigation already covered by the sidebar/project links.
- Removed visible conversion/file-path notes from each source card. Technical information remains inside one disclosure.
- Notification summaries no longer repeat full webhook messages in two visible sections. Retry is not shown when all deliveries are complete.
- The navigation badge counts pending deliveries, not historical sent messages.

## Behavior safeguards

- Selecting Unassigned clears the project filter and hides it, avoiding an impossible combination of a canonical project and an unassigned record.
- Export always uses the visible transaction filters.
- The native dialog provides full source IDs, source labels, dates, amount, tool, and duplicate links. Only an unresolved record offers project assignment. The project is never preselected.
- The browser handles modal focus containment and Escape dismissal. A cancel/close control and labeled project field are available.
- Existing manual assignments are preserved; generic source labels are not automatically treated as Internal.

## Verification boundary

Automated application tests pass. The browser was explicitly retried after the user reported changing permission to Allow, but the browser policy still rejected http://127.0.0.1:3000 with a saved-preference block. No alternate host/browser/control path was used. Visual, keyboard, CSV download, and mobile walkthroughs remain pending permission actually taking effect.
