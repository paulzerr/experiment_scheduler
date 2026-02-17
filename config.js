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
    MAX_CONCURRENT_SESSIONS: 14,
    
    // Time windows for scheduling (in days)
    SESSION1_WINDOW_DAYS: 14, // Next 2 weeks for first available session
    EXPERIMENT_WINDOW_DAYS: 25, // 25 days after first session for remaining experiment nights
    
    // Minimum consecutive available days required for experiment sessions
    MIN_AVAILABLE_DAYS: 25, // Ensure 25 consecutive days are available for experiment sessions
    
    // Time slot options for instruction sessions
    TIME_SLOTS: [
        '11:00',
        '13:00',
        '16:00',
    ],

    // Instruction-session weekdays that should be blocked
    // Use full weekday names (case-insensitive), e.g. 'Saturday', 'Tuesday'
    INSTRUCTION_BLOCKED_WEEKDAYS: new Set([
        'Saturday',
        'Sunday'
    ]),
    
    // Blocked dates - no instruction sessions may be scheduled on these dates
    // Blocked dates are converted to a Set for efficient O(1) lookups.
    BLOCKED_DATES: new Set([
        '2026-03-13',
        '2026-03-16',
        '2026-03-17', 
        '2026-03-18', 
        '2026-03-19', 
        '2026-03-20', 
        '2026-03-23',
        '2026-03-27',
        '2026-04-03'
    ]),

    // Blocked instruction date-time ranges.
    // Only affects instruction timeslot eligibility; experiment-night selection is unchanged.
    // Each range blocks slots where slot start time is within [start, end).
    // Example: block 13:00 on Feb 1, 2026:
    // { date: '2026-02-01', start: '13:00', end: '14:00' }
    INSTRUCTION_BLOCKED_DATE_TIME_RANGES: [
        { date: '2026-02-01', start: '13:00', end: '14:00' },
        { date: '2026-02-02', start: '14:00', end: '18:00' }
    ]
};

excessiveLogConfig('config.js loaded: Supabase configuration object created', {
    url: SUPABASE_CONFIG.URL,
    anonKeyLength: SUPABASE_CONFIG.ANON_KEY.length
});
excessiveLogConfig('config.js loaded: Scheduler configuration object created', {
    totalSessions: SCHEDULER_CONFIG.TOTAL_SESSIONS,
    maxConcurrentSessions: SCHEDULER_CONFIG.MAX_CONCURRENT_SESSIONS,
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
