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
| TPTS-034 | Investigate resale split type data availability | Complete | 1 hour |
| TPTS-035 | Add security code to Clean Up Stale Inventory | Ready | 0.5 hours |
| TPTS-036 | Automatiq API client wrapper | Ready | 2 hours |
| TPTS-037 | Orders page with data table | Ready | 3 hours |
| TPTS-038 | Orders filters and search | Ready | 2 hours |
| TPTS-039 | Order confirm/reject actions | Ready | 2 hours |
| TPTS-040 | Order details modal | Ready | 2 hours |
| TPTS-041 | Auto-refresh and notifications | Ready | 1 hour |
| TPTS-042 | Add Ticketmaster URL to CSV internal_notes | Ready | 0.5 hours |
| TPTS-043 | Multiple Ticketmaster URLs per event | Ready | 2 hours |
| TPTS-044 | Exclude Standard listings with ≤2 seats | Ready | 0.5 hours |
| TPTS-047 | Standard/Resale CSV export toggles | Ready | 1 hour |
| TPTS-048 | Minimum seat cost filter for CSV | Ready | 1 hour |
| TPTS-049 | High quantity bonus markup (Standard only) | Ready | 1.5 hours |

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

## 2.1 TPTS-023: Separate % Increase Fields (UPDATED)

> **Note:** The original spec was updated to include high quantity bonus and minimum cost filter features (TPTS-048, TPTS-049).

### File 1: `models/eventModel.js`

**KEEP existing field (used as fallback):**
```javascript
priceIncreasePercentage: {
  type: Number,
  default: 25, // Default 25% markup (legacy - used as fallback)
},
```

**ADD these new fields:**
```javascript
// Standard/Resale markup split
standardMarkup: {
  type: Number,
  default: null,
  description: "Markup % for Standard tickets (overrides priceIncreasePercentage)"
},
resaleMarkup: {
  type: Number,
  default: null,
  description: "Markup % for Resale tickets (overrides priceIncreasePercentage)"
},

// High quantity bonus (Standard only)
highQuantityThreshold: {
  type: Number,
  default: 8,
  description: "Seat quantity threshold for bonus markup (Standard only)"
},
highQuantityBonusMarkup: {
  type: Number,
  default: 0,
  description: "Bonus markup % added when seats >= threshold (Standard only)"
},

// Minimum cost filter
minimumSeatCost: {
  type: Number,
  default: null,
  description: "Minimum seat cost threshold for CSV export filtering"
},
enableMinimumCostFilter: {
  type: Boolean,
  default: false,
  description: "Enable filtering by minimum seat cost in CSV export"
},
```

### Markup Logic

| Type | Quantity | Base Markup | Bonus | Total |
|------|----------|-------------|-------|-------|
| Standard | 5 seats | 15% | 0% | 15% |
| Standard | 10 seats | 15% | 10% | 25% |
| Resale | 5 seats | 10% | 0% | 10% |
| Resale | 10 seats | 10% | 0% | 10% |

*High quantity bonus only applies to Standard tickets*

### File 2: `app/dashboard/list-event/NewScraper.jsx`

**In formData state, ADD:**
```javascript
standardMarkup: "",
resaleMarkup: "",
highQuantityThreshold: 8,
highQuantityBonusMarkup: "",
minimumSeatCost: "",
enableMinimumCostFilter: false,
```

**In useEffect for edit mode, ADD:**
```javascript
standardMarkup: initialData.standardMarkup ?? "",
resaleMarkup: initialData.resaleMarkup ?? "",
highQuantityThreshold: initialData.highQuantityThreshold ?? 8,
highQuantityBonusMarkup: initialData.highQuantityBonusMarkup ?? "",
minimumSeatCost: initialData.minimumSeatCost || "",
enableMinimumCostFilter: initialData.enableMinimumCostFilter || false,
```

**In handleSubmit eventData, ADD:**
```javascript
standardMarkup: formData.standardMarkup !== "" ? parseFloat(formData.standardMarkup) : null,
resaleMarkup: formData.resaleMarkup !== "" ? parseFloat(formData.resaleMarkup) : null,
highQuantityThreshold: parseInt(formData.highQuantityThreshold) || 8,
highQuantityBonusMarkup: formData.highQuantityBonusMarkup !== "" ? parseFloat(formData.highQuantityBonusMarkup) : 0,
minimumSeatCost: formData.minimumSeatCost ? parseFloat(formData.minimumSeatCost) : null,
enableMinimumCostFilter: formData.enableMinimumCostFilter,
```

**Add Markup Settings UI section (see commit 0c6f93c for full JSX)**

### File 3: `actions/csvActions.tsx`

**Update the $addFields stage in aggregation pipeline:**
```javascript
{
  $addFields: {
    event_url: { $arrayElemAt: ['$eventDetails.URL', 0] },
    includeStandardSeats: { $ifNull: [{ $arrayElemAt: ['$eventDetails.includeStandardSeats', 0] }, true] },
    includeResaleSeats: { $ifNull: [{ $arrayElemAt: ['$eventDetails.includeResaleSeats', 0] }, true] },
    minimumSeatCost: { $arrayElemAt: ['$eventDetails.minimumSeatCost', 0] },
    enableMinimumCostFilter: { $ifNull: [{ $arrayElemAt: ['$eventDetails.enableMinimumCostFilter', 0] }, false] },
    // Markup settings
    priceIncreasePercentage: { $ifNull: [{ $arrayElemAt: ['$eventDetails.priceIncreasePercentage', 0] }, 25] },
    standardMarkup: { $arrayElemAt: ['$eventDetails.standardMarkup', 0] },
    resaleMarkup: { $arrayElemAt: ['$eventDetails.resaleMarkup', 0] },
    highQuantityThreshold: { $ifNull: [{ $arrayElemAt: ['$eventDetails.highQuantityThreshold', 0] }, 8] },
    highQuantityBonusMarkup: { $ifNull: [{ $arrayElemAt: ['$eventDetails.highQuantityBonusMarkup', 0] }, 0] }
  }
}
```

**Add markup calculation function:**
```typescript
function calculateMarkupPercentage(
  isStandard: boolean,
  quantity: number,
  doc: ConsecutiveGroupDocument
): number {
  const defaultMarkup = doc.priceIncreasePercentage ?? 25;
  let baseMarkup: number;

  if (isStandard) {
    baseMarkup = doc.standardMarkup ?? defaultMarkup;
  } else {
    baseMarkup = doc.resaleMarkup ?? defaultMarkup;
  }

  // Add high quantity bonus for Standard tickets only
  let bonusMarkup = 0;
  if (isStandard) {
    const threshold = doc.highQuantityThreshold ?? 8;
    if (quantity >= threshold) {
      bonusMarkup = doc.highQuantityBonusMarkup ?? 0;
    }
  }

  return baseMarkup + bonusMarkup;
}
```

**Update processBatch to use new markup logic:**
```typescript
// Calculate markup based on ticket type and quantity
const markupPercentage = calculateMarkupPercentage(isStandard, quantity, doc);
const listPriceWithMarkup = applyMarkup(inventory?.listPrice || 0, markupPercentage);

// Use in return object:
list_price: Number(listPriceWithMarkup.toFixed(2)),
```

**Add minimum cost filter in processBatch:**
```typescript
// Check minimum cost filter
const enableMinCostFilter = doc.enableMinimumCostFilter === true;
const minCost = doc.minimumSeatCost;
const listingPrice = inventory?.listPrice || 0;

if (enableMinCostFilter && minCost !== null && minCost !== undefined && minCost > 0) {
  if (listingPrice < minCost) {
    return false; // Filter out this listing
  }
}
```

### GitHub Commits
- `36c70fe` - Add minimum seat cost filter for CSV export per event
- `0c6f93c` - Add Standard/Resale markup split with high quantity bonus

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

**Purpose:** Automatically add "-game" to the internal_notes field for events that are approaching their event time.

### Trigger Conditions (whichever comes first):
1. Event is within 24 hours of start time, OR
2. It is 10:00 PM EST the day before the event

### Implementation Files

**File 1: `actions/gameTagActions.ts`**

Contains the core logic:
- `shouldAddGameTag(eventDateTime)` - Checks if event meets trigger conditions
- `autoPopulateGameTag()` - Processes all events and adds "-game" tag
- `previewGameTagEvents()` - Preview which events would be tagged

**File 2: `app/api/game-tag-scheduler/route.ts`**

API route for scheduled job control:
- `GET /api/game-tag-scheduler` - Get scheduler status
- `POST /api/game-tag-scheduler` with actions:
  - `start` - Start the scheduler
  - `stop` - Stop the scheduler
  - `run-now` - Run immediately
  - `preview` - Preview without changes
  - `update-settings` - Update interval settings

**File 3: `models/gameTagSchedulerModel.ts`**

MongoDB model to persist scheduler settings and stats.

### Trigger Logic

```typescript
function shouldAddGameTag(eventDateTime: Date): { shouldTag: boolean; triggerReason: string } {
  const now = new Date();
  const eventDate = new Date(eventDateTime);

  // Condition 1: Within 24 hours
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const isWithin24Hours = eventDate <= twentyFourHoursFromNow;

  // Condition 2: Past 10 PM EST day before
  // 10 PM EST = 03:00 UTC on event day
  const eventDateMidnight = new Date(eventDate);
  eventDateMidnight.setUTCHours(0, 0, 0, 0);
  const tenPmEstTrigger = new Date(eventDateMidnight);
  tenPmEstTrigger.setUTCHours(3, 0, 0, 0);
  const isPastTenPmEst = now >= tenPmEstTrigger;

  if (isWithin24Hours || isPastTenPmEst) {
    return { shouldTag: true, triggerReason: '...' };
  }
  return { shouldTag: false, triggerReason: 'Not yet within trigger window' };
}
```

### Notes Update Logic

```typescript
// Idempotent - won't add if already present
if (currentNotes.includes('-game')) {
  continue; // Skip - already tagged
}

// Append to existing notes
const newNotes = currentNotes.trim()
  ? `${currentNotes.trim()} -game`
  : '-game';
```

### Scheduler Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| isEnabled | false | Whether scheduler is running |
| checkIntervalMinutes | 15 | How often to check events |
| lastRunAt | null | Last execution time |
| nextRunAt | null | Next scheduled execution |

### API Usage Examples

```bash
# Start scheduler with 15-minute interval
curl -X POST /api/game-tag-scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "checkIntervalMinutes": 15}'

# Preview which events would be tagged
curl -X POST /api/game-tag-scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "preview"}'

# Run immediately (manual trigger)
curl -X POST /api/game-tag-scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "run-now"}'

# Stop scheduler
curl -X POST /api/game-tag-scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'
```

### Testing Checklist

- [ ] Start scheduler via API
- [ ] Verify scheduler status shows isRunning: true
- [ ] Create event happening in < 24 hours
- [ ] Wait for scheduler run (or use run-now)
- [ ] Verify "-game" was added to internal_notes
- [ ] Verify events already tagged are skipped
- [ ] Verify past events are not processed
- [ ] Test preview endpoint shows correct events

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

## 2.11 TPTS-034: Investigate Resale Split Type Data Availability

**Status:** Complete (Investigation)

**Findings:** The Ticketmaster API provides a `listingType` field that indicates whether a listing is "Standard" or "Resale". This data is already being captured and stored in the `ConsecutiveGroup` model.

**Data Location:**
- Field: `listingAttributesV2.listingType` in Ticketmaster API response
- Values: `"Standard"` or `"Resale"`
- Stored in: `ConsecutiveGroup.inventory.listingType`

**Usage:** This field is used by TPTS-044 and TPTS-047 to filter CSV exports by ticket type.

---

## 2.12 TPTS-042: Add Ticketmaster URL to CSV internal_notes

**Purpose:** Include the event's Ticketmaster URL in the CSV export's internal_notes field for reference.

### File: `actions/csvActions.tsx`

**Aggregation $addFields already includes:**
```javascript
event_url: { $arrayElemAt: ['$eventDetails.URL', 0] },
```

**Update processBatch internal_notes to include URL:**
```typescript
// Build internal_notes: base tags + event-specific notes + URL
const baseNotes = "-tnow -tmplus";
const eventNotes = doc.event_internal_notes?.trim() || '';
const eventUrl = doc.event_url || '';

// Combine all notes
let internalNotes = baseNotes;
if (eventNotes) {
  internalNotes += ` ${eventNotes}`;
}
if (eventUrl) {
  internalNotes += ` ${eventUrl}`;
}

// Use in return object:
internal_notes: internalNotes,
```

### CSV Output Example
```
internal_notes: "-tnow -tmplus Lakers Game https://www.ticketmaster.com/event/123456"
```

### GitHub Commit
- Part of CSV export enhancements

---

## 2.13 TPTS-043: Multiple Ticketmaster URLs per Event

**Purpose:** Support events that have multiple Ticketmaster listing pages (e.g., general admission + accessible seating).

### File 1: `models/eventModel.js`

**ADD this field (after URL):**
```javascript
additionalURLs: [{
  url: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
}],
```

### File 2: `app/dashboard/list-event/NewScraper.jsx`

**In formData state, ADD:**
```javascript
additionalURLs: [],
```

**In useEffect for edit mode, ADD:**
```javascript
additionalURLs: initialData.additionalURLs || [],
```

**In handleSubmit eventData, ADD:**
```javascript
additionalURLs: formData.additionalURLs,
```

**Add Additional URLs UI section:**
```jsx
{/* Additional URLs */}
<div className="md:col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Additional Ticketmaster URLs
  </label>
  {formData.additionalURLs.map((urlObj, index) => (
    <div key={index} className="flex gap-2 mb-2">
      <input
        type="text"
        placeholder="Label (e.g., 'Accessible')"
        value={urlObj.label}
        onChange={(e) => handleAdditionalUrlChange(index, 'label', e.target.value)}
        className="w-1/3 px-3 py-2 border border-gray-300 rounded-lg"
      />
      <input
        type="url"
        placeholder="https://www.ticketmaster.com/..."
        value={urlObj.url}
        onChange={(e) => handleAdditionalUrlChange(index, 'url', e.target.value)}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
      />
      <button
        type="button"
        onClick={() => removeAdditionalUrl(index)}
        className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </div>
  ))}
  <button
    type="button"
    onClick={addAdditionalUrl}
    className="mt-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2"
  >
    <Plus className="h-4 w-4" />
    Add URL
  </button>
</div>
```

**Add handler functions:**
```javascript
const addAdditionalUrl = () => {
  setFormData(prev => ({
    ...prev,
    additionalURLs: [...prev.additionalURLs, { label: '', url: '' }]
  }));
};

const removeAdditionalUrl = (index) => {
  setFormData(prev => ({
    ...prev,
    additionalURLs: prev.additionalURLs.filter((_, i) => i !== index)
  }));
};

const handleAdditionalUrlChange = (index, field, value) => {
  setFormData(prev => ({
    ...prev,
    additionalURLs: prev.additionalURLs.map((urlObj, i) =>
      i === index ? { ...urlObj, [field]: value } : urlObj
    )
  }));
};
```

### Usage Notes
- Primary URL is still used for scraping
- Additional URLs are informational/for manual reference
- Can be extended to support multi-URL scraping in the future

---

## 2.14 TPTS-044: Exclude Standard Listings with ≤2 Seats from CSV

**Purpose:** Filter out Standard ticket listings with 2 or fewer consecutive seats from CSV export, as these small groups are typically less desirable.

### File: `actions/csvActions.tsx`

**In processBatch function, ADD this filter:**
```typescript
// Exclude Standard listings with 2 or fewer seats
const listingType = doc.inventory?.listingType || 'Standard';
const isStandard = listingType === 'Standard';
const quantity = doc.seats?.length || 0;

if (isStandard && quantity <= 2) {
  return false; // Filter out this listing
}
```

**Filter Logic:**
| Listing Type | Quantity | Included in CSV |
|--------------|----------|-----------------|
| Standard | 1 | ❌ No |
| Standard | 2 | ❌ No |
| Standard | 3+ | ✅ Yes |
| Resale | 1 | ✅ Yes |
| Resale | 2 | ✅ Yes |
| Resale | Any | ✅ Yes |

### Rationale
- Small Standard listings often represent unsold venue inventory
- Buyers generally prefer larger seat groups
- Resale listings are included regardless of quantity (seller inventory varies)

---

## 2.15 TPTS-047: Standard/Resale CSV Export Toggles

**Purpose:** Allow per-event control over whether Standard and/or Resale tickets are included in CSV exports.

### File 1: `models/eventModel.js`

**ADD these fields:**
```javascript
includeStandardSeats: {
  type: Boolean,
  default: true,
  description: "Include Standard ticket listings in CSV export"
},
includeResaleSeats: {
  type: Boolean,
  default: true,
  description: "Include Resale ticket listings in CSV export"
},
```

### File 2: `actions/eventActions.ts`

**ADD this server action:**
```typescript
/**
 * Toggle CSV export settings for an event (includeStandardSeats or includeResaleSeats)
 * This is a lightweight update that doesn't trigger seat deletion
 */
export async function toggleCsvExportSetting(
  eventId: string,
  field: 'includeStandardSeats' | 'includeResaleSeats',
  value: boolean
) {
  if (!eventId || typeof eventId !== 'string') {
    return { error: 'Invalid event ID provided', success: false };
  }

  if (field !== 'includeStandardSeats' && field !== 'includeResaleSeats') {
    return { error: 'Invalid field', success: false };
  }

  await dbConnect();
  try {
    const updateData = { [field]: value };

    const updatedEvent = await Event.findByIdAndUpdate(eventId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedEvent) {
      return { error: 'Event not found', success: false };
    }

    return {
      success: true,
      event: JSON.parse(JSON.stringify(updatedEvent)),
      field,
      value
    };
  } catch (error) {
    console.error('Error toggling CSV export setting:', error);
    return { error: (error as Error).message, success: false };
  }
}
```

### File 3: `app/dashboard/events/EventsTableModern.jsx`

**Add S/R toggle columns to the Events list table:**

```jsx
{/* Standard Toggle Column */}
<td className="px-2 py-3 whitespace-nowrap text-center">
  <button
    onClick={() => handleToggleCsvExport(event._id, 'includeStandardSeats', !event.includeStandardSeats)}
    className={`px-2 py-1 text-xs font-bold rounded ${
      event.includeStandardSeats !== false
        ? 'bg-green-100 text-green-800 hover:bg-green-200'
        : 'bg-red-100 text-red-800 hover:bg-red-200'
    }`}
    title={event.includeStandardSeats !== false ? 'Standard: ON' : 'Standard: OFF'}
  >
    S
  </button>
</td>

{/* Resale Toggle Column */}
<td className="px-2 py-3 whitespace-nowrap text-center">
  <button
    onClick={() => handleToggleCsvExport(event._id, 'includeResaleSeats', !event.includeResaleSeats)}
    className={`px-2 py-1 text-xs font-bold rounded ${
      event.includeResaleSeats !== false
        ? 'bg-green-100 text-green-800 hover:bg-green-200'
        : 'bg-red-100 text-red-800 hover:bg-red-200'
    }`}
    title={event.includeResaleSeats !== false ? 'Resale: ON' : 'Resale: OFF'}
  >
    R
  </button>
</td>
```

### File 4: `actions/csvActions.tsx`

**Update aggregation $addFields:**
```javascript
includeStandardSeats: { $ifNull: [{ $arrayElemAt: ['$eventDetails.includeStandardSeats', 0] }, true] },
includeResaleSeats: { $ifNull: [{ $arrayElemAt: ['$eventDetails.includeResaleSeats', 0] }, true] },
```

**Add filter in processBatch:**
```typescript
// Check Standard/Resale inclusion settings
const listingType = doc.inventory?.listingType || 'Standard';
const isStandard = listingType === 'Standard';
const includeStandard = doc.includeStandardSeats !== false;
const includeResale = doc.includeResaleSeats !== false;

if (isStandard && !includeStandard) {
  return false; // Exclude Standard tickets
}
if (!isStandard && !includeResale) {
  return false; // Exclude Resale tickets
}
```

### UI Appearance in Events Table
| S Button | R Button | Meaning |
|----------|----------|---------|
| Green "S" | Green "R" | Both types included (default) |
| Red "S" | Green "R" | Standard excluded, Resale included |
| Green "S" | Red "R" | Standard included, Resale excluded |
| Red "S" | Red "R" | Both excluded (no CSV output) |

### GitHub Commits
- `d8dd424` - Add Standard/Resale quick toggles to Events list table
- `bae2d44` - Add Standard/Resale seat toggles for CSV export per event

---

## 2.16 TPTS-048: Minimum Seat Cost Filter for CSV Export

**Purpose:** Allow per-event filtering of CSV exports to exclude listings below a minimum cost threshold.

### File 1: `models/eventModel.js`

**ADD these fields:**
```javascript
minimumSeatCost: {
  type: Number,
  default: null,
  description: "Minimum seat cost threshold for CSV export filtering"
},
enableMinimumCostFilter: {
  type: Boolean,
  default: false,
  description: "Enable filtering by minimum seat cost in CSV export"
},
```

### File 2: `actions/eventActions.ts`

**ADD this server action:**
```typescript
/**
 * Update minimum cost filter settings for an event
 * This is a lightweight update that doesn't trigger seat deletion
 */
export async function updateMinimumCostSetting(
  eventId: string,
  field: 'minimumSeatCost' | 'enableMinimumCostFilter',
  value: number | boolean | null
) {
  if (!eventId || typeof eventId !== 'string') {
    return { error: 'Invalid event ID provided', success: false };
  }

  if (field !== 'minimumSeatCost' && field !== 'enableMinimumCostFilter') {
    return { error: 'Invalid field', success: false };
  }

  await dbConnect();
  try {
    const updateData = { [field]: value };

    const updatedEvent = await Event.findByIdAndUpdate(eventId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedEvent) {
      return { error: 'Event not found', success: false };
    }

    return {
      success: true,
      event: JSON.parse(JSON.stringify(updatedEvent)),
      field,
      value
    };
  } catch (error) {
    console.error('Error updating minimum cost setting:', error);
    return { error: (error as Error).message, success: false };
  }
}
```

### File 3: `app/dashboard/list-event/NewScraper.jsx`

**In formData state, ADD:**
```javascript
minimumSeatCost: "",
enableMinimumCostFilter: false,
```

**Add UI section:**
```jsx
{/* Minimum Cost Filter */}
<div className="flex items-end gap-4">
  <div className="flex-1">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Minimum Seat Cost
    </label>
    <div className="relative">
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
      <input
        type="number"
        name="minimumSeatCost"
        value={formData.minimumSeatCost}
        onChange={handleInputChange}
        placeholder="0.00"
        min="0"
        step="0.01"
        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg"
      />
    </div>
  </div>
  <div className="flex items-center gap-2 pb-2">
    <input
      type="checkbox"
      id="enableMinimumCostFilter"
      name="enableMinimumCostFilter"
      checked={formData.enableMinimumCostFilter}
      onChange={(e) => handleInputChange({ target: { name: 'enableMinimumCostFilter', value: e.target.checked } })}
      className="h-4 w-4 text-blue-600 rounded"
    />
    <label htmlFor="enableMinimumCostFilter" className="text-sm text-gray-700">
      Enable filter
    </label>
  </div>
</div>
```

### File 4: `app/dashboard/events/EventsTableModern.jsx`

**Add Min $ column to Events table:**
```jsx
{/* Min $ Column Header */}
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Min $
</th>

{/* Min $ Column Cell */}
<td className="px-4 py-3 whitespace-nowrap">
  <div className="flex items-center gap-2">
    <span className="text-sm text-gray-900">
      {event.minimumSeatCost ? `$${event.minimumSeatCost}` : '-'}
    </span>
    <button
      onClick={() => handleToggleMinCostFilter(event._id, !event.enableMinimumCostFilter)}
      className={`px-2 py-1 text-xs font-bold rounded ${
        event.enableMinimumCostFilter
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      {event.enableMinimumCostFilter ? 'ON' : 'OFF'}
    </button>
  </div>
</td>
```

### File 5: `actions/csvActions.tsx`

**Update aggregation $addFields:**
```javascript
minimumSeatCost: { $arrayElemAt: ['$eventDetails.minimumSeatCost', 0] },
enableMinimumCostFilter: { $ifNull: [{ $arrayElemAt: ['$eventDetails.enableMinimumCostFilter', 0] }, false] },
```

**Add filter in processBatch:**
```typescript
// Check minimum cost filter
const enableMinCostFilter = doc.enableMinimumCostFilter === true;
const minCost = doc.minimumSeatCost;
const listingPrice = inventory?.listPrice || 0;

if (enableMinCostFilter && minCost !== null && minCost !== undefined && minCost > 0) {
  if (listingPrice < minCost) {
    return false; // Filter out listings below minimum cost
  }
}
```

### Filter Logic
| Min Cost | Filter Enabled | Listing Price | Included |
|----------|----------------|---------------|----------|
| $50 | ON | $75 | ✅ Yes |
| $50 | ON | $30 | ❌ No |
| $50 | OFF | $30 | ✅ Yes |
| null | ON | $30 | ✅ Yes |

### GitHub Commit
- `36c70fe` - Add minimum seat cost filter for CSV export per event

---

## 2.17 TPTS-049: High Quantity Bonus Markup (Standard Only)

**Purpose:** Add bonus markup for Standard ticket listings with 8+ seats. This is additive to the base Standard markup.

### File 1: `models/eventModel.js`

**ADD these fields:**
```javascript
highQuantityThreshold: {
  type: Number,
  default: 8,
  description: "Seat quantity threshold for bonus markup (Standard only)"
},
highQuantityBonusMarkup: {
  type: Number,
  default: 0,
  description: "Bonus markup % added when seats >= threshold (Standard only)"
},
```

### File 2: `app/dashboard/list-event/NewScraper.jsx`

**In formData state, ADD:**
```javascript
highQuantityThreshold: 8,
highQuantityBonusMarkup: "",
```

**Add UI section:**
```jsx
{/* High Quantity Bonus (Standard Only) */}
<div className="border-t pt-4 mt-4">
  <h4 className="text-sm font-medium text-gray-700 mb-3">
    High Quantity Bonus (Standard Only)
  </h4>
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="block text-sm text-gray-600 mb-1">
        Threshold (seats)
      </label>
      <input
        type="number"
        name="highQuantityThreshold"
        value={formData.highQuantityThreshold}
        onChange={handleInputChange}
        min="1"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
      />
      <p className="text-xs text-gray-500 mt-1">
        Apply bonus when seats ≥ this
      </p>
    </div>
    <div>
      <label className="block text-sm text-gray-600 mb-1">
        Bonus Markup %
      </label>
      <input
        type="number"
        name="highQuantityBonusMarkup"
        value={formData.highQuantityBonusMarkup}
        onChange={handleInputChange}
        placeholder="0"
        min="0"
        step="0.1"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
      />
      <p className="text-xs text-gray-500 mt-1">
        Added to Standard base markup
      </p>
    </div>
  </div>
</div>
```

### File 3: `actions/csvActions.tsx`

**Update aggregation $addFields:**
```javascript
highQuantityThreshold: { $ifNull: [{ $arrayElemAt: ['$eventDetails.highQuantityThreshold', 0] }, 8] },
highQuantityBonusMarkup: { $ifNull: [{ $arrayElemAt: ['$eventDetails.highQuantityBonusMarkup', 0] }, 0] }
```

**Add markup calculation function:**
```typescript
/**
 * Calculate markup percentage based on ticket type and quantity
 * High quantity bonus ONLY applies to Standard tickets
 */
function calculateMarkupPercentage(
  isStandard: boolean,
  quantity: number,
  doc: ConsecutiveGroupDocument
): number {
  const defaultMarkup = doc.priceIncreasePercentage ?? 25;
  let baseMarkup: number;

  if (isStandard) {
    baseMarkup = doc.standardMarkup ?? defaultMarkup;
  } else {
    baseMarkup = doc.resaleMarkup ?? defaultMarkup;
  }

  // Add high quantity bonus for Standard tickets only
  let bonusMarkup = 0;
  if (isStandard) {
    const threshold = doc.highQuantityThreshold ?? 8;
    if (quantity >= threshold) {
      bonusMarkup = doc.highQuantityBonusMarkup ?? 0;
    }
  }

  return baseMarkup + bonusMarkup;
}
```

**Update processBatch to use new function:**
```typescript
const listingType = doc.inventory?.listingType || 'Standard';
const isStandard = listingType === 'Standard';
const quantity = doc.seats?.length || 0;

// Calculate markup based on ticket type and quantity
const markupPercentage = calculateMarkupPercentage(isStandard, quantity, doc);
const listPriceWithMarkup = applyMarkup(inventory?.listPrice || 0, markupPercentage);
```

### Markup Calculation Examples

**Configuration:**
- Standard Base: 15%
- Resale Base: 10%
- Threshold: 8 seats
- Bonus: 10%

| Type | Qty | Base | Bonus | Total Markup |
|------|-----|------|-------|--------------|
| Standard | 4 | 15% | 0% | **15%** |
| Standard | 8 | 15% | 10% | **25%** |
| Standard | 12 | 15% | 10% | **25%** |
| Resale | 4 | 10% | 0% | **10%** |
| Resale | 8 | 10% | 0% | **10%** |
| Resale | 12 | 10% | 0% | **10%** |

**Key Point:** Bonus markup ONLY applies to Standard tickets, never to Resale.

### GitHub Commit
- `0c6f93c` - Add Standard/Resale markup split with high quantity bonus

---

# PART 3: MONGODB MIGRATION SCRIPT

Run this ONCE after deploying both repos:

```javascript
// Connect to MongoDB and run:

// 1. Set defaults for new markup fields (NO migration needed - fields have defaults)
// priceIncreasePercentage is KEPT as fallback, not removed
// New fields standardMarkup, resaleMarkup default to null (use fallback)
// highQuantityThreshold defaults to 8
// highQuantityBonusMarkup defaults to 0
// minimumSeatCost defaults to null
// enableMinimumCostFilter defaults to false

// Optional: If you want to explicitly set new fields on existing events:
db.events.updateMany(
  { standardMarkup: { $exists: false } },
  {
    $set: {
      standardMarkup: null,
      resaleMarkup: null,
      highQuantityThreshold: 8,
      highQuantityBonusMarkup: 0,
      minimumSeatCost: null,
      enableMinimumCostFilter: false
    }
  }
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

## TPTS-023: Markup Settings (Standard/Resale Split + High Quantity Bonus + Min Cost Filter)
- [ ] Create new event with different standard and resale markup percentages
- [ ] Edit existing event and verify markup fields save correctly
- [ ] Set high quantity threshold (e.g., 8) and bonus markup (e.g., 10%)
- [ ] Generate CSV - verify standard tickets use standardMarkup
- [ ] Generate CSV - verify resale tickets use resaleMarkup
- [ ] Generate CSV - verify Standard tickets with 8+ seats get bonus markup added
- [ ] Generate CSV - verify Resale tickets with 8+ seats do NOT get bonus (Standard only)
- [ ] Set minimum cost (e.g., $50) and enable filter
- [ ] Generate CSV - verify listings below $50 are excluded
- [ ] Disable minimum cost filter - verify all listings are included
- [ ] Test Events list table - Min $ column shows value and ON/OFF toggle

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

## TPTS-042: Ticketmaster URL in CSV
- [ ] Create event with Ticketmaster URL
- [ ] Generate CSV - verify URL appears in internal_notes field
- [ ] Verify format: "-tnow -tmplus [notes] [URL]"

## TPTS-043: Multiple Ticketmaster URLs
- [ ] Create event with primary URL
- [ ] Add additional URLs with labels (e.g., "Accessible")
- [ ] Edit event - verify additional URLs persist
- [ ] Remove an additional URL - verify it's deleted

## TPTS-044: Exclude Standard ≤2 Seats
- [ ] Generate CSV - verify Standard listings with 1-2 seats are excluded
- [ ] Verify Standard listings with 3+ seats ARE included
- [ ] Verify Resale listings with 1-2 seats ARE included (no filter)

## TPTS-047: Standard/Resale CSV Toggles
- [ ] Events table shows "S" and "R" toggle buttons
- [ ] Click S button - toggles green/red
- [ ] Click R button - toggles green/red
- [ ] Set S=OFF, generate CSV - verify no Standard tickets
- [ ] Set R=OFF, generate CSV - verify no Resale tickets
- [ ] Set both ON - verify both types included

## TPTS-048: Minimum Cost Filter
- [ ] Events table shows "Min $" column
- [ ] Set minimum cost (e.g., $50) in Edit Event form
- [ ] Toggle ON in Events table
- [ ] Generate CSV - verify listings below $50 are excluded
- [ ] Toggle OFF - verify all listings included regardless of price

## TPTS-049: High Quantity Bonus
- [ ] Set Standard markup (e.g., 15%) in Edit Event form
- [ ] Set threshold (e.g., 8 seats) and bonus (e.g., 10%)
- [ ] Generate CSV - verify Standard 4-seat listing = 15% markup
- [ ] Verify Standard 8-seat listing = 25% markup (15% + 10%)
- [ ] Verify Resale 8-seat listing = resale markup only (NO bonus)

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

## Additional Task Documentation (Implemented)

| Task ID | Feature | Key Files Modified |
|---------|---------|-------------------|
| TPTS-034 | Resale split type investigation | Investigation only (data in ConsecutiveGroup.inventory.listingType) |
| TPTS-042 | Ticketmaster URL in CSV | `actions/csvActions.tsx` |
| TPTS-043 | Multiple URLs per event | `models/eventModel.js`, `app/dashboard/list-event/NewScraper.jsx` |
| TPTS-044 | Exclude Standard ≤2 seats | `actions/csvActions.tsx` |
| TPTS-047 | Standard/Resale CSV toggles | `models/eventModel.js`, `actions/eventActions.ts`, `actions/csvActions.tsx`, `EventsTableModern.jsx` |
| TPTS-048 | Minimum cost filter | `models/eventModel.js`, `actions/eventActions.ts`, `actions/csvActions.tsx`, `NewScraper.jsx`, `EventsTableModern.jsx` |
| TPTS-049 | High quantity bonus markup | `models/eventModel.js`, `actions/csvActions.tsx`, `NewScraper.jsx` |

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

**Last Updated:** February 12, 2026
**Branch:** claude/add-monday-api-token-rk25G
**Tasks Documented:** TPTS-023 through TPTS-049 (26 tasks total)
