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
    MAX_CONCURRENT_SESSIONS: 12,
    
    // Time windows for scheduling (in days)
    SESSION1_WINDOW_DAYS: 7,
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
        'Wednesday',
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
        '2026-05-16', // Hemelvaart
        '2026-05-25' // Pinksteren        
    ]),



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
