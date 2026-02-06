/**
 * TPTS-033: Always Use Highest Price When Multiple Offers Exist
 *
 * PROBLEM:
 * When a seat has multiple price offers (e.g., Standard $45 + Kids $0),
 * we need to ensure the HIGHEST price is always used in the CSV.
 *
 * WHERE THE FIX GOES:
 * Playwright repo - scraper.js or wherever offers are processed
 *
 * Files to modify in PLAYWRIGHT repo:
 * 1. scraper.js - where Facet API response is processed
 */

// ============================================================
// UNDERSTANDING THE DATA STRUCTURE
// ============================================================

/**
 * Ticketmaster Facet API returns offers for each seat.
 * A single seat can have MULTIPLE offers with different prices:
 *
 * Example from screenshot:
 * Section 146, Row 15, Seat 7:
 *   - Offer 1: "Standard Admission (Ages 13+)" - $45.00
 *   - Offer 2: "Kids Tickets by Ticketmaster (Ages 0-12)" - $0.00
 *
 * We want to ALWAYS use the HIGHEST price ($45.00)
 */


// ============================================================
// SOLUTION: Update offer processing in scraper.js
// ============================================================

/**
 * When processing offers for a seat, find the one with the highest price.
 *
 * FIND the section in scraper.js where offers are processed.
 * It likely looks something like this:
 */

// BEFORE (example - might vary based on actual code):
// const offer = seat.offers[0]; // Takes first offer
// const listPrice = offer.price;

// AFTER - Use highest price:
function getHighestPriceOffer(offers) {
  if (!offers || offers.length === 0) {
    return null;
  }

  // Find offer with highest price
  return offers.reduce((highest, current) => {
    const currentPrice = current.price || current.listPrice || current.rawPrice || 0;
    const highestPrice = highest.price || highest.listPrice || highest.rawPrice || 0;
    return currentPrice > highestPrice ? current : highest;
  }, offers[0]);
}

// Usage:
// const offer = getHighestPriceOffer(seat.offers);
// const listPrice = offer?.price || offer?.listPrice || 0;


// ============================================================
// ALTERNATIVE: Fix in the Facet data processing
// ============================================================

/**
 * The Facet API response structure typically looks like:
 * {
 *   facets: [
 *     {
 *       offers: [
 *         { offerId: "xxx", price: 45.00, name: "Standard Admission" },
 *         { offerId: "yyy", price: 0.00, name: "Kids Tickets" }
 *       ],
 *       places: ["seatId1", "seatId2", ...]
 *     }
 *   ]
 * }
 *
 * Or it might be structured per-seat:
 * {
 *   seats: [
 *     {
 *       id: "seatId",
 *       offers: [
 *         { price: 45.00 },
 *         { price: 0.00 }
 *       ]
 *     }
 *   ]
 * }
 */

// Generic function to extract highest price from any offer structure
function extractHighestPrice(offerData) {
  // Handle array of offers
  if (Array.isArray(offerData)) {
    const prices = offerData
      .map(o => parseFloat(o.price || o.listPrice || o.rawPrice || o.total || 0))
      .filter(p => !isNaN(p) && p > 0);

    if (prices.length === 0) return 0;
    return Math.max(...prices);
  }

  // Handle single offer object
  if (typeof offerData === 'object' && offerData !== null) {
    return parseFloat(offerData.price || offerData.listPrice || offerData.rawPrice || 0);
  }

  // Handle direct price value
  if (typeof offerData === 'number') {
    return offerData;
  }

  return 0;
}


// ============================================================
// WHERE TO LOOK IN SCRAPER.JS
// ============================================================

/**
 * Search for these patterns in the playwright scraper:
 *
 * 1. Where offers are extracted:
 *    - Search for: "offers"
 *    - Search for: "listPrice"
 *    - Search for: "price"
 *    - Search for: "facet"
 *
 * 2. Where seat data is built:
 *    - Look for where ConsecutiveGroup or inventory objects are created
 *    - Find where listPrice is assigned
 *
 * 3. The fix should be applied where the seat's price is determined
 *    BEFORE it gets saved to the database
 */


// ============================================================
// EXAMPLE INTEGRATION
// ============================================================

/**
 * If the current code looks like this:
 *
 * ```javascript
 * // Processing each seat from Facet API
 * for (const seat of seatsData) {
 *   const seatInfo = {
 *     section: seat.section,
 *     row: seat.row,
 *     seatNumber: seat.seatNumber,
 *     listPrice: seat.offers[0]?.price || 0,  // <-- PROBLEM: Takes first offer
 *     // ...other fields
 *   };
 * }
 * ```
 *
 * Change it to:
 *
 * ```javascript
 * // Processing each seat from Facet API
 * for (const seat of seatsData) {
 *   // Get highest price from all offers
 *   const highestPrice = extractHighestPrice(seat.offers);
 *
 *   const seatInfo = {
 *     section: seat.section,
 *     row: seat.row,
 *     seatNumber: seat.seatNumber,
 *     listPrice: highestPrice,  // <-- FIX: Uses highest price
 *     // ...other fields
 *   };
 * }
 * ```
 */


// ============================================================
// EXPORT FOR USE IN SCRAPER
// ============================================================

module.exports = {
  getHighestPriceOffer,
  extractHighestPrice
};

// Or for ES modules:
// export { getHighestPriceOffer, extractHighestPrice };


// ============================================================
// TESTING
// ============================================================

// Test cases
const testCases = [
  {
    name: "Multiple offers - should return 45",
    offers: [
      { price: 45.00, name: "Standard Admission" },
      { price: 0.00, name: "Kids Tickets" }
    ],
    expected: 45.00
  },
  {
    name: "Single offer - should return that price",
    offers: [
      { price: 125.00, name: "Standard" }
    ],
    expected: 125.00
  },
  {
    name: "Three offers - should return highest",
    offers: [
      { price: 50.00, name: "Standard" },
      { price: 75.00, name: "VIP" },
      { price: 0.00, name: "Kids" }
    ],
    expected: 75.00
  },
  {
    name: "Empty offers - should return 0",
    offers: [],
    expected: 0
  }
];

// Run tests
console.log("Testing extractHighestPrice function:\n");
testCases.forEach(test => {
  const result = extractHighestPrice(test.offers);
  const passed = result === test.expected;
  console.log(`${passed ? '✅' : '❌'} ${test.name}`);
  console.log(`   Expected: ${test.expected}, Got: ${result}\n`);
});
