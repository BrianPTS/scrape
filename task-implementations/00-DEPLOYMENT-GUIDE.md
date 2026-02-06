# Complete Deployment Guide - Sprint 1 Tasks

## Quick Reference

| Task ID | Description | Status | Estimated SP |
|---------|-------------|--------|--------------|
| TPTS-023 | Separate % fields for Standard/Resale | Ready | 2 hours |
| TPTS-024 | Add Notes field to Edit Event form | Ready | 1 hour |
| TPTS-025 | Include Notes in CSV export | Ready | 0.5 hours |
| TPTS-026 | Bulk edit functionality for Events | Ready | 4-6 hours |
| TPTS-027 | Venue Type dropdown | Ready | 1-2 hours |
| TPTS-028 | Auto-populate "-game" tag | Ready | 2 hours |
| TPTS-029 | This deployment guide | Ready | - |
| TPTS-030 | Playwright eventModel sync | Ready | 1 hour |
| TPTS-031 | Auto-cleanup stale inventory | Ready | 2 hours |
| TPTS-032 | Event Capacity/Seats Available | Ready | 3 hours |
| TPTS-033 | Always use highest price for multi-offer seats | Ready | 1 hour |

---

## Repository Overview

| Repo | URL | Purpose |
|------|-----|---------|
| **scrape** | github.com/BrianPTS/scrape | TMC Portal (Next.js frontend) |
| **playwright** | github.com/abdulsamad2/playwright | Backend scraper |

**IMPORTANT:** Both repos share the same MongoDB database. Model changes MUST be synchronized.

---

## Deployment Order (Recommended)

```
1. PLAYWRIGHT REPO FIRST
   └── Apply eventModel changes (TPTS-030)
   └── Apply seat stats patch (TPTS-032)

2. SCRAPE REPO SECOND
   └── All other changes

3. RUN MIGRATION SCRIPT
   └── Update existing data in MongoDB

4. VERIFY
   └── Test all features
```

---

# PART 1: PLAYWRIGHT REPO CHANGES

## 1.1 Event Model Updates (TPTS-030)

**File:** `models/eventModel.js`

Replace the entire file with:

```javascript
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    mapping_id: {
      type: String,
      required: true,
      unique: true,
    },
    Event_ID: {
      type: String,
      required: true,
      unique: true,
    },
    Event_Name: {
      type: String,
      required: true,
    },
    Event_DateTime: {
      type: Date,
      required: true,
    },
    Venue: String,

    // NEW: Venue Type dropdown (TPTS-027)
    venue_type: {
      type: String,
      enum: ['stadium', 'arena', 'theater', 'other'],
      default: 'other',
    },

    URL: {
      type: String,
      required: true,
    },
    Zone: {
      type: String,
      default: "none",
    },
    Available_Seats: {
      type: Number,
      default: 0,
    },

    // NEW: Venue capacity and seats for sale (TPTS-032)
    venueCapacity: {
      type: Number,
      default: 0,
    },
    seatsForSale: {
      type: Number,
      default: 0,
    },

    Skip_Scraping: {
      type: Boolean,
      default: true,
    },
    inHandDate: {
      type: Date,
      default: Date.now,
    },

    // NEW: Separate percentage fields (TPTS-023)
    // REPLACES: priceIncreasePercentage
    standardPriceIncreasePercentage: {
      type: Number,
      default: 35,
    },
    resalePriceIncreasePercentage: {
      type: Number,
      default: 35,
    },

    // NEW: Internal notes field (TPTS-024)
    internal_notes: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    Last_Updated: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      lastUpdate: String,
      iterationNumber: Number,
      scrapeStartTime: Date,
      scrapeEndTime: Date,
      inHandDate: Date,
      scrapeDurationSeconds: Number,
      totalRunningTimeMinutes: Number,
      ticketStats: {
        totalTickets: Number,
        ticketCountChange: Number,
        previousTicketCount: Number,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
eventSchema.index({ URL: 1 }, { unique: true });

export const Event = mongoose.model("Event", eventSchema);
```

---

## 1.2 Seat Stats Feature (TPTS-032)

Apply the patch file OR make these manual changes:

### Option A: Apply Patch File
```bash
cd /path/to/playwright-repo
git apply /path/to/scrape/playwright-seat-stats.patch
```

### Option B: Manual Changes

#### 1. Create new file: `helpers/seatCounter.js`

```javascript
/**
 * Seat Counter Helper
 * Calculates venue capacity and seats for sale from Ticketmaster API responses.
 */

/**
 * Count total seats in venue from Map API response (venue capacity)
 */
export function countVenueCapacity(mapData) {
  let totalSeats = 0;

  if (!mapData || !mapData.pages || !mapData.pages.length) {
    return 0;
  }

  try {
    const page = mapData.pages[0];
    if (!page.segments) return 0;

    page.segments.forEach((composit) => {
      if (composit?.segments) {
        composit.segments.forEach((section) => {
          if (section.segments && section.segments.length > 0) {
            section.segments.forEach((row) => {
              if (row.placesNoKeys && Array.isArray(row.placesNoKeys)) {
                totalSeats += row.placesNoKeys.length;
              }
            });
          } else if (section.placesNoKeys && Array.isArray(section.placesNoKeys)) {
            totalSeats += section.placesNoKeys.length;
          }
        });
      }
    });
  } catch (error) {
    console.error('[SeatCounter] Error counting venue capacity:', error.message);
  }

  return totalSeats;
}

/**
 * Count total seats for sale from Facet API response
 */
export function countSeatsForSale(facetData) {
  let totalSeats = 0;

  if (!facetData || !facetData.facets || !Array.isArray(facetData.facets)) {
    return 0;
  }

  try {
    facetData.facets.forEach((facet) => {
      if (facet.places && Array.isArray(facet.places)) {
        facet.places.forEach((placeString) => {
          const seatCount = countPlacesInString(placeString);
          totalSeats += seatCount;
        });
      }
    });
  } catch (error) {
    console.error('[SeatCounter] Error counting seats for sale:', error.message);
  }

  return totalSeats;
}

function countPlacesInString(placeString) {
  if (!placeString || typeof placeString !== 'string') {
    return 0;
  }

  let count = 0;
  let currentToken = '';

  for (let i = 0; i < placeString.length; i++) {
    const char = placeString[i];

    if (char === '[') {
      // depth++
    } else if (char === ']') {
      if (currentToken.length > 0) {
        count++;
        currentToken = '';
      }
    } else if (char === ',') {
      if (currentToken.length > 0) {
        count++;
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }

  if (currentToken.length > 0) {
    count++;
  }

  if (count === 0 && placeString.length > 0) {
    count = 1;
  }

  return count;
}

export function getSeatStats(mapData, facetData) {
  return {
    venueCapacity: countVenueCapacity(mapData),
    seatsForSale: countSeatsForSale(facetData)
  };
}

export default {
  countVenueCapacity,
  countSeatsForSale,
  getSeatStats
};
```

#### 2. Update `scraper.js`

Add import at top:
```javascript
import { getSeatStats } from "./helpers/seatCounter.js";
```

In the `callTicketmasterAPI` function, after successful validation, add:
```javascript
// Calculate venue capacity and seats for sale
const seatStats = getSeatStats(DataMap, DataFacets);

console.log(
  `Event ${eventId} scrape successful - ${seatCount} seat groups found ` +
  `[Venue capacity: ${seatStats.venueCapacity}, Seats for sale: ${seatStats.seatsForSale}]`
);

// Attach stats to result
result.seatStats = seatStats;
```

#### 3. Update `scraperManager.js`

In the metadata update section, add:
```javascript
// Extract seat stats if available
const seatStats = validScrapeResult.seatStats || {};

// Include in the Event.updateOne call:
await Event.updateOne(
  { Event_ID: eventId },
  {
    $set: {
      Available_Seats: currentTicketCount,
      venueCapacity: seatStats.venueCapacity || 0,
      seatsForSale: seatStats.seatsForSale || 0,
      Last_Updated: new Date(),
      // ... rest of fields
    },
  }
);
```

---

# PART 2: SCRAPE REPO CHANGES

## 2.1 TPTS-023: Separate % Increase Fields

### File 1: `models/eventModel.js`

**REMOVE:**
```javascript
priceIncreasePercentage: {
  type: Number,
  default: 35,
},
```

**ADD:**
```javascript
standardPriceIncreasePercentage: {
  type: Number,
  default: 35,
},
resalePriceIncreasePercentage: {
  type: Number,
  default: 35,
},
```

### File 2: `app/dashboard/list-event/NewScraper.jsx`

**In formData state (around line 20-32):**

REPLACE: `Percentage_Increase_ListCost: 0,`

WITH:
```javascript
Standard_Percentage_Increase: 35,
Resale_Percentage_Increase: 35,
```

**In useEffect for edit mode (around line 35-57):**

REPLACE: `Percentage_Increase_ListCost: initialData.priceIncreasePercentage || 0,`

WITH:
```javascript
Standard_Percentage_Increase: initialData.standardPriceIncreasePercentage || 35,
Resale_Percentage_Increase: initialData.resalePriceIncreasePercentage || 35,
```

**In validationState (around line 62-72):**

REPLACE: `Percentage_Increase_ListCost: true,`

WITH:
```javascript
Standard_Percentage_Increase: true,
Resale_Percentage_Increase: true,
```

**In touchedFields (around line 73-83):**

REPLACE: `Percentage_Increase_ListCost: false,`

WITH:
```javascript
Standard_Percentage_Increase: false,
Resale_Percentage_Increase: false,
```

**In validateForm function (around line 271-298):**

REPLACE: `Percentage_Increase_ListCost: formData.Percentage_Increase_ListCost >= 0,`

WITH:
```javascript
Standard_Percentage_Increase: formData.Standard_Percentage_Increase >= 0,
Resale_Percentage_Increase: formData.Resale_Percentage_Increase >= 0,
```

**In handleSubmit eventData (around line 406-419):**

REPLACE: `priceIncreasePercentage: formData.Percentage_Increase_ListCost,`

WITH:
```javascript
standardPriceIncreasePercentage: formData.Standard_Percentage_Increase,
resalePriceIncreasePercentage: formData.Resale_Percentage_Increase,
```

**Replace the single percentage input field in JSX with TWO fields:**

```jsx
{/* Standard Ticket Percentage Increase Field */}
<div>
  <label
    htmlFor="Standard_Percentage_Increase"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    % Increase - Standard <span className="text-red-500">*</span>
  </label>
  <div className="relative">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <Tag className="h-5 w-5 text-gray-400" />
    </div>
    <input
      id="Standard_Percentage_Increase"
      name="Standard_Percentage_Increase"
      type="number"
      min="0"
      step="0.01"
      value={formData.Standard_Percentage_Increase}
      onChange={handleInputChange}
      onBlur={handleBlur}
      placeholder="e.g., 35"
      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
        !validationState.Standard_Percentage_Increase && touchedFields.Standard_Percentage_Increase
          ? "border-red-500 bg-red-50"
          : validationState.Standard_Percentage_Increase && formData.Standard_Percentage_Increase
          ? "border-green-500 bg-green-50"
          : "border-gray-300"
      }`}
      disabled={loading}
    />
  </div>
  <p className="mt-1 text-xs text-gray-500">
    Markup % for standard/list pricing
  </p>
</div>

{/* Resale Ticket Percentage Increase Field */}
<div>
  <label
    htmlFor="Resale_Percentage_Increase"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    % Increase - Resale <span className="text-red-500">*</span>
  </label>
  <div className="relative">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <Tag className="h-5 w-5 text-gray-400" />
    </div>
    <input
      id="Resale_Percentage_Increase"
      name="Resale_Percentage_Increase"
      type="number"
      min="0"
      step="0.01"
      value={formData.Resale_Percentage_Increase}
      onChange={handleInputChange}
      onBlur={handleBlur}
      placeholder="e.g., 35"
      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
        !validationState.Resale_Percentage_Increase && touchedFields.Resale_Percentage_Increase
          ? "border-red-500 bg-red-50"
          : validationState.Resale_Percentage_Increase && formData.Resale_Percentage_Increase
          ? "border-green-500 bg-green-50"
          : "border-gray-300"
      }`}
      disabled={loading}
    />
  </div>
  <p className="mt-1 text-xs text-gray-500">
    Markup % for resale pricing
  </p>
</div>
```

### File 3: `actions/csvActions.tsx`

**Update the $addFields stage in aggregation pipeline:**
```javascript
{
  $addFields: {
    event_url: { $arrayElemAt: ['$eventDetails.URL', 0] },
    standardPriceIncreasePercentage: { $arrayElemAt: ['$eventDetails.standardPriceIncreasePercentage', 0] },
    resalePriceIncreasePercentage: { $arrayElemAt: ['$eventDetails.resalePriceIncreasePercentage', 0] }
  }
}
```

**Update ConsecutiveGroupDocument interface:**
```typescript
interface ConsecutiveGroupDocument {
  // ... existing fields ...
  standardPriceIncreasePercentage?: number;
  resalePriceIncreasePercentage?: number;
}
```

**Update processBatch function price calculation:**
```typescript
// Determine if this is a resale ticket
const isResale = inventory?.splitType === 'DEFAULT';

// Get the appropriate percentage based on ticket type
const priceIncreasePercentage = isResale
  ? (doc.resalePriceIncreasePercentage || 35)
  : (doc.standardPriceIncreasePercentage || 35);

// Calculate the adjusted price
const listPrice = inventory?.listPrice || 0;
const adjustedPrice = listPrice * (1 + priceIncreasePercentage / 100);

// Use in return object:
list_price: Number(adjustedPrice.toFixed(2)),
```

---

## 2.2 TPTS-024: Add Notes Field to Edit Event Form

### File 1: `models/eventModel.js`

**ADD this field:**
```javascript
internal_notes: {
  type: String,
  default: "",
  maxlength: 1000,
},
```

### File 2: `app/dashboard/list-event/NewScraper.jsx`

**In formData state, ADD:**
```javascript
internal_notes: "",
```

**In useEffect for edit mode, ADD:**
```javascript
internal_notes: initialData.internal_notes || "",
```

**In validationState, ADD:**
```javascript
internal_notes: true,
```

**In touchedFields, ADD:**
```javascript
internal_notes: false,
```

**In handleSubmit eventData, ADD:**
```javascript
internal_notes: formData.internal_notes,
```

**Add this JSX field to the form (at the end, full width):**
```jsx
{/* Internal Notes Field */}
<div className="md:col-span-2">
  <label
    htmlFor="internal_notes"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    Notes
  </label>
  <div className="relative">
    <textarea
      id="internal_notes"
      name="internal_notes"
      rows={3}
      value={formData.internal_notes}
      onChange={handleInputChange}
      onBlur={handleBlur}
      placeholder="Add internal notes about this event (optional)..."
      maxLength={1000}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none"
      disabled={loading}
    />
  </div>
  <div className="flex justify-between mt-1">
    <p className="text-xs text-gray-500">
      Optional notes for internal use (included in CSV exports)
    </p>
    <p className={`text-xs ${formData.internal_notes.length > 900 ? 'text-amber-500' : 'text-gray-400'}`}>
      {formData.internal_notes.length}/1000
    </p>
  </div>
</div>
```

---

## 2.3 TPTS-025: Include Notes in CSV Export

### File: `actions/csvActions.tsx`

**Update $addFields to include notes:**
```javascript
{
  $addFields: {
    event_url: { $arrayElemAt: ['$eventDetails.URL', 0] },
    event_internal_notes: { $arrayElemAt: ['$eventDetails.internal_notes', 0] }
  }
}
```

**Update interface:**
```typescript
event_internal_notes?: string;
```

**Update processBatch internal_notes logic:**
```typescript
// Build internal_notes: base tags + event-specific notes
const baseNotes = "-tnow -tmplus";
const eventNotes = doc.event_internal_notes?.trim() || '';

const internalNotes = eventNotes
  ? `${baseNotes} ${eventNotes}`
  : baseNotes;

// Use in return object:
internal_notes: internalNotes,
```

---

## 2.4 TPTS-026: Bulk Edit Functionality

See file: `TPTS-026-bulk-edit-functionality.js` for complete implementation.

**Summary of changes:**

1. **actions/eventActions.ts** - Add `bulkUpdateEvents` function
2. **app/dashboard/events/page.js** - Add selection state, handlers, and modal
3. **app/dashboard/events/EventsTableModern.jsx** - Add checkbox column

---

## 2.5 TPTS-027: Venue Type Dropdown

### File 1: `models/eventModel.js`

**ADD this field (after Venue):**
```javascript
venue_type: {
  type: String,
  enum: ['stadium', 'arena', 'theater', 'other'],
  default: 'other',
},
```

### File 2: `app/dashboard/list-event/NewScraper.jsx`

**Add Building2 icon import:**
```javascript
import { Building2 } from "lucide-react";
```

**Add constant before component:**
```javascript
const VENUE_TYPES = [
  { value: 'stadium', label: 'Stadium' },
  { value: 'arena', label: 'Arena' },
  { value: 'theater', label: 'Theater' },
  { value: 'other', label: 'Other' },
];
```

**In formData, ADD:** `venue_type: "other",`

**In useEffect, ADD:** `venue_type: initialData.venue_type || "other",`

**In validationState, ADD:** `venue_type: true,`

**In touchedFields, ADD:** `venue_type: false,`

**In eventData, ADD:** `venue_type: formData.venue_type,`

**Add dropdown JSX (after Venue field):**
```jsx
{/* Venue Type Field */}
<div>
  <label
    htmlFor="venue_type"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    Venue Type
  </label>
  <div className="relative">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <Building2 className="h-5 w-5 text-gray-400" />
    </div>
    <select
      id="venue_type"
      name="venue_type"
      value={formData.venue_type}
      onChange={handleInputChange}
      onBlur={handleBlur}
      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors appearance-none bg-white"
      disabled={loading}
    >
      {VENUE_TYPES.map((type) => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </select>
  </div>
  <p className="mt-1 text-xs text-gray-500">
    Categorize the venue type
  </p>
</div>
```

---

## 2.6 TPTS-028: Auto-populate "-game" Tag

See file: `AUTO-POPULATE-game-tag.js` for complete implementation.

**Summary:**
- Add `isGameEvent()` helper function to detect sports events
- Auto-add "-game" to internal_notes when creating sports events
- Ensure "-game" tag in CSV export for sports events

---

## 2.7 TPTS-031: Auto-cleanup Stale Inventory

**Already implemented in main codebase.** When an event is paused, after 1 minute the system automatically cleans up stale inventory.

---

## 2.8 TPTS-032: Event Capacity/Seats Available in UI

**Already implemented.** The Events table now shows an "Inventory" column with:
- Seats for sale count
- Total venue capacity
- % sold badge (color-coded: green < 50%, amber 50-79%, red 80%+)

---

## 2.9 TPTS-033: Always Use Highest Price for Multi-Offer Seats

**Problem:** When a Ticketmaster seat has multiple price offers (e.g., "Standard Admission $45" and "Kids Tickets $0"), the scraper was selecting the offer based on shortest ID string length instead of price.

**Fix:** Always select the offer with the highest total price (faceValue + fees).

### Apply the Patch

```bash
cd /path/to/playwright-repo
git apply /path/to/scrape/playwright-highest-price.patch
```

### Manual Changes (if patch doesn't apply cleanly)

#### 1. Update `helpers/seats.js`

Replace the offerId selection logic (appears twice, around lines 135 and 156):

**BEFORE:**
```javascript
offerId: x?.offers.length > 0 ? x?.offers.length>1?x?.offers.reduce((shortest, current) => {
  return current.length < shortest.length ? current : shortest;
}):x?.offers[0] : "",
```

**AFTER:**
```javascript
// Pass ALL offer IDs - selection of highest price happens in seatBatch.js
offerId: x?.offers.length > 0 ? x?.offers[0] : "",
allOfferIds: x?.offers || [], // NEW: Pass all offer IDs for price comparison
```

#### 2. Update `helpers/seatBatch.js`

Add this function at the top of the file (after imports):

```javascript
/**
 * Select the offer with the highest price from multiple offer IDs
 * @param {Array<string>} offerIds - Array of offer IDs
 * @param {Array<Object>} allOffers - Array of all offer objects with prices
 * @returns {Object|null} The offer with the highest price, or null if none found
 */
function selectHighestPricedOffer(offerIds, allOffers) {
  if (!offerIds || offerIds.length === 0 || !allOffers || allOffers.length === 0) {
    return null;
  }

  // Find all matching offers
  const matchingOffers = offerIds
    .map(id => allOffers.find(o => o.offerId === id))
    .filter(Boolean);

  if (matchingOffers.length === 0) {
    return null;
  }

  // If only one offer, return it
  if (matchingOffers.length === 1) {
    return matchingOffers[0];
  }

  // Select the offer with the highest total price (faceValue + charges)
  return matchingOffers.reduce((highest, current) => {
    const currentTotal = (current.faceValue || 0) +
      (current.charges?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0);
    const highestTotal = (highest.faceValue || 0) +
      (highest.charges?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0);

    return currentTotal > highestTotal ? current : highest;
  }, matchingOffers[0]);
}
```

Replace the offer lookup logic in `AttachRowSection`:

**BEFORE:**
```javascript
let offerGet = offers.find((e) => e.offerId == x.offerId);
```

**AFTER:**
```javascript
// Use highest priced offer when multiple offers exist for the same seat
let offerGet;
if (x.allOfferIds && x.allOfferIds.length > 1) {
  // Multiple offers available - select highest priced one
  offerGet = selectHighestPricedOffer(x.allOfferIds, offers);
} else {
  // Single offer or no allOfferIds - use original logic
  offerGet = offers.find((e) => e.offerId == x.offerId);
}
```

Also add `allOfferIds` to all data structures that pass through:
- `CreateConsicutiveSeats` merged object
- `customData` return object
- `groupedSeats` push object

---

# PART 3: MONGODB MIGRATION SCRIPT

Run this ONCE after deploying both repos:

```javascript
// Connect to MongoDB and run:

// 1. Migrate priceIncreasePercentage to new fields
db.events.updateMany(
  { priceIncreasePercentage: { $exists: true } },
  [
    {
      $set: {
        standardPriceIncreasePercentage: "$priceIncreasePercentage",
        resalePriceIncreasePercentage: "$priceIncreasePercentage"
      }
    }
  ]
);

// 2. Remove old field
db.events.updateMany(
  { priceIncreasePercentage: { $exists: true } },
  { $unset: { priceIncreasePercentage: "" } }
);

// 3. Set default venue_type for existing events
db.events.updateMany(
  { venue_type: { $exists: false } },
  { $set: { venue_type: "other" } }
);

// 4. Set default internal_notes for existing events
db.events.updateMany(
  { internal_notes: { $exists: false } },
  { $set: { internal_notes: "" } }
);

// 5. Set default seat stats for existing events
db.events.updateMany(
  { venueCapacity: { $exists: false } },
  { $set: { venueCapacity: 0, seatsForSale: 0 } }
);

// 6. Verify migration
db.events.findOne({}, {
  standardPriceIncreasePercentage: 1,
  resalePriceIncreasePercentage: 1,
  venue_type: 1,
  internal_notes: 1,
  venueCapacity: 1,
  seatsForSale: 1,
  priceIncreasePercentage: 1  // Should NOT exist
});
```

---

# PART 4: TESTING CHECKLIST

## TPTS-023: Separate % Fields
- [ ] Create new event with different standard and resale percentages
- [ ] Edit existing event and verify both fields save correctly
- [ ] Generate CSV - verify standard tickets use standard percentage
- [ ] Generate CSV - verify resale tickets use resale percentage

## TPTS-024: Notes Field
- [ ] Create new event with internal notes
- [ ] Create new event without notes (field is optional)
- [ ] Edit existing event and add/modify notes
- [ ] Verify character counter works (1000 max)

## TPTS-025: Notes in CSV
- [ ] Create event with notes, generate CSV - notes should appear
- [ ] Event without notes should have default "-tnow -tmplus"

## TPTS-026: Bulk Edit
- [ ] Select multiple events using checkboxes
- [ ] Click "Edit X Selected" button
- [ ] Update % increase for all selected
- [ ] Update notes for all selected
- [ ] Pause/resume multiple events at once

## TPTS-027: Venue Type
- [ ] Create new event - venue type dropdown works
- [ ] Edit existing event - venue type saves correctly
- [ ] Default value is "other"

## TPTS-028: Auto "-game" Tag
- [ ] Create sports event (Lakers vs Celtics) - should auto-add "-game"
- [ ] Create concert event - should NOT auto-add "-game"
- [ ] CSV export includes "-game" for sports events

## TPTS-032: Seat Stats
- [ ] Scrape an event - venue capacity and seats for sale should populate
- [ ] Events table shows "Inventory" column with correct data
- [ ] % sold badge shows correct color

## TPTS-033: Highest Price Selection
- [ ] Scrape an event that has seats with multiple offers (Standard + Kids)
- [ ] Verify CSV shows the higher price (Standard), not the lower price (Kids)
- [ ] Check console logs show correct offer being selected

---

# PART 5: FILE INDEX

| File | Description |
|------|-------------|
| `TPTS-023-separate-percentage-fields.js` | Separate % fields implementation |
| `TPTS-024-add-notes-field.js` | Notes field implementation |
| `TPTS-025-notes-in-csv-export.js` | CSV notes export implementation |
| `TPTS-026-bulk-edit-functionality.js` | Bulk edit implementation |
| `TPTS-027-venue-type-dropdown.js` | Venue type dropdown implementation |
| `TPTS-033-use-highest-price.js` | Highest price selection implementation |
| `AUTO-POPULATE-game-tag.js` | Auto -game tag implementation |
| `PLAYWRIGHT-REPO-eventModel-changes.js` | Complete eventModel for playwright |
| `playwright-seat-stats.patch` | Patch file for seat stats in playwright |
| `playwright-highest-price.patch` | Patch file for highest price selection |

---

# QUICK COMMANDS

```bash
# Apply playwright patch
cd /path/to/playwright
git apply /path/to/scrape/playwright-seat-stats.patch

# Commit changes
git add .
git commit -m "Apply Sprint 1 changes"

# Deploy
# ... your deployment commands ...

# Run migration
mongosh "your-connection-string" --eval "
  db.events.updateMany({priceIncreasePercentage: {\$exists: true}}, [{\$set: {standardPriceIncreasePercentage: '\$priceIncreasePercentage', resalePriceIncreasePercentage: '\$priceIncreasePercentage'}}]);
  db.events.updateMany({priceIncreasePercentage: {\$exists: true}}, {\$unset: {priceIncreasePercentage: ''}});
  db.events.updateMany({venue_type: {\$exists: false}}, {\$set: {venue_type: 'other'}});
  db.events.updateMany({internal_notes: {\$exists: false}}, {\$set: {internal_notes: ''}});
  db.events.updateMany({venueCapacity: {\$exists: false}}, {\$set: {venueCapacity: 0, seatsForSale: 0}});
"
```

---

**Last Updated:** January 30, 2026
**Branch:** claude/add-monday-api-token-rk25G
