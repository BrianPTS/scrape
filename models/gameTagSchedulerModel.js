import mongoose from 'mongoose';

const gameTagSchedulerSchema = new mongoose.Schema({
  isEnabled: {
    type: Boolean,
    default: false
  },
  checkIntervalMinutes: {
    type: Number,
    required: true,
    min: 1,
    max: 60,
    default: 15
  },
  lastRunAt: {
    type: Date,
    default: null
  },
  nextRunAt: {
    type: Date,
    default: null
  },
  totalRuns: {
    type: Number,
    default: 0
  },
  totalEventsTagged: {
    type: Number,
    default: 0
  },
  lastRunStats: {
    eventsChecked: { type: Number, default: 0 },
    eventsTagged: { type: Number, default: 0 },
    errors: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
gameTagSchedulerSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      isEnabled: false,
      checkIntervalMinutes: 15
    });
  }
  return settings;
};

gameTagSchedulerSchema.statics.updateSettings = async function(updates) {
  const settings = await this.getSettings();
  Object.assign(settings, updates, { updatedAt: new Date() });
  return await settings.save();
};

export const GameTagScheduler = mongoose.models.GameTagScheduler || mongoose.model('GameTagScheduler', gameTagSchedulerSchema);
