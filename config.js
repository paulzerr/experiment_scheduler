// config.js - Configuration settings for the Experiment Scheduler

// Supabase Configuration
const SUPABASE_CONFIG = {
    URL: 'https://xiupbovpolvimeayboig.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpdXBib3Zwb2x2aW1lYXlib2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1MTQ5ODMsImV4cCI6MjA1NzA5MDk4M30.r-b6VnDBSB6D_LYj0CF1fdiQ66eJVGzakGguSV7619U'
};

// Scheduler Configuration
const SCHEDULER_CONFIG = {
    // Total number of experiment sessions to schedule
    TOTAL_SESSIONS: 15,
    
    // Number of backup sessions
    NUM_BACKUP_SESSIONS: 3,
    
    // Maximum number of concurrent sessions (based on available devices)
    MAX_CONCURRENT_SESSIONS: 15,
    
    // Time windows for scheduling (in days)
    SESSION1_WINDOW_DAYS: 14, // Next 2 weeks for first available session
    FOLLOW_UP_WINDOW_DAYS: 21, // 3 weeks after first session for remaining sessions
    BACKUP_WINDOW_DAYS: 7,    // 7 days after last regular session for backups
    
    // Minimum consecutive available days required for experiment sessions
    MIN_AVAILABLE_DAYS: 28, // Ensure 28 consecutive days are available for follow-up sessions
    
    // Time slot options for instruction sessions
    TIME_SLOTS: [
        '11:00',
        '11:30',
        '12:00',
        '12:30',
        '13:00',
        '13:30',
        '14:00',
        '14:30',
        '15:00',
        '15:30',
        '16:00',
        '16:30',
        '17:00',
    ],
    
    // Blocked dates - no instruction sessions may be scheduled on these dates
    // Blocked dates are converted to a Set for efficient O(1) lookups.
    BLOCKED_DATES: new Set([
        '2025-12-23',
        '2025-12-24',
        '2025-12-25',
        '2025-12-26',
        '2025-12-27',
        '2025-12-28',
        '2025-12-29',
        '2025-12-30',
        '2025-12-31',
        '2026-01-01',
        '2026-01-02',
        '2026-01-03',
        '2026-01-04',
        
    ])
};
