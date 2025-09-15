// dateManager.js - Centralized date management utilities

class DateManager {
    /**
     * Converts a Date object or a string into a YYYY-MM-DD string.
     * @param {Date|string} date - The date to convert.
     * @returns {string|null} The date in YYYY-MM-DD format or null if input is invalid.
     */
    static toYYYYMMDD(date) {
        if (!date) return null;
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;
        
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }

    /**
     * Converts various date inputs into a UTC Date object at midnight.
     * This ensures consistency and avoids timezone-related issues.
     * @param {Date|string} dateInput - The date to convert.
     * @returns {Date|null} A new Date object set to midnight UTC, or null if input is invalid.
     */
    static toUTCDate(dateInput) {
        if (!dateInput) return null;

        let date;
        if (dateInput instanceof Date) {
            date = new Date(dateInput);
        } else if (typeof dateInput === 'string') {
            // Handles 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ss...'
            // Treat the string as being in the local timezone
            date = new Date(dateInput);
        }

        if (date && !isNaN(date.getTime())) {
            // Set time to midnight in the local timezone, not UTC
            date.setHours(0, 0, 0, 0);
            return date;
        }

        return null;
    }

    /**
     * Formats a Date object for display.
     * @param {Date} date - The date to format.
     * @returns {string} Human-readable date string.
     */
    static formatForDisplay(date) {
        if (!date) return 'N/A';
        const options = {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Amsterdam'
        };
        return new Intl.DateTimeFormat('en-US', options).format(date);
    }

    /**
     * Gets the next work day (Monday-Friday)
     * @param {Date} date - Starting date
     * @returns {Date} Next work day
     */
    static getNextWorkDay(date) {
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        
        const dayOfWeek = nextDay.getDay();
        if (dayOfWeek === 0) { // Sunday
            nextDay.setDate(nextDay.getDate() + 1);
        } else if (dayOfWeek === 6) { // Saturday
            nextDay.setDate(nextDay.getDate() + 2);
        }
        
        return nextDay;
    }


    /**
     * Generates follow-up dates starting from a base date.
     * @param {Date} baseDate - The base date.
     * @param {number} days - Number of days to generate.
     * @returns {Date[]} Array of Date objects.
     */
    static generateFollowUpDates(baseDate, days) {
        const startDate = this.toUTCDate(baseDate);
        if (!startDate) return [];

        const dates = [];
        for (let i = 1; i <= days; i++) {
            const newDate = new Date(startDate);
            newDate.setUTCDate(startDate.getUTCDate() + i);
            dates.push(newDate);
        }
        return dates;
    }

    /**
     * Generates backup dates starting from the day after the last session.
     * @param {Date[]} sessionDates - Array of session dates.
     * @param {number} days - Number of backup days to generate.
     * @returns {Date[]} Array of Date objects.
     */
    static generateBackupDates(sessionDates, days) {
        if (!sessionDates || sessionDates.length === 0) return [];
        
        const sortedSessions = [...sessionDates].sort((a, b) => a.getTime() - b.getTime());
        const lastSessionDate = sortedSessions[sortedSessions.length - 1];

        const dates = [];
        for (let i = 1; i <= days; i++) {
            const newDate = new Date(lastSessionDate);
            newDate.setUTCDate(lastSessionDate.getUTCDate() + i);
            dates.push(newDate);
        }
        return dates;
    }

    /**
     * Checks if a date is blocked.
     * @param {Date} date - The date to check.
     * @returns {boolean} True if the date is blocked.
     */
    static isDateBlocked(date) {
        const dateString = this.toYYYYMMDD(date);
        // Correctly check if the Set has the date string
        return SCHEDULER_CONFIG.BLOCKED_DATES.has(dateString);
    }

    /**
     * Checks if a given date is a weekend (Saturday or Sunday).
     * @param {Date} date The date to check.
     * @returns {boolean} True if the date is a weekend, false otherwise.
     */
    static isWeekend(date) {
        if (!date || isNaN(date.getTime())) {
            return false; // Or throw an error, depending on desired strictness
        }
        const dayOfWeek = date.getUTCDay(); // 0 for Sunday, 6 for Saturday
        return dayOfWeek === 0 || dayOfWeek === 6;
    }

    /**
     * Finds the first valid start date for an experiment based on a set of rules.
     * It pre-calculates the status of each day in a search range and then finds a valid slot.
     * @param {Date} searchStartDate - The date to start searching from.
     * @param {Map<string, number>} dateCountMap - A map of dates (YYYY-MM-DD) to their booking count.
     * @param {object} config - The scheduler configuration object.
     * @returns {Date|null} The first valid Date for the experiment, or null if none is found.
     */
    static findExperimentStartDate(searchStartDate, dateCountMap, config) {
        const { MIN_AVAILABLE_DAYS, MAX_CONCURRENT_SESSIONS, BLOCKED_DATES } = config;
        const searchRangeDays = 365;

        // 1. Create a status map for the entire search range
        const statusMap = [];
        let currentDate = this.toUTCDate(searchStartDate);

        for (let i = 0; i < searchRangeDays + MIN_AVAILABLE_DAYS; i++) {
            const dateStr = this.toYYYYMMDD(currentDate);
            const dayOfWeek = currentDate.getUTCDay();
            
            statusMap.push({
                date: new Date(currentDate),
                isWeekend: this.isWeekend(currentDate),
                isGloballyBlocked: this.isDateBlocked(currentDate),
                isFull: (dateCountMap.get(dateStr) || 0) >= MAX_CONCURRENT_SESSIONS,
            });

            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }

        // 2. Iterate through the status map to find a valid start date
        for (let i = 0; i <= searchRangeDays; i++) {
            const potentialStartDate = statusMap[i];

            // Rule 1: Check if the potential start date is a valid first session day
            const isStartDateValid = !potentialStartDate.isWeekend &&
                                     !potentialStartDate.isGloballyBlocked &&
                                     !potentialStartDate.isFull;

            if (isStartDateValid) {
                // Rule 2: Check if the subsequent 28-day period is valid (not full)
                const experimentWindow = statusMap.slice(i, i + MIN_AVAILABLE_DAYS);
                const isWindowValid = experimentWindow.every(day => !day.isFull);

                if (isWindowValid) {
                    return potentialStartDate.date; // Found a valid start date
                }
            }
        }

        return null; // No valid start date found in the entire range
    }
}