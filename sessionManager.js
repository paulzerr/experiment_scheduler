// sessionManager.js - Manages session selection and validation

class SessionManager {
    constructor(config) {
        this.config = config;
        this.selectedSessions = [];
        this.selectedBackups = [];
        this.selectedTimeslot = null;
        this.dateCountMap = new Map();
        this.takenDateTimeSlots = new Set();
    }

    /**
     * Updates the maps of booked/taken dates and timeslots.
     * The keys for the maps are YYYY-MM-DD strings.
     * @param {Map<string, number>} dateCountMap - Map of dates to their booking counts.
     * @param {Set<string>} takenDateTimeSlots - Set of 'YYYY-MM-DD_HH:mm' strings for taken slots.
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
        return this.isDateAvailable(date) && !DateManager.isDateBlocked(date);
    }

    /**
     * Checks if a timeslot is available on a specific date.
     * @param {string} timeslot - The timeslot (e.g., '14:00').
     * @param {Date} date - The date to check against.
     * @returns {boolean} True if the timeslot is available.
     */
    isTimeslotAvailable(timeslot, date) {
        if (!date) return true; // If no date, assume available
        const dateString = DateManager.toYYYYMMDD(date);
        const dateTimeKey = `${dateString}_${timeslot}`;
        return !this.takenDateTimeSlots.has(dateTimeKey);
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
    getSubmissionData() {
        const sortedSessions = [...this.selectedSessions].sort((a, b) => a.getTime() - b.getTime());
        const sortedBackups = [...this.selectedBackups].sort((a, b) => a.getTime() - b.getTime());

        return {
            session_dates: sortedSessions.map(d => DateManager.toYYYYMMDD(d)),
            backup_dates: sortedBackups.map(d => DateManager.toYYYYMMDD(d)),
            instruction_timeslot: this.selectedTimeslot
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