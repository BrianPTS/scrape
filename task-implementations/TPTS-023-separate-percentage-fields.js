/**
 * TPTS-023: Add Separate % Increase Fields for Standard and Resale
 *
 * This file contains all code changes needed for this task.
 * Files to modify:
 * 1. models/eventModel.js (BOTH repos: scrape + playwright)
 * 2. app/dashboard/list-event/NewScraper.jsx (scrape repo)
 * 3. actions/csvActions.tsx (scrape repo)
 */

// ============================================================
// PART 1: EVENT MODEL CHANGES (models/eventModel.js)
// Apply to BOTH repos: /scrape/models/eventModel.js AND /playwright/models/eventModel.js
// ============================================================

// REMOVE this field:
/*
priceIncreasePercentage: {
  type: Number,
  default: 35,
},
*/

// REPLACE WITH these two fields:
const newPriceFields = {
  standardPriceIncreasePercentage: {
    type: Number,
    default: 35, // Default 35% markup for standard tickets
  },
  resalePriceIncreasePercentage: {
    type: Number,
    default: 35, // Default 35% markup for resale tickets
  },
};


// ============================================================
// PART 2: FORM CHANGES (app/dashboard/list-event/NewScraper.jsx)
// ============================================================

// 2A. Update formData state initialization (around line 20-32)
// REPLACE: Percentage_Increase_ListCost: 0,
// WITH:
const formDataChanges = {
  Standard_Percentage_Increase: 35,
  Resale_Percentage_Increase: 35,
};

// 2B. Update useEffect for edit mode (around line 35-57)
// REPLACE: Percentage_Increase_ListCost: initialData.priceIncreasePercentage || 0,
// WITH:
const useEffectChanges = {
  Standard_Percentage_Increase: initialData.standardPriceIncreasePercentage || 35,
  Resale_Percentage_Increase: initialData.resalePriceIncreasePercentage || 35,
};

// 2C. Update validationState (around line 62-72)
// REPLACE: Percentage_Increase_ListCost: true,
// WITH:
const validationStateChanges = {
  Standard_Percentage_Increase: true,
  Resale_Percentage_Increase: true,
};

// 2D. Update touchedFields (around line 73-83)
// REPLACE: Percentage_Increase_ListCost: false,
// WITH:
const touchedFieldsChanges = {
  Standard_Percentage_Increase: false,
  Resale_Percentage_Increase: false,
};

// 2E. Update validateForm function (around line 271-298)
// REPLACE: Percentage_Increase_ListCost: formData.Percentage_Increase_ListCost >= 0,
// WITH:
const validateFormChanges = {
  Standard_Percentage_Increase: formData.Standard_Percentage_Increase >= 0,
  Resale_Percentage_Increase: formData.Resale_Percentage_Increase >= 0,
};

// 2F. Update handleSubmit eventData (around line 406-419)
// REPLACE: priceIncreasePercentage: formData.Percentage_Increase_ListCost,
// WITH:
const eventDataChanges = {
  standardPriceIncreasePercentage: formData.Standard_Percentage_Increase,
  resalePriceIncreasePercentage: formData.Resale_Percentage_Increase,
};

// 2G. NEW JSX - Replace the single Percentage_Increase_ListCost field (around line 939-995)
// with these TWO fields:

const StandardPercentageFieldJSX = `
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
      className={\`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors \${
        !validationState.Standard_Percentage_Increase && touchedFields.Standard_Percentage_Increase
          ? "border-red-500 bg-red-50"
          : validationState.Standard_Percentage_Increase && formData.Standard_Percentage_Increase
          ? "border-green-500 bg-green-50"
          : "border-gray-300"
      }\`}
      disabled={loading}
    />
  </div>
  <p className="mt-1 text-xs text-gray-500">
    Markup % for standard/list pricing
  </p>
</div>
`;

const ResalePercentageFieldJSX = `
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
      className={\`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors \${
        !validationState.Resale_Percentage_Increase && touchedFields.Resale_Percentage_Increase
          ? "border-red-500 bg-red-50"
          : validationState.Resale_Percentage_Increase && formData.Resale_Percentage_Increase
          ? "border-green-500 bg-green-50"
          : "border-gray-300"
      }\`}
      disabled={loading}
    />
  </div>
  <p className="mt-1 text-xs text-gray-500">
    Markup % for resale pricing
  </p>
</div>
`;


// ============================================================
// PART 3: CSV EXPORT CHANGES (actions/csvActions.tsx)
// ============================================================

// 3A. Update the aggregation pipeline $addFields (around line 420-425)
const pipelineAddFields = {
  $addFields: {
    event_url: { $arrayElemAt: ['$eventDetails.URL', 0] },
    standardPriceIncreasePercentage: { $arrayElemAt: ['$eventDetails.standardPriceIncreasePercentage', 0] },
    resalePriceIncreasePercentage: { $arrayElemAt: ['$eventDetails.resalePriceIncreasePercentage', 0] }
  }
};

// 3B. Update ConsecutiveGroupDocument interface (around line 504-539)
// ADD these fields:
const interfaceAdditions = `
  standardPriceIncreasePercentage?: number;
  resalePriceIncreasePercentage?: number;
`;

// 3C. Update processBatch function - price calculation (around line 592-649)
// REPLACE the applyPriceIncrease call with this logic:
const processBatchPriceLogic = `
// Determine if this is a resale ticket (splitType === 'DEFAULT')
const isResale = inventory?.splitType === 'DEFAULT';

// Get the appropriate percentage based on ticket type
const priceIncreasePercentage = isResale
  ? (doc.resalePriceIncreasePercentage || 35)
  : (doc.standardPriceIncreasePercentage || 35);

// Calculate the adjusted price
const listPrice = inventory?.listPrice || 0;
const adjustedPrice = listPrice * (1 + priceIncreasePercentage / 100);

// Use adjustedPrice instead of applyPriceIncrease(inventory?.listPrice || 0)
list_price: Number(adjustedPrice.toFixed(2)),
`;


// ============================================================
// PART 4: MIGRATION SCRIPT (run in MongoDB)
// ============================================================

const migrationScript = `
// Run this in MongoDB to migrate existing events
db.events.updateMany(
  { priceIncreasePercentage: { $exists: true } },
  [
    {
      $set: {
        standardPriceIncreasePercentage: "$priceIncreasePercentage",
        resalePriceIncreasePercentage: "$priceIncreasePercentage"
      }
    },
    {
      $unset: "priceIncreasePercentage"
    }
  ]
);
`;

console.log("TPTS-023 Implementation Guide Loaded");
