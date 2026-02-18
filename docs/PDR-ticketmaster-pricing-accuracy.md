# PDR: Ticketmaster Pricing Accuracy Overhaul

**Author:** Engineering
**Date:** 2026-02-18
**Status:** Implementation Complete
**Branch:** `claude/ticketmaster-cost-analysis-Cqruf`
**Repos Affected:** `BrianPTS/play`, `BrianPTS/scrape`

---

## 1. Problem Statement

The scraper was **manually calculating** ticket costs by summing individual charge components from the Ticketmaster facets API. This approach produced incorrect pricing because:

1. **Missing fee types** — The code only knew about `order_processing` vs "everything else." It had no awareness of `facility`, `face_value_tax`, or other charge reasons. Any fee type not explicitly handled was silently miscategorized or lost.

2. **Incorrect field mapping** — `faceValue`, `taxedCost`, and `cost` on every ticket were all set to the same manually-calculated `totalCost` value. The actual face value printed on the ticket was never stored.

3. **No source of truth** — The API provides `offer.totalPrice` (the exact amount the buyer pays per ticket, computed server-side by Ticketmaster with all fees included). The scraper ignored this field entirely and attempted to reproduce the math itself.

4. **Hidden fees undetectable** — Fees embedded in offer names (e.g., "$25 Club Fee" baked into `faceValue`) could not be identified because `offerName` was never stored.

### Impact

Tickets listed at incorrect prices — either too high (overpaying on cost basis) or too low (leaving margin on the table). No way to audit which fees were applied per ticket after scraping.

---

## 2. Current State (Before)

### Pricing Logic (`seatBatch.js` lines 179–189)

```javascript
// OLD: Manual calculation — fragile, incomplete
const orderProcessingCharges = offer?.charges?.filter(x => x?.reason === "order_processing") || [];
const singleExtraCharges = orderProcessingCharges.reduce(...) / seatCount;

const otherCharges = offer?.charges?.filter(x => x?.reason !== "order_processing") || [];
const repeatExtraCharges = otherCharges.reduce(...);

const totalCost = singleExtraCharges + repeatExtraCharges + faceValue;
```

### Data Stored Per Ticket

| Field       | Value Stored          | Correct? |
|-------------|-----------------------|----------|
| `cost`      | manually-calculated   | Approximate |
| `faceValue` | same as `cost`        | **Wrong** — should be actual face value |
| `taxedCost` | same as `cost`        | **Wrong** — should reflect tax |
| `sellPrice` | cost + markup %       | Wrong (derived from wrong base) |

### Fee Visibility

None. Individual fee components were discarded after summation. No way to query "how much service fee did we pay on Section 101 tickets."

---

## 3. Proposed Solution

### Core Principle

**Use `offer.totalPrice` from the Ticketmaster API as the absolute source of truth.** This field is computed server-side by Ticketmaster and represents the exact amount a buyer pays per ticket at checkout — including every fee type, current and future.

### Pricing Formula

```
perTicketCost  = offer.totalPrice              (API source of truth)
faceValue      = offer.faceValue               (actual face value on ticket)
totalFees      = perTicketCost - faceValue      (ALL fees, any type)
listPrice      = perTicketCost * (1 + markup%)  (sell price with margin)
```

### Fallback (Backward Compatibility)

If `offer.totalPrice` is missing or zero (edge case — non-standard API response):

```
perTicketCost = faceValue + allPerTicketCharges + (orderProcessing / seatCount)
```

This preserves the old behavior so nothing breaks during rollout.

---

## 4. Technical Design

### 4.1 Files Changed

| File | Repo | Change |
|------|------|--------|
| `helpers/seatBatch.js` | `play` | Replaced manual pricing with `offer.totalPrice`; store fee breakdown |
| `models/seatModel.js` | `scrape` | Added 9 fee breakdown fields to inventory schema |
| `actions/csvActions.tsx` | `scrape` | Added 7 fee columns to CSV export; fixed face_price/cost mapping |

### 4.2 New Data Fields

#### Stored in MongoDB (`inventory` subdocument)

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `totalPrice` | Number | `offer.totalPrice` | Per-ticket buyer cost (source of truth) |
| `noChargesPrice` | Number | `offer.noChargesPrice` | Base price before any fees |
| `face_price` | Number | `offer.faceValue` | Face value printed on ticket |
| `serviceFee` | Number | `charges[reason=service]` | Service charge per ticket |
| `facilityFee` | Number | `charges[reason=facility]` | Facility fee per ticket |
| `orderProcessingFee` | Number | `charges[reason=order_processing]` | Order processing (per-order, stored as per-ticket share) |
| `taxAmount` | Number | `charges[reason=face_value_tax]` | Tax per ticket |
| `totalFees` | Number | `totalPrice - faceValue` | All fees combined (catches unknown types) |
| `offerName` | String | `offer.name` | Offer name (reveals hidden fees like "Club Fee") |
| `inventoryType` | String | `offer.inventoryType` | "primary" or "resale" |

#### Exported in CSV

| Column | Source Field |
|--------|-------------|
| `service_fee` | `inventory.serviceFee` |
| `facility_fee` | `inventory.facilityFee` |
| `order_processing_fee` | `inventory.orderProcessingFee` |
| `tax_amount` | `inventory.taxAmount` |
| `total_fees` | `inventory.totalFees` |
| `offer_name` | `inventory.offerName` |
| `inventory_type` | `inventory.inventoryType` |

### 4.3 Corrected Field Mappings

| CSV Column | Before | After |
|------------|--------|-------|
| `face_price` | `inventory.cost` (wrong — was total cost) | `inventory.face_price` (actual face value) |
| `cost` | `inventory.cost / qty` (approximate) | `inventory.totalPrice` (exact per-ticket) |
| `taxed_cost` | same as cost | `inventory.totalPrice` (includes tax) |
| `list_price` | markup on wrong base | markup on correct `totalPrice` |

---

## 5. Data Flow

```
Ticketmaster Facets API
        │
        ▼
   offer object
   ├── totalPrice: 422.77      ← buyer pays this (SOURCE OF TRUTH)
   ├── faceValue: 355.00        ← printed on ticket
   ├── noChargesPrice: 355.00   ← base before fees
   ├── listPrice: 355.00        ← advertised price
   └── charges[]
       ├── {reason: "service",          amount: 42.95}
       ├── {reason: "order_processing", amount: 2.50}
       ├── {reason: "facility",         amount: 15.00}
       └── {reason: "face_value_tax",   amount: 7.32}
        │
        ▼
   seatBatch.js (CreateInventoryAndLine)
   ├── perTicketCost = offer.totalPrice = 422.77
   ├── faceValue = offer.faceValue = 355.00
   ├── totalFees = 422.77 - 355.00 = 67.77
   ├── serviceFee = 42.95
   ├── facilityFee = 15.00
   ├── orderProcessingFee = 2.50
   ├── taxAmount = 7.32
   └── listPrice = 422.77 * (1 + markup%)
        │
        ▼
   MongoDB (ConsecutiveGroup.inventory)
   ├── cost: 422.77 * seatCount    (total for all seats)
   ├── face_price: 355.00           (actual face value)
   ├── totalPrice: 422.77           (per-ticket buyer cost)
   ├── totalFees: 67.77             (all fees combined)
   ├── serviceFee: 42.95
   ├── facilityFee: 15.00
   ├── orderProcessingFee: 2.50
   ├── taxAmount: 7.32
   └── offerName: "Standard Admission"
        │
        ▼
   CSV Export (csvActions.tsx)
   ├── face_price: 355.00
   ├── cost: 422.77
   ├── taxed_cost: 422.77
   ├── list_price: 422.77 * (1 + markup%)
   ├── service_fee: 42.95
   ├── facility_fee: 15.00
   ├── order_processing_fee: 2.50
   ├── tax_amount: 7.32
   ├── total_fees: 67.77
   └── offer_name: "Standard Admission"
```

---

## 6. Why This Is Future-Proof

| Scenario | Old Code | New Code |
|----------|----------|----------|
| TM adds `venue_surcharge` fee | **Missed entirely** — not in filter | Captured in `totalPrice` automatically; shows in `totalFees` |
| TM adds `dynamic_pricing` fee | **Missed entirely** | Captured automatically |
| TM removes `facility` fee | Code still filters for it, gets 0 | `facilityFee` = 0, `totalPrice` still correct |
| TM changes fee calculation logic | Manual math diverges from TM | `totalPrice` always matches checkout |
| Club fee hidden in faceValue | Undetectable | Visible via `offerName` containing "Club Fee" |

The key insight: **`totalFees = totalPrice - faceValue` is a catch-all.** Even if we can't name a specific fee, the total is always accurate because `totalPrice` is Ticketmaster's own computation.

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `offer.totalPrice` missing from API response | Low | Fallback to manual calculation (old behavior) on lines 194–198 |
| Existing DB records don't have new fields | None | New fields are optional in schema (no `required: true`). Old records unaffected. |
| CSV consumers don't expect new columns | Low | New columns are appended at the end. Existing column positions unchanged. |
| `totalPrice` includes fees we don't want in cost basis | Low | Individual fee fields stored separately — can adjust formulas post-hoc |
| Markup applied to wrong base | None | `listPrice` now uses `perTicketCost` (correct total) instead of miscalculated total |

---

## 8. Backward Compatibility

- **MongoDB**: All new fields are optional. Existing documents continue to work. New documents get the full fee breakdown.
- **CSV**: 7 new columns appended after `passthrough`. Existing column order is preserved. Any CSV consumer reading by position (columns 1–27) sees no change.
- **API responses**: The `inventory` object sent to the backend includes all new fields. The backend should ignore unknown fields if not yet updated.
- **Fallback pricing**: If `offer.totalPrice` is missing, the code falls back to the previous manual calculation, so the worst case is "same as before."

---

## 9. Validation Checklist

After deployment, verify with a known event:

- [ ] `totalPrice` in DB matches `offer.totalPrice` from a raw API call
- [ ] `face_price` in DB matches `offer.faceValue` (NOT `totalPrice`)
- [ ] `totalFees` = `totalPrice` - `face_price`
- [ ] `serviceFee` + `facilityFee` + `orderProcessingFee` + `taxAmount` ≈ `totalFees` (may not exactly equal if unknown fee types exist — that's expected)
- [ ] `listPrice` = `totalPrice` * (1 + listCostPercentage/100)
- [ ] CSV `face_price` column shows face value, not inflated total
- [ ] CSV `cost` column shows per-ticket total (not total for all seats)
- [ ] `offerName` populated for tickets with special pricing (Club, VIP, etc.)
- [ ] Fallback path works: mock an offer without `totalPrice` and verify old calculation kicks in

---

## 10. Appendix: Known Ticketmaster Charge Types

| `reason` | `type` | Description | Per-ticket or Per-order |
|----------|--------|-------------|------------------------|
| `service` | `fee` | Service charge | Per-ticket |
| `facility` | `fee` | Facility/venue fee | Per-ticket |
| `order_processing` | `fee` | Order processing fee | Per-order (split across seats) |
| `face_value_tax` | `tax` | Tax on face value | Per-ticket |

Note: This list is not exhaustive. Ticketmaster can add new charge reasons at any time. The `totalPrice` approach handles this automatically.
