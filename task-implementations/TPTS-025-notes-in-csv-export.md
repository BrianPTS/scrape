# TPTS-025: Include Notes Field in CSV Export

## Overview
Modify the CSV export functionality to include the event's `internal_notes` field.
The notes will be appended to the existing internal_notes value (which currently has "-tnow -tmplus").

## Files to Modify

### 1. actions/csvActions.tsx

#### Update the aggregation pipeline to include event notes:

In the `generateInventoryCsv` function, update the `$addFields` stage to include the event's internal_notes:

```typescript
// Modify the aggregation pipeline
const pipeline = [
  { $match: eventFilter },
  // Join with Event collection to get the Ticketmaster URL and internal_notes
  {
    $lookup: {
      from: 'events',
      localField: 'mapping_id',
      foreignField: 'mapping_id',
      as: 'eventDetails'
    }
  },
  // Add the event URL and internal_notes fields to the document
  {
    $addFields: {
      event_url: { $arrayElemAt: ['$eventDetails.URL', 0] },
      event_internal_notes: { $arrayElemAt: ['$eventDetails.internal_notes', 0] } // ADD this
    }
  },
  { $project: projection },
  { $sort: { _id: 1 } }
];
```

#### Update the projection to include event_internal_notes:

```typescript
const projection = {
  'inventory.inventoryId': 1,
  'event_name': 1,
  'venue_name': 1,
  'event_date': 1,
  'eventId': 1,
  'mapping_id': 1,
  'event_url': 1,
  'event_internal_notes': 1, // ADD this
  'inventory.quantity': 1,
  'inventory.section': 1,
  'inventory.row': 1,
  'seats.number': 1,
  'inventory.barcodes': 1,
  'inventory.tags': 1,
  'inventory.notes': 1,
  'inventory.publicNotes': 1,
  'inventory.listPrice': 1,
  'inventory.face_price': 1,
  'inventory.taxed_cost': 1,
  'inventory.cost': 1,
  'inventory.hideSeatNumbers': 1,
  'inventory.in_hand': 1,
  'inventory.inHandDate': 1,
  'inventory.instant_transfer': 1,
  'inventory.files_available': 1,
  'inventory.splitType': 1,
  'inventory.custom_split': 1,
  'inventory.stockType': 1,
  'inventory.zone': 1,
  'inventory.shown_quantity': 1,
  'inventory.passthrough': 1,
};
```

#### Update the ConsecutiveGroupDocument interface:

```typescript
interface ConsecutiveGroupDocument {
  _id?: string;
  inventory?: {
    inventoryId?: number;
    quantity?: number;
    section?: string;
    row?: string;
    barcodes?: string;
    tags?: string;
    notes?: string;
    publicNotes?: string;
    listPrice?: number;
    face_price?: number;
    taxed_cost?: number;
    cost?: number;
    hideSeatNumbers?: boolean;
    in_hand?: boolean;
    inHandDate?: Date | string;
    instant_transfer?: boolean;
    files_available?: boolean;
    splitType?: string;
    custom_split?: string;
    stockType?: string;
    zone?: boolean;
    shown_quantity?: number;
    passthrough?: string;
  };
  event_name?: string;
  venue_name?: string;
  event_date?: Date | string;
  eventId?: string;
  mapping_id?: string;
  event_url?: string;
  event_internal_notes?: string; // ADD this
  seats?: Array<{ number: string | number }>;
}
```

#### Update the processBatch function to include event notes:

```typescript
async function processBatch(batch: ConsecutiveGroupDocument[]): Promise<CsvRow[]> {
  return batch.map(doc => {
    const inventory = doc.inventory;

    // Pre-compute expensive operations with null safety
    const seatsString = doc.seats && doc.seats.length > 0 ?
      doc.seats.map((seat: { number: string | number }) => seat.number).join(',') : '';
    const eventDateString = doc.event_date ?
      new Date(doc.event_date).toISOString() : '';
    const inHandDateString = inventory?.inHandDate ?
      new Date(inventory.inHandDate).toISOString().slice(0, 10) : '';

    // Calculate split configuration
    const { finalSplitType, customSplit } = calculateSplitConfiguration(
      inventory?.quantity || 0,
      inventory?.splitType
    );

    // Handle SRO rows
    const row = inventory?.row || '';
    const isSRO = row.toUpperCase() === 'SRO';
    const existingPublicNotes = inventory?.publicNotes || '';
    const publicNotes = isSRO
      ? (existingPublicNotes ? `${existingPublicNotes} - STANDING ROOM ONLY` : 'STANDING ROOM ONLY')
      : existingPublicNotes;

    // BUILD INTERNAL NOTES - Combine base notes with event-specific notes
    const baseNotes = "-tnow -tmplus";
    const eventNotes = doc.event_internal_notes?.trim() || '';
    const internalNotes = eventNotes
      ? `${baseNotes} ${eventNotes}`
      : baseNotes;

    return {
      inventory_id: inventory?.inventoryId || 0,
      event_name: doc.event_name || '',
      venue_name: doc.venue_name || '',
      event_date: eventDateString,
      event_id: doc.mapping_id || '',
      quantity: inventory?.quantity || 0,
      section: inventory?.section || '',
      row: inventory?.row || '',
      seats: seatsString,
      barcodes: inventory?.barcodes || '',
      internal_notes: internalNotes, // MODIFIED - now includes event notes
      public_notes: publicNotes,
      tags: (inventory?.splitType === 'NEVERLEAVEONE' ? 'STANDARD' : 'RESALE'),
      list_price: Number(applyPriceIncrease(inventory?.listPrice || 0).toFixed(2)),
      face_price: Number((inventory?.cost || 0).toFixed(2)),
      taxed_cost: Number((inventory?.cost || 0).toFixed(2)),
      cost: Number((inventory?.cost || 0).toFixed(2)),
      hide_seats: inventory?.hideSeatNumbers ? "Y" : "N",
      in_hand: "N",
      in_hand_date: inHandDateString,
      instant_transfer: inventory?.instant_transfer ? "Y" : "N",
      files_available: "N",
      split_type: finalSplitType,
      custom_split: customSplit,
      stock_type: (inventory?.stockType as CsvRow['stock_type']) || "ELECTRONIC",
      zone: "N",
      shown_quantity: inventory?.shown_quantity || undefined,
      passthrough: inventory?.passthrough || ''
    } as CsvRow;
  });
}
```

## Complete Modified processBatch Function

Here's the complete modified function with the notes integration:

```typescript
// Helper function to process batches in parallel
async function processBatch(batch: ConsecutiveGroupDocument[]): Promise<CsvRow[]> {
  return batch.map(doc => {
    const inventory = doc.inventory;

    // Pre-compute expensive operations with null safety
    const seatsString = doc.seats && doc.seats.length > 0 ?
      doc.seats.map((seat: { number: string | number }) => seat.number).join(',') : '';
    const eventDateString = doc.event_date ?
      new Date(doc.event_date).toISOString() : '';
    const inHandDateString = inventory?.inHandDate ?
      new Date(inventory.inHandDate).toISOString().slice(0, 10) : '';

    // Calculate split configuration based on quantity and split type
    const { finalSplitType, customSplit } = calculateSplitConfiguration(
      inventory?.quantity || 0,
      inventory?.splitType
    );

    // Check if row is SRO and handle public notes accordingly
    const row = inventory?.row || '';
    const isSRO = row.toUpperCase() === 'SRO';
    const existingPublicNotes = inventory?.publicNotes || '';
    const publicNotes = isSRO
      ? (existingPublicNotes ? `${existingPublicNotes} - STANDING ROOM ONLY` : 'STANDING ROOM ONLY')
      : existingPublicNotes;

    // Build internal_notes: base platform tags + event-specific notes
    // Base notes are always included for platform tagging
    const baseNotes = "-tnow -tmplus";
    // Event-specific notes come from the event's internal_notes field
    const eventNotes = doc.event_internal_notes?.trim() || '';
    // Combine: if event has notes, append them after base notes
    const internalNotes = eventNotes
      ? `${baseNotes} ${eventNotes}`
      : baseNotes;

    return {
      inventory_id: inventory?.inventoryId || 0,
      event_name: doc.event_name || '',
      venue_name: doc.venue_name || '',
      event_date: eventDateString,
      event_id: doc.mapping_id || '',
      quantity: inventory?.quantity || 0,
      section: inventory?.section || '',
      row: inventory?.row || '',
      seats: seatsString,
      barcodes: inventory?.barcodes || '',
      internal_notes: internalNotes,
      public_notes: publicNotes,
      tags: (inventory?.splitType === 'NEVERLEAVEONE' ? 'STANDARD' : 'RESALE'),
      list_price: Number(applyPriceIncrease(inventory?.listPrice || 0).toFixed(2)),
      face_price: Number((inventory?.cost || 0).toFixed(2)),
      taxed_cost: Number((inventory?.cost || 0).toFixed(2)),
      cost: Number((inventory?.cost || 0).toFixed(2)),
      hide_seats: inventory?.hideSeatNumbers ? "Y" : "N",
      in_hand: "N",
      in_hand_date: inHandDateString,
      instant_transfer: inventory?.instant_transfer ? "Y" : "N",
      files_available: "N",
      split_type: finalSplitType,
      custom_split: customSplit,
      stock_type: (inventory?.stockType as CsvRow['stock_type']) || "ELECTRONIC",
      zone: "N",
      shown_quantity: inventory?.shown_quantity || undefined,
      passthrough: inventory?.passthrough || ''
    } as CsvRow;
  });
}
```

## Example Output

### Event with no internal_notes:
```csv
internal_notes
-tnow -tmplus
```

### Event with internal_notes = "VIP package available":
```csv
internal_notes
-tnow -tmplus VIP package available
```

### Event with internal_notes = "-game Premium seating":
```csv
internal_notes
-tnow -tmplus -game Premium seating
```

## Alternative: Separate Notes Field Option

If you want to keep the base notes separate and have event notes in a different position:

```typescript
// Option A: Event notes BEFORE base notes
const internalNotes = eventNotes
  ? `${eventNotes} ${baseNotes}`
  : baseNotes;

// Option B: Event notes as a completely separate value (overwrite base if present)
const internalNotes = eventNotes || baseNotes;
```

## Testing Checklist

- [ ] Export CSV for event with no internal_notes - should show "-tnow -tmplus"
- [ ] Export CSV for event with internal_notes - should append to base notes
- [ ] Verify notes appear correctly in the internal_notes column
- [ ] Test with special characters in notes (commas, quotes)
- [ ] Test with long notes (approaching 1000 char limit)
- [ ] Verify CSV format is still valid after notes inclusion
