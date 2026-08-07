// config.js - Configuration settings for the Experiment Scheduler

const EXCESSIVE_LOG_MARKER_CONFIG = '[EXCESSIVE_TRACE]';
function excessiveLogConfig(message, payload) {
    if (payload === undefined) {
        console.log(EXCESSIVE_LOG_MARKER_CONFIG, message);
    } else {
        console.log(EXCESSIVE_LOG_MARKER_CONFIG, message, payload);
    }
}

// Supabase Configuration
const SUPABASE_CONFIG = {
    URL: 'https://julcmnhkslouhrpsrrrv.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bGNtbmhrc2xvdWhycHNycnJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDUxNzMsImV4cCI6MjA5NDQyMTE3M30.RACw3yBY13g9sXurxQTF2eX6T2bYSyI9NVX3f-ZeG1k'
};

// Scheduler Configuration
const SCHEDULER_CONFIG = {
    // Total number of experiment sessions to schedule
    TOTAL_SESSIONS: 12,
    
    // Maximum number of concurrent sessions (based on available devices)
    MAX_CONCURRENT_SESSIONS: 20,

    // Maximum number of concurrent intakes on the exact same timeslot
    MAX_INTAKES_PER_TIMESLOT: 8,

    // Allowed daily intake distributions across timeslots.
    // Examples: 2 double + 1 single, 1 double + 2 single, or 4 single.
    ALLOWED_DAILY_INTAKE_PATTERNS: [
        { doubleTimeslots: 2, singleTimeslots: 1 },
        { doubleTimeslots: 1, singleTimeslots: 2 },
        { doubleTimeslots: 0, singleTimeslots: 4 }
    ],

    // Minimum gap between different intake timeslots on the same date
    MINUTES_BETWEEN_DIFFERENT_INTAKE_TIMESLOTS: 119,

    // Minimum lead time before an intake timeslot can be booked
    INTAKE_MIN_ADVANCE_HOURS: 16,

    // Latest time to book a Monday intake, on the preceding Friday
    MONDAY_INTAKE_BOOKING_CUTOFF_TIME: '18:00',

    // Extra calendar days to reserve equipment after the last data collection day
    EQUIPMENT_CLEANING_DELAY_DAYS: 0,
    
    // Time windows for scheduling (in days)
    SESSION1_WINDOW_DAYS: 5,
    EXPERIMENT_WINDOW_DAYS: 18, 
    
    // Minimum consecutive available days required for experiment sessions
    MIN_AVAILABLE_DAYS: 18, 
    
    // Time slot options for instruction sessions
    TIME_SLOTS: [
        '11:00',
        '13:30',
        '17:00',
    ],

    // Instruction-session weekdays that should be blocked
    INSTRUCTION_BLOCKED_WEEKDAYS: new Set([
        'Saturday',
        'Sunday'
    ]),

    INSTRUCTION_BLOCKED_DATE_TIME_RANGES: [
    ],

    // Blocked dates - no instruction sessions may be scheduled on these dates
    BLOCKED_DATES: new Set([
    ]),



};

excessiveLogConfig('config.js loaded: Supabase configuration object created', {
    url: SUPABASE_CONFIG.URL,
    anonKeyLength: SUPABASE_CONFIG.ANON_KEY.length
});
excessiveLogConfig('config.js loaded: Scheduler configuration object created', {
    totalSessions: SCHEDULER_CONFIG.TOTAL_SESSIONS,
    maxConcurrentSessions: SCHEDULER_CONFIG.MAX_CONCURRENT_SESSIONS,
    maxIntakesPerTimeslot: SCHEDULER_CONFIG.MAX_INTAKES_PER_TIMESLOT,
    allowedDailyIntakePatterns: SCHEDULER_CONFIG.ALLOWED_DAILY_INTAKE_PATTERNS,
    minutesBetweenDifferentIntakeTimeslots: SCHEDULER_CONFIG.MINUTES_BETWEEN_DIFFERENT_INTAKE_TIMESLOTS,
    intakeMinAdvanceHours: SCHEDULER_CONFIG.INTAKE_MIN_ADVANCE_HOURS,
    mondayIntakeBookingCutoffTime: SCHEDULER_CONFIG.MONDAY_INTAKE_BOOKING_CUTOFF_TIME,
    equipmentCleaningDelayDays: SCHEDULER_CONFIG.EQUIPMENT_CLEANING_DELAY_DAYS,
    session1WindowDays: SCHEDULER_CONFIG.SESSION1_WINDOW_DAYS,
    experimentWindowDays: SCHEDULER_CONFIG.EXPERIMENT_WINDOW_DAYS,
    minAvailableDays: SCHEDULER_CONFIG.MIN_AVAILABLE_DAYS,
    timeSlots: SCHEDULER_CONFIG.TIME_SLOTS,
    instructionBlockedWeekdays: Array.from(SCHEDULER_CONFIG.INSTRUCTION_BLOCKED_WEEKDAYS),
    blockedDatesCount: SCHEDULER_CONFIG.BLOCKED_DATES.size,
    blockedDates: Array.from(SCHEDULER_CONFIG.BLOCKED_DATES),
    instructionBlockedDateTimeRangesCount: SCHEDULER_CONFIG.INSTRUCTION_BLOCKED_DATE_TIME_RANGES.length,
    instructionBlockedDateTimeRanges: SCHEDULER_CONFIG.INSTRUCTION_BLOCKED_DATE_TIME_RANGES
});
