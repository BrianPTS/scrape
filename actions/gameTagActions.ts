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
 *
 * TPTS-028: Trigger conditions (whichever comes first):
 * 1. Event is within 24 hours of start time, OR
 * 2. It is 10:00 PM EST the day before the event
 *
 * @param eventDateTime - The event's date/time
 * @returns Object with shouldTag boolean and triggerReason string
 */
function shouldAddGameTag(eventDateTime: Date): { shouldTag: boolean; triggerReason: string } {
  const now = new Date();
  const eventDate = new Date(eventDateTime);

  // Condition 1: Check if event is within 24 hours
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const isWithin24Hours = eventDate <= twentyFourHoursFromNow;

  // Condition 2: Check if it's past 10 PM EST the day before
  // Calculate 10 PM EST the day before the event
  // EST offset is -5 hours from UTC (ignoring DST for simplicity)
  // 10 PM EST = 10 PM + 5 hours = 3 AM UTC (next day)

  // Get event date at midnight UTC
  const eventDateMidnight = new Date(eventDate);
  eventDateMidnight.setUTCHours(0, 0, 0, 0);

  // 10 PM EST day before = 03:00 UTC on event day
  const tenPmEstTrigger = new Date(eventDateMidnight);
  tenPmEstTrigger.setUTCHours(3, 0, 0, 0); // 10 PM EST = 03:00 UTC

  const isPastTenPmEst = now >= tenPmEstTrigger;

  // Determine trigger reason
  if (isWithin24Hours && isPastTenPmEst) {
    return { shouldTag: true, triggerReason: 'Within 24 hours AND past 10 PM EST day before' };
  } else if (isWithin24Hours) {
    return { shouldTag: true, triggerReason: 'Within 24 hours of event' };
  } else if (isPastTenPmEst) {
    return { shouldTag: true, triggerReason: 'Past 10 PM EST day before event' };
  }

  return { shouldTag: false, triggerReason: 'Not yet within trigger window' };
}

/**
 * Simpler check function that just returns boolean
 * Used for backward compatibility
 */
function shouldAddGameTagSimple(eventDateTime: Date): boolean {
  return shouldAddGameTag(eventDateTime).shouldTag;
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
    }).select('Event_Name Event_DateTime Venue internal_notes Event_ID');

    const wouldBeTagged: Array<{
      eventId: string;
      name: string;
      dateTime: Date;
      venue: string;
      currentNotes: string;
      triggerReason: string;
    }> = [];
    const alreadyTagged: Array<{
      eventId: string;
      name: string;
      dateTime: Date;
      venue: string;
    }> = [];
    const notYetReady: Array<{
      eventId: string;
      name: string;
      dateTime: Date;
      venue: string;
    }> = [];

    for (const event of events) {
      const currentNotes = event.internal_notes || '';

      if (currentNotes.includes('-game')) {
        alreadyTagged.push({
          eventId: event.Event_ID,
          name: event.Event_Name,
          dateTime: event.Event_DateTime,
          venue: event.Venue
        });
      } else {
        const { shouldTag, triggerReason } = shouldAddGameTag(event.Event_DateTime);
        if (shouldTag) {
          wouldBeTagged.push({
            eventId: event.Event_ID,
            name: event.Event_Name,
            dateTime: event.Event_DateTime,
            venue: event.Venue,
            currentNotes,
            triggerReason
          });
        } else {
          notYetReady.push({
            eventId: event.Event_ID,
            name: event.Event_Name,
            dateTime: event.Event_DateTime,
            venue: event.Venue
          });
        }
      }
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total: events.length,
        wouldBeTagged: wouldBeTagged.length,
        alreadyTagged: alreadyTagged.length,
        notYetReady: notYetReady.length
      },
      wouldBeTagged,
      alreadyTagged,
      notYetReady
    };

  } catch (error) {
    console.error('[GameTag] Error in preview:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}
