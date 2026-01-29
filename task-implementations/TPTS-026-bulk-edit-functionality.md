# TPTS-026: Add Bulk Edit Functionality to Events Page

## Overview
Add the ability to select multiple events and edit common fields (like price percentages, notes, scraping status) for all selected events at once.

## Files to Modify/Create

### 1. actions/eventActions.ts - Add bulkUpdateEvents function

```typescript
/**
 * Updates multiple events at once with the same data.
 * @param {string[]} eventIds - Array of event IDs to update.
 * @param {object} updateData - The data to apply to all events.
 * @returns {Promise<object>} Result with success count and any errors.
 */
export async function bulkUpdateEvents(
  eventIds: string[],
  updateData: {
    priceIncreasePercentage?: number;
    standardPriceIncreasePercentage?: number;
    resalePriceIncreasePercentage?: number;
    internal_notes?: string;
    Skip_Scraping?: boolean;
    Zone?: string;
  }
) {
  // Input validation
  if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
    return { error: 'No event IDs provided', success: false };
  }

  if (!updateData || typeof updateData !== 'object') {
    return { error: 'Invalid update data provided', success: false };
  }

  await dbConnect();

  try {
    const results = {
      success: true,
      updated: 0,
      failed: 0,
      errors: [] as string[],
      deletedSeatGroups: 0,
    };

    // Check if we need to delete seat groups (price change or stopping scraping)
    const shouldDeleteSeats =
      updateData.priceIncreasePercentage !== undefined ||
      updateData.standardPriceIncreasePercentage !== undefined ||
      updateData.resalePriceIncreasePercentage !== undefined ||
      updateData.Skip_Scraping === true;

    // Get all events being updated to get their Event_IDs for seat deletion
    if (shouldDeleteSeats) {
      const eventsToUpdate = await Event.find(
        { _id: { $in: eventIds } },
        { Event_ID: 1 }
      );
      const eventIdStrings = eventsToUpdate.map(e => e.Event_ID);

      // Delete seat groups for all affected events
      const seatDeletionResult = await deleteConsecutiveGroupsByEventIds(eventIdStrings);
      results.deletedSeatGroups = seatDeletionResult.deletedCount || 0;
    }

    // Perform bulk update
    const updateResult = await Event.updateMany(
      { _id: { $in: eventIds } },
      { $set: updateData }
    );

    results.updated = updateResult.modifiedCount;

    return {
      success: true,
      message: `Successfully updated ${results.updated} events${results.deletedSeatGroups > 0 ? `. Deleted ${results.deletedSeatGroups} seat groups.` : ''}.`,
      ...results,
    };
  } catch (error) {
    console.error('Error in bulk update:', error);
    return {
      success: false,
      error: (error as Error).message || 'Failed to bulk update events',
      updated: 0,
      failed: eventIds.length,
    };
  }
}
```

### 2. app/dashboard/events/page.js - Add bulk selection and edit UI

#### Add new state variables:

```jsx
// Add these state variables after existing ones
const [selectedEvents, setSelectedEvents] = useState(new Set());
const [showBulkEditModal, setShowBulkEditModal] = useState(false);
const [bulkEditLoading, setBulkEditLoading] = useState(false);
const [bulkEditData, setBulkEditData] = useState({
  priceIncreasePercentage: '',
  internal_notes: '',
  Skip_Scraping: null, // null means no change
});
```

#### Add import for bulkUpdateEvents:

```jsx
import { getAllEvents, updateEvent, updateAllEvents, deleteEvent, bulkUpdateEvents } from '@/actions/eventActions';
```

#### Add selection handlers:

```jsx
// Toggle single event selection
const toggleEventSelection = (eventId) => {
  setSelectedEvents(prev => {
    const newSet = new Set(prev);
    if (newSet.has(eventId)) {
      newSet.delete(eventId);
    } else {
      newSet.add(eventId);
    }
    return newSet;
  });
};

// Select all events on current page
const selectAllOnPage = () => {
  const pageEventIds = paginatedEvents.map(e => e._id);
  setSelectedEvents(prev => {
    const newSet = new Set(prev);
    pageEventIds.forEach(id => newSet.add(id));
    return newSet;
  });
};

// Deselect all events
const deselectAll = () => {
  setSelectedEvents(new Set());
};

// Check if all on page are selected
const allOnPageSelected = paginatedEvents.length > 0 &&
  paginatedEvents.every(e => selectedEvents.has(e._id));

// Handle bulk edit submission
const handleBulkEdit = async () => {
  if (selectedEvents.size === 0) return;

  setBulkEditLoading(true);
  try {
    const updateData = {};

    // Only include fields that have been set
    if (bulkEditData.priceIncreasePercentage !== '') {
      updateData.priceIncreasePercentage = Number(bulkEditData.priceIncreasePercentage);
    }
    if (bulkEditData.internal_notes !== '') {
      updateData.internal_notes = bulkEditData.internal_notes;
    }
    if (bulkEditData.Skip_Scraping !== null) {
      updateData.Skip_Scraping = bulkEditData.Skip_Scraping;
    }

    if (Object.keys(updateData).length === 0) {
      alert('Please set at least one field to update');
      return;
    }

    const result = await bulkUpdateEvents(Array.from(selectedEvents), updateData);

    if (result.success) {
      // Refresh events to show updated data
      await fetchEvents(true);
      setSelectedEvents(new Set());
      setShowBulkEditModal(false);
      setBulkEditData({
        priceIncreasePercentage: '',
        internal_notes: '',
        Skip_Scraping: null,
      });

      // Show success message
      setDeleteMessage(result.message);
      setDeleteMessageType('success');
      setTimeout(() => {
        setDeleteMessage('');
        setDeleteMessageType('');
      }, 5000);
    } else {
      alert(`Bulk update failed: ${result.error}`);
    }
  } catch (error) {
    alert(`Error during bulk update: ${error.message}`);
  } finally {
    setBulkEditLoading(false);
  }
};
```

#### Add Bulk Edit Button in header (next to existing buttons):

```jsx
<div className="flex gap-2">
  {/* Existing Refresh button */}
  <button
    onClick={() => fetchEvents(true)}
    disabled={refreshing}
    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
  >
    <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
    {refreshing ? 'Refreshing…' : 'Refresh'}
  </button>

  {/* NEW: Bulk Edit Button - only show when events are selected */}
  {selectedEvents.size > 0 && (
    <button
      onClick={() => setShowBulkEditModal(true)}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      <Edit2 className="w-4 h-4 mr-1" />
      Edit {selectedEvents.size} Selected
    </button>
  )}

  {/* Existing Start/Stop Scraping All button */}
  <button
    onClick={toggleScrapingAll}
    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${allActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
    disabled={filteredEvents.length === 0}
  >
    {allActive ? 'Stop Scraping All' : 'Start Scraping All'}
  </button>
</div>
```

#### Add Edit2 icon import:

```jsx
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, Search, X, SlidersHorizontal, Edit2 } from 'lucide-react';
```

#### Add Select All checkbox in table header:

```jsx
{/* Selection controls bar - add above the Events Table */}
{paginatedEvents.length > 0 && (
  <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={allOnPageSelected}
          onChange={() => allOnPageSelected ? deselectAll() : selectAllOnPage()}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <span className="text-sm text-gray-600">
          {allOnPageSelected ? 'Deselect all' : 'Select all on page'}
        </span>
      </label>
      {selectedEvents.size > 0 && (
        <span className="text-sm text-blue-600 font-medium">
          {selectedEvents.size} event{selectedEvents.size !== 1 ? 's' : ''} selected
        </span>
      )}
    </div>
    {selectedEvents.size > 0 && (
      <button
        onClick={deselectAll}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Clear selection
      </button>
    )}
  </div>
)}
```

#### Add Bulk Edit Modal:

```jsx
{/* Bulk Edit Modal */}
{showBulkEditModal && (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
    <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Bulk Edit {selectedEvents.size} Event{selectedEvents.size !== 1 ? 's' : ''}
          </h3>
          <button
            onClick={() => setShowBulkEditModal(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          Only fill in the fields you want to update. Empty fields will not be changed.
        </p>

        <div className="space-y-4">
          {/* Price Increase Percentage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price Increase Percentage
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Leave empty to keep current value"
              value={bulkEditData.priceIncreasePercentage}
              onChange={(e) => setBulkEditData(prev => ({
                ...prev,
                priceIncreasePercentage: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Internal Notes
            </label>
            <textarea
              rows={3}
              placeholder="Leave empty to keep current value"
              value={bulkEditData.internal_notes}
              onChange={(e) => setBulkEditData(prev => ({
                ...prev,
                internal_notes: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Scraping Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scraping Status
            </label>
            <select
              value={bulkEditData.Skip_Scraping === null ? '' : bulkEditData.Skip_Scraping.toString()}
              onChange={(e) => setBulkEditData(prev => ({
                ...prev,
                Skip_Scraping: e.target.value === '' ? null : e.target.value === 'true'
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">No change</option>
              <option value="false">Start scraping (active)</option>
              <option value="true">Stop scraping (paused)</option>
            </select>
          </div>
        </div>

        {/* Warning message */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Changing price percentage or stopping scraping will delete associated seat inventory data.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={() => setShowBulkEditModal(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={bulkEditLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleBulkEdit}
            disabled={bulkEditLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {bulkEditLoading ? 'Updating...' : 'Update Selected Events'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

### 3. app/dashboard/events/EventsTableModern.jsx - Add checkbox column

Update the table component to include selection checkboxes:

```jsx
// Add to component props
const EventsTableModern = ({
  data,
  toggleScraping,
  loadingSeatCounts,
  onDeleteEvent,
  togglingEvents,
  selectedEvents = new Set(),  // ADD
  onToggleSelection = () => {}, // ADD
}) => {
```

Add checkbox column to the table header:

```jsx
<thead className="bg-gray-50">
  <tr>
    {/* ADD: Selection checkbox header */}
    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
      <span className="sr-only">Select</span>
    </th>
    {/* ... existing column headers ... */}
  </tr>
</thead>
```

Add checkbox cell to each row:

```jsx
<tbody className="bg-white divide-y divide-gray-200">
  {data.map((event) => (
    <tr key={event._id} className={`hover:bg-gray-50 ${selectedEvents.has(event._id) ? 'bg-blue-50' : ''}`}>
      {/* ADD: Selection checkbox */}
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={selectedEvents.has(event._id)}
          onChange={() => onToggleSelection(event._id)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      {/* ... existing cells ... */}
    </tr>
  ))}
</tbody>
```

Update the EventsTableModern usage in page.js:

```jsx
<EventsTableModern
  data={paginatedEvents}
  toggleScraping={toggleScraping}
  loadingSeatCounts={loadingSeatCounts}
  onDeleteEvent={handleDeleteEvent}
  togglingEvents={togglingEvents}
  selectedEvents={selectedEvents}         // ADD
  onToggleSelection={toggleEventSelection} // ADD
/>
```

## Testing Checklist

- [ ] Select individual events with checkboxes
- [ ] Select all events on page
- [ ] Deselect all events
- [ ] Open bulk edit modal
- [ ] Update price percentage for multiple events
- [ ] Update internal notes for multiple events
- [ ] Change scraping status for multiple events
- [ ] Verify seat groups are deleted when price changes
- [ ] Verify success message shows
- [ ] Selection clears after successful update
- [ ] Handle errors gracefully
