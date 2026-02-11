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
    URL: {
      type: String,
      required: true,
    },
    additionalURLs: [{
      url: {
        type: String,
        required: true,
      },
      label: {
        type: String,
        required: true,
      },
    }],
    includeStandardSeats: {
      type: Boolean,
      default: true,
      description: "Include Standard ticket listings in CSV export"
    },
    includeResaleSeats: {
      type: Boolean,
      default: true,
      description: "Include Resale ticket listings in CSV export"
    },
    minimumSeatCost: {
      type: Number,
      default: null,
      description: "Minimum seat cost threshold for CSV export filtering"
    },
    enableMinimumCostFilter: {
      type: Boolean,
      default: false,
      description: "Enable filtering by minimum seat cost in CSV export"
    },
    Zone: {
      type: String,
      default: "none",
    },
    Available_Seats: {
      type: Number,
      default: 0,
    },
    venueCapacity: {
      type: Number,
      default: 0,
      description: "Total number of seats in the venue"
    },
    seatsForSale: {
      type: Number,
      default: 0,
      description: "Total number of individual seats currently for sale"
    },
    Skip_Scraping: {
      type: Boolean,
      default: true,
    },
    inHandDate: {
      type: Date,
      default: Date.now,
    },
    priceIncreasePercentage: {
      type: Number,
      default: 25, // Default 25% markup (legacy - used as fallback)
    },
    standardMarkup: {
      type: Number,
      default: null,
      description: "Markup % for Standard tickets (overrides priceIncreasePercentage)"
    },
    resaleMarkup: {
      type: Number,
      default: null,
      description: "Markup % for Resale tickets (overrides priceIncreasePercentage)"
    },
    highQuantityThreshold: {
      type: Number,
      default: 8,
      description: "Seat quantity threshold for bonus markup (Standard only)"
    },
    highQuantityBonusMarkup: {
      type: Number,
      default: 0,
      description: "Bonus markup % added when seats >= threshold (Standard only)"
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
eventSchema.index({ Last_Updated: 1 }); // Index for CSV generation filtering

export const Event = mongoose.models.Event || mongoose.model("Event", eventSchema);
