/**
 * Game Tag Scheduler API
 *
 * Manages the automatic "-game" tag scheduler that runs every 15 minutes
 * and adds "-game" to internal_notes for events at 10 PM EST the day before.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getGameTagSettings,
  updateGameTagSettings,
  autoPopulateGameTag,
  previewGameTagEvents
} from '@/actions/gameTagActions';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Store the interval instance
let scheduledInterval: NodeJS.Timeout | null = null;
let isInitialized = false;

// Scheduler metrics
interface SchedulerMetrics {
  totalRuns: number;
  totalEventsTagged: number;
  startTime: number;
  lastError?: string;
}

const schedulerMetrics: SchedulerMetrics = {
  totalRuns: 0,
  totalEventsTagged: 0,
  startTime: Date.now()
};

/**
 * Initialize scheduler on server start
 */
async function initializeScheduler() {
  if (isInitialized) return;

  try {
    const settings = await getGameTagSettings();

    // If scheduler was running before server restart, restart it
    if (settings.isEnabled && settings.checkIntervalMinutes) {
      console.log('[GameTag] Restoring scheduler from database settings...');
      await startScheduler(settings.checkIntervalMinutes);
    }

    isInitialized = true;
  } catch (error) {
    console.error('[GameTag] Failed to initialize scheduler:', error);
  }
}

/**
 * Start the game tag scheduler
 */
async function startScheduler(intervalMinutes: number) {
  // Stop existing interval if running
  if (scheduledInterval) {
    clearInterval(scheduledInterval);
    scheduledInterval = null;
  }

  // Reset metrics
  schedulerMetrics.totalRuns = 0;
  schedulerMetrics.totalEventsTagged = 0;
  schedulerMetrics.startTime = Date.now();
  schedulerMetrics.lastError = undefined;

  const intervalMs = intervalMinutes * 60 * 1000;

  const scheduledTask = async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [GameTag] Running scheduled game tag check...`);

    try {
      schedulerMetrics.totalRuns++;

      // Run the auto-populate function
      const result = await autoPopulateGameTag();

      if (result.success) {
        schedulerMetrics.totalEventsTagged += result.stats?.eventsTagged || 0;

        // Update database with run stats
        await updateGameTagSettings({
          lastRunAt: new Date(),
          nextRunAt: new Date(Date.now() + intervalMs),
          totalRuns: schedulerMetrics.totalRuns,
          totalEventsTagged: schedulerMetrics.totalEventsTagged,
          lastRunStats: result.stats
        });

        console.log(`[${timestamp}] [GameTag] Completed: ${result.message}`);
      } else {
        schedulerMetrics.lastError = result.error;
        console.error(`[${timestamp}] [GameTag] Failed:`, result.error);
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      schedulerMetrics.lastError = errorMsg;
      console.error(`[${timestamp}] [GameTag] Error:`, errorMsg);
    }
  };

  // Run immediately on start
  await scheduledTask();

  // Set up the interval
  scheduledInterval = setInterval(scheduledTask, intervalMs);

  console.log(`[GameTag] Scheduler started with ${intervalMinutes} minute interval`);

  return {
    success: true,
    message: `Game tag scheduler started with ${intervalMinutes} minute interval`,
    nextRun: new Date(Date.now() + intervalMs)
  };
}

/**
 * Stop the scheduler
 */
function stopScheduler() {
  if (scheduledInterval) {
    clearInterval(scheduledInterval);
    scheduledInterval = null;
    console.log('[GameTag] Scheduler stopped');
    return true;
  }
  return false;
}

/**
 * GET - Get scheduler status and settings
 */
export async function GET() {
  try {
    await initializeScheduler();

    const settings = await getGameTagSettings();

    return NextResponse.json({
      success: true,
      settings: {
        ...settings,
        isRunning: !!scheduledInterval
      },
      metrics: {
        ...schedulerMetrics,
        uptime: scheduledInterval ? Date.now() - schedulerMetrics.startTime : 0
      }
    });
  } catch (error) {
    console.error('[GameTag] Error getting settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get scheduler settings' },
      { status: 500 }
    );
  }
}

/**
 * POST - Control the scheduler
 * Actions: start, stop, run-now, preview, update-settings
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, checkIntervalMinutes } = body;

    switch (action) {
      case 'start': {
        const settings = await getGameTagSettings();
        const interval = checkIntervalMinutes || settings.checkIntervalMinutes || 15;

        await updateGameTagSettings({
          isEnabled: true,
          checkIntervalMinutes: interval,
          nextRunAt: new Date(Date.now() + interval * 60 * 1000)
        });

        const result = await startScheduler(interval);

        return NextResponse.json(result);
      }

      case 'stop': {
        const stopped = stopScheduler();

        if (stopped) {
          await updateGameTagSettings({
            isEnabled: false
          });

          return NextResponse.json({
            success: true,
            message: 'Game tag scheduler stopped',
            finalMetrics: {
              totalRuns: schedulerMetrics.totalRuns,
              totalEventsTagged: schedulerMetrics.totalEventsTagged
            }
          });
        } else {
          return NextResponse.json(
            { success: false, message: 'No scheduler is running' },
            { status: 400 }
          );
        }
      }

      case 'run-now': {
        console.log('[GameTag] Manual run triggered');
        const result = await autoPopulateGameTag();

        if (result.success) {
          // Update stats
          await updateGameTagSettings({
            lastRunAt: new Date(),
            totalEventsTagged: (await getGameTagSettings()).totalEventsTagged + (result.stats?.eventsTagged || 0),
            lastRunStats: result.stats
          });
        }

        return NextResponse.json(result);
      }

      case 'preview': {
        const preview = await previewGameTagEvents();
        return NextResponse.json(preview);
      }

      case 'update-settings': {
        const updates: { checkIntervalMinutes?: number } = {};
        if (checkIntervalMinutes !== undefined) {
          updates.checkIntervalMinutes = checkIntervalMinutes;
        }

        await updateGameTagSettings(updates);

        return NextResponse.json({
          success: true,
          message: 'Settings updated'
        });
      }

      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action. Use: start, stop, run-now, preview, update-settings' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[GameTag] API Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
