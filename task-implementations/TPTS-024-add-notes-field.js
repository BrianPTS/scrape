/**
 * TPTS-024: Add Notes Field to Edit Event Form
 *
 * This file contains all code changes needed for this task.
 * Files to modify:
 * 1. models/eventModel.js (BOTH repos: scrape + playwright)
 * 2. app/dashboard/list-event/NewScraper.jsx (scrape repo)
 */

// ============================================================
// PART 1: EVENT MODEL CHANGES (models/eventModel.js)
// Apply to BOTH repos
// ============================================================

// ADD this field to the eventSchema (after Zone or any appropriate location):
const notesField = {
  internal_notes: {
    type: String,
    default: "",
    maxlength: 1000, // Limit note length
  },
};


// ============================================================
// PART 2: FORM CHANGES (app/dashboard/list-event/NewScraper.jsx)
// ============================================================

// 2A. Update formData state initialization
// ADD to the useState object:
const formDataAddition = {
  internal_notes: "",
};

// 2B. Update useEffect for edit mode
// ADD to the setFormData object:
const useEffectAddition = {
  internal_notes: initialData.internal_notes || "",
};

// 2C. Update validationState
// ADD (notes is optional, so always valid):
const validationStateAddition = {
  internal_notes: true,
};

// 2D. Update touchedFields
// ADD:
const touchedFieldsAddition = {
  internal_notes: false,
};

// 2E. Update handleSubmit eventData
// ADD:
const eventDataAddition = {
  internal_notes: formData.internal_notes,
};

// 2F. NEW JSX - Add this field to the form (suggest placing it at the end, spanning full width)
const NotesFieldJSX = `
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
    <p className={\`text-xs \${formData.internal_notes.length > 900 ? 'text-amber-500' : 'text-gray-400'}\`}>
      {formData.internal_notes.length}/1000
    </p>
  </div>
</div>
`;

console.log("TPTS-024 Implementation Guide Loaded");
