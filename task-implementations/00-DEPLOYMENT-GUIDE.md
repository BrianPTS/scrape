# Deployment Guide - Sprint 1 Tasks

## Repository Overview

| Repo | URL | Purpose |
|------|-----|---------|
| **scrape** | github.com/BrianPTS/scrape | TMC Portal (Next.js frontend) |
| **playwright** | github.com/abdulsamad2/playwright | Backend scraper |

**Both repos share the same MongoDB database**, so model changes must be synchronized.

---

## Changes by Repository

### PLAYWRIGHT REPO (abdulsamad2/playwright)

Only the Event model needs to change:

| File | Changes |
|------|---------|
| `models/eventModel.js` | Add: `standardPriceIncreasePercentage`, `resalePriceIncreasePercentage`, `internal_notes`, `venue_type`. Remove: `priceIncreasePercentage` |

See: `PLAYWRIGHT-REPO-eventModel-changes.js` for complete code.

---

### SCRAPE REPO (BrianPTS/scrape)

| Task | Files to Modify |
|------|-----------------|
| TPTS-023 | `models/eventModel.js`, `app/dashboard/list-event/NewScraper.jsx`, `actions/csvActions.tsx` |
| TPTS-024 | `models/eventModel.js`, `app/dashboard/list-event/NewScraper.jsx` |
| TPTS-025 | `actions/csvActions.tsx` |
| TPTS-026 | `actions/eventActions.ts`, `app/dashboard/events/page.js`, `app/dashboard/events/EventsTableModern.jsx` |
| TPTS-027 | `models/eventModel.js`, `app/dashboard/list-event/NewScraper.jsx` |
| Auto -game | `app/dashboard/list-event/NewScraper.jsx`, `actions/csvActions.tsx` |

---

## Deployment Order

1. **Update playwright repo** - `models/eventModel.js`
2. **Update scrape repo** - All files listed above
3. **Deploy both repos** (can be simultaneous)
4. **Run migration script** (see below)
5. **Verify** - Check MongoDB and test the portal

---

## MongoDB Migration Script

Run this ONCE after deploying both repos:

```javascript
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

// 3. Set default venue_type
db.events.updateMany(
  { venue_type: { $exists: false } },
  { $set: { venue_type: "other" } }
);

// 4. Set default internal_notes
db.events.updateMany(
  { internal_notes: { $exists: false } },
  { $set: { internal_notes: "" } }
);
```

---

## File Index

| File | Description |
|------|-------------|
| `TPTS-023-separate-percentage-fields.js` | Separate % fields for Standard/Resale |
| `TPTS-024-add-notes-field.js` | Add Notes to Edit Event form |
| `TPTS-025-notes-in-csv-export.js` | Include Notes in CSV export |
| `TPTS-026-bulk-edit-functionality.js` | Bulk edit for Events page |
| `TPTS-027-venue-type-dropdown.js` | Venue Type dropdown |
| `AUTO-POPULATE-game-tag.js` | Auto -game tag for sports events |
| `PLAYWRIGHT-REPO-eventModel-changes.js` | **Complete eventModel.js for playwright repo** |
