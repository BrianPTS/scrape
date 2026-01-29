# TPTS-023: Add Separate % Increase Fields for Standard and Resale

## Overview
This implementation adds two separate price increase percentage fields:
- `standardPriceIncreasePercentage` - for standard tickets (splitType: 'NEVERLEAVEONE')
- `resalePriceIncreasePercentage` - for resale tickets (splitType: 'DEFAULT')

## Files to Modify

### 1. models/eventModel.js

Add the new fields to the schema:

```javascript
// Replace the single priceIncreasePercentage field with two separate fields
// REMOVE:
// priceIncreasePercentage: {
//   type: Number,
//   default: 25,
// },

// ADD:
standardPriceIncreasePercentage: {
  type: Number,
  default: 25, // Default 25% markup for standard tickets
},
resalePriceIncreasePercentage: {
  type: Number,
  default: 25, // Default 25% markup for resale tickets
},
```

### 2. app/dashboard/list-event/NewScraper.jsx

Update the form to have two separate input fields:

```jsx
// In the formData state initialization, replace:
// Percentage_Increase_ListCost: 0,

// WITH:
Standard_Percentage_Increase: 25,
Resale_Percentage_Increase: 25,

// In useEffect for initial data loading, replace:
// Percentage_Increase_ListCost: initialData.priceIncreasePercentage || 0,

// WITH:
Standard_Percentage_Increase: initialData.standardPriceIncreasePercentage || 25,
Resale_Percentage_Increase: initialData.resalePriceIncreasePercentage || 25,

// In validationState, replace:
// Percentage_Increase_ListCost: true,

// WITH:
Standard_Percentage_Increase: true,
Resale_Percentage_Increase: true,

// In touchedFields, replace:
// Percentage_Increase_ListCost: false,

// WITH:
Standard_Percentage_Increase: false,
Resale_Percentage_Increase: false,

// In validateForm(), replace:
// Percentage_Increase_ListCost: formData.Percentage_Increase_ListCost >= 0,

// WITH:
Standard_Percentage_Increase: formData.Standard_Percentage_Increase >= 0,
Resale_Percentage_Increase: formData.Resale_Percentage_Increase >= 0,

// In handleSubmit eventData, replace:
// priceIncreasePercentage: formData.Percentage_Increase_ListCost,

// WITH:
standardPriceIncreasePercentage: formData.Standard_Percentage_Increase,
resalePriceIncreasePercentage: formData.Resale_Percentage_Increase,

// Replace the single percentage input field in JSX with two fields:
```

#### New JSX for the two percentage fields (replace the single Percentage_Increase_ListCost field):

```jsx
{/* Standard Ticket Percentage Increase Field */}
<div>
  <label
    htmlFor="Standard_Percentage_Increase"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    Standard Ticket % Increase{" "}
    <span className="text-red-500">*</span>
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
      placeholder="Enter % increase for standard tickets"
      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
        !validationState.Standard_Percentage_Increase &&
        touchedFields.Standard_Percentage_Increase
          ? "border-red-500 bg-red-50"
          : validationState.Standard_Percentage_Increase &&
            formData.Standard_Percentage_Increase
          ? "border-green-500 bg-green-50"
          : "border-gray-300"
      }`}
      disabled={loading}
    />
    {touchedFields.Standard_Percentage_Increase &&
      (validationState.Standard_Percentage_Increase &&
      formData.Standard_Percentage_Increase ? (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>
      ) : !validationState.Standard_Percentage_Increase ? (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
      ) : null)}
  </div>
  {!validationState.Standard_Percentage_Increase &&
    touchedFields.Standard_Percentage_Increase && (
      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Please enter a valid percentage (0 or greater)
      </p>
    )}
  <p className="mt-1 text-xs text-gray-500">
    Price markup for standard tickets (NEVERLEAVEONE split type)
  </p>
</div>

{/* Resale Ticket Percentage Increase Field */}
<div>
  <label
    htmlFor="Resale_Percentage_Increase"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    Resale Ticket % Increase{" "}
    <span className="text-red-500">*</span>
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
      placeholder="Enter % increase for resale tickets"
      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
        !validationState.Resale_Percentage_Increase &&
        touchedFields.Resale_Percentage_Increase
          ? "border-red-500 bg-red-50"
          : validationState.Resale_Percentage_Increase &&
            formData.Resale_Percentage_Increase
          ? "border-green-500 bg-green-50"
          : "border-gray-300"
      }`}
      disabled={loading}
    />
    {touchedFields.Resale_Percentage_Increase &&
      (validationState.Resale_Percentage_Increase &&
      formData.Resale_Percentage_Increase ? (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>
      ) : !validationState.Resale_Percentage_Increase ? (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
      ) : null)}
  </div>
  {!validationState.Resale_Percentage_Increase &&
    touchedFields.Resale_Percentage_Increase && (
      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Please enter a valid percentage (0 or greater)
      </p>
    )}
  <p className="mt-1 text-xs text-gray-500">
    Price markup for resale tickets (DEFAULT/CUSTOM split type)
  </p>
</div>
```

### 3. actions/csvActions.tsx

Update the `processBatch` function to use the appropriate percentage based on ticket type:

```typescript
// In the processBatch function, update the price calculation logic:

// First, we need to pass event data to get the percentage values
// Modify the aggregation pipeline to include event percentage fields:

// In the pipeline $lookup stage, ensure we get the percentage fields:
{
  $addFields: {
    event_url: { $arrayElemAt: ['$eventDetails.URL', 0] },
    standardPriceIncreasePercentage: { $arrayElemAt: ['$eventDetails.standardPriceIncreasePercentage', 0] },
    resalePriceIncreasePercentage: { $arrayElemAt: ['$eventDetails.resalePriceIncreasePercentage', 0] }
  }
}

// Update the projection to include these fields:
const projection = {
  // ... existing fields ...
  'standardPriceIncreasePercentage': 1,
  'resalePriceIncreasePercentage': 1,
};

// Update ConsecutiveGroupDocument interface:
interface ConsecutiveGroupDocument {
  // ... existing fields ...
  standardPriceIncreasePercentage?: number;
  resalePriceIncreasePercentage?: number;
}

// In processBatch function, update the price calculation:
async function processBatch(batch: ConsecutiveGroupDocument[]): Promise<CsvRow[]> {
  return batch.map(doc => {
    const inventory = doc.inventory;

    // Determine if this is a resale ticket (splitType === 'DEFAULT')
    const isResale = inventory?.splitType === 'DEFAULT';

    // Get the appropriate percentage based on ticket type
    const priceIncreasePercentage = isResale
      ? (doc.resalePriceIncreasePercentage || 25)
      : (doc.standardPriceIncreasePercentage || 25);

    // Apply the price increase
    const listPrice = inventory?.listPrice || 0;
    const adjustedPrice = listPrice * (1 + priceIncreasePercentage / 100);

    // ... rest of the mapping logic ...

    return {
      // ... other fields ...
      list_price: Number(adjustedPrice.toFixed(2)),
      // ... other fields ...
    } as CsvRow;
  });
}
```

### 4. actions/eventActions.ts

Update the `updateEvent` function to handle both percentage fields:

```typescript
export async function updateEvent(
  eventId: string,
  updateData: Partial<Event> & {
    Skip_Scraping?: boolean;
    standardPriceIncreasePercentage?: number;
    resalePriceIncreasePercentage?: number;
  },
  deleteSeatGroups: boolean = false
) {
  // ... existing validation ...

  // Check if we're updating either price percentage
  const isUpdatingStandardPercentage = updateData.standardPriceIncreasePercentage !== undefined &&
                              updateData.standardPriceIncreasePercentage !== currentEvent.standardPriceIncreasePercentage;
  const isUpdatingResalePercentage = updateData.resalePriceIncreasePercentage !== undefined &&
                              updateData.resalePriceIncreasePercentage !== currentEvent.resalePriceIncreasePercentage;

  const shouldDeleteSeats = deleteSeatGroups || isStoppingScraping || isUpdatingStandardPercentage || isUpdatingResalePercentage;

  // ... rest of the function ...
}
```

## Migration Script

For existing events with the old single `priceIncreasePercentage` field:

```javascript
// Run this migration script to update existing events
// Can be run in MongoDB shell or via Node.js

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
```

## Testing Checklist

- [ ] Create new event with different standard and resale percentages
- [ ] Edit existing event and verify both fields save correctly
- [ ] Generate CSV and verify standard tickets use standard percentage
- [ ] Generate CSV and verify resale tickets use resale percentage
- [ ] Verify migration script works for existing events
- [ ] Test that changing either percentage triggers seat group deletion
