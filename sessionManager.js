// sessionManager.js - Manages session selection and validation

const EXCESSIVE_LOG_MARKER_SESSION_MANAGER = '[EXCESSIVE_TRACE]';
function excessiveLogSessionManager(message, payload) {
    if (payload === undefined) {
        console.log(EXCESSIVE_LOG_MARKER_SESSION_MANAGER, message);
    } else {
        console.log(EXCESSIVE_LOG_MARKER_SESSION_MANAGER, message, payload);
    }
}

function serializeSessionManagerDate(date) {
    if (!date) return null;
    if (!(date instanceof Date)) return { nonDateValue: date };
    return {
        iso: isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString(),
        time: date.getTime()
    };
}

function serializeSessionManagerDateArray(dates) {
    if (!Array.isArray(dates)) return dates;
    return dates.map(d => serializeSessionManagerDate(d));
}

class SessionManager {
    constructor(config) {
        this.config = config;
        this.selectedSessions = [];
        this.selectedBackups = [];
        this.selectedTimeslot = null;
        this.dateCountMap = new Map();
        this.takenDateTimeSlots = new Map();
        excessiveLogSessionManager('SessionManager.constructor initialized new instance', {
            config: this.config,
            selectedSessions: this.selectedSessions,
            selectedBackups: this.selectedBackups,
            selectedTimeslot: this.selectedTimeslot,
            dateCountMapSize: this.dateCountMap.size,
            takenDateTimeSlotsSize: this.takenDateTimeSlots.size
        });
    }

    /**
     * Updates the maps of booked/taken dates and timeslots.
     * The keys for the maps are YYYY-MM-DD strings.
     * @param {Map<string, number>} dateCountMap - Map of dates to their booking counts.
     * @param {Map<string, number>} takenDateTimeSlots - Map of 'YYYY-MM-DD_HH:mm' strings to count of bookings.
     */
    updateAvailability(dateCountMap, takenDateTimeSlots) {
        excessiveLogSessionManager('SessionManager.updateAvailability called', {
            incomingDateCountMapSize: dateCountMap?.size || 0,
            incomingTakenDateTimeSlotsSize: takenDateTimeSlots?.size || 0,
            incomingDateCountEntries: dateCountMap ? Array.from(dateCountMap.entries()) : [],
            incomingTakenDateTimeSlotEntries: takenDateTimeSlots ? Array.from(takenDateTimeSlots.entries()) : []
        });
        this.dateCountMap = dateCountMap;
        this.takenDateTimeSlots = takenDateTimeSlots;
        excessiveLogSessionManager('SessionManager.updateAvailability state updated', {
            storedDateCountMapSize: this.dateCountMap.size,
            storedTakenDateTimeSlotsSize: this.takenDateTimeSlots.size
        });
    }

    /**
     * Checks if a date is available for booking.
     * @param {Date} date - The date to check.
     * @returns {boolean} True if the date is available.
     */
    isDateAvailable(date) {
        excessiveLogSessionManager('SessionManager.isDateAvailable called', {
            date: serializeSessionManagerDate(date)
        });
        const dateString = DateManager.toYYYYMMDD(date);
        const currentCount = this.dateCountMap.get(dateString) || 0;
        const isAvailable = currentCount < this.config.MAX_CONCURRENT_SESSIONS;
        excessiveLogSessionManager('SessionManager.isDateAvailable evaluated', {
            dateString,
            currentCount,
            maxConcurrentSessions: this.config.MAX_CONCURRENT_SESSIONS,
            isAvailable
        });
        return isAvailable;
    }

    /**
     * Checks if a date is available for the first session (instruction session).
     * @param {Date} date - The date to check.
     * @returns {boolean} True if available for an instruction session.
     */
    isDateAvailableForInstruction(date) {
        excessiveLogSessionManager('SessionManager.isDateAvailableForInstruction called', {
            date: serializeSessionManagerDate(date)
        });
        const instructionSessionsCount = this.countInstructionSessionsOnDate(date);
        
        // Check if there are any valid timeslots remaining for this date
        // considering the 48-hour rule
        const availableSlots = this.getAvailableTimeSlots(date);
        const hasValidSlots = availableSlots.length > 0;
        const isDateAvailable = this.isDateAvailable(date);
        const isBlocked = DateManager.isDateBlocked(date);
        const isWeekend = DateManager.isWeekend(date);
        const passesInstructionCount = instructionSessionsCount < 3;
        const result = isDateAvailable &&
                       !isBlocked &&
                       !isWeekend &&
                       passesInstructionCount &&
                       hasValidSlots;
        excessiveLogSessionManager('SessionManager.isDateAvailableForInstruction evaluated', {
            instructionSessionsCount,
            availableSlots,
            hasValidSlots,
            isDateAvailable,
            isBlocked,
            isWeekend,
            passesInstructionCount,
            result
        });
        return result;
    }

    /**
     * Counts the number of instruction sessions already scheduled on a given date.
     * @param {Date} date - The date to check.
     * @returns {number} The number of instruction sessions on that date.
     */
    countInstructionSessionsOnDate(date) {
        excessiveLogSessionManager('SessionManager.countInstructionSessionsOnDate called', {
            date: serializeSessionManagerDate(date),
            takenDateTimeSlotsEntries: Array.from(this.takenDateTimeSlots.entries())
        });
        const dateString = DateManager.toYYYYMMDD(date);
        let count = 0;
        for (const dateTimeSlot of this.takenDateTimeSlots.keys()) {
            const matchesDate = dateTimeSlot.startsWith(dateString);
            excessiveLogSessionManager('SessionManager.countInstructionSessionsOnDate iterating key', {
                dateString,
                dateTimeSlot,
                matchesDate
            });
            if (dateTimeSlot.startsWith(dateString)) {
                count++;
                excessiveLogSessionManager('SessionManager.countInstructionSessionsOnDate incremented count', {
                    dateTimeSlot,
                    newCount: count
                });
            }
        }
        excessiveLogSessionManager('SessionManager.countInstructionSessionsOnDate returning', { dateString, count });
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
        excessiveLogSessionManager('SessionManager.getAvailableTimeSlots called', {
            date: serializeSessionManagerDate(date),
            configuredTimeSlots: this.config.TIME_SLOTS
        });
        const dateString = DateManager.toYYYYMMDD(date);
        const takenSlotsMap = new Map(); // time -> count

        for (const [key, count] of this.takenDateTimeSlots) {
            excessiveLogSessionManager('SessionManager.getAvailableTimeSlots inspecting taken slot entry', {
                key,
                count,
                matchesDate: key.startsWith(dateString),
                dateString
            });
            if (key.startsWith(dateString)) {
                const time = key.split('_')[1];
                takenSlotsMap.set(time, count);
                excessiveLogSessionManager('SessionManager.getAvailableTimeSlots added to takenSlotsMap', {
                    time,
                    count
                });
            }
        }
        excessiveLogSessionManager('SessionManager.getAvailableTimeSlots built takenSlotsMap', {
            entries: Array.from(takenSlotsMap.entries())
        });

        const timeToMinutes = (time) => {
            const [hours, minutes] = time.split(':').map(Number);
            const minutesValue = hours * 60 + minutes;
            excessiveLogSessionManager('SessionManager.getAvailableTimeSlots converted time to minutes', {
                time,
                hours,
                minutes,
                minutesValue
            });
            return minutesValue;
        };

        const gap = 150; // 2.5 hours in minutes
        const now = new Date();
        const minTime = now.getTime() + (48 * 60 * 60 * 1000); // 48 hours from now
        excessiveLogSessionManager('SessionManager.getAvailableTimeSlots computed timing boundaries', {
            now: serializeSessionManagerDate(now),
            minTime,
            minTimeIso: new Date(minTime).toISOString(),
            gap
        });

        const availableSlots = this.config.TIME_SLOTS.filter(slot => {
            const [hours, minutes] = slot.split(':').map(Number);
            const slotDate = new Date(date);
            slotDate.setUTCHours(hours, minutes, 0, 0);
            excessiveLogSessionManager('SessionManager.getAvailableTimeSlots evaluating slot', {
                slot,
                hours,
                minutes,
                slotDate: serializeSessionManagerDate(slotDate)
            });

            // 0. Check 48-hour rule
            if (slotDate.getTime() < minTime) {
                excessiveLogSessionManager('SessionManager.getAvailableTimeSlots rejected by 48-hour rule', {
                    slot,
                    slotTime: slotDate.getTime(),
                    minTime
                });
                return false;
            }

            // 0.5 Check Friday block (10:00 - 14:29)
            // 5 is Friday in getUTCDay() (0=Sun, 1=Mon, ..., 5=Fri, 6=Sat)
            if (slotDate.getUTCDay() === 5) {
                const slotTimeInMinutes = hours * 60 + minutes;
                const blockStart = 10 * 60;      // 10:00
                const blockEnd = 14 * 60 + 29;   // 14:29
                excessiveLogSessionManager('SessionManager.getAvailableTimeSlots evaluating Friday block', {
                    slot,
                    slotTimeInMinutes,
                    blockStart,
                    blockEnd
                });
                
                if (slotTimeInMinutes >= blockStart && slotTimeInMinutes <= blockEnd) {
                    excessiveLogSessionManager('SessionManager.getAvailableTimeSlots rejected by Friday block', { slot });
                    return false;
                }
            }

            // 0.6 Check Monday block (before 13:00)
            // 1 is Monday in getUTCDay()
            if (slotDate.getUTCDay() === 1) {
                const slotTimeInMinutes = hours * 60 + minutes;
                const blockEnd = 13 * 60; // 13:00
                excessiveLogSessionManager('SessionManager.getAvailableTimeSlots evaluating Monday block', {
                    slot,
                    slotTimeInMinutes,
                    blockEnd
                });
                
                if (slotTimeInMinutes < blockEnd) {
                    excessiveLogSessionManager('SessionManager.getAvailableTimeSlots rejected by Monday block', { slot });
                    return false;
                }
            }

            const slotMinutes = timeToMinutes(slot);
            const slotCount = takenSlotsMap.get(slot) || 0;
            excessiveLogSessionManager('SessionManager.getAvailableTimeSlots evaluated slot capacity', {
                slot,
                slotMinutes,
                slotCount
            });

            // 1. Check capacity (max 2 concurrent intakes)
            if (slotCount >= 2) {
                excessiveLogSessionManager('SessionManager.getAvailableTimeSlots rejected by same-slot capacity', {
                    slot,
                    slotCount
                });
                return false;
            }

            // 2. Check conflicts with OTHER slots
            // If we pick this slot, it must not overlap with any OTHER occupied slot.
            for (const [takenTime, _] of takenSlotsMap) {
                if (takenTime === slot) continue; // Ignore self (we can add to existing slot if count < 2)

                const takenMinutes = timeToMinutes(takenTime);
                const diff = Math.abs(slotMinutes - takenMinutes);
                excessiveLogSessionManager('SessionManager.getAvailableTimeSlots comparing against taken slot', {
                    slot,
                    slotMinutes,
                    takenTime,
                    takenMinutes,
                    diff,
                    gap
                });
                if (Math.abs(slotMinutes - takenMinutes) < gap) {
                    excessiveLogSessionManager('SessionManager.getAvailableTimeSlots rejected by cross-slot gap rule', {
                        slot,
                        takenTime
                    });
                    return false; // Overlaps with a different active slot
                }
            }
            
            excessiveLogSessionManager('SessionManager.getAvailableTimeSlots accepted slot', { slot });
            return true;
        });
        excessiveLogSessionManager('SessionManager.getAvailableTimeSlots returning available slots', {
            dateString,
            availableSlots
        });
        return availableSlots;
    }

    /**
     * Checks if a timeslot is available on a specific date.
     * @param {string} timeslot - The timeslot (e.g., '14:00').
     * @param {Date} date - The date to check against.
     * @returns {boolean} True if the timeslot is available.
     */
    isTimeslotAvailable(timeslot, date) {
        excessiveLogSessionManager('SessionManager.isTimeslotAvailable called', {
            timeslot,
            date: serializeSessionManagerDate(date)
        });
        if (!date) {
            excessiveLogSessionManager('SessionManager.isTimeslotAvailable returning true because date is missing');
            return true; // If no date, assume available
        }
        
        const [hours, minutes] = timeslot.split(':').map(Number);
        const slotDate = new Date(date);
        slotDate.setUTCHours(hours, minutes, 0, 0);
        const now = new Date();
        const minTime = now.getTime() + (48 * 60 * 60 * 1000); // 48 hours from now
        excessiveLogSessionManager('SessionManager.isTimeslotAvailable computed slot date and minimum time', {
            timeslot,
            slotDate: serializeSessionManagerDate(slotDate),
            now: serializeSessionManagerDate(now),
            minTime,
            minTimeIso: new Date(minTime).toISOString()
        });
        
        // 0. Check 48-hour rule
        if (slotDate.getTime() < minTime) {
            excessiveLogSessionManager('SessionManager.isTimeslotAvailable rejected by 48-hour rule', {
                slotTime: slotDate.getTime(),
                minTime
            });
            return false;
        }

        // 0.5 Check Friday block (10:00 - 14:29)
        if (slotDate.getUTCDay() === 5) {
            const slotTimeInMinutes = hours * 60 + minutes;
            const blockStart = 10 * 60;      // 10:00
            const blockEnd = 14 * 60 + 29;   // 14:29
            excessiveLogSessionManager('SessionManager.isTimeslotAvailable evaluating Friday block', {
                timeslot,
                slotTimeInMinutes,
                blockStart,
                blockEnd
            });
            
            if (slotTimeInMinutes >= blockStart && slotTimeInMinutes <= blockEnd) {
                excessiveLogSessionManager('SessionManager.isTimeslotAvailable rejected by Friday block', { timeslot });
                return false;
            }
        }

        // 0.6 Check Monday block (before 13:00)
        if (slotDate.getUTCDay() === 1) {
            const slotTimeInMinutes = hours * 60 + minutes;
            const blockEnd = 13 * 60; // 13:00
            excessiveLogSessionManager('SessionManager.isTimeslotAvailable evaluating Monday block', {
                timeslot,
                slotTimeInMinutes,
                blockEnd
            });
            
            if (slotTimeInMinutes < blockEnd) {
                excessiveLogSessionManager('SessionManager.isTimeslotAvailable rejected by Monday block', { timeslot });
                return false;
            }
        }

        const dateString = DateManager.toYYYYMMDD(date);
        const dateTimeKey = `${dateString}_${timeslot}`;
        const count = this.takenDateTimeSlots.get(dateTimeKey) || 0;
        excessiveLogSessionManager('SessionManager.isTimeslotAvailable evaluated same-slot occupancy', {
            dateString,
            dateTimeKey,
            count
        });

        // 1. Check capacity
        if (count >= 2) {
            excessiveLogSessionManager('SessionManager.isTimeslotAvailable rejected by same-slot capacity', {
                dateTimeKey,
                count
            });
            return false;
        }

        // 2. Check conflicts with OTHER slots
        const timeToMinutes = (time) => {
            const [hours, minutes] = time.split(':').map(Number);
            const minutesValue = hours * 60 + minutes;
            excessiveLogSessionManager('SessionManager.isTimeslotAvailable converted time to minutes', {
                time,
                hours,
                minutes,
                minutesValue
            });
            return minutesValue;
        };

        const slotMinutes = timeToMinutes(timeslot);
        const gap = 150; // 2.5 hours in minutes
        excessiveLogSessionManager('SessionManager.isTimeslotAvailable evaluating cross-slot gap constraints', {
            timeslot,
            slotMinutes,
            gap
        });

        for (const [key, _] of this.takenDateTimeSlots) {
            if (key.startsWith(dateString)) {
                const takenTime = key.split('_')[1];
                if (takenTime === timeslot) continue; // Ignore self

                const takenMinutes = timeToMinutes(takenTime);
                const diff = Math.abs(slotMinutes - takenMinutes);
                excessiveLogSessionManager('SessionManager.isTimeslotAvailable compared against taken slot', {
                    key,
                    takenTime,
                    takenMinutes,
                    diff,
                    gap
                });
                if (diff < gap) {
                    excessiveLogSessionManager('SessionManager.isTimeslotAvailable rejected by cross-slot gap rule', {
                        timeslot,
                        takenTime
                    });
                    return false; // Overlaps with a different active slot
                }
            }
        }

        excessiveLogSessionManager('SessionManager.isTimeslotAvailable returning true', {
            timeslot,
            dateString
        });
        return true;
    }

    /**
     * Selects or deselects the first session.
     * @param {Date} date - The selected date.
     * @returns {Object} Result with success status and flags.
     */
    selectFirstSession(date) {
        excessiveLogSessionManager('SessionManager.selectFirstSession called', {
            requestedDate: serializeSessionManagerDate(date),
            currentSelectedSessions: serializeSessionManagerDateArray(this.selectedSessions),
            currentSelectedBackups: serializeSessionManagerDateArray(this.selectedBackups),
            currentSelectedTimeslot: this.selectedTimeslot
        });
        const previousFirst = this.selectedSessions.length > 0 ? this.selectedSessions[0] : null;
        const wasSelected = previousFirst && previousFirst.getTime() === date.getTime();
        excessiveLogSessionManager('SessionManager.selectFirstSession evaluated current state', {
            previousFirst: serializeSessionManagerDate(previousFirst),
            wasSelected
        });

        if (wasSelected) {
            this.selectedSessions = []; // Deselect
            const result = { success: true, reset: true, deselected: true };
            excessiveLogSessionManager('SessionManager.selectFirstSession deselected first session', {
                result,
                selectedSessions: serializeSessionManagerDateArray(this.selectedSessions)
            });
            return result;
        } else {
            this.selectedSessions = [date];
            // Reset subsequent steps if the first session changes
            const needsReset = !previousFirst || previousFirst.getTime() !== date.getTime();
            if (needsReset) {
                this.selectedBackups = [];
                this.selectedTimeslot = null;
                excessiveLogSessionManager('SessionManager.selectFirstSession reset downstream selections', {
                    selectedBackups: this.selectedBackups,
                    selectedTimeslot: this.selectedTimeslot
                });
            }
            const result = { success: true, reset: needsReset, deselected: false };
            excessiveLogSessionManager('SessionManager.selectFirstSession selected new first session', {
                result,
                selectedSessions: serializeSessionManagerDateArray(this.selectedSessions)
            });
            return result;
        }
    }

    /**
     * Finds the index of a date in an array of Date objects.
     * @param {Date} date - The date to find.
     * @param {Date[]} dateArray - The array to search in.
     * @returns {number} The index of the date, or -1 if not found.
     */
    _findDateIndex(date, dateArray) {
        excessiveLogSessionManager('SessionManager._findDateIndex called', {
            targetDate: serializeSessionManagerDate(date),
            array: serializeSessionManagerDateArray(dateArray)
        });
        const index = dateArray.findIndex(d => d.getTime() === date.getTime());
        excessiveLogSessionManager('SessionManager._findDateIndex returning', { index });
        return index;
    }

    /**
     * Selects or deselects a follow-up session.
     * @param {Date} date - The selected date.
     * @returns {Object} Result with success status and message.
     */
    selectFollowUpSession(date) {
        excessiveLogSessionManager('SessionManager.selectFollowUpSession called', {
            requestedDate: serializeSessionManagerDate(date),
            selectedSessionsBefore: serializeSessionManagerDateArray(this.selectedSessions),
            selectedBackupsBefore: serializeSessionManagerDateArray(this.selectedBackups)
        });
        const sessionIndex = this._findDateIndex(date, this.selectedSessions);
        excessiveLogSessionManager('SessionManager.selectFollowUpSession computed existing index', { sessionIndex });

        if (sessionIndex > -1) {
            this.selectedSessions.splice(sessionIndex, 1);
            this.selectedBackups = []; // Clear backups when regular sessions change
            const result = { success: true, deselected: true };
            excessiveLogSessionManager('SessionManager.selectFollowUpSession deselected existing session', {
                result,
                selectedSessionsAfter: serializeSessionManagerDateArray(this.selectedSessions),
                selectedBackupsAfter: serializeSessionManagerDateArray(this.selectedBackups)
            });
            return result;
        } else {
            if (this.selectedSessions.length >= this.config.TOTAL_SESSIONS) {
                const result = {
                    success: false,
                    error: `You can only select ${this.config.TOTAL_SESSIONS} total sessions.`
                };
                excessiveLogSessionManager('SessionManager.selectFollowUpSession rejected due to total sessions limit', {
                    result,
                    selectedSessionsLength: this.selectedSessions.length,
                    maxSessions: this.config.TOTAL_SESSIONS
                });
                return result;
            }
            this.selectedSessions.push(date);
            const result = { success: true, deselected: false };
            excessiveLogSessionManager('SessionManager.selectFollowUpSession selected new follow-up session', {
                result,
                selectedSessionsAfter: serializeSessionManagerDateArray(this.selectedSessions)
            });
            return result;
        }
    }

    /**
     * Selects or deselects a backup session.
     * @param {Date} date - The selected date.
     * @returns {Object} Result with success status and message.
     */
    selectBackupSession(date) {
        excessiveLogSessionManager('SessionManager.selectBackupSession called', {
            requestedDate: serializeSessionManagerDate(date),
            selectedBackupsBefore: serializeSessionManagerDateArray(this.selectedBackups)
        });
        const backupIndex = this._findDateIndex(date, this.selectedBackups);
        excessiveLogSessionManager('SessionManager.selectBackupSession computed existing index', { backupIndex });

        if (backupIndex > -1) {
            this.selectedBackups.splice(backupIndex, 1);
            const result = { success: true, deselected: true };
            excessiveLogSessionManager('SessionManager.selectBackupSession deselected existing backup', {
                result,
                selectedBackupsAfter: serializeSessionManagerDateArray(this.selectedBackups)
            });
            return result;
        } else {
            if (this.selectedBackups.length >= this.config.NUM_BACKUP_SESSIONS) {
                const result = {
                    success: false,
                    error: `You can only select ${this.config.NUM_BACKUP_SESSIONS} backup sessions.`
                };
                excessiveLogSessionManager('SessionManager.selectBackupSession rejected due to backup session limit', {
                    result,
                    selectedBackupsLength: this.selectedBackups.length,
                    maxBackups: this.config.NUM_BACKUP_SESSIONS
                });
                return result;
            }
            this.selectedBackups.push(date);
            const result = { success: true, deselected: false };
            excessiveLogSessionManager('SessionManager.selectBackupSession selected new backup session', {
                result,
                selectedBackupsAfter: serializeSessionManagerDateArray(this.selectedBackups)
            });
            return result;
        }
    }

    /**
     * Sets the selected timeslot
     * @param {string} timeslot - Time slot string
     */
    setTimeslot(timeslot) {
        excessiveLogSessionManager('SessionManager.setTimeslot called', {
            previousTimeslot: this.selectedTimeslot,
            newTimeslot: timeslot
        });
        this.selectedTimeslot = timeslot;
        excessiveLogSessionManager('SessionManager.setTimeslot updated state', {
            selectedTimeslot: this.selectedTimeslot
        });
    }

    /**
     * Checks if all required selections are complete
     * @returns {boolean} True if ready for review
     */
    isReadyForReview() {
        const hasAllSessions = this.selectedSessions.length === this.config.TOTAL_SESSIONS;
        const hasAllBackups = this.selectedBackups.length === this.config.NUM_BACKUP_SESSIONS;
        const hasTimeslot = this.selectedTimeslot !== null;
        const result = hasAllSessions && hasAllBackups && hasTimeslot;
        excessiveLogSessionManager('SessionManager.isReadyForReview evaluated', {
            selectedSessionsLength: this.selectedSessions.length,
            requiredSessions: this.config.TOTAL_SESSIONS,
            selectedBackupsLength: this.selectedBackups.length,
            requiredBackups: this.config.NUM_BACKUP_SESSIONS,
            selectedTimeslot: this.selectedTimeslot,
            hasAllSessions,
            hasAllBackups,
            hasTimeslot,
            result
        });
        return result;
    }

    /**
     * Gets the remaining sessions needed
     * @returns {number} Number of remaining sessions
     */
    getRemainingSessionsCount() {
        const remaining = Math.max(0, this.config.TOTAL_SESSIONS - this.selectedSessions.length);
        excessiveLogSessionManager('SessionManager.getRemainingSessionsCount returning', {
            totalSessions: this.config.TOTAL_SESSIONS,
            selectedSessionsLength: this.selectedSessions.length,
            remaining
        });
        return remaining;
    }

    /**
     * Gets the follow-up sessions count (excluding first session)
     * @returns {number} Number of follow-up sessions selected
     */
    getFollowUpCount() {
        const count = this.selectedSessions.length > 1 ? this.selectedSessions.length - 1 : 0;
        excessiveLogSessionManager('SessionManager.getFollowUpCount returning', {
            selectedSessionsLength: this.selectedSessions.length,
            followUpCount: count
        });
        return count;
    }

    /**
     * Checks if a date is already selected in the main sessions.
     * @param {Date} date - The date to check.
     * @returns {boolean} True if the date is selected.
     */
    isDateSelectedInSessions(date) {
        const selected = this._findDateIndex(date, this.selectedSessions) > -1;
        excessiveLogSessionManager('SessionManager.isDateSelectedInSessions evaluated', {
            date: serializeSessionManagerDate(date),
            selected
        });
        return selected;
    }

    /**
     * Checks if a date is already selected in the backup sessions.
     * @param {Date} date - The date to check.
     * @returns {boolean} True if the date is selected.
     */
    isDateSelectedInBackups(date) {
        const selected = this._findDateIndex(date, this.selectedBackups) > -1;
        excessiveLogSessionManager('SessionManager.isDateSelectedInBackups evaluated', {
            date: serializeSessionManagerDate(date),
            selected
        });
        return selected;
    }

    /**
     * Gets sorted session and backup data for submission.
     * Converts Date objects to YYYY-MM-DD strings for the database.
     * @returns {Object} Sorted session data for submission.
     */
    getEquipmentDays() {
        excessiveLogSessionManager('SessionManager.getEquipmentDays called', {
            selectedSessions: serializeSessionManagerDateArray(this.selectedSessions),
            selectedBackups: serializeSessionManagerDateArray(this.selectedBackups)
        });
        if (this.selectedSessions.length === 0) {
            excessiveLogSessionManager('SessionManager.getEquipmentDays returning empty array because no selected sessions');
            return [];
        }

        const allDates = [...this.selectedSessions, ...this.selectedBackups].sort((a, b) => a.getTime() - b.getTime());
        const firstDay = allDates[0];
        const lastDay = allDates[allDates.length - 1];
        excessiveLogSessionManager('SessionManager.getEquipmentDays computed date boundaries', {
            allDates: serializeSessionManagerDateArray(allDates),
            firstDay: serializeSessionManagerDate(firstDay),
            lastDay: serializeSessionManagerDate(lastDay)
        });

        // Calculate the cleaning day
        const cleaningDay = new Date(lastDay);
        cleaningDay.setDate(cleaningDay.getDate() + 1);
        const finalCleaningDay = DateManager.getNextWorkDay(cleaningDay);
        excessiveLogSessionManager('SessionManager.getEquipmentDays computed cleaning day boundaries', {
            cleaningDay: serializeSessionManagerDate(cleaningDay),
            finalCleaningDay: serializeSessionManagerDate(finalCleaningDay)
        });

        // Generate all days from the first session to the final cleaning day
        const equipmentDays = [];
        let currentDay = new Date(firstDay);

        while (currentDay <= finalCleaningDay) {
            equipmentDays.push(DateManager.toYYYYMMDD(currentDay));
            excessiveLogSessionManager('SessionManager.getEquipmentDays pushed equipment day', {
                currentDay: serializeSessionManagerDate(currentDay),
                storedDay: equipmentDays[equipmentDays.length - 1],
                runningCount: equipmentDays.length
            });
            currentDay.setDate(currentDay.getDate() + 1);
            excessiveLogSessionManager('SessionManager.getEquipmentDays incremented day cursor', {
                nextCurrentDay: serializeSessionManagerDate(currentDay)
            });
        }

        excessiveLogSessionManager('SessionManager.getEquipmentDays returning equipment days', {
            equipmentDaysCount: equipmentDays.length,
            equipmentDays
        });
        return equipmentDays;
    }

    getSubmissionData() {
        excessiveLogSessionManager('SessionManager.getSubmissionData called', {
            selectedSessions: serializeSessionManagerDateArray(this.selectedSessions),
            selectedBackups: serializeSessionManagerDateArray(this.selectedBackups),
            selectedTimeslot: this.selectedTimeslot
        });
        const sortedSessions = [...this.selectedSessions].sort((a, b) => a.getTime() - b.getTime());
        const sortedBackups = [...this.selectedBackups].sort((a, b) => a.getTime() - b.getTime());
        excessiveLogSessionManager('SessionManager.getSubmissionData sorted dates', {
            sortedSessions: serializeSessionManagerDateArray(sortedSessions),
            sortedBackups: serializeSessionManagerDateArray(sortedBackups)
        });

        const submissionData = {
            session_dates: sortedSessions.map(d => DateManager.toYYYYMMDD(d)),
            backup_dates: sortedBackups.map(d => DateManager.toYYYYMMDD(d)),
            instruction_timeslot: this.selectedTimeslot,
            has_equipment_days: this.getEquipmentDays()
        };
        excessiveLogSessionManager('SessionManager.getSubmissionData returning payload', submissionData);
        return submissionData;
    }

    /**
     * Validates the selected sessions and timeslot against the latest availability data.
     * @returns {{isValid: boolean, conflicts: Array<string>}} An object indicating if the selection is valid and a list of conflicts.
     */
    validateSelection() {
        excessiveLogSessionManager('SessionManager.validateSelection called', {
            selectedSessions: serializeSessionManagerDateArray(this.selectedSessions),
            selectedBackups: serializeSessionManagerDateArray(this.selectedBackups),
            selectedTimeslot: this.selectedTimeslot
        });
        const conflicts = [];
        const allSelectedDates = [...this.selectedSessions, ...this.selectedBackups];
        excessiveLogSessionManager('SessionManager.validateSelection combined selected dates', {
            allSelectedDates: serializeSessionManagerDateArray(allSelectedDates)
        });

        // Check if all selected dates are still available
        for (const date of allSelectedDates) {
            excessiveLogSessionManager('SessionManager.validateSelection checking date availability', {
                date: serializeSessionManagerDate(date)
            });
            if (!this.isDateAvailable(date)) {
                conflicts.push(`Date ${DateManager.toYYYYMMDD(date)} is no longer available.`);
                excessiveLogSessionManager('SessionManager.validateSelection found unavailable date conflict', {
                    date: serializeSessionManagerDate(date),
                    conflicts
                });
            }
        }

        // Check if the selected timeslot for the first session is still available
        if (this.selectedTimeslot && this.selectedSessions.length > 0) {
            const firstSessionDate = this.selectedSessions[0];
            excessiveLogSessionManager('SessionManager.validateSelection checking selected timeslot availability', {
                selectedTimeslot: this.selectedTimeslot,
                firstSessionDate: serializeSessionManagerDate(firstSessionDate)
            });
            if (!this.isTimeslotAvailable(this.selectedTimeslot, firstSessionDate)) {
                conflicts.push(`Timeslot ${this.selectedTimeslot} on ${DateManager.toYYYYMMDD(firstSessionDate)} is no longer available.`);
                excessiveLogSessionManager('SessionManager.validateSelection found timeslot conflict', {
                    selectedTimeslot: this.selectedTimeslot,
                    firstSessionDate: serializeSessionManagerDate(firstSessionDate),
                    conflicts
                });
            }
        } else {
            excessiveLogSessionManager('SessionManager.validateSelection skipped timeslot validation', {
                selectedTimeslot: this.selectedTimeslot,
                selectedSessionsLength: this.selectedSessions.length
            });
        }

        const result = {
            isValid: conflicts.length === 0,
            conflicts: conflicts
        };
        excessiveLogSessionManager('SessionManager.validateSelection returning result', result);
        return result;
    }

    /**
     * Resets all selections
     */
    reset() {
        excessiveLogSessionManager('SessionManager.reset called', {
            selectedSessionsBefore: serializeSessionManagerDateArray(this.selectedSessions),
            selectedBackupsBefore: serializeSessionManagerDateArray(this.selectedBackups),
            selectedTimeslotBefore: this.selectedTimeslot
        });
        this.selectedSessions = [];
        this.selectedBackups = [];
        this.selectedTimeslot = null;
        excessiveLogSessionManager('SessionManager.reset completed', {
            selectedSessionsAfter: this.selectedSessions,
            selectedBackupsAfter: this.selectedBackups,
            selectedTimeslotAfter: this.selectedTimeslot
        });
    }
}
