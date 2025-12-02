// sessionManager.js - Manages session selection and validation

class SessionManager {
    constructor(config) {
        this.config = config;
        this.selectedSessions = [];
        this.selectedBackups = [];
        this.selectedTimeslot = null;
        this.dateCountMap = new Map();
        this.takenDateTimeSlots = new Map();
    }

    /**
     * Updates the maps of booked/taken dates and timeslots.
     * The keys for the maps are YYYY-MM-DD strings.
     * @param {Map<string, number>} dateCountMap - Map of dates to their booking counts.
     * @param {Map<string, number>} takenDateTimeSlots - Map of 'YYYY-MM-DD_HH:mm' strings to count of bookings.
     */
    updateAvailability(dateCountMap, takenDateTimeSlots) {
        this.dateCountMap = dateCountMap;
        this.takenDateTimeSlots = takenDateTimeSlots;
    }

    /**
     * Checks if a date is available for booking.
     * @param {Date} date - The date to check.
     * @returns {boolean} True if the date is available.
     */
    isDateAvailable(date) {
        const dateString = DateManager.toYYYYMMDD(date);
        const currentCount = this.dateCountMap.get(dateString) || 0;
        return currentCount < this.config.MAX_CONCURRENT_SESSIONS;
    }

    /**
     * Checks if a date is available for the first session (instruction session).
     * @param {Date} date - The date to check.
     * @returns {boolean} True if available for an instruction session.
     */
    isDateAvailableForInstruction(date) {
        const instructionSessionsCount = this.countInstructionSessionsOnDate(date);
        
        // Check if there are any valid timeslots remaining for this date
        // considering the 48-hour rule
        const availableSlots = this.getAvailableTimeSlots(date);
        const hasValidSlots = availableSlots.length > 0;

        return this.isDateAvailable(date) &&
               !DateManager.isDateBlocked(date) &&
               !DateManager.isWeekend(date) &&
               instructionSessionsCount < 3 &&
               hasValidSlots;
    }

    /**
     * Counts the number of instruction sessions already scheduled on a given date.
     * @param {Date} date - The date to check.
     * @returns {number} The number of instruction sessions on that date.
     */
    countInstructionSessionsOnDate(date) {
        const dateString = DateManager.toYYYYMMDD(date);
        let count = 0;
        for (const dateTimeSlot of this.takenDateTimeSlots.keys()) {
            if (dateTimeSlot.startsWith(dateString)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Gets available time slots for a given date, enforcing a 2.5-hour gap.
     * Allows up to 2 concurrent intakes on the SAME timeslot.
     * Filters out slots less than 48 hours from now.
     * @param {Date} date - The date for which to get available time slots.
     * @returns {string[]} An array of available time slot strings.
     */
    getAvailableTimeSlots(date) {
        const dateString = DateManager.toYYYYMMDD(date);
        const takenSlotsMap = new Map(); // time -> count

        for (const [key, count] of this.takenDateTimeSlots) {
            if (key.startsWith(dateString)) {
                const time = key.split('_')[1];
                takenSlotsMap.set(time, count);
            }
        }

        const timeToMinutes = (time) => {
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const gap = 150; // 2.5 hours in minutes
        const now = new Date();
        const minTime = now.getTime() + (48 * 60 * 60 * 1000); // 48 hours from now

        return this.config.TIME_SLOTS.filter(slot => {
            const [hours, minutes] = slot.split(':').map(Number);
            const slotDate = new Date(date);
            slotDate.setUTCHours(hours, minutes, 0, 0);

            // 0. Check 48-hour rule
            if (slotDate.getTime() < minTime) {
                return false;
            }

            // 0.5 Check Friday block (10:00 - 14:29)
            // 5 is Friday in getUTCDay() (0=Sun, 1=Mon, ..., 5=Fri, 6=Sat)
            if (slotDate.getUTCDay() === 5) {
                const slotTimeInMinutes = hours * 60 + minutes;
                const blockStart = 10 * 60;      // 10:00
                const blockEnd = 14 * 60 + 29;   // 14:29
                
                if (slotTimeInMinutes >= blockStart && slotTimeInMinutes <= blockEnd) {
                    return false;
                }
            }

            // 0.6 Check Monday block (before 13:00)
            // 1 is Monday in getUTCDay()
            if (slotDate.getUTCDay() === 1) {
                const slotTimeInMinutes = hours * 60 + minutes;
                const blockEnd = 13 * 60; // 13:00
                
                if (slotTimeInMinutes < blockEnd) {
                    return false;
                }
            }

            const slotMinutes = timeToMinutes(slot);
            const slotCount = takenSlotsMap.get(slot) || 0;

            // 1. Check capacity (max 2 concurrent intakes)
            if (slotCount >= 2) {
                return false;
            }

            // 2. Check conflicts with OTHER slots
            // If we pick this slot, it must not overlap with any OTHER occupied slot.
            for (const [takenTime, _] of takenSlotsMap) {
                if (takenTime === slot) continue; // Ignore self (we can add to existing slot if count < 2)

                const takenMinutes = timeToMinutes(takenTime);
                if (Math.abs(slotMinutes - takenMinutes) < gap) {
                    return false; // Overlaps with a different active slot
                }
            }
            
            return true;
        });
    }

    /**
     * Checks if a timeslot is available on a specific date.
     * @param {string} timeslot - The timeslot (e.g., '14:00').
     * @param {Date} date - The date to check against.
     * @returns {boolean} True if the timeslot is available.
     */
    isTimeslotAvailable(timeslot, date) {
        if (!date) return true; // If no date, assume available
        
        const [hours, minutes] = timeslot.split(':').map(Number);
        const slotDate = new Date(date);
        slotDate.setUTCHours(hours, minutes, 0, 0);
        const now = new Date();
        const minTime = now.getTime() + (48 * 60 * 60 * 1000); // 48 hours from now
        
        // 0. Check 48-hour rule
        if (slotDate.getTime() < minTime) {
            return false;
        }

        // 0.5 Check Friday block (10:00 - 14:29)
        if (slotDate.getUTCDay() === 5) {
            const slotTimeInMinutes = hours * 60 + minutes;
            const blockStart = 10 * 60;      // 10:00
            const blockEnd = 14 * 60 + 29;   // 14:29
            
            if (slotTimeInMinutes >= blockStart && slotTimeInMinutes <= blockEnd) {
                return false;
            }
        }

        // 0.6 Check Monday block (before 13:00)
        if (slotDate.getUTCDay() === 1) {
            const slotTimeInMinutes = hours * 60 + minutes;
            const blockEnd = 13 * 60; // 13:00
            
            if (slotTimeInMinutes < blockEnd) {
                return false;
            }
        }

        const dateString = DateManager.toYYYYMMDD(date);
        const dateTimeKey = `${dateString}_${timeslot}`;
        const count = this.takenDateTimeSlots.get(dateTimeKey) || 0;

        // 1. Check capacity
        if (count >= 2) return false;

        // 2. Check conflicts with OTHER slots
        const timeToMinutes = (time) => {
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const slotMinutes = timeToMinutes(timeslot);
        const gap = 150; // 2.5 hours in minutes

        for (const [key, _] of this.takenDateTimeSlots) {
            if (key.startsWith(dateString)) {
                const takenTime = key.split('_')[1];
                if (takenTime === timeslot) continue; // Ignore self

                const takenMinutes = timeToMinutes(takenTime);
                if (Math.abs(slotMinutes - takenMinutes) < gap) {
                    return false; // Overlaps with a different active slot
                }
            }
        }

        return true;
    }

    /**
     * Selects or deselects the first session.
     * @param {Date} date - The selected date.
     * @returns {Object} Result with success status and flags.
     */
    selectFirstSession(date) {
        const previousFirst = this.selectedSessions.length > 0 ? this.selectedSessions[0] : null;
        const wasSelected = previousFirst && previousFirst.getTime() === date.getTime();

        if (wasSelected) {
            this.selectedSessions = []; // Deselect
            return { success: true, reset: true, deselected: true };
        } else {
            this.selectedSessions = [date];
            // Reset subsequent steps if the first session changes
            const needsReset = !previousFirst || previousFirst.getTime() !== date.getTime();
            if (needsReset) {
                this.selectedBackups = [];
                this.selectedTimeslot = null;
            }
            return { success: true, reset: needsReset, deselected: false };
        }
    }

    /**
     * Finds the index of a date in an array of Date objects.
     * @param {Date} date - The date to find.
     * @param {Date[]} dateArray - The array to search in.
     * @returns {number} The index of the date, or -1 if not found.
     */
    _findDateIndex(date, dateArray) {
        return dateArray.findIndex(d => d.getTime() === date.getTime());
    }

    /**
     * Selects or deselects a follow-up session.
     * @param {Date} date - The selected date.
     * @returns {Object} Result with success status and message.
     */
    selectFollowUpSession(date) {
        const sessionIndex = this._findDateIndex(date, this.selectedSessions);

        if (sessionIndex > -1) {
            this.selectedSessions.splice(sessionIndex, 1);
            this.selectedBackups = []; // Clear backups when regular sessions change
            return { success: true, deselected: true };
        } else {
            if (this.selectedSessions.length >= this.config.TOTAL_SESSIONS) {
                return {
                    success: false,
                    error: `You can only select ${this.config.TOTAL_SESSIONS} total sessions.`
                };
            }
            this.selectedSessions.push(date);
            return { success: true, deselected: false };
        }
    }

    /**
     * Selects or deselects a backup session.
     * @param {Date} date - The selected date.
     * @returns {Object} Result with success status and message.
     */
    selectBackupSession(date) {
        const backupIndex = this._findDateIndex(date, this.selectedBackups);

        if (backupIndex > -1) {
            this.selectedBackups.splice(backupIndex, 1);
            return { success: true, deselected: true };
        } else {
            if (this.selectedBackups.length >= this.config.NUM_BACKUP_SESSIONS) {
                return {
                    success: false,
                    error: `You can only select ${this.config.NUM_BACKUP_SESSIONS} backup sessions.`
                };
            }
            this.selectedBackups.push(date);
            return { success: true, deselected: false };
        }
    }

    /**
     * Sets the selected timeslot
     * @param {string} timeslot - Time slot string
     */
    setTimeslot(timeslot) {
        this.selectedTimeslot = timeslot;
    }

    /**
     * Checks if all required selections are complete
     * @returns {boolean} True if ready for review
     */
    isReadyForReview() {
        return this.selectedSessions.length === this.config.TOTAL_SESSIONS &&
               this.selectedBackups.length === this.config.NUM_BACKUP_SESSIONS &&
               this.selectedTimeslot !== null;
    }

    /**
     * Gets the remaining sessions needed
     * @returns {number} Number of remaining sessions
     */
    getRemainingSessionsCount() {
        return Math.max(0, this.config.TOTAL_SESSIONS - this.selectedSessions.length);
    }

    /**
     * Gets the follow-up sessions count (excluding first session)
     * @returns {number} Number of follow-up sessions selected
     */
    getFollowUpCount() {
        return this.selectedSessions.length > 1 ? this.selectedSessions.length - 1 : 0;
    }

    /**
     * Checks if a date is already selected in the main sessions.
     * @param {Date} date - The date to check.
     * @returns {boolean} True if the date is selected.
     */
    isDateSelectedInSessions(date) {
        return this._findDateIndex(date, this.selectedSessions) > -1;
    }

    /**
     * Checks if a date is already selected in the backup sessions.
     * @param {Date} date - The date to check.
     * @returns {boolean} True if the date is selected.
     */
    isDateSelectedInBackups(date) {
        return this._findDateIndex(date, this.selectedBackups) > -1;
    }

    /**
     * Gets sorted session and backup data for submission.
     * Converts Date objects to YYYY-MM-DD strings for the database.
     * @returns {Object} Sorted session data for submission.
     */
    getEquipmentDays() {
        if (this.selectedSessions.length === 0) {
            return [];
        }

        const allDates = [...this.selectedSessions, ...this.selectedBackups].sort((a, b) => a.getTime() - b.getTime());
        const firstDay = allDates[0];
        const lastDay = allDates[allDates.length - 1];

        // Calculate the cleaning day
        const cleaningDay = new Date(lastDay);
        cleaningDay.setDate(cleaningDay.getDate() + 1);
        const finalCleaningDay = DateManager.getNextWorkDay(cleaningDay);

        // Generate all days from the first session to the final cleaning day
        const equipmentDays = [];
        let currentDay = new Date(firstDay);

        while (currentDay <= finalCleaningDay) {
            equipmentDays.push(DateManager.toYYYYMMDD(currentDay));
            currentDay.setDate(currentDay.getDate() + 1);
        }

        return equipmentDays;
    }

    getSubmissionData() {
        const sortedSessions = [...this.selectedSessions].sort((a, b) => a.getTime() - b.getTime());
        const sortedBackups = [...this.selectedBackups].sort((a, b) => a.getTime() - b.getTime());

        return {
            session_dates: sortedSessions.map(d => DateManager.toYYYYMMDD(d)),
            backup_dates: sortedBackups.map(d => DateManager.toYYYYMMDD(d)),
            instruction_timeslot: this.selectedTimeslot,
            has_equipment_days: this.getEquipmentDays()
        };
    }

    /**
     * Validates the selected sessions and timeslot against the latest availability data.
     * @returns {{isValid: boolean, conflicts: Array<string>}} An object indicating if the selection is valid and a list of conflicts.
     */
    validateSelection() {
        const conflicts = [];
        const allSelectedDates = [...this.selectedSessions, ...this.selectedBackups];

        // Check if all selected dates are still available
        for (const date of allSelectedDates) {
            if (!this.isDateAvailable(date)) {
                conflicts.push(`Date ${DateManager.toYYYYMMDD(date)} is no longer available.`);
            }
        }

        // Check if the selected timeslot for the first session is still available
        if (this.selectedTimeslot && this.selectedSessions.length > 0) {
            const firstSessionDate = this.selectedSessions[0];
            if (!this.isTimeslotAvailable(this.selectedTimeslot, firstSessionDate)) {
                conflicts.push(`Timeslot ${this.selectedTimeslot} on ${DateManager.toYYYYMMDD(firstSessionDate)} is no longer available.`);
            }
        }

        return {
            isValid: conflicts.length === 0,
            conflicts: conflicts
        };
    }

    /**
     * Resets all selections
     */
    reset() {
        this.selectedSessions = [];
        this.selectedBackups = [];
        this.selectedTimeslot = null;
    }
}