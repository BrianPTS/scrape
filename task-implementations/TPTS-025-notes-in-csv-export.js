/**
 * TPTS-025: Include Notes Field in CSV Export
 *
 * DEPENDENCY: Requires TPTS-024 (Add Notes field) to be completed first.
 *
 * This file contains all code changes needed for this task.
 * Files to modify:
 * 1. actions/csvActions.tsx (scrape repo)
 */

// ============================================================
// PART 1: UPDATE AGGREGATION PIPELINE (actions/csvActions.tsx)
// Around line 410-430
// ============================================================

// Update the $addFields stage to include event's internal_notes:
const updatedAddFields = {
  $addFields: {
    event_url: { $arrayElemAt: ['$eventDetails.URL', 0] },
    event_internal_notes: { $arrayElemAt: ['$eventDetails.internal_notes', 0] } // ADD THIS
  }
};


// ============================================================
// PART 2: UPDATE PROJECTION (actions/csvActions.tsx)
// Around line 371-402
// ============================================================

// ADD to the projection object:
const projectionAddition = {
  'event_internal_notes': 1,
};


// ============================================================
// PART 3: UPDATE INTERFACE (actions/csvActions.tsx)
// Around line 504-539
// ============================================================

// ADD to ConsecutiveGroupDocument interface:
const interfaceAddition = `
  event_internal_notes?: string; // Notes from Event collection
`;


// ============================================================
// PART 4: UPDATE processBatch FUNCTION (actions/csvActions.tsx)
// Around line 592-649
// ============================================================

// Find the line that sets internal_notes (around line 629):
// CURRENT: internal_notes: "-tnow -tmplus",

// REPLACE WITH this logic:
const internalNotesLogic = `
// Build internal_notes: base platform tags + event-specific notes
const baseNotes = "-tnow -tmplus";
const eventNotes = doc.event_internal_notes?.trim() || '';

// Combine: base notes + event notes (if any)
const internalNotes = eventNotes
  ? \`\${baseNotes} \${eventNotes}\`
  : baseNotes;

// Then use in the return object:
internal_notes: internalNotes,
`;


// ============================================================
// COMPLETE UPDATED processBatch SNIPPET
// ============================================================

const updatedProcessBatchSnippet = `
async function processBatch(batch: ConsecutiveGroupDocument[]): Promise<CsvRow[]> {
  return batch.map(doc => {
    const inventory = doc.inventory;

    // Pre-compute values
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
      ? (existingPublicNotes ? \`\${existingPublicNotes} - STANDING ROOM ONLY\` : 'STANDING ROOM ONLY')
      : existingPublicNotes;

    // BUILD INTERNAL NOTES - Combine base notes with event-specific notes
    const baseNotes = "-tnow -tmplus";
    const eventNotes = doc.event_internal_notes?.trim() || '';
    const internalNotes = eventNotes
      ? \`\${baseNotes} \${eventNotes}\`
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
      internal_notes: internalNotes, // UPDATED - now includes event notes
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
`;


// ============================================================
// EXAMPLE CSV OUTPUT
// ============================================================

const exampleOutputs = {
  noNotes: "internal_notes: -tnow -tmplus",
  withNotes: "internal_notes: -tnow -tmplus VIP package available",
  withGameTag: "internal_notes: -tnow -tmplus -game Premium seating"
};

console.log("TPTS-025 Implementation Guide Loaded");
