// dateManager.js - Centralized date management utilities

const EXCESSIVE_LOG_MARKER_DATE_MANAGER = '[EXCESSIVE_TRACE]';
function excessiveLogDateManager(message, payload) {
    if (payload === undefined) {
        console.log(EXCESSIVE_LOG_MARKER_DATE_MANAGER, message);
    } else {
        console.log(EXCESSIVE_LOG_MARKER_DATE_MANAGER, message, payload);
    }
}

function serializeDateManagerDate(date) {
    if (!date) return null;
    if (!(date instanceof Date)) return { nonDateValue: date };
    return {
        iso: isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString(),
        time: date.getTime()
    };
}

class DateManager {
    /**
     * Converts a Date object or a string into a YYYY-MM-DD string.
     * @param {Date|string} date - The date to convert.
     * @returns {string|null} The date in YYYY-MM-DD format or null if input is invalid.
     */
    static toYYYYMMDD(date) {
        excessiveLogDateManager('DateManager.toYYYYMMDD called', { input: date });
        if (!date) {
            excessiveLogDateManager('DateManager.toYYYYMMDD returning null because input is falsy', { input: date });
            return null;
        }

        const d = new Date(date);
        excessiveLogDateManager('DateManager.toYYYYMMDD created Date instance', serializeDateManagerDate(d));
        if (isNaN(d.getTime())) {
            excessiveLogDateManager('DateManager.toYYYYMMDD returning null because date is invalid', { input: date });
            return null;
        }
        
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        excessiveLogDateManager('DateManager.toYYYYMMDD extracted UTC parts', { year, month, day });
        
        const result = `${year}-${month}-${day}`;
        excessiveLogDateManager('DateManager.toYYYYMMDD returning result', { result });
        return result;
    }

    /**
     * Converts various date inputs into a UTC Date object at midnight.
     * This ensures consistency and avoids timezone-related issues.
     * @param {Date|string} dateInput - The date to convert.
     * @returns {Date|null} A new Date object set to midnight UTC, or null if input is invalid.
     */
    static toUTCDate(dateInput) {
        excessiveLogDateManager('DateManager.toUTCDate called', { input: dateInput, inputType: typeof dateInput });
        if (!dateInput) {
            excessiveLogDateManager('DateManager.toUTCDate returning null because input is falsy', { input: dateInput });
            return null;
        }

        let date;
        if (dateInput instanceof Date) {
            date = new Date(dateInput);
            excessiveLogDateManager('DateManager.toUTCDate cloned Date instance input', serializeDateManagerDate(date));
        } else if (typeof dateInput === 'string') {
            // Handles 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ss...'
            const datePart = dateInput.split('T')[0];
            const parts = datePart.split('-').map(Number);
            excessiveLogDateManager('DateManager.toUTCDate parsed string input', { datePart, parts });
            if (parts.length === 3 && parts.every(p => !isNaN(p))) {
                // new Date(year, monthIndex, day)
                date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
                excessiveLogDateManager('DateManager.toUTCDate constructed UTC date from parsed parts', serializeDateManagerDate(date));
            } else {
                excessiveLogDateManager('DateManager.toUTCDate string input did not have 3 numeric parts', { dateInput, partsLength: parts.length });
            }
        } else {
            excessiveLogDateManager('DateManager.toUTCDate encountered unsupported input type', { inputType: typeof dateInput });
        }

        if (date && !isNaN(date.getTime())) {
            date.setUTCHours(0, 0, 0, 0);
            excessiveLogDateManager('DateManager.toUTCDate normalized date to midnight UTC', serializeDateManagerDate(date));
            return date;
        }

        excessiveLogDateManager('DateManager.toUTCDate returning null because no valid date was produced', { input: dateInput });
        return null;
    }

    /**
     * Formats a Date object for display.
     * @param {Date} date - The date to format.
     * @returns {string} Human-readable date string.
     */
    static formatForDisplay(date) {
        excessiveLogDateManager('DateManager.formatForDisplay called', { input: serializeDateManagerDate(date) });
        if (!date) {
            excessiveLogDateManager('DateManager.formatForDisplay returning N/A because input is falsy');
            return 'N/A';
        }

        const formatted = date.toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        });
        excessiveLogDateManager('DateManager.formatForDisplay returning formatted date', { formatted });
        return formatted;
    }

    /**
     * Gets the next work day (Monday-Friday)
     * @param {Date} date - Starting date
     * @returns {Date} Next work day
     */
    static getNextWorkDay(date) {
        excessiveLogDateManager('DateManager.getNextWorkDay called', { input: serializeDateManagerDate(date) });
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        excessiveLogDateManager('DateManager.getNextWorkDay initial next day computed', { nextDay: serializeDateManagerDate(nextDay) });
        
        const dayOfWeek = nextDay.getDay();
        excessiveLogDateManager('DateManager.getNextWorkDay evaluated dayOfWeek', { dayOfWeek });
        if (dayOfWeek === 0) { // Sunday
            nextDay.setDate(nextDay.getDate() + 1);
            excessiveLogDateManager('DateManager.getNextWorkDay adjusted Sunday to Monday', { adjusted: serializeDateManagerDate(nextDay) });
        } else if (dayOfWeek === 6) { // Saturday
            nextDay.setDate(nextDay.getDate() + 2);
            excessiveLogDateManager('DateManager.getNextWorkDay adjusted Saturday to Monday', { adjusted: serializeDateManagerDate(nextDay) });
        }
        
        excessiveLogDateManager('DateManager.getNextWorkDay returning', { output: serializeDateManagerDate(nextDay) });
        return nextDay;
    }


    /**
     * Generates experiment-night options starting from a base date.
     * @param {Date} baseDate - The base date.
     * @param {number} days - Number of days to generate.
     * @returns {Date[]} Array of Date objects.
     */
    static generateExperimentDates(baseDate, days) {
        excessiveLogDateManager('DateManager.generateExperimentDates called', {
            baseDate: serializeDateManagerDate(baseDate),
            days
        });
        const startDate = this.toUTCDate(baseDate);
        excessiveLogDateManager('DateManager.generateExperimentDates normalized base date', {
            startDate: serializeDateManagerDate(startDate)
        });
        if (!startDate) {
            excessiveLogDateManager('DateManager.generateExperimentDates returning empty array because normalized date is null');
            return [];
        }

        const dates = [];
        for (let i = 1; i <= days; i++) {
            const newDate = new Date(startDate);
            newDate.setUTCDate(startDate.getUTCDate() + i);
            dates.push(newDate);
            excessiveLogDateManager('DateManager.generateExperimentDates pushed date', {
                index: i,
                generated: serializeDateManagerDate(newDate)
            });
        }
        excessiveLogDateManager('DateManager.generateExperimentDates returning generated dates', {
            count: dates.length,
            preview: dates.map(d => d.toISOString())
        });
        return dates;
    }

    /**
     * Checks if a date is blocked.
     * @param {Date} date - The date to check.
     * @returns {boolean} True if the date is blocked.
     */
    static isDateBlocked(date) {
        excessiveLogDateManager('DateManager.isDateBlocked called', { input: serializeDateManagerDate(date) });
        const dateString = this.toYYYYMMDD(date);
        // Correctly check if the Set has the date string
        const isBlocked = SCHEDULER_CONFIG.BLOCKED_DATES.has(dateString);
        excessiveLogDateManager('DateManager.isDateBlocked evaluated', { dateString, isBlocked });
        return isBlocked;
    }

    /**
     * Checks if a given date is a weekend (Saturday or Sunday).
     * @param {Date} date The date to check.
     * @returns {boolean} True if the date is a weekend, false otherwise.
     */
    static isWeekend(date) {
        excessiveLogDateManager('DateManager.isWeekend called', { input: serializeDateManagerDate(date) });
        if (!date || isNaN(date.getTime())) {
            excessiveLogDateManager('DateManager.isWeekend returning false because input is invalid');
            return false; // Or throw an error, depending on desired strictness
        }
        const dayOfWeek = date.getUTCDay(); // 0 for Sunday, 6 for Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        excessiveLogDateManager('DateManager.isWeekend evaluated', { dayOfWeek, isWeekend });
        return isWeekend;
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
        excessiveLogDateManager('DateManager.findExperimentStartDate called', {
            searchStartDate: serializeDateManagerDate(searchStartDate),
            dateCountMapSize: dateCountMap?.size || 0,
            config
        });
        const { MIN_AVAILABLE_DAYS, MAX_CONCURRENT_SESSIONS, BLOCKED_DATES } = config;
        const searchRangeDays = 365;
        excessiveLogDateManager('DateManager.findExperimentStartDate using search parameters', {
            MIN_AVAILABLE_DAYS,
            MAX_CONCURRENT_SESSIONS,
            blockedDatesCount: BLOCKED_DATES?.size || 0,
            searchRangeDays
        });

        // 1. Create a status map for the entire search range
        const statusMap = [];
        let currentDate = this.toUTCDate(searchStartDate);
        excessiveLogDateManager('DateManager.findExperimentStartDate normalized search start date', {
            currentDate: serializeDateManagerDate(currentDate)
        });

        for (let i = 0; i < searchRangeDays + MIN_AVAILABLE_DAYS; i++) {
            const dateStr = this.toYYYYMMDD(currentDate);
            const dayOfWeek = currentDate.getUTCDay();
            const bookingCount = dateCountMap.get(dateStr) || 0;
            const isWeekend = this.isWeekend(currentDate);
            const isGloballyBlocked = this.isDateBlocked(currentDate);
            const isFull = bookingCount >= MAX_CONCURRENT_SESSIONS;
            
            statusMap.push({
                date: new Date(currentDate),
                isWeekend: isWeekend,
                isGloballyBlocked: isGloballyBlocked,
                isFull: isFull,
            });
            excessiveLogDateManager('DateManager.findExperimentStartDate statusMap entry created', {
                index: i,
                dateStr,
                dayOfWeek,
                bookingCount,
                isWeekend,
                isGloballyBlocked,
                isFull
            });

            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            excessiveLogDateManager('DateManager.findExperimentStartDate incremented currentDate', {
                nextCurrentDate: serializeDateManagerDate(currentDate)
            });
        }

        excessiveLogDateManager('DateManager.findExperimentStartDate statusMap build complete', {
            statusMapLength: statusMap.length
        });

        // 2. Iterate through the status map to find a valid start date
        for (let i = 0; i <= searchRangeDays; i++) {
            const potentialStartDate = statusMap[i];
            excessiveLogDateManager('DateManager.findExperimentStartDate evaluating candidate', {
                candidateIndex: i,
                candidateDate: serializeDateManagerDate(potentialStartDate?.date),
                candidateStatus: potentialStartDate
            });

            // Rule 1: Check if the potential start date is a valid first session day
            const isStartDateValid = !potentialStartDate.isWeekend &&
                                     !potentialStartDate.isGloballyBlocked &&
                                     !potentialStartDate.isFull;
            excessiveLogDateManager('DateManager.findExperimentStartDate start-date validity evaluated', {
                candidateIndex: i,
                isStartDateValid
            });

            if (isStartDateValid) {
                // Rule 2: Check if the subsequent required period is valid (not full)
                const experimentWindow = statusMap.slice(i, i + MIN_AVAILABLE_DAYS);
                excessiveLogDateManager('DateManager.findExperimentStartDate extracted experiment window', {
                    candidateIndex: i,
                    windowLength: experimentWindow.length,
                    windowDates: experimentWindow.map(day => day.date.toISOString())
                });
                const isWindowValid = experimentWindow.every(day => !day.isFull);
                excessiveLogDateManager('DateManager.findExperimentStartDate window validity evaluated', {
                    candidateIndex: i,
                    isWindowValid,
                    fullDaysInWindow: experimentWindow.filter(day => day.isFull).map(day => day.date.toISOString())
                });

                if (isWindowValid) {
                    excessiveLogDateManager('DateManager.findExperimentStartDate returning valid date', {
                        candidateIndex: i,
                        result: serializeDateManagerDate(potentialStartDate.date)
                    });
                    return potentialStartDate.date; // Found a valid start date
                }
            }
        }

        excessiveLogDateManager('DateManager.findExperimentStartDate returning null because no valid date found');
        return null; // No valid start date found in the entire range
    }

    /**
     * Checks whether a given start date has a full consecutive capacity window.
     * This enforces the same window-capacity rule used when finding the initial experiment start date.
     * @param {Date} startDate - Candidate start date.
     * @param {Map<string, number>} dateCountMap - Map of dates (YYYY-MM-DD) to booking counts.
     * @param {object} config - Scheduler configuration object.
     * @returns {boolean} True if every day in the window is not full.
     */
    static hasConsecutiveCapacityWindow(startDate, dateCountMap, config) {
        excessiveLogDateManager('DateManager.hasConsecutiveCapacityWindow called', {
            startDate: serializeDateManagerDate(startDate),
            dateCountMapSize: dateCountMap?.size || 0,
            config
        });

        if (!dateCountMap || typeof dateCountMap.get !== 'function') {
            excessiveLogDateManager('DateManager.hasConsecutiveCapacityWindow returning false because dateCountMap is invalid', {
                dateCountMap
            });
            return false;
        }

        const normalizedStartDate = this.toUTCDate(startDate);
        if (!normalizedStartDate) {
            excessiveLogDateManager('DateManager.hasConsecutiveCapacityWindow returning false because startDate is invalid', {
                startDate
            });
            return false;
        }

        const { MIN_AVAILABLE_DAYS, MAX_CONCURRENT_SESSIONS } = config;
        excessiveLogDateManager('DateManager.hasConsecutiveCapacityWindow using window parameters', {
            normalizedStartDate: serializeDateManagerDate(normalizedStartDate),
            MIN_AVAILABLE_DAYS,
            MAX_CONCURRENT_SESSIONS
        });

        for (let i = 0; i < MIN_AVAILABLE_DAYS; i++) {
            const checkDate = new Date(normalizedStartDate);
            checkDate.setUTCDate(normalizedStartDate.getUTCDate() + i);
            const dateStr = this.toYYYYMMDD(checkDate);
            const bookingCount = dateCountMap.get(dateStr) || 0;
            const isFull = bookingCount >= MAX_CONCURRENT_SESSIONS;

            excessiveLogDateManager('DateManager.hasConsecutiveCapacityWindow evaluated day in window', {
                offsetDays: i,
                checkDate: serializeDateManagerDate(checkDate),
                dateStr,
                bookingCount,
                isFull
            });

            if (isFull) {
                excessiveLogDateManager('DateManager.hasConsecutiveCapacityWindow returning false because window contains full day', {
                    offsetDays: i,
                    dateStr,
                    bookingCount
                });
                return false;
            }
        }

        excessiveLogDateManager('DateManager.hasConsecutiveCapacityWindow returning true because all days passed');
        return true;
    }
}
