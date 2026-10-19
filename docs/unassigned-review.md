# Review of originally unassigned transactions

Reviewed 2026-10-19 against the supplied CSVs, Vendor C payloads, manual workbook values, project list, aliases, stored raw records, references, and persisted user assignments. This review makes no accounting mutations.

## Result

The original set contains 13 records totaling Rp5.836.232,5. The live database now has **12 unresolved records totaling Rp5.201.507,5**. One pre-existing manual assignment links vc_30307 (Rp634.725) to BRK-05. That assignment was preserved; the source payload alone does not independently substantiate it.

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
| vc_30307 | Vendor C | sandbox | Rp634.725 | Existing manual assignment: BRK-05 | Label sandbox is generic or absent from the canonical project list; there is no project-specific reference. |

## Decisions

- No remaining transaction can be confidently mapped from the provided fields alone. No new assignment was made.
- Blank labels do not imply Internal. Labels misc, test, and sandbox describe usage context, not project ownership. They remain separate from project budgets until confirmed.
- new client pitch is not a project in projects.csv. Assigning it to a client or Internal would be an undocumented guess.
- INV-950 identifies the manual purchase, but its project and reference cells are empty. There is no matching invoice entry elsewhere that supplies project ownership.
- Temporal proximity, transaction ID numbering, identical tools, or the existing vc_30307 assignment are not sufficient evidence for assigning other records.
- To resolve a record, obtain confirmation from its job owner or the operations invoice/job log, then open it in Transaksi and select the confirmed project in the detail dialog.
- The transaction remains visible and exportable while unresolved. Current project spend is not silently inflated by unverified allocations.
