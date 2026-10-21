# Review of originally unassigned transactions

Reviewed 2026-10-19 and refreshed 2026-10-21 against the supplied CSVs, Vendor C payloads, manual workbook values, project list, aliases, stored raw records, references, and persisted user assignments. This review makes no accounting mutations.

## Result

The original set contains **13 unresolved records totaling Rp5.836.232,50**. User assignments temporarily reduced the count to 7. On 2026-10-21, the database was reset at the user's request to the original imported baseline, removing all manual assignments and restoring all 13 unresolved records. The previous database was backed up in `storage/backups/`. Source labels alone do not establish project ownership; assignments require confirmation from the owner or operations records.

| Record | Vendor | Original label | Amount IDR | Current result | Source evidence |
| --- | --- | --- | ---: | --- | --- |
| Excel row 22, INV-950 | Stock Music | (blank) | Rp450.000 | Unresolved | Project label is blank; no reference identifies a project. |
| TXN101021 | Vendor A | (blank) | Rp105.760 | Unresolved | Project label is blank; no reference identifies a project. |
| TXN101027 | Vendor A | misc | Rp63.200 | Unresolved | Label misc is generic or absent from the canonical project list; there is no project-specific reference. |
| TXN101022 | Vendor A | test | Rp132.960 | Unresolved | Label test is generic or absent from the canonical project list; there is no project-specific reference. |
| TXN101032 | Vendor A | new client pitch | Rp11.360 | Unresolved | Label new client pitch is generic or absent from the canonical project list; there is no project-specific reference. |
| TXN101034 | Vendor A | (blank) | Rp39.840 | Unresolved | Project label is blank; no reference identifies a project. |
| INV2609-4402 | Vendor B | misc | Rp1.408.062,5 | Unresolved | Label misc is generic or absent from the canonical project list; there is no project-specific reference. |
| INV2609-4403 | Vendor B | misc | Rp1.034.475 | Unresolved | Label misc is generic or absent from the canonical project list; there is no project-specific reference. |
| INV2609-4405 | Vendor B | sandbox | Rp1.080.300 | Unresolved | Label sandbox is generic or absent from the canonical project list; there is no project-specific reference. |
| vc_30304 | Vendor C | sandbox | Rp214.500 | Unresolved | Label sandbox is generic or absent from the canonical project list; there is no project-specific reference. |
| vc_30299 | Vendor C | sandbox | Rp617.012,5 | Unresolved | Label sandbox is generic or absent from the canonical project list; there is no project-specific reference. |
| vc_30294 | Vendor C | sandbox | Rp44.037,5 | Unresolved | Label sandbox is generic or absent from the canonical project list; there is no project-specific reference. |
| vc_30307 | Vendor C | sandbox | Rp634.725 | Unresolved | Label sandbox is generic or absent from the canonical project list; there is no project-specific reference. |

## Decisions

- No remaining transaction can be confidently mapped from the provided fields alone. No new assignment was made.
- Blank labels do not imply Internal. Labels misc, test, and sandbox describe usage context, not project ownership. They remain separate from project budgets until confirmed.
- new client pitch is not a project in projects.csv. Assigning it to a client or Internal would be an undocumented guess.
- INV-950 identifies the manual purchase, but its project and reference cells are empty. There is no matching invoice entry elsewhere that supplies project ownership.
- Temporal proximity, transaction ID numbering, identical tools, or previous manual assignments are not sufficient evidence for assigning other records.
- To resolve a record, obtain confirmation from its job owner or the operations invoice/job log, then open it in Transaksi and select the confirmed project in the detail dialog.
- The transaction remains visible and exportable while unresolved. Current project spend is not silently inflated by unverified allocations.
