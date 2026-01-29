/**
 * TPTS-026: Add Bulk Edit Functionality to Events Page
 *
 * This file contains all code changes needed for this task.
 * Files to modify:
 * 1. actions/eventActions.ts (scrape repo) - Add bulkUpdateEvents function
 * 2. app/dashboard/events/page.js (scrape repo) - Add selection UI and bulk edit modal
 * 3. app/dashboard/events/EventsTableModern.jsx (scrape repo) - Add checkbox column
 */

// ============================================================
// PART 1: NEW SERVER ACTION (actions/eventActions.ts)
// Add this new function to the file
// ============================================================

const bulkUpdateEventsFunction = `
/**
 * Updates multiple events at once with the same data.
 * @param {string[]} eventIds - Array of event IDs to update.
 * @param {object} updateData - The data to apply to all events.
 * @returns {Promise<object>} Result with success count and any errors.
 */
export async function bulkUpdateEvents(
  eventIds: string[],
  updateData: {
    standardPriceIncreasePercentage?: number;
    resalePriceIncreasePercentage?: number;
    internal_notes?: string;
    Skip_Scraping?: boolean;
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
      if (typeof deleteConsecutiveGroupsByEventIds === 'function') {
        const seatDeletionResult = await deleteConsecutiveGroupsByEventIds(eventIdStrings);
        results.deletedSeatGroups = seatDeletionResult.deletedCount || 0;
      }
    }

    // Perform bulk update
    const updateResult = await Event.updateMany(
      { _id: { $in: eventIds } },
      { $set: updateData }
    );

    results.updated = updateResult.modifiedCount;

    return {
      success: true,
      message: \`Successfully updated \${results.updated} events\${results.deletedSeatGroups > 0 ? \`. Deleted \${results.deletedSeatGroups} seat groups.\` : ''}.\`,
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
`;


// ============================================================
// PART 2: PAGE.JS CHANGES (app/dashboard/events/page.js)
// ============================================================

// 2A. Add import for bulkUpdateEvents (around line 3)
const importAddition = `
import { getAllEvents, updateEvent, updateAllEvents, deleteEvent, bulkUpdateEvents } from '@/actions/eventActions';
import { Edit2 } from 'lucide-react'; // Add Edit2 to existing lucide imports
`;

// 2B. Add new state variables (after existing useState declarations, around line 23)
const newStateVariables = `
const [selectedEvents, setSelectedEvents] = useState(new Set());
const [showBulkEditModal, setShowBulkEditModal] = useState(false);
const [bulkEditLoading, setBulkEditLoading] = useState(false);
const [bulkEditData, setBulkEditData] = useState({
  standardPriceIncreasePercentage: '',
  resalePriceIncreasePercentage: '',
  internal_notes: '',
  Skip_Scraping: null, // null means no change
});
`;

// 2C. Add selection handler functions (after existing handlers)
const selectionHandlers = `
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
    if (bulkEditData.standardPriceIncreasePercentage !== '') {
      updateData.standardPriceIncreasePercentage = Number(bulkEditData.standardPriceIncreasePercentage);
    }
    if (bulkEditData.resalePriceIncreasePercentage !== '') {
      updateData.resalePriceIncreasePercentage = Number(bulkEditData.resalePriceIncreasePercentage);
    }
    if (bulkEditData.internal_notes !== '') {
      updateData.internal_notes = bulkEditData.internal_notes;
    }
    if (bulkEditData.Skip_Scraping !== null) {
      updateData.Skip_Scraping = bulkEditData.Skip_Scraping;
    }

    if (Object.keys(updateData).length === 0) {
      alert('Please set at least one field to update');
      setBulkEditLoading(false);
      return;
    }

    const result = await bulkUpdateEvents(Array.from(selectedEvents), updateData);

    if (result.success) {
      await fetchEvents(true);
      setSelectedEvents(new Set());
      setShowBulkEditModal(false);
      setBulkEditData({
        standardPriceIncreasePercentage: '',
        resalePriceIncreasePercentage: '',
        internal_notes: '',
        Skip_Scraping: null,
      });

      setDeleteMessage(result.message);
      setDeleteMessageType('success');
      setTimeout(() => {
        setDeleteMessage('');
        setDeleteMessageType('');
      }, 5000);
    } else {
      alert(\`Bulk update failed: \${result.error}\`);
    }
  } catch (error) {
    alert(\`Error during bulk update: \${error.message}\`);
  } finally {
    setBulkEditLoading(false);
  }
};
`;

// 2D. Add Bulk Edit button to header (add after Refresh button, around line 420)
const bulkEditButtonJSX = `
{/* Bulk Edit Button - only show when events are selected */}
{selectedEvents.size > 0 && (
  <button
    onClick={() => setShowBulkEditModal(true)}
    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
  >
    <Edit2 className="w-4 h-4 mr-1" />
    Edit {selectedEvents.size} Selected
  </button>
)}
`;

// 2E. Add Selection controls bar (add before EventsTableModern, around line 703)
const selectionControlsJSX = `
{/* Selection Controls Bar */}
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
`;

// 2F. Update EventsTableModern usage (around line 703)
const eventsTableModernUpdate = `
<EventsTableModern
  data={paginatedEvents}
  toggleScraping={toggleScraping}
  loadingSeatCounts={loadingSeatCounts}
  onDeleteEvent={handleDeleteEvent}
  togglingEvents={togglingEvents}
  selectedEvents={selectedEvents}
  onToggleSelection={toggleEventSelection}
/>
`;

// 2G. Bulk Edit Modal JSX (add before closing </div> of the component)
const bulkEditModalJSX = `
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
          Only fill in fields you want to update. Empty fields will not be changed.
        </p>

        <div className="space-y-4">
          {/* Standard % Increase */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              % Increase - Standard
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Leave empty to keep current"
              value={bulkEditData.standardPriceIncreasePercentage}
              onChange={(e) => setBulkEditData(prev => ({
                ...prev,
                standardPriceIncreasePercentage: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Resale % Increase */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              % Increase - Resale
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Leave empty to keep current"
              value={bulkEditData.resalePriceIncreasePercentage}
              onChange={(e) => setBulkEditData(prev => ({
                ...prev,
                resalePriceIncreasePercentage: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              rows={3}
              placeholder="Leave empty to keep current"
              value={bulkEditData.internal_notes}
              onChange={(e) => setBulkEditData(prev => ({
                ...prev,
                internal_notes: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 resize-none"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No change</option>
              <option value="false">Resume (active)</option>
              <option value="true">Pause (inactive)</option>
            </select>
          </div>
        </div>

        {/* Warning */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Changing price % or pausing will delete seat inventory data.
          </p>
        </div>

        {/* Actions */}
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
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {bulkEditLoading ? 'Updating...' : 'Update Selected'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
`;


// ============================================================
// PART 3: EventsTableModern.jsx CHANGES
// ============================================================

// 3A. Update component props
const tablePropsUpdate = `
const EventsTableModern = ({
  data,
  toggleScraping,
  loadingSeatCounts,
  onDeleteEvent,
  togglingEvents,
  selectedEvents = new Set(),      // ADD
  onToggleSelection = () => {},    // ADD
}) => {
`;

// 3B. Add checkbox column to table header (add as first <th>)
const tableHeaderCheckbox = `
<th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
  <span className="sr-only">Select</span>
</th>
`;

// 3C. Add checkbox cell to each row (add as first <td> in the map)
const tableRowCheckbox = `
<td className="px-3 py-4 whitespace-nowrap">
  <input
    type="checkbox"
    checked={selectedEvents.has(event._id)}
    onChange={() => onToggleSelection(event._id)}
    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
    onClick={(e) => e.stopPropagation()}
  />
</td>
`;

// 3D. Update row className to highlight selected rows
const rowClassNameUpdate = `
<tr
  key={event._id}
  className={\`hover:bg-gray-50 \${selectedEvents.has(event._id) ? 'bg-blue-50' : ''}\`}
>
`;

console.log("TPTS-026 Implementation Guide Loaded");
