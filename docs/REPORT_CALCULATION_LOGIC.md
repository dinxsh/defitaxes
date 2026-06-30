# DeFiTaxes — Report Calculation & Output Logic

This document explains, in full detail, how DeFiTaxes turns classified transactions into a tax **report object** and then renders that object into the various **report outputs** (Form 8949, Schedule D, TurboTax, transaction ledger, and the print PDF).

---

## 1. The Report Object (`TaxReport`)

Everything downstream renders from a single `TaxReport` produced by `calculateTaxes(transactions, taxYear?, currency?, importedLots?, method?)`. Its shape (`src/lib/types.ts:100-122`):

| Field | Meaning | How it's computed |
|---|---|---|
| `shortTermEvents` | Disposals held ≤ 1 year | Built per lot-match during the chronological walk |
| `longTermEvents` | Disposals held > 1 year | Calendar comparison via `isLongTerm` (leap-year safe) |
| `income` | Ordinary income events | One per `income`-treated transfer, valued at FMV |
| `totalShortTermGain` | Σ `gainLoss` of short-term events | `reduce` over `shortTermEvents` |
| `totalLongTermGain` | Σ `gainLoss` of long-term events | `reduce` over `longTermEvents` |
| `totalIncome` | Σ FMV of income events | `reduce` over `income` |
| `totalFees` | Σ USD gas across **all** txs | accumulated regardless of tax year |
| `currency` | ISO 4217 code of all monetary values | passed in (default `USD`) |
| `unknownBasisCount` | # disposals with `costBasis === 0 && proceeds > 0` | filter over all events |
| `unknownBasisValueAtRisk` | Σ proceeds of those events | proceeds that may be over-reported |
| `zeroRateTransferCount` | # tax-relevant transfers with `rate === 0` | missing price data warning |
| `washSaleCount` | # loss events flagged as wash sales (advisory) | post-scan |
| `washSaleDisallowedLoss` | Σ abs(loss) of flagged events (advisory — **not** actually disallowed) | post-scan |
| `unknownTxCount` | # transactions with `category === "UNKNOWN"` | filter over txs |

### 1.0 Calculation inputs

Two inputs shape the numbers before any event is emitted:

- **`importedLots`** (`src/lib/taxCalc.ts:73-93`): user-supplied off-chain/historical lots are pushed into the per-token queues *before* the chronological walk, so on-chain disposals can match against acquisitions the app never saw on-chain. Each is keyed by `token.toLowerCase()` (aligning with the canonical-symbol key path), carries its own `date`/`amount`/`costBasisPerUnit`, and is marked `txHash: "imported"`, `isYield: false`.
- **`method`** (`FIFO` | `LIFO` | `HIFO` | `ACB`): selects which lot a disposal consumes (`pickLotIndex`, `src/lib/taxCalc.ts:23-34`). For `ACB` the queue is collapsed to a single weighted-average lot before matching (`collapseToAcb`). The chosen method changes the `costBasis`/`gainLoss`/holding-period of every event and is stamped into the PDF header.

### 1.1 How each event row is built

For every `sell`/`fee` transfer the engine matches against the per-token lot queue and emits a `TaxEvent` (`src/lib/taxCalc.ts:180-192`):

- **`proceeds`** = `(matched / transfer.amount) × netProceeds`, where `netProceeds = max(0, grossProceeds − allocatedGas)` and `grossProceeds = transfer.amount × transfer.rate`. Proceeds are reduced by the transaction's pro-rated gas, but **clamped at 0** so gas larger than gross proceeds can't produce negative proceeds / an overstated loss.
- **`costBasis`** = `matched × lot.costBasisPerUnit` (the consumed lot's per-unit basis, which already includes gas added at acquisition time).
- **`gainLoss`** = `proceeds − costBasis`.
- **`holdingPeriod`** = `long-term` only if held **more than one year**, computed by `isLongTerm(acquired, sold)` via a calendar `+1 year` comparison (`src/lib/taxCalc.ts`). This is leap-year safe — a 366-day span ending exactly one calendar year later stays short-term, where a naive `> 365 days` rule would misclassify it.
- **Year filter**: the event is only pushed into the report if `!taxYear || dateSold.getFullYear() === taxYear`.

**Unknown-basis remainder** (`src/lib/taxCalc.ts:212-234`): if a disposal drains the queue, the leftover quantity becomes a **short-term** event with `costBasis = 0`, `gainLoss = proceeds` (worst case, fully taxable), and its description is suffixed `[unknown basis]`.

**Income events** (`src/lib/taxCalc.ts:235-263`): each `income` transfer creates an `IncomeEvent` valued at `amount × rate` (FMV) **and** seeds a new acquisition lot at that FMV — so later disposal of that token isn't double-taxed.

### 1.2 Wash-sale post-scan (advisory — `src/lib/taxCalc.ts`)

After all events exist, the engine scans every **loss** event (`gainLoss < 0`):
- It looks up that event's `tokenKey` and the `txHash` of the lot it consumed.
- It checks the token's acquisition timeline for **any other** acquisition within **±30 days** of the sale date (skipping the exact lot consumed).
- If found → `event.washSale = true`, increment `washSaleCount`, add `abs(gainLoss)` to `washSaleDisallowedLoss`.

> **Advisory only.** Under current US law crypto is treated as **property, not a security**, so IRC §1091 wash-sale rules generally do **not** apply and the loss remains deductible. The scan therefore only *flags* matches — it never subtracts the loss from `totalShortTermGain`/`totalLongTermGain`, and exports do **not** auto-emit the IRS `W` disallowance code (which would forfeit a legitimately deductible loss). The flag is surfaced as an advisory note for filers who conclude the rule applies to their situation.

---

## 2. Report Outputs

Output is produced by **seven** functions — six in `src/lib/exporters.ts` plus `openPdfReport` in `src/lib/pdfReport.ts` — all consuming the `TaxReport` (or, for the ledger, the raw transaction list). The UI (`ExportPanel.tsx`) wires **six buttons**: PDF report, Form 8949 Part I, Form 8949 Part II, Schedule D, TurboTax, and the transaction ledger. The combined `exportForm8949()` (both parts in one file) exists but is **not** currently surfaced in the UI. CSV money fields are rendered to 2 decimals via `.toFixed(2)`; CSV fields containing `,`/`"`/newline are quoted/escaped by `toCsv` (`src/lib/utils.ts:57-66`).

### 2.1 Form 8949 CSV (`src/lib/exporters.ts:6-52`)

The IRS form for individual capital gain/loss line items. Every event becomes one row via `taxEventToRow(e, box)`:

| Column | Source |
|---|---|
| Description of Property | `e.description` |
| Date Acquired | `formatDateIrs(e.dateAcquired)` |
| Date Sold | `formatDateIrs(e.dateSold)` |
| Proceeds | `e.proceeds` |
| Cost or Other Basis | `e.costBasis` |
| **Adjustment Code** | Always blank — wash-sale losses are not auto-disallowed (see §1.2) |
| **Adjustment Amount** | Always blank |
| Gain or (Loss) | `e.gainLoss` |
| **Box** | `"C"` for short-term, `"F"` for long-term |
| Notes | `"Missing Price"` (if `costBasis === 0 && proceeds > 0`) and/or `"Possible wash sale (advisory)"`, `;`-joined |

Dates are formatted **MM/DD/YYYY** via `formatDateIrs` (`src/lib/utils.ts:49-54`). The **Box** column is the IRS classification: Part I Box C (short-term, basis not reported to IRS) and Part II Box F (long-term, basis not reported). The Adjustment Code/Amount columns are left blank — wash-sale losses are surfaced as an advisory note rather than auto-disallowed (see §1.2).

Three exporters:
- `exportForm8949ShortTerm` → only short-term events, Box C.
- `exportForm8949LongTerm` → only long-term events, Box F.
- `exportForm8949` → both, short-term first.

### 2.2 Schedule D CSV (`src/lib/exporters.ts:55-115`)

The IRS summary form that aggregates Form 8949 into line totals. It recomputes aggregate proceeds/basis directly from the events:

```
stProceeds = Σ shortTermEvents.proceeds
stBasis    = Σ shortTermEvents.costBasis
ltProceeds = Σ longTermEvents.proceeds
ltBasis    = Σ longTermEvents.costBasis
net        = totalShortTermGain + totalLongTermGain
```

It then emits rows mapped to **actual IRS Schedule D line numbers**. Because this tool generates Form 8949 with **Box C** (short-term) / **Box F** (long-term) — i.e. "basis not reported to the IRS" — the aggregate totals flow to the matching Schedule D lines **3** and **10**. (Lines 1a/8a are reserved for 1099-B basis-reported transactions that bypass Form 8949 and are therefore left empty here.) Only the lines the app can derive carry numbers; the rest are emitted as **empty placeholders** to preserve the form's structure:
- **Part I (short-term)**: line **3** (Box C totals) and line **7** (net short-term) carry `stProceeds`, `stBasis`, `totalShortTermGain`. Lines **1a**, **1b**, **2** are empty placeholders.
- **Part II (long-term)**: line **10** (Box F totals) and line **15** (net long-term) carry `ltProceeds`, `ltBasis`, `totalLongTermGain`. Lines **8a**, **8b**, **9** are empty placeholders.
- **Part III (summary)**: line **16** — proceeds/basis columns use `(stProceeds + ltProceeds)` and `(stBasis + ltBasis)`; the gain column uses `net` = `totalShortTermGain + totalLongTermGain`.

> Schedule D's gain columns equal proceeds − basis. Wash-sale flags are advisory and never disallowed (§1.2), so there is no Schedule D adjustments column and the net is unaffected.

### 2.3 TurboTax CSV (`src/lib/exporters.ts:118-149`)

TurboTax's crypto import format. Columns: `Currency Name, Purchase Date, Cost Basis, Date Sold, Proceeds`. It merges short-term + long-term events (TurboTax derives the holding period from the dates itself).

**Row-limit handling**: TurboTax caps imports at **3999 rows per file**. If `allEvents.length ≤ 3999` it writes a single file; otherwise it slices into batches of 3999 and writes `...-part1.csv`, `...-part2.csv`, etc.

### 2.4 Full Transaction Ledger CSV (`src/lib/exporters.ts:152-182`)

A complete audit trail of the *classified* transactions (not tax events). Columns: `Date (ISO), Chain, Tx Hash, Category, Counterparty, Gas Fee (USD), Transfers, Missing Price`.

- **Category** is rendered as its human label via `CATEGORY_INFO[tx.category].label`.
- **Counterparty** prefers `counterpartyLabel`, falling back to the raw address.
- **Transfers** is a flattened string: each transfer rendered as `BUCKET: amount SYMBOL (treatment)`, joined by `;` — so you can see the bucket/treatment decisions per transfer.
- **Missing Price** = `"YES"` if any transfer has `rate === 0 && amount > 0`.

### 2.5 Print PDF Report (`src/lib/pdfReport.ts`)

`openPdfReport(report, method, taxYear)` builds a self-contained HTML document, opens it in a new window, and triggers `window.print()` after a 300ms render delay (so it can be saved as PDF). No dependencies — all CSS is inline, tuned for print (mm units, `@page` margins).

**Currency formatting** uses `Intl.NumberFormat` with the report's currency code, falling back to `$x.xx` if the code is invalid. Gains are green (`.gain`), losses red (`.loss`) via `gainClass(v) = v >= 0 ? "gain" : "loss"`.

**Document structure:**

1. **Header / meta** — Year (`taxYear` or `"All Years"`), Currency, Method (FIFO/LIFO/HIFO/ACB), and generation timestamp.
2. **Disclaimer** — "Not tax advice" boilerplate.
3. **Summary grid** (6 cards):
   - Short-Term Gain/Loss + event count
   - Long-Term Gain/Loss + event count
   - Ordinary Income + event count
   - Gas Fees Paid (always styled as a loss)
   - Wash Sales Flagged + flagged amount (advisory)
   - Unknown Basis Events + value at risk
4. **Net Capital Gain/Loss row** = `totalShortTermGain + totalLongTermGain`.
5. **Warnings block** (only if any apply):
   - Wash sales → advisory note that crypto is generally not subject to IRC §1091, so the losses remain deductible
   - Unknown basis (only if value at risk ≥ 0.01) → "proceeds may be over-reported"
   - Zero-rate transfers → "cost basis may be understated"
6. **Form 8949 Part I table** — short-term events (Description / Date Acquired / Date Sold / Proceeds / Cost Basis / Gain-Loss), dates via `formatDateIrs` (MM/DD/YYYY). Flagged rows get an inline `W` badge (advisory marker only — no loss is disallowed).
7. **Form 8949 Part II table** — long-term events, same columns.
8. **Ordinary Income table** — Date / Description / Amount / Fair Market Value. Dates use `formatDateIrs` (MM/DD/YYYY) and token amounts use `formatAmount`, consistent with the gain tables.

Empty sections render a styled "No events" placeholder row.

---

## 3. End-to-End Flow

```
Raw txs ──► classifier.ts ──► treatments ──► calculateTaxes() ──► TaxReport
                                                                      │
                        ┌─────────────────────────────────────────────┤
                        ▼                ▼               ▼             ▼
                  Form 8949 CSV    Schedule D CSV   TurboTax CSV   PDF report
                  (Box C/F, W      (IRS line nums   (3999-row      (summary +
                   adj. codes)      7/15/16)         batching)      8949 + income)
                                                          ▲
                                          transactions.csv (raw audit ledger)
```

## 4. Key Details Not To Miss

- **Gas is double-purposed**: pro-rated into each buy's cost basis and each sell's net proceeds (`src/lib/taxCalc.ts:107-119`), *and* summed wholesale into `totalFees` (which ignores the tax-year filter).
- **`totalFees` spans all years**, but events/income are year-filtered — so fees in the PDF can exceed what the year's events imply.
- **Wash-sale losses are flagged, never disallowed.** Crypto is property, not a security, so IRC §1091 doesn't currently apply; the loss stays in the totals and exports carry only an advisory note/badge (no `W` adjustment). If you need true §1091 behavior (disallow loss + add to replacement-lot basis), that's a deliberate, separate change.
- **Inter-wallet transfers are non-taxable.** With the full owned-address set passed to the classifier, a move between two of the user's own wallets buckets as `SELF` (ignored), and raw transactions are deduped by `(chain, hash)` so the same on-chain tx fetched under two wallets isn't double-counted (gas or events).
- **ACB uses an amount-weighted average acquisition date** (not the earliest) when collapsing the lot pool, reducing short/long-term misclassification of the pooled lot.
- **Unknown-basis events are always short-term** with zero basis (conservative/maximal tax), and feed both the `unknownBasisCount` warning and the 8949 "Missing Price" note.
- **Schedule D recomputes** proceeds/basis from events independently rather than reusing the report's gain totals — they agree by construction but are derived separately.
- **Box mapping is fixed**: short-term → Box C, long-term → Box F (both "basis not reported to IRS"), reflecting that on-chain basis is self-computed, not 1099-B-reported.
- **Money is rendered at 2 decimals everywhere**; CSV uses raw `.toFixed(2)`, PDF uses locale-aware `Intl.NumberFormat` keyed on the report currency.
- **Two distinct "missing price" signals (now aligned on the same filter)**: both the report's `zeroRateTransferCount` (`src/lib/taxCalc.ts:299-303`) and the transaction-ledger CSV's "Missing Price = YES" flag count transfers with `rate === 0 && amount > 0 && treatment !== "ignore"`, so the ledger and the warning banner agree. The 8949/PDF "Missing Price"/"unknown basis" note is a separate signal driven by `costBasis === 0 && proceeds > 0`.
- **Gas allocation covers buy/sell/fee**: pro-rated gas is distributed across `buy`, `sell`, and `fee` transfers (`src/lib/taxCalc.ts:111-115`), matching the disposal branch which treats `sell` and `fee` identically.
- **Imported lots participate fully**: pre-seeded lots match against on-chain disposals like any other acquisition, so their `costBasisPerUnit` flows directly into reported `costBasis`/`gainLoss`.
