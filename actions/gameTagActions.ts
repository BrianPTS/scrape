'use server';

/**
 * Game Tag Actions
 *
 * Automatically adds "-game" to internal_notes for events that are
 * approaching their event time. Triggers at 10 PM EST the day before.
 */

import dbConnect from '@/lib/dbConnect';
import { Event } from '@/models/eventModel';
import { GameTagScheduler } from '@/models/gameTagSchedulerModel';

/**
 * Get game tag scheduler settings
 */
export async function getGameTagSettings() {
  await dbConnect();
  try {
    const settings = await GameTagScheduler.getSettings();
    return JSON.parse(JSON.stringify(settings));
  } catch (error) {
    console.error('Error getting game tag settings:', error);
    return {
      isEnabled: false,
      checkIntervalMinutes: 15,
      lastRunAt: null,
      nextRunAt: null,
      totalRuns: 0,
      totalEventsTagged: 0,
      lastRunStats: null
    };
  }
}

/**
 * Update game tag scheduler settings
 */
export async function updateGameTagSettings(updates: {
  isEnabled?: boolean;
  checkIntervalMinutes?: number;
  lastRunAt?: Date;
  nextRunAt?: Date;
  totalRuns?: number;
  totalEventsTagged?: number;
  lastRunStats?: {
    eventsChecked: number;
    eventsTagged: number;
    errors: string[];
  };
}) {
  await dbConnect();
  try {
    const settings = await GameTagScheduler.updateSettings(updates);
    return JSON.parse(JSON.stringify(settings));
  } catch (error) {
    console.error('Error updating game tag settings:', error);
    throw error;
  }
}

/**
 * Check if an event should have "-game" tag added
 * Triggers at 10 PM EST the day before the event
 */
function shouldAddGameTag(eventDateTime: Date): boolean {
  const now = new Date();

  // Convert event time to EST
  const eventDate = new Date(eventDateTime);

  // Get 10 PM EST the day before the event
  // Create a date for the day before at 10 PM EST
  const dayBefore = new Date(eventDate);
  dayBefore.setDate(dayBefore.getDate() - 1);

  // Set to 10 PM EST (22:00)
  // EST is UTC-5, so 10 PM EST = 3 AM UTC next day (or 22:00 - 5 = 03:00 UTC)
  // But we need to handle this properly

  // Get the event date in EST timezone
  const estOffset = -5 * 60; // EST is UTC-5 (in minutes)
  const utcTime = dayBefore.getTime() + (dayBefore.getTimezoneOffset() * 60000);
  const estTime = new Date(utcTime + (estOffset * 60000));

  // Set to 10 PM (22:00) in EST
  estTime.setHours(22, 0, 0, 0);

  // Convert back to UTC for comparison
  const tenPmEstInUtc = new Date(estTime.getTime() - (estOffset * 60000) + (estTime.getTimezoneOffset() * 60000));

  // Simpler approach: Calculate 10 PM EST the day before
  // 10 PM EST = 03:00 UTC the next day (during standard time)
  // or 02:00 UTC the next day (during daylight saving)

  // Let's use a simpler calculation:
  // Get the event date, subtract 1 day, set to 22:00, then adjust for EST
  const triggerTime = new Date(eventDate);
  triggerTime.setDate(triggerTime.getDate() - 1);
  triggerTime.setUTCHours(22 + 5, 0, 0, 0); // 10 PM EST = 03:00 UTC (next day technically)

  // Check if current time is past the trigger time
  return now >= triggerTime;
}

/**
 * Alternative simpler approach using moment-timezone equivalent logic
 */
function shouldAddGameTagSimple(eventDateTime: Date): boolean {
  const now = new Date();
  const eventDate = new Date(eventDateTime);

  // Calculate 10 PM EST the day before the event
  // EST offset is -5 hours from UTC (ignoring DST for simplicity)
  // 10 PM EST = 10 PM + 5 hours = 3 AM UTC (next day)

  // Get event date at midnight UTC
  const eventDateMidnight = new Date(eventDate);
  eventDateMidnight.setUTCHours(0, 0, 0, 0);

  // Go back one day and set to 10 PM EST (which is 3 AM UTC)
  // Actually: day before at 10 PM EST
  // If event is Jan 15, we want Jan 14 at 10 PM EST
  // Jan 14 10 PM EST = Jan 15 03:00 UTC

  const triggerTime = new Date(eventDateMidnight);
  triggerTime.setUTCHours(3, 0, 0, 0); // 10 PM EST = 03:00 UTC

  return now >= triggerTime;
}

/**
 * Auto-populate "-game" tag for events nearing their event time
 * This function checks all active events and adds "-game" to internal_notes
 * for events where it's 10 PM EST the day before.
 */
export async function autoPopulateGameTag() {
  await dbConnect();

  const stats = {
    eventsChecked: 0,
    eventsTagged: 0,
    errors: [] as string[]
  };

  try {
    // Get all active events (Skip_Scraping = false) that don't already have "-game"
    const events = await Event.find({
      Skip_Scraping: { $ne: true },
      Event_DateTime: { $gte: new Date() } // Only future events
    });

    stats.eventsChecked = events.length;
    console.log(`[GameTag] Checking ${events.length} active events...`);

    for (const event of events) {
      try {
        // Check if event already has "-game" tag
        const currentNotes = event.internal_notes || '';
        if (currentNotes.includes('-game')) {
          continue; // Already tagged, skip
        }

        // Check if we should add the tag (10 PM EST day before)
        if (shouldAddGameTagSimple(event.Event_DateTime)) {
          // Add "-game" tag
          const newNotes = currentNotes.trim()
            ? `${currentNotes.trim()} -game`
            : '-game';

          await Event.findByIdAndUpdate(event._id, {
            internal_notes: newNotes
          });

          stats.eventsTagged++;
          console.log(`[GameTag] Added "-game" to event: ${event.Event_Name} (${event.Event_DateTime})`);
        }
      } catch (eventError) {
        const errorMsg = `Failed to process event ${event._id}: ${(eventError as Error).message}`;
        stats.errors.push(errorMsg);
        console.error(`[GameTag] ${errorMsg}`);
      }
    }

    console.log(`[GameTag] Completed: Checked ${stats.eventsChecked}, Tagged ${stats.eventsTagged}`);

    return {
      success: true,
      message: `Checked ${stats.eventsChecked} events, tagged ${stats.eventsTagged} with "-game"`,
      stats
    };

  } catch (error) {
    console.error('[GameTag] Error in autoPopulateGameTag:', error);
    return {
      success: false,
      error: (error as Error).message,
      stats
    };
  }
}

/**
 * Preview which events would be tagged
 * Useful for testing without making changes
 */
export async function previewGameTagEvents() {
  await dbConnect();

  try {
    const events = await Event.find({
      Skip_Scraping: { $ne: true },
      Event_DateTime: { $gte: new Date() }
    }).select('Event_Name Event_DateTime Venue internal_notes');

    const wouldBeTagged = [];
    const alreadyTagged = [];
    const notYetReady = [];

    for (const event of events) {
      const currentNotes = event.internal_notes || '';

      if (currentNotes.includes('-game')) {
        alreadyTagged.push({
          name: event.Event_Name,
          dateTime: event.Event_DateTime,
          venue: event.Venue
        });
      } else if (shouldAddGameTagSimple(event.Event_DateTime)) {
        wouldBeTagged.push({
          name: event.Event_Name,
          dateTime: event.Event_DateTime,
          venue: event.Venue
        });
      } else {
        notYetReady.push({
          name: event.Event_Name,
          dateTime: event.Event_DateTime,
          venue: event.Venue
        });
      }
    }

    return {
      success: true,
      summary: {
        total: events.length,
        wouldBeTagged: wouldBeTagged.length,
        alreadyTagged: alreadyTagged.length,
        notYetReady: notYetReady.length
      },
      wouldBeTagged,
      alreadyTagged
    };

  } catch (error) {
    console.error('[GameTag] Error in preview:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}
