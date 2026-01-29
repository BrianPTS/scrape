/**
 * TPTS-027: Add Venue Type Dropdown to Add Event Form
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

// ADD this field to the eventSchema (after Venue):
const venueTypeField = {
  venue_type: {
    type: String,
    enum: ['stadium', 'arena', 'theater', 'other'],
    default: 'other',
  },
};


// ============================================================
// PART 2: FORM CHANGES (app/dashboard/list-event/NewScraper.jsx)
// ============================================================

// 2A. Add Building2 icon to imports (around line 1-17)
const iconImport = `
import {
  Calendar,
  Globe,
  Clock,
  MapPin,
  Tag,
  Hash,
  Ticket,
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Loader,
  Building2, // ADD THIS
} from "lucide-react";
`;

// 2B. Add venue type options constant (before the component, around line 19)
const venueTypesConstant = `
// Venue type options for dropdown
const VENUE_TYPES = [
  { value: 'stadium', label: 'Stadium' },
  { value: 'arena', label: 'Arena' },
  { value: 'theater', label: 'Theater' },
  { value: 'other', label: 'Other' },
];
`;

// 2C. Update formData state initialization
// ADD to the useState object:
const formDataAddition = {
  venue_type: "other",
};

// 2D. Update useEffect for edit mode
// ADD to the setFormData object:
const useEffectAddition = {
  venue_type: initialData.venue_type || "other",
};

// 2E. Update validationState
// ADD (always valid since it has a default):
const validationStateAddition = {
  venue_type: true,
};

// 2F. Update touchedFields
// ADD:
const touchedFieldsAddition = {
  venue_type: false,
};

// 2G. Update handleSubmit eventData
// ADD:
const eventDataAddition = {
  venue_type: formData.venue_type,
};

// 2H. NEW JSX - Add dropdown field (place after Venue field, around line 797)
const VenueTypeFieldJSX = `
{/* Venue Type Field */}
<div>
  <label
    htmlFor="venue_type"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    Venue Type
  </label>
  <div className="relative">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <Building2 className="h-5 w-5 text-gray-400" />
    </div>
    <select
      id="venue_type"
      name="venue_type"
      value={formData.venue_type}
      onChange={handleInputChange}
      onBlur={handleBlur}
      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors appearance-none bg-white"
      disabled={loading}
    >
      {VENUE_TYPES.map((type) => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </select>
    {/* Custom dropdown arrow */}
    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
      <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </div>
  </div>
  <p className="mt-1 text-xs text-gray-500">
    Categorize the venue type
  </p>
</div>
`;


// ============================================================
// PART 3: MIGRATION SCRIPT (run in MongoDB)
// ============================================================

const migrationScript = `
// Run this in MongoDB to set default venue_type for existing events
db.events.updateMany(
  { venue_type: { $exists: false } },
  { $set: { venue_type: 'other' } }
);
`;

console.log("TPTS-027 Implementation Guide Loaded");
