# Auto-Populate Internal Notes with "-game" for Sports Events

## Overview
Automatically add the "-game" tag to the `internal_notes` field for events that are detected as sports/game events. This can be done either:
1. **At event creation** - Auto-populate when adding a new event
2. **At CSV export** - Dynamically add based on event type or name patterns

## Option A: Auto-populate at Event Creation (Recommended)

### Files to Modify

#### 1. app/dashboard/list-event/NewScraper.jsx

Add a helper function to detect if an event is a game:

```jsx
// Add this helper function before the component
const isGameEvent = (eventName, venue, venueType) => {
  const text = `${eventName} ${venue}`.toLowerCase();

  // Check venue type first (if TPTS-027 is implemented)
  if (venueType === 'sports') {
    return true;
  }

  // Sports team/league keywords
  const sportsKeywords = [
    // Major leagues
    'nba', 'nfl', 'nhl', 'mlb', 'mls',
    // Sports terms
    'game', 'match', 'vs', 'versus', 'championship', 'playoff', 'playoffs',
    // Venue types
    'stadium', 'field', 'park', 'court',
    // Sports
    'basketball', 'football', 'hockey', 'baseball', 'soccer', 'tennis',
    'wrestling', 'wwe', 'ufc', 'boxing', 'mma',
    // Common team name patterns
    'bulls', 'lakers', 'celtics', 'heat', 'warriors', 'knicks',
    'yankees', 'dodgers', 'red sox', 'cubs', 'mets',
    'patriots', 'cowboys', 'packers', 'eagles', 'chiefs',
    'blackhawks', 'rangers', 'bruins', 'penguins', 'maple leafs',
  ];

  return sportsKeywords.some(keyword => text.includes(keyword));
};
```

Update the URL extraction to auto-populate internal_notes:

```jsx
// In handleInputChange, when extracting data from URL:
if (name === "URL" && validateUrl(value)) {
  const extractedData = extractEventDataFromUrl(value);
  if (extractedData) {
    // Check if this is a game event
    const isGame = isGameEvent(
      extractedData.eventName || '',
      extractedData.venue || '',
      formData.venue_type // If venue_type is already set
    );

    // Auto-populate internal_notes for game events
    const autoNotes = isGame ? '-game' : '';

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      Event_ID: extractedData.eventId || prev.Event_ID,
      Event_Name: extractedData.eventName || prev.Event_Name,
      Venue: extractedData.venue || prev.Venue,
      Event_DateTime: extractedData.eventDate || prev.Event_DateTime,
      inHandDate: extractedData.inHandDate || prev.inHandDate,
      // Only set internal_notes if it's empty and we detected a game
      internal_notes: prev.internal_notes || autoNotes,
    }));
  }
  // ... rest of handling ...
}
```

Also update when venue_type changes to suggest -game:

```jsx
// In handleInputChange, add special handling for venue_type:
if (name === "venue_type" && value === "sports") {
  setFormData((prev) => ({
    ...prev,
    [name]: value,
    // Suggest -game in notes if empty
    internal_notes: prev.internal_notes || '-game',
  }));
} else {
  setFormData((prev) => ({
    ...prev,
    [name]: value,
  }));
}
```

#### Complete handleInputChange with game detection:

```jsx
const handleInputChange = (e) => {
  const { name, value } = e.target;

  // Special handling for venue_type changes
  if (name === "venue_type") {
    if (value === "sports" && !formData.internal_notes) {
      // Auto-suggest -game for sports events
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        internal_notes: '-game',
      }));
      setTouchedFields((prev) => ({
        ...prev,
        [name]: true,
      }));
      return;
    }
  }

  // Special handling for URL changes - try to extract all event data
  if (name === "URL" && validateUrl(value)) {
    const extractedData = extractEventDataFromUrl(value);
    if (extractedData) {
      // Detect if this is a game event
      const isGame = isGameEvent(
        extractedData.eventName || '',
        extractedData.venue || ''
      );

      setFormData((prev) => ({
        ...prev,
        [name]: value,
        Event_ID: extractedData.eventId || prev.Event_ID,
        Event_Name: extractedData.eventName || prev.Event_Name,
        Venue: extractedData.venue || prev.Venue,
        Event_DateTime: extractedData.eventDate || prev.Event_DateTime,
        inHandDate: extractedData.inHandDate || prev.inHandDate,
        // Auto-set venue_type if detected as sports
        venue_type: isGame ? 'sports' : prev.venue_type,
        // Auto-set -game note for sports events (only if notes are empty)
        internal_notes: (isGame && !prev.internal_notes) ? '-game' : prev.internal_notes,
      }));
    } else {
      // Fallback to just extracting event ID
      const extractedId = extractEventIdFromUrl(value);
      if (extractedId && !formData.Event_ID) {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          Event_ID: extractedId,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
      }
    }
  } else {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // ... rest of validation logic ...
};
```

## Option B: Auto-populate at CSV Export Time

If you prefer to keep the internal_notes field clean and only add "-game" during export:

### Modify actions/csvActions.tsx

Update the processBatch function to detect game events:

```typescript
// Add helper function
function isGameEvent(eventName: string, venueName: string, venueType?: string): boolean {
  const text = `${eventName} ${venueName}`.toLowerCase();

  // Check venue type first
  if (venueType === 'sports') {
    return true;
  }

  const sportsKeywords = [
    'nba', 'nfl', 'nhl', 'mlb', 'mls',
    'game', 'match', 'vs', 'versus', 'championship', 'playoff',
    'stadium', 'field', 'court',
    'basketball', 'football', 'hockey', 'baseball', 'soccer',
    'wrestling', 'wwe', 'ufc', 'boxing',
  ];

  return sportsKeywords.some(keyword => text.includes(keyword));
}

// In processBatch, update the internal_notes logic:
async function processBatch(batch: ConsecutiveGroupDocument[]): Promise<CsvRow[]> {
  return batch.map(doc => {
    const inventory = doc.inventory;

    // ... existing pre-compute operations ...

    // Detect if this is a game event
    const isGame = isGameEvent(
      doc.event_name || '',
      doc.venue_name || '',
      doc.venue_type // If available from event data
    );

    // Build internal_notes
    const baseNotes = "-tnow -tmplus";
    const gameTag = isGame ? " -game" : "";
    const eventNotes = doc.event_internal_notes?.trim() || '';

    // Combine all notes: base + game tag (if applicable) + event-specific notes
    let internalNotes = baseNotes + gameTag;
    if (eventNotes) {
      // Don't duplicate -game if already in event notes
      if (!eventNotes.includes('-game')) {
        internalNotes += ` ${eventNotes}`;
      } else {
        // If event notes already have -game, use them directly
        internalNotes = `${baseNotes} ${eventNotes}`;
      }
    }

    return {
      // ... other fields ...
      internal_notes: internalNotes.trim(),
      // ... other fields ...
    } as CsvRow;
  });
}
```

Update the aggregation pipeline to include venue_type:

```typescript
// In the $addFields stage:
{
  $addFields: {
    event_url: { $arrayElemAt: ['$eventDetails.URL', 0] },
    event_internal_notes: { $arrayElemAt: ['$eventDetails.internal_notes', 0] },
    venue_type: { $arrayElemAt: ['$eventDetails.venue_type', 0] } // ADD
  }
}

// Update ConsecutiveGroupDocument interface:
interface ConsecutiveGroupDocument {
  // ... existing fields ...
  venue_type?: string; // ADD
}
```

## Option C: Hybrid Approach (Best of Both)

1. Auto-suggest "-game" at event creation (user can remove if incorrect)
2. At CSV export, verify and add "-game" if missing for sports events

This ensures:
- Users have visibility into the tagging
- CSV export is always consistent
- Manual overrides are respected

### Implementation for Hybrid:

#### In NewScraper.jsx:

```jsx
// Show a hint when -game is auto-added
{formData.venue_type === 'sports' && formData.internal_notes?.includes('-game') && (
  <p className="mt-1 text-xs text-blue-600 flex items-center gap-1">
    <Info className="h-3 w-3" />
    "-game" tag auto-added for sports events
  </p>
)}
```

#### In csvActions.tsx processBatch:

```typescript
// Ensure -game is present for sports events, even if not in stored notes
const isGame = isGameEvent(doc.event_name || '', doc.venue_name || '', doc.venue_type);
const hasGameTag = doc.event_internal_notes?.includes('-game') || false;

let internalNotes = baseNotes;
if (isGame && !hasGameTag) {
  internalNotes += ' -game';
}
if (doc.event_internal_notes) {
  internalNotes += ` ${doc.event_internal_notes}`;
}
```

## Example Outputs

### Non-game event (no event notes):
```csv
internal_notes
-tnow -tmplus
```

### Game event (no event notes):
```csv
internal_notes
-tnow -tmplus -game
```

### Game event with additional notes:
```csv
internal_notes
-tnow -tmplus -game Premium seating available
```

### Non-game event with custom notes:
```csv
internal_notes
-tnow -tmplus VIP package included
```

## Testing Checklist

- [ ] Create sports event - verify "-game" is auto-added to notes
- [ ] Create non-sports event - verify no "-game" tag
- [ ] Change venue_type to sports - verify "-game" is suggested
- [ ] User removes "-game" manually - verify it stays removed
- [ ] Export CSV for game event - verify "-game" in internal_notes
- [ ] Export CSV for non-game event - verify no "-game"
- [ ] Test with various sports team names in event name
- [ ] Test with "vs" in event name (e.g., "Lakers vs Celtics")
- [ ] Verify no duplicate "-game" tags in output
