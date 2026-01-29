# TPTS-027: Add Venue Type Dropdown to Add Event Form

## Overview
Add a `venue_type` field with a dropdown selector to categorize events by venue/event type.
This helps in organizing events and can be used for filtering or reporting.

## Venue Type Options
Based on common ticketing categories:
- `concert` - Concerts and music performances
- `sports` - Sports events (games, matches)
- `theater` - Theater and Broadway shows
- `comedy` - Comedy shows and stand-up
- `festival` - Music festivals and events
- `family` - Family events and shows
- `other` - Other event types

## Files to Modify

### 1. models/eventModel.js

Add the venue_type field to the schema:

```javascript
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    // ... existing fields ...

    Venue: String,

    // ADD: Venue Type field after Venue
    venue_type: {
      type: String,
      enum: ['concert', 'sports', 'theater', 'comedy', 'festival', 'family', 'other'],
      default: 'other',
    },

    // ... rest of existing fields ...
  },
  {
    timestamps: true,
  }
);
```

### 2. app/dashboard/list-event/NewScraper.jsx

#### Add Building2 icon import (optional, for styling):

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
  Building2, // ADD this for venue type icon
} from "lucide-react";
```

#### Define venue type options constant (add before the component):

```jsx
// Venue type options for dropdown
const VENUE_TYPES = [
  { value: 'concert', label: 'Concert / Music' },
  { value: 'sports', label: 'Sports' },
  { value: 'theater', label: 'Theater / Broadway' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'festival', label: 'Festival' },
  { value: 'family', label: 'Family / Kids' },
  { value: 'other', label: 'Other' },
];
```

#### Update formData state:

```jsx
const [formData, setFormData] = useState({
  URL: "",
  Event_ID: "",
  Event_Name: "",
  Event_DateTime: "",
  Venue: "",
  venue_type: "other", // ADD this with default value
  Zone: "General",
  Available_Seats: 0,
  Skip_Scraping: true,
  inHandDate: "",
  mapping_id: "",
  Percentage_Increase_ListCost: 0,
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
      venue_type: initialData.venue_type || "other", // ADD this
      Zone: initialData.Zone || "General",
      Available_Seats: initialData.Available_Seats || 0,
      Skip_Scraping: initialData.Skip_Scraping !== undefined ? initialData.Skip_Scraping : true,
      inHandDate: formatDateForInput(initialData.inHandDate),
      mapping_id: initialData.mapping_id || "",
      Percentage_Increase_ListCost: initialData.priceIncreasePercentage || 0,
    });
  }
}, [isEdit, initialData]);
```

#### Update validationState:

```jsx
const [validationState, setValidationState] = useState({
  URL: true,
  Event_ID: true,
  Event_Name: true,
  Event_DateTime: true,
  Venue: true,
  venue_type: true, // ADD - always valid since it has a default
  Zone: true,
  inHandDate: true,
  mapping_id: true,
  Percentage_Increase_ListCost: true,
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
  venue_type: false, // ADD
  Zone: false,
  inHandDate: false,
  mapping_id: false,
  Percentage_Increase_ListCost: false,
});
```

#### Update validateForm (venue_type always valid):

```jsx
const validateForm = () => {
  const validation = {
    URL: validateUrl(formData.URL),
    Event_ID: formData.Event_ID.length > 0,
    Event_Name: formData.Event_Name.length >= 3,
    Event_DateTime: Boolean(formData.Event_DateTime),
    Venue: formData.Venue.length > 0,
    venue_type: true, // Always valid - has default value
    Zone: formData.Zone.length > 0,
    inHandDate: Boolean(formData.inHandDate),
    mapping_id: formData.mapping_id.length > 0,
    Percentage_Increase_ListCost: formData.Percentage_Increase_ListCost >= 0,
  };

  // ... rest of function ...
};
```

#### Update handleSubmit eventData:

```jsx
const eventData = {
  URL: formData.URL,
  Event_ID: formData.Event_ID,
  Event_Name: formData.Event_Name,
  Event_DateTime: formData.Event_DateTime,
  Venue: formData.Venue,
  venue_type: formData.venue_type, // ADD this
  Zone: formData.Zone,
  Available_Seats: formData.Available_Seats,
  Skip_Scraping: formData.Skip_Scraping,
  inHandDate: formData.inHandDate,
  mapping_id: formData.mapping_id,
  priceIncreasePercentage: formData.Percentage_Increase_ListCost,
};
```

#### Add Venue Type dropdown to JSX (add after the Venue field):

```jsx
{/* Venue Field */}
<div>
  <label
    htmlFor="Venue"
    className="block text-sm font-medium text-gray-700 mb-1"
  >
    Venue <span className="text-red-500">*</span>
  </label>
  {/* ... existing Venue input ... */}
</div>

{/* NEW: Venue Type Field */}
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
      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors appearance-none bg-white"
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
    Categorize the event type for better organization
  </p>
</div>

{/* Zone Field */}
<div>
  {/* ... existing Zone input ... */}
</div>
```

### 3. Optional: Auto-detect venue type from URL/Event Name

Add a helper function to suggest venue type based on event data:

```jsx
// Add this helper function before the component
const detectVenueType = (eventName, venue) => {
  const text = `${eventName} ${venue}`.toLowerCase();

  // Sports keywords
  const sportsKeywords = ['nba', 'nfl', 'nhl', 'mlb', 'game', 'match', 'vs', 'versus', 'stadium', 'arena', 'basketball', 'football', 'hockey', 'baseball', 'soccer', 'wrestling', 'ufc', 'boxing'];
  if (sportsKeywords.some(keyword => text.includes(keyword))) {
    return 'sports';
  }

  // Theater keywords
  const theaterKeywords = ['broadway', 'theater', 'theatre', 'musical', 'play', 'opera', 'ballet'];
  if (theaterKeywords.some(keyword => text.includes(keyword))) {
    return 'theater';
  }

  // Comedy keywords
  const comedyKeywords = ['comedy', 'stand-up', 'standup', 'comedian', 'laugh'];
  if (comedyKeywords.some(keyword => text.includes(keyword))) {
    return 'comedy';
  }

  // Festival keywords
  const festivalKeywords = ['festival', 'fest', 'coachella', 'lollapalooza', 'bonnaroo'];
  if (festivalKeywords.some(keyword => text.includes(keyword))) {
    return 'festival';
  }

  // Family keywords
  const familyKeywords = ['disney', 'sesame', 'kids', 'children', 'family', 'circus', 'ice show'];
  if (familyKeywords.some(keyword => text.includes(keyword))) {
    return 'family';
  }

  // Concert keywords (most common default)
  const concertKeywords = ['concert', 'tour', 'live', 'amphitheater', 'pavilion'];
  if (concertKeywords.some(keyword => text.includes(keyword))) {
    return 'concert';
  }

  // Default to concert for most events
  return 'concert';
};
```

Then update the URL extraction function to auto-detect:

```jsx
// In handleInputChange, when URL is parsed:
if (name === "URL" && validateUrl(value)) {
  const extractedData = extractEventDataFromUrl(value);
  if (extractedData) {
    // Auto-detect venue type
    const detectedType = detectVenueType(
      extractedData.eventName || '',
      extractedData.venue || ''
    );

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      Event_ID: extractedData.eventId || prev.Event_ID,
      Event_Name: extractedData.eventName || prev.Event_Name,
      Venue: extractedData.venue || prev.Venue,
      venue_type: detectedType, // Auto-set venue type
      Event_DateTime: extractedData.eventDate || prev.Event_DateTime,
      inHandDate: extractedData.inHandDate || prev.inHandDate,
    }));
  }
  // ... rest of handling ...
}
```

### 4. Optional: Add venue type to Events Table display

In `EventsTableModern.jsx`, add a column to show the venue type:

```jsx
// Add to table header
<th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Type
</th>

// Add to table row
<td className="px-4 py-4 whitespace-nowrap">
  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getVenueTypeColor(event.venue_type)}`}>
    {event.venue_type || 'other'}
  </span>
</td>

// Add helper function for colors
const getVenueTypeColor = (type) => {
  const colors = {
    concert: 'bg-purple-100 text-purple-800',
    sports: 'bg-green-100 text-green-800',
    theater: 'bg-amber-100 text-amber-800',
    comedy: 'bg-pink-100 text-pink-800',
    festival: 'bg-blue-100 text-blue-800',
    family: 'bg-cyan-100 text-cyan-800',
    other: 'bg-gray-100 text-gray-800',
  };
  return colors[type] || colors.other;
};
```

### 5. Optional: Add venue type filter to Events page

In `page.js`, add a filter for venue type:

```jsx
// Add to filters state
const [filters, setFilters] = useState({
  // ... existing filters ...
  venueType: 'all', // ADD
});

// Add to filter function
const matchesVenueType = filters.venueType === 'all' ||
  event.venue_type === filters.venueType;

// Add return condition
return matchesSearch && matchesDateRange && matchesVenue &&
       matchesSeatRange && matchesScrapingStatus && matchesCreatedRange &&
       matchesAvailableSeats && matchesVenueType; // ADD

// Add to Advanced Filters panel
<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700">Venue Type</label>
  <select
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
    value={filters.venueType}
    onChange={(e) => updateFilter('venueType', e.target.value)}
  >
    <option value="all">All Types</option>
    <option value="concert">Concert / Music</option>
    <option value="sports">Sports</option>
    <option value="theater">Theater / Broadway</option>
    <option value="comedy">Comedy</option>
    <option value="festival">Festival</option>
    <option value="family">Family / Kids</option>
    <option value="other">Other</option>
  </select>
</div>
```

## Migration Script

For existing events without venue_type:

```javascript
// MongoDB migration script
db.events.updateMany(
  { venue_type: { $exists: false } },
  { $set: { venue_type: 'other' } }
);
```

## Testing Checklist

- [ ] Create new event and select venue type
- [ ] Create new event - verify default is 'other'
- [ ] Edit existing event and change venue type
- [ ] Verify venue type persists after save
- [ ] Test auto-detection from URL (if implemented)
- [ ] Verify dropdown displays all options
- [ ] Test on mobile devices
- [ ] Verify migration works for existing events
- [ ] Test venue type filter (if implemented)
