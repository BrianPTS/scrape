# TPTS-024: Add Notes Field to Edit Event Form

## Overview
Add an `internal_notes` field to events that can be edited in the Add/Edit Event form.
This field will store internal notes about the event that can later be included in CSV exports.

## Files to Modify

### 1. models/eventModel.js

Add the notes field to the schema:

```javascript
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    // ... existing fields ...

    // ADD this new field after Zone or any appropriate location:
    internal_notes: {
      type: String,
      default: "",
      maxlength: 1000, // Limit note length
    },

    // ... rest of existing fields ...
  },
  {
    timestamps: true,
  }
);
```

### 2. app/dashboard/list-event/NewScraper.jsx

#### Update formData state:

```jsx
const [formData, setFormData] = useState({
  URL: "",
  Event_ID: "",
  Event_Name: "",
  Event_DateTime: "",
  Venue: "",
  Zone: "General",
  Available_Seats: 0,
  Skip_Scraping: true,
  inHandDate: "",
  mapping_id: "",
  Percentage_Increase_ListCost: 0,
  internal_notes: "", // ADD this new field
});
```

#### Update useEffect for edit mode:

```jsx
useEffect(() => {
  if (isEdit && initialData) {
    const formatDateForInput = (dateString) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toISOString().slice(0, 16);
    };

    setFormData({
      URL: initialData.URL || "",
      Event_ID: initialData.Event_ID || "",
      Event_Name: initialData.Event_Name || "",
      Event_DateTime: formatDateForInput(initialData.Event_DateTime),
      Venue: initialData.Venue || "",
      Zone: initialData.Zone || "General",
      Available_Seats: initialData.Available_Seats || 0,
      Skip_Scraping: initialData.Skip_Scraping !== undefined ? initialData.Skip_Scraping : true,
      inHandDate: formatDateForInput(initialData.inHandDate),
      mapping_id: initialData.mapping_id || "",
      Percentage_Increase_ListCost: initialData.priceIncreasePercentage || 0,
      internal_notes: initialData.internal_notes || "", // ADD this
    });
  }
}, [isEdit, initialData]);
```

#### Update validationState (notes is optional, so always valid):

```jsx
const [validationState, setValidationState] = useState({
  URL: true,
  Event_ID: true,
  Event_Name: true,
  Event_DateTime: true,
  Venue: true,
  Zone: true,
  inHandDate: true,
  mapping_id: true,
  Percentage_Increase_ListCost: true,
  internal_notes: true, // ADD - always valid since optional
});
```

#### Update touchedFields:

```jsx
const [touchedFields, setTouchedFields] = useState({
  URL: false,
  Event_ID: false,
  Event_Name: false,
  Event_DateTime: false,
  Venue: false,
  Zone: false,
  inHandDate: false,
  mapping_id: false,
  Percentage_Increase_ListCost: false,
  internal_notes: false, // ADD
});
```

#### Update handleSubmit eventData:

```jsx
const eventData = {
  URL: formData.URL,
  Event_ID: formData.Event_ID,
  Event_Name: formData.Event_Name,
  Event_DateTime: formData.Event_DateTime,
  Venue: formData.Venue,
  Zone: formData.Zone,
  Available_Seats: formData.Available_Seats,
  Skip_Scraping: formData.Skip_Scraping,
  inHandDate: formData.inHandDate,
  mapping_id: formData.mapping_id,
  priceIncreasePercentage: formData.Percentage_Increase_ListCost,
  internal_notes: formData.internal_notes, // ADD this
};
```

#### Add the Notes input field to the JSX form (add after the Zone field or Percentage field):

```jsx
{/* Internal Notes Field */}
<div className="md:col-span-2">
  <label
    htmlFor="internal_notes"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    Internal Notes
  </label>
  <div className="relative">
    <textarea
      id="internal_notes"
      name="internal_notes"
      rows={3}
      value={formData.internal_notes}
      onChange={handleInputChange}
      onBlur={handleBlur}
      placeholder="Add internal notes about this event (optional)"
      maxLength={1000}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none"
      disabled={loading}
    />
  </div>
  <div className="flex justify-between mt-1">
    <p className="text-xs text-gray-500">
      Optional notes for internal use (will be included in CSV exports)
    </p>
    <p className="text-xs text-gray-400">
      {formData.internal_notes.length}/1000
    </p>
  </div>
</div>
```

### 3. Import FileText icon (optional, for styling)

If you want to add an icon to the notes field:

```jsx
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
  FileText, // ADD this import
} from "lucide-react";
```

Then update the textarea with an icon:

```jsx
{/* Internal Notes Field with Icon */}
<div className="md:col-span-2">
  <label
    htmlFor="internal_notes"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    <div className="flex items-center gap-2">
      <FileText className="h-4 w-4 text-gray-400" />
      Internal Notes
    </div>
  </label>
  <div className="relative">
    <textarea
      id="internal_notes"
      name="internal_notes"
      rows={3}
      value={formData.internal_notes}
      onChange={handleInputChange}
      onBlur={handleBlur}
      placeholder="Add internal notes about this event (optional)&#10;Example: VIP package available, parking info, special requirements..."
      maxLength={1000}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none"
      disabled={loading}
    />
  </div>
  <div className="flex justify-between mt-1">
    <p className="text-xs text-gray-500">
      Optional notes for internal use (will be included in CSV exports)
    </p>
    <p className={`text-xs ${formData.internal_notes.length > 900 ? 'text-amber-500' : 'text-gray-400'}`}>
      {formData.internal_notes.length}/1000
    </p>
  </div>
</div>
```

## Complete Modified NewScraper.jsx Form Section

Here's how the full grid of form fields should look with notes added:

```jsx
<form onSubmit={handleSubmit} className="space-y-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* URL Field */}
    {/* ... existing URL field ... */}

    {/* Event ID Field */}
    {/* ... existing Event ID field ... */}

    {/* Event Name Field */}
    {/* ... existing Event Name field ... */}

    {/* Event Date/Time Field */}
    {/* ... existing Event DateTime field ... */}

    {/* In-Hand Date Field */}
    {/* ... existing inHandDate field ... */}

    {/* Venue Field */}
    {/* ... existing Venue field ... */}

    {/* Zone Field */}
    {/* ... existing Zone field ... */}

    {/* Available Seats Field */}
    {/* ... existing Available Seats field ... */}

    {/* Skip Scraping Field */}
    {/* ... existing Skip Scraping checkbox ... */}

    {/* Event Mapping ID Field */}
    {/* ... existing mapping_id field ... */}

    {/* Percentage Increase List Cost Field */}
    {/* ... existing Percentage field ... */}

    {/* Internal Notes Field - NEW */}
    <div className="md:col-span-2">
      <label
        htmlFor="internal_notes"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Internal Notes
      </label>
      <div className="relative">
        <textarea
          id="internal_notes"
          name="internal_notes"
          rows={3}
          value={formData.internal_notes}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder="Add internal notes about this event (optional)"
          maxLength={1000}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none"
          disabled={loading}
        />
      </div>
      <div className="flex justify-between mt-1">
        <p className="text-xs text-gray-500">
          Optional notes for internal use (will be included in CSV exports)
        </p>
        <p className="text-xs text-gray-400">
          {formData.internal_notes.length}/1000
        </p>
      </div>
    </div>
  </div>

  {/* Submit buttons */}
  {/* ... existing submit section ... */}
</form>
```

## Testing Checklist

- [ ] Create new event with internal notes
- [ ] Create new event without notes (field is optional)
- [ ] Edit existing event and add notes
- [ ] Edit existing event and clear notes
- [ ] Verify notes persist after save
- [ ] Verify character counter works correctly
- [ ] Verify max length of 1000 characters is enforced
- [ ] Verify notes field displays correctly on mobile devices
