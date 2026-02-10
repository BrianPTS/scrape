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
| TPTS-034 | Investigate resale split type data availability | Test | 1 hour |
| TPTS-035 | Add security code to Clean Up Stale Inventory | Ready | 0.5 hours |
| TPTS-036 | Automatiq API client wrapper | Ready | 2 hours |
| TPTS-037 | Orders page with data table | Ready | 3 hours |
| TPTS-038 | Orders filters and search | Ready | 2 hours |
| TPTS-039 | Order confirm/reject actions | Ready | 2 hours |
| TPTS-040 | Order details modal | Ready | 2 hours |
| TPTS-041 | Auto-refresh and notifications | Ready | 1 hour |

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

## 2.10 TPTS-035: Add Security Code to Clean Up Stale Inventory Button

**Purpose:** Add a 4-digit security code requirement (2026) to the "Clean Up Stale Inventory" button to prevent accidental deletion.

**File:** `app/dashboard/export-csv/page.tsx`

### Changes Made

1. **Added state variable** (line 95):
```typescript
const [staleSecurityCode, setStaleSecurityCode] = useState('');
```

2. **Reset code on confirm** (line 363-364):
```typescript
const confirmStaleCleanup = async () => {
  setShowStaleCleanupDialog(false);
  setStaleSecurityCode('');  // Reset security code
  // ... rest of function
};
```

3. **Reset code on cancel** (line 393-395):
```typescript
const cancelStaleCleanup = () => {
  setShowStaleCleanupDialog(false);
  setStaleSecurityCode('');  // Reset security code
};
```

4. **Updated dialog** (lines 992-1024):
- Added label and input field for 4-digit security code
- Confirm button is disabled until user enters "2026"
- Button changes from gray to yellow when correct code is entered

### How It Works

1. User clicks "Clean Up Stale Inventory" button
2. Warning dialog appears with a text input field
3. User must enter "2026" to enable the confirm button
4. Confirm button is grayed out and disabled until correct code is entered
5. Code resets when dialog is closed (cancel or confirm)

### Testing

1. Navigate to Dashboard > Export CSV
2. Scroll to "Inventory Management" section
3. Click "Clean Up Stale Inventory" button
4. Verify confirm button is disabled (gray)
5. Enter "2026" in the security code field
6. Verify confirm button becomes enabled (yellow)
7. Click Cancel - verify code resets
8. Re-open dialog - verify code field is empty

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

# PART 5: ORDERS DASHBOARD (TPTS-036 to TPTS-041)

## Overview

The Orders Dashboard integrates with the SeatScouts/Automatiq API to provide real-time order management directly from the TMC Portal.

## Prerequisites

You need API credentials from SeatScouts/Automatiq:
- **API Token**: Your company's API token
- **Company ID**: Your company ID in the system

Contact SeatScouts/Broker Genius support if you don't have these credentials.

---

## 5.1 Environment Variables Setup

Add these to your `.env.local` file:

```env
# Automatiq (SeatScouts/Broker Genius) API Credentials
AUTOMATIQ_API_TOKEN=your_api_token_here
AUTOMATIQ_COMPANY_ID=your_company_id_here
```

**IMPORTANT:** Never commit these credentials to version control.

---

## 5.2 Files Created

| File | Purpose |
|------|---------|
| `lib/automatiq.ts` | API client wrapper with typed interfaces |
| `actions/orderActions.ts` | Server-side actions for order operations |
| `app/api/orders/route.ts` | REST API endpoints for client-side calls |
| `app/dashboard/orders/page.tsx` | Orders page UI component |

---

## 5.3 API Client (TPTS-036)

**File:** `lib/automatiq.ts`

The API client provides:

### Types
```typescript
interface AutomatiqOrder {
  id: number;
  order_id: string;
  status: OrderStatus;
  marketplace: string;
  event_name: string;
  occurs_at: string;
  order_date: string;
  section: string;
  row: string;
  low_seat: string | number;
  high_seat: string | number;
  quantity: number;
  unit_price: number | string;
  total: number | string;
  delivery: string;
  // ... more fields
}

type OrderStatus = 'pending' | 'problem' | 'confirmed' | 'confirmed_delay' | 'delivery_problem' | 'delivered';
```

### Functions
```typescript
// Fetch orders with filters
getOrders(filters: OrderFilters): Promise<OrdersResponse>

// Get single order
getOrder(orderId: string | number): Promise<AutomatiqOrder>

// Order actions
confirmOrder(orderId, seatNumbers?): Promise<AutomatiqOrder>
rejectOrder(orderId): Promise<AutomatiqOrder>
recheckOrder(orderId): Promise<AutomatiqOrder>
fulfillOrder(orderId): Promise<AutomatiqOrder>

// Delivery
deliverOrderWithUrls(orderId, urls): Promise<AutomatiqOrder>

// Proofs
uploadOrderProofs(orderId, proofs): Promise<AutomatiqOrder>
getOrderProofs(orderId, marketplace): Promise<ProofsResponse>
```

---

## 5.4 Server Actions (TPTS-039)

**File:** `actions/orderActions.ts`

Server actions wrap the API client with error handling:

```typescript
// Check if API is configured
checkAutomatiqConfig(): Promise<{ configured: boolean; message?: string }>

// Fetch orders
fetchOrders(filters): Promise<OrderActionResult>
fetchOrder(orderId): Promise<OrderActionResult>

// Order actions
confirmOrder(orderId, seatNumbers?): Promise<OrderActionResult>
rejectOrder(orderId): Promise<OrderActionResult>
recheckOrder(orderId): Promise<OrderActionResult>
setOrderAutoFulfill(orderId): Promise<OrderActionResult>

// Stats
getOrderStats(): Promise<{ stats: OrderStats }>
```

---

## 5.5 API Routes

**File:** `app/api/orders/route.ts`

### GET /api/orders

Fetch orders with optional filters:

```
GET /api/orders?status=pending&marketplace=stubhub&limit=25&page=1
```

Query Parameters:
- `status` - Filter by status (pending, problem, confirmed, etc.)
- `marketplace` - Filter by marketplace (stubhub, vividseats, etc.)
- `event_name` - Search by event name
- `limit` - Results per page (default: 25)
- `page` - Page number (default: 1)
- `stats=true` - Return only stats counts

### POST /api/orders

Perform actions on orders:

```json
{
  "action": "confirm",  // confirm, reject, recheck, fulfill
  "orderId": 12345,
  "seatNumbers": "1,2,3,4"  // optional, for confirm
}
```

---

## 5.6 Orders Page Features (TPTS-037 to TPTS-041)

**File:** `app/dashboard/orders/page.tsx`

### Stats Cards
- Total Orders count
- Pending count (yellow)
- Problems count (red)
- Confirmed count (blue)
- Delivered count (green)

### Orders Table
| Column | Description |
|--------|-------------|
| Status | Color-coded badge (Pending, Problem, Confirmed, etc.) |
| Order ID | Marketplace order ID |
| Event | Event name and date |
| Marketplace | StubHub, VividSeats, etc. |
| Seats | Section, Row, Seat numbers, Quantity |
| Total | Total price and per-ticket price |
| Order Date | When order was placed |
| Actions | View, Confirm, Reject, Recheck, Auto-Fulfill |

### Filters
- **Search**: Filter by event name
- **Status**: Dropdown for all statuses
- **Marketplace**: Dropdown for all marketplaces
- **Advanced**: Date range filters (expandable)

### Actions
| Action | Icon | When Shown | API Endpoint |
|--------|------|------------|--------------|
| View | Eye | Always | Opens modal |
| Confirm | Green check | Pending/Problem | PATCH /orders/{id}/confirm |
| Reject | Red X | Pending/Problem | PATCH /orders/{id}/reject |
| Recheck | Rotate | Always | GET /orders/{id}/recheck |
| Auto-Fulfill | Lightning | Pending | PATCH /orders/{id}/fulfill |

### Order Details Modal
- Status and Marketplace badges
- Order ID and Sync ID
- Order date and delivery type
- Event information (name, date, venue)
- Ticket details (section, row, seats, quantity)
- Pricing breakdown
- Error reason (if any)
- Internal notes and tags
- POS IDs
- Action buttons

### Auto-Refresh
- Toggle: On/Off
- Intervals: 30s, 1m, 2m, 5m
- Last refresh timestamp
- Manual refresh button

---

## 5.7 Sidebar Navigation Update

**File:** `app/dashboard/layout.tsx`

Orders has been moved from "Coming Soon" to active navigation.

The Orders link is now in the main navigation menu between Proxies and Logout.

---

## 5.8 Testing Checklist

### Configuration
- [ ] Add AUTOMATIQ_API_TOKEN to .env.local
- [ ] Add AUTOMATIQ_COMPANY_ID to .env.local
- [ ] Restart Next.js dev server

### Orders Page
- [ ] Navigate to /dashboard/orders
- [ ] Verify stats cards display counts
- [ ] Verify orders table loads data
- [ ] Test search by event name
- [ ] Test status filter
- [ ] Test marketplace filter
- [ ] Test pagination

### Actions
- [ ] Click eye icon - modal opens
- [ ] Click confirm on pending order
- [ ] Click reject on pending order
- [ ] Click recheck on any order
- [ ] Verify toast notifications appear

### Auto-Refresh
- [ ] Toggle auto-refresh on/off
- [ ] Change refresh interval
- [ ] Verify data updates automatically
- [ ] Verify last refresh timestamp updates

### Error Handling
- [ ] Remove API token - verify error message displays
- [ ] Test with invalid credentials

---

## 5.9 Supported Marketplaces

| Marketplace | API Value |
|-------------|-----------|
| AXS | axs |
| FanXchange | fanxchange |
| GameTime | gametime |
| SeatGeek | seatgeek |
| StubHub | stubhub |
| Ticket Evolution | ticket_evo |
| TicketNetwork | ticket_network_mp |
| Ticketmaster | ticketmaster |
| TickPick | tickpick |
| VividSeats | vividseats |

---

## 5.10 API Rate Limits

The Automatiq API has a rate limit of **100 requests per minute** per company_id.

The auto-refresh feature is designed to stay well within this limit:
- At 30s interval: 2 requests/minute
- At 1m interval: 1 request/minute
- At 5m interval: 0.2 requests/minute

---

**Last Updated:** February 10, 2026
**Branch:** claude/add-monday-api-token-rk25G
