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
    URL: 'https://xiupbovpolvimeayboig.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpdXBib3Zwb2x2aW1lYXlib2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1MTQ5ODMsImV4cCI6MjA1NzA5MDk4M30.r-b6VnDBSB6D_LYj0CF1fdiQ66eJVGzakGguSV7619U'
};

// Scheduler Configuration
const SCHEDULER_CONFIG = {
    // Total number of experiment sessions to schedule
    TOTAL_SESSIONS: 18,
    
    // Maximum number of concurrent sessions (based on available devices)
    MAX_CONCURRENT_SESSIONS: 16,

    // Maximum number of concurrent intakes on the exact same timeslot
    MAX_INTAKES_PER_TIMESLOT: 2,

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
    INTAKE_MIN_ADVANCE_HOURS: 24,

    // Latest time to book a Monday intake, on the preceding Friday
    MONDAY_INTAKE_BOOKING_CUTOFF_TIME: '18:00',

    // Extra calendar days to reserve equipment after the last data collection day
    EQUIPMENT_CLEANING_DELAY_DAYS: 1,
    
    // Time windows for scheduling (in days)
    SESSION1_WINDOW_DAYS: 5,
    EXPERIMENT_WINDOW_DAYS: 25, 
    
    // Minimum consecutive available days required for experiment sessions
    MIN_AVAILABLE_DAYS: 25, 
    
    // Time slot options for instruction sessions
    TIME_SLOTS: [
        '11:00',
        '13:00',
        '16:00',
    ],

    // Instruction-session weekdays that should be blocked
    INSTRUCTION_BLOCKED_WEEKDAYS: new Set([
        'Saturday',
        'Sunday'
    ]),

    INSTRUCTION_BLOCKED_DATE_TIME_RANGES: [
        { date: '2026-02-01', start: '13:00', end: '14:00' },
        { date: '2026-02-02', start: '14:00', end: '18:00' }
    ],

    // Blocked dates - no instruction sessions may be scheduled on these dates
    BLOCKED_DATES: new Set([
        '2026-03-13',
        '2026-03-16',
        '2026-03-17', 
        '2026-03-18', 
        '2026-03-19', 
        '2026-03-20', 
        '2026-03-23',
        '2026-03-27',
        '2026-04-03', // Eastern
        '2026-04-06', // Eastern
        '2026-04-27', // Kingsday
        '2026-05-05', // Liberation day building closed
        '2026-05-14', // Hemelvaart building closed
        '2026-05-15', // Hemelvaart building closed
        '2026-05-25', // Pinksteren   
        '2026-07-01',
        '2026-07-02',
        '2026-07-03',
        '2026-07-04',
        '2026-07-05',
        '2026-07-06',
        '2026-07-07',
        '2026-07-08',
        '2026-07-09',
        '2026-07-10',
        '2026-07-11',
        '2026-07-12',
        '2026-07-13',
        '2026-07-14',
        '2026-07-15',
        '2026-07-16',
        '2026-07-17',
        '2026-07-18',
        '2026-07-19',
        '2026-07-20',
        '2026-07-21',
        '2026-07-22',
        '2026-07-23',
        '2026-07-24',
        '2026-07-25',
        '2026-07-26',
        '2026-07-27',
        '2026-07-28',
        '2026-07-29',
        '2026-07-30',
        '2026-07-31',
        '2026-08-01',
        '2026-08-02',
        '2026-08-03',
        '2026-08-04',
        '2026-08-05',
        '2026-08-06',
        '2026-08-07',
        '2026-08-08',
        '2026-08-09',
        '2026-08-10',
        '2026-08-11',
        '2026-08-12',
        '2026-08-13',
        '2026-08-14',
        '2026-08-15',
        '2026-08-16',
        '2026-08-17',
        '2026-08-18',
        '2026-08-19',
        '2026-08-20',
        '2026-08-21',
        '2026-08-22',
        '2026-08-23',
        '2026-08-24',
        '2026-08-25',
        '2026-08-26',
        '2026-08-27',
        '2026-08-28',
        '2026-08-29',
        '2026-08-30',
        '2026-08-31'        
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
