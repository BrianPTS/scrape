/**
 * DEBUG: Investigate Resale Split Type Data from Ticketmaster
 *
 * PURPOSE:
 * Determine if Ticketmaster's internal endpoints provide split configuration
 * for resale tickets (e.g., "must buy all 4" vs "can buy 2 or 4").
 *
 * INSTRUCTIONS FOR DEVELOPER:
 *
 * 1. Apply this debug code to the playwright repo
 * 2. Run a scrape on an event that has RESALE tickets
 * 3. Check the console output for the debug information
 * 4. Share the output with me so I can determine if split data is available
 *
 * ============================================================
 * STEP 1: Add this code to scraper.js
 * ============================================================
 *
 * Find this line (around line 1050):
 *   console.log(`API requests completed for event ${eventId} in ${Date.now() - startTime}ms`);
 *
 * Add the following code AFTER that line:
 */

// ============================================================
// DEBUG CODE TO ADD TO scraper.js (after "API requests completed" log)
// ============================================================

const DEBUG_CODE_FOR_SCRAPER = `
    // ===== START DEBUG: Resale Split Investigation =====
    const offers = DataFacets?._embedded?.offer || [];
    const facets = DataFacets?.facets || [];

    if (offers.length > 0) {
      console.log('\\n' + '='.repeat(80));
      console.log('[DEBUG] RESALE SPLIT INVESTIGATION - Event ' + eventId);
      console.log('='.repeat(80));

      // Find resale offers
      const resaleOffers = offers.filter(o => o.inventoryType?.toLowerCase() === 'resale');
      const primaryOffers = offers.filter(o => o.inventoryType?.toLowerCase() !== 'resale');

      console.log('\\nTotal offers: ' + offers.length);
      console.log('Resale offers: ' + resaleOffers.length);
      console.log('Primary offers: ' + primaryOffers.length);

      // Log ALL fields available in a resale offer
      if (resaleOffers.length > 0) {
        console.log('\\n--- RESALE OFFER SAMPLE (FULL OBJECT) ---');
        console.log(JSON.stringify(resaleOffers[0], null, 2));

        console.log('\\n--- ALL RESALE OFFER FIELD NAMES ---');
        const resaleFields = Object.keys(resaleOffers[0]);
        resaleFields.forEach(field => {
          const value = resaleOffers[0][field];
          const valueType = Array.isArray(value) ? 'array' : typeof value;
          console.log('  ' + field + ': ' + valueType);
        });

        // Look specifically for split-related fields
        console.log('\\n--- SEARCHING FOR SPLIT-RELATED FIELDS ---');
        const splitKeywords = ['split', 'quantity', 'min', 'max', 'sell', 'config', 'rule', 'group', 'must', 'allow'];
        resaleFields.forEach(field => {
          const fieldLower = field.toLowerCase();
          if (splitKeywords.some(kw => fieldLower.includes(kw))) {
            console.log('  POTENTIAL SPLIT FIELD: ' + field + ' = ' + JSON.stringify(resaleOffers[0][field]));
          }
        });
      }

      // Log a primary offer for comparison
      if (primaryOffers.length > 0) {
        console.log('\\n--- PRIMARY OFFER SAMPLE (FULL OBJECT) ---');
        console.log(JSON.stringify(primaryOffers[0], null, 2));
      }

      // Check facets structure for any split data
      if (facets.length > 0) {
        console.log('\\n--- FACET STRUCTURE SAMPLE ---');
        const sampleFacet = facets[0];
        console.log('Facet fields: ' + Object.keys(sampleFacet).join(', '));

        // Look for resale facets
        const resaleFacet = facets.find(f =>
          f.inventoryTypes?.includes('resale') ||
          f.offers?.some(o => offers.find(off => off.offerId === o)?.inventoryType === 'resale')
        );

        if (resaleFacet) {
          console.log('\\n--- RESALE FACET SAMPLE ---');
          console.log(JSON.stringify(resaleFacet, null, 2));
        }
      }

      // Log all unique field names across ALL offers
      console.log('\\n--- ALL UNIQUE FIELD NAMES ACROSS ALL OFFERS ---');
      const allFields = new Set();
      offers.forEach(o => Object.keys(o).forEach(k => allFields.add(k)));
      console.log([...allFields].sort().join(', '));

      console.log('\\n' + '='.repeat(80));
      console.log('[DEBUG] END RESALE SPLIT INVESTIGATION');
      console.log('='.repeat(80) + '\\n');
    }
    // ===== END DEBUG: Resale Split Investigation =====
`;

// ============================================================
// WHAT TO LOOK FOR IN THE OUTPUT
// ============================================================

const WHAT_TO_LOOK_FOR = `
WHAT TO LOOK FOR IN THE DEBUG OUTPUT:

1. SPLIT-RELATED FIELDS:
   Look for any fields containing these keywords:
   - splitRules, splitType, splitConfiguration
   - minQuantity, maxQuantity, quantityRules
   - sellConfiguration, sellingRules
   - mustBuyAll, allowedSplits
   - ticketGrouping, groupRules

2. QUANTITY FIELDS:
   - quantity, availableQuantities
   - Any array of numbers like [2, 4] meaning "can buy 2 or 4"

3. COMPARE PRIMARY vs RESALE:
   - Primary tickets have 'ticketTypeUnsoldQualifier' for pack holds
   - Does resale have an equivalent field?

4. NESTED OBJECTS:
   - Check if there's a nested object like 'sellConfig' or 'rules'

EXAMPLE OUTPUT THAT WOULD MEAN SPLIT DATA EXISTS:
{
  "offerId": "xxx",
  "inventoryType": "resale",
  "sellConfiguration": {
    "allowedQuantities": [2, 4],
    "mustSellAll": false
  }
}

EXAMPLE OUTPUT THAT WOULD MEAN SPLIT DATA DOES NOT EXIST:
{
  "offerId": "xxx",
  "inventoryType": "resale",
  "faceValue": 150,
  "charges": [...],
  // No split-related fields
}
`;

// ============================================================
// ALTERNATIVE: Save to file instead of console
// ============================================================

const SAVE_TO_FILE_VERSION = `
    // Save debug output to file for easier review
    const debugOutput = {
      eventId: eventId,
      timestamp: new Date().toISOString(),
      totalOffers: offers.length,
      resaleOffers: offers.filter(o => o.inventoryType?.toLowerCase() === 'resale'),
      primaryOffers: offers.filter(o => o.inventoryType?.toLowerCase() !== 'resale'),
      sampleFacet: DataFacets?.facets?.[0] || null,
      allFieldNames: [...new Set(offers.flatMap(o => Object.keys(o)))].sort()
    };

    const fs = require('fs');
    const debugPath = \`debug/resale-split-investigation-\${eventId}.json\`;
    fs.mkdirSync('debug', { recursive: true });
    fs.writeFileSync(debugPath, JSON.stringify(debugOutput, null, 2));
    console.log('[DEBUG] Resale split investigation saved to: ' + debugPath);
`;

// ============================================================
// COMPLETE PATCH FILE
// ============================================================

console.log(`
================================================================================
DEBUG: RESALE SPLIT INVESTIGATION
================================================================================

This file contains debug code to investigate whether Ticketmaster provides
split configuration data for resale tickets.

INSTRUCTIONS:

1. Open playwright repo: helpers/scraper.js

2. Find this line (around line 1050):
   console.log(\`API requests completed for event \${eventId} in \${Date.now() - startTime}ms\`);

3. Add the debug code AFTER that line (see DEBUG_CODE_FOR_SCRAPER above)

4. Run a scrape on an event WITH RESALE TICKETS

5. Check the console output for:
   - [DEBUG] RESALE SPLIT INVESTIGATION
   - Look for any split-related fields

6. Share the output so we can determine if split data is available

================================================================================
`);

module.exports = {
  DEBUG_CODE_FOR_SCRAPER,
  WHAT_TO_LOOK_FOR,
  SAVE_TO_FILE_VERSION
};
