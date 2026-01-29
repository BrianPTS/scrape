/**
 * Auto-populate internal_notes with "-game" for Sports Events
 *
 * This file contains code to automatically add the "-game" tag
 * to internal_notes for events detected as sports/games.
 *
 * Files to modify:
 * 1. app/dashboard/list-event/NewScraper.jsx (scrape repo) - Auto-detect at creation
 * 2. actions/csvActions.tsx (scrape repo) - Ensure -game in CSV export
 */

// ============================================================
// PART 1: GAME DETECTION HELPER FUNCTION
// Add this to NewScraper.jsx (before the component)
// ============================================================

const isGameEventFunction = `
// Helper function to detect if an event is a sports game
const isGameEvent = (eventName, venue) => {
  const text = \`\${eventName} \${venue}\`.toLowerCase();

  // Sports keywords that indicate a game event
  const sportsKeywords = [
    // Major leagues
    'nba', 'nfl', 'nhl', 'mlb', 'mls', 'ncaa', 'college',
    // Sports terms
    'game', 'match', 'vs', 'versus', 'vs.', 'championship', 'playoff', 'playoffs', 'finals',
    // Venue types often associated with sports
    'stadium', 'field', 'ballpark', 'coliseum',
    // Sports
    'basketball', 'football', 'hockey', 'baseball', 'soccer', 'tennis',
    'wrestling', 'wwe', 'ufc', 'boxing', 'mma',
    // Common team patterns
    'bulls', 'lakers', 'celtics', 'heat', 'warriors', 'knicks', 'nets', 'spurs',
    'yankees', 'dodgers', 'red sox', 'cubs', 'mets', 'giants', 'cardinals',
    'patriots', 'cowboys', 'packers', 'eagles', 'chiefs', 'raiders', '49ers',
    'blackhawks', 'rangers', 'bruins', 'penguins', 'maple leafs', 'flyers',
  ];

  return sportsKeywords.some(keyword => text.includes(keyword));
};
`;


// ============================================================
// PART 2: AUTO-DETECT IN FORM (NewScraper.jsx)
// Update handleInputChange to auto-add -game
// ============================================================

const handleInputChangeUpdate = `
// In handleInputChange, when URL is parsed successfully:
if (name === "URL" && validateUrl(value)) {
  const extractedData = extractEventDataFromUrl(value);
  if (extractedData) {
    // Check if this is a game event
    const isGame = isGameEvent(
      extractedData.eventName || '',
      extractedData.venue || ''
    );

    // Auto-populate internal_notes for game events (only if notes are empty)
    const autoNotes = isGame ? '-game' : '';

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      Event_ID: extractedData.eventId || prev.Event_ID,
      Event_Name: extractedData.eventName || prev.Event_Name,
      Venue: extractedData.venue || prev.Venue,
      Event_DateTime: extractedData.eventDate || prev.Event_DateTime,
      inHandDate: extractedData.inHandDate || prev.inHandDate,
      // Auto-set -game note for sports events (only if notes are empty)
      internal_notes: prev.internal_notes || autoNotes,
    }));
  }
  // ... rest of existing code
}
`;


// ============================================================
// PART 3: CSV EXPORT - ENSURE -game TAG (csvActions.tsx)
// Modify processBatch to auto-add -game for sports events
// ============================================================

const csvExportUpdate = `
// In processBatch function, update the internal_notes logic:

// Add the isGameEvent helper at the top of the file
function isGameEvent(eventName: string, venueName: string): boolean {
  const text = \`\${eventName} \${venueName}\`.toLowerCase();

  const sportsKeywords = [
    'nba', 'nfl', 'nhl', 'mlb', 'mls',
    'game', 'match', 'vs', 'versus', 'championship', 'playoff',
    'stadium', 'field', 'ballpark',
    'basketball', 'football', 'hockey', 'baseball', 'soccer',
    'wrestling', 'wwe', 'ufc', 'boxing',
  ];

  return sportsKeywords.some(keyword => text.includes(keyword));
}

// Then in processBatch, update the internal_notes building:
const baseNotes = "-tnow -tmplus";

// Detect if this is a game event
const isGame = isGameEvent(doc.event_name || '', doc.venue_name || '');

// Get event-specific notes
const eventNotes = doc.event_internal_notes?.trim() || '';

// Check if -game tag is already present
const hasGameTag = eventNotes.includes('-game');

// Build internal_notes
let internalNotes = baseNotes;

// Add -game tag for sports events if not already present
if (isGame && !hasGameTag) {
  internalNotes += ' -game';
}

// Append event-specific notes if present
if (eventNotes) {
  internalNotes += \` \${eventNotes}\`;
}

// Use in the return object:
internal_notes: internalNotes.trim(),
`;


// ============================================================
// EXAMPLE OUTPUTS
// ============================================================

const examples = {
  // Non-game event, no custom notes
  example1: {
    eventName: "Taylor Swift - The Eras Tour",
    venue: "MetLife Stadium",
    eventNotes: "",
    output: "-tnow -tmplus"  // No -game since it's a concert
  },

  // Game event, no custom notes
  example2: {
    eventName: "Lakers vs Celtics",
    venue: "Crypto.com Arena",
    eventNotes: "",
    output: "-tnow -tmplus -game"  // Auto -game detected
  },

  // Game event with custom notes
  example3: {
    eventName: "NFL Playoffs - Chiefs vs Bills",
    venue: "Arrowhead Stadium",
    eventNotes: "Premium seating available",
    output: "-tnow -tmplus -game Premium seating available"
  },

  // Event with -game already in notes
  example4: {
    eventName: "Lakers vs Warriors",
    venue: "Chase Center",
    eventNotes: "-game VIP package",
    output: "-tnow -tmplus -game VIP package"  // No duplicate -game
  }
};


// ============================================================
// COMPLETE UPDATED processBatch SNIPPET
// ============================================================

const completeProcessBatchSnippet = `
// Helper function - add at top of file
function isGameEvent(eventName: string, venueName: string): boolean {
  const text = \`\${eventName} \${venueName}\`.toLowerCase();
  const sportsKeywords = [
    'nba', 'nfl', 'nhl', 'mlb', 'mls', 'game', 'match', 'vs', 'versus',
    'championship', 'playoff', 'stadium', 'field', 'basketball', 'football',
    'hockey', 'baseball', 'soccer', 'wrestling', 'wwe', 'ufc', 'boxing'
  ];
  return sportsKeywords.some(keyword => text.includes(keyword));
}

// In processBatch function:
async function processBatch(batch: ConsecutiveGroupDocument[]): Promise<CsvRow[]> {
  return batch.map(doc => {
    const inventory = doc.inventory;

    // ... existing pre-compute operations ...

    // BUILD INTERNAL NOTES with auto -game detection
    const baseNotes = "-tnow -tmplus";
    const isGame = isGameEvent(doc.event_name || '', doc.venue_name || '');
    const eventNotes = doc.event_internal_notes?.trim() || '';
    const hasGameTag = eventNotes.includes('-game');

    let internalNotes = baseNotes;
    if (isGame && !hasGameTag) {
      internalNotes += ' -game';
    }
    if (eventNotes) {
      internalNotes += \` \${eventNotes}\`;
    }

    return {
      // ... other fields ...
      internal_notes: internalNotes.trim(),
      // ... other fields ...
    } as CsvRow;
  });
}
`;

console.log("AUTO-POPULATE-game-tag Implementation Guide Loaded");
