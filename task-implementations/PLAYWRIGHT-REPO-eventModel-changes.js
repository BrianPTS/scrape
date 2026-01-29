/**
 * EVENT MODEL CHANGES FOR PLAYWRIGHT REPO
 * File: /playwright/models/eventModel.js
 *
 * IMPORTANT: These changes MUST be applied to keep the model
 * in sync with the scrape (portal) repo since they share the same MongoDB.
 */

// ============================================================
// CURRENT eventModel.js (playwright repo)
// ============================================================

const CURRENT_MODEL = `
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    mapping_id: { type: String, required: true, unique: true },
    Event_ID: { type: String, required: true, unique: true },
    Event_Name: { type: String, required: true },
    Event_DateTime: { type: Date, required: true },
    Venue: String,
    URL: { type: String, required: true },
    Zone: { type: String, default: "none" },
    Available_Seats: { type: Number, default: 0 },
    Skip_Scraping: { type: Boolean, default: true },
    inHandDate: { type: Date, default: Date.now },
    priceIncreasePercentage: { type: Number, default: 35 },  // <-- REMOVE THIS
    Last_Updated: { type: Date, default: Date.now },
    metadata: { ... },
  },
  { timestamps: true }
);
`;


// ============================================================
// NEW eventModel.js (REPLACE the entire file with this)
// ============================================================

const NEW_MODEL = `
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    mapping_id: {
      type: String,
      required: true,
      unique: true,
    },
    Event_ID: {
      type: String,
      required: true,
      unique: true,
    },
    Event_Name: {
      type: String,
      required: true,
    },
    Event_DateTime: {
      type: Date,
      required: true,
    },
    Venue: String,

    // NEW: Venue Type dropdown (TPTS-027)
    venue_type: {
      type: String,
      enum: ['stadium', 'arena', 'theater', 'other'],
      default: 'other',
    },

    URL: {
      type: String,
      required: true,
    },
    Zone: {
      type: String,
      default: "none",
    },
    Available_Seats: {
      type: Number,
      default: 0,
    },
    Skip_Scraping: {
      type: Boolean,
      default: true,
    },
    inHandDate: {
      type: Date,
      default: Date.now,
    },

    // NEW: Separate percentage fields (TPTS-023)
    // REPLACES: priceIncreasePercentage
    standardPriceIncreasePercentage: {
      type: Number,
      default: 35,
    },
    resalePriceIncreasePercentage: {
      type: Number,
      default: 35,
    },

    // NEW: Internal notes field (TPTS-024)
    internal_notes: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    Last_Updated: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      lastUpdate: String,
      iterationNumber: Number,
      scrapeStartTime: Date,
      scrapeEndTime: Date,
      inHandDate: Date,
      scrapeDurationSeconds: Number,
      totalRunningTimeMinutes: Number,
      ticketStats: {
        totalTickets: Number,
        ticketCountChange: Number,
        previousTicketCount: Number,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
eventSchema.index({ URL: 1 }, { unique: true });

export const Event = mongoose.model("Event", eventSchema);
`;


// ============================================================
// MIGRATION SCRIPT (run ONCE in MongoDB after updating both repos)
// ============================================================

const MIGRATION_SCRIPT = `
// Run this in MongoDB shell or via script AFTER deploying both repos

// 1. Migrate priceIncreasePercentage to new fields
db.events.updateMany(
  { priceIncreasePercentage: { $exists: true } },
  [
    {
      $set: {
        standardPriceIncreasePercentage: "$priceIncreasePercentage",
        resalePriceIncreasePercentage: "$priceIncreasePercentage"
      }
    }
  ]
);

// 2. Remove old field
db.events.updateMany(
  { priceIncreasePercentage: { $exists: true } },
  { $unset: { priceIncreasePercentage: "" } }
);

// 3. Set default venue_type for existing events
db.events.updateMany(
  { venue_type: { $exists: false } },
  { $set: { venue_type: "other" } }
);

// 4. Set default internal_notes for existing events
db.events.updateMany(
  { internal_notes: { $exists: false } },
  { $set: { internal_notes: "" } }
);

// Verify migration
db.events.findOne({}, {
  standardPriceIncreasePercentage: 1,
  resalePriceIncreasePercentage: 1,
  venue_type: 1,
  internal_notes: 1,
  priceIncreasePercentage: 1  // Should not exist
});
`;


// ============================================================
// DEPLOYMENT ORDER
// ============================================================

const DEPLOYMENT_STEPS = `
1. Update playwright repo eventModel.js (this file shows the changes)
2. Update scrape repo eventModel.js (same changes)
3. Deploy BOTH repos
4. Run migration script ONCE
5. Verify data in MongoDB
`;

console.log("Playwright repo eventModel changes loaded");
