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
    MAX_CONCURRENT_SESSIONS: 14,
    
    // Time windows for scheduling (in days)
    SESSION1_WINDOW_DAYS: 14, // Next 2 weeks for first available session
    FOLLOW_UP_WINDOW_DAYS: 21, // 3 weeks after first session for remaining sessions
    BACKUP_WINDOW_DAYS: 7,    // 7 days after last regular session for backups
    
    // Minimum consecutive available days required for experiment sessions
    MIN_AVAILABLE_DAYS: 28, // Ensure 28 consecutive days are available for follow-up sessions
    
    // Time slot options for instruction sessions
    TIME_SLOTS: [
        '11:00',
        '13:00',
        '17:00',
    ],
    
    // Blocked dates - no instruction sessions may be scheduled on these dates
    // Blocked dates are converted to a Set for efficient O(1) lookups.
    BLOCKED_DATES: new Set([
        '2026-01-09',
        '2026-01-13',
        '2026-01-16',
        
    ])
};
