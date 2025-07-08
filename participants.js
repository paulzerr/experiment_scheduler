// participants.js - Valid participant IDs and their start dates for the Experiment Scheduler

// This file contains the list of valid participant IDs that are allowed to access the scheduler
// Each participant can have an optional start date (YYYY-MM-DD) for their experiment window
// If no start date is provided, the next work day will be used as the first available day

const VALID_PARTICIPANTS = {
    // Format: 'participantID': 'startDate' (optional)
    // Example with start date specified:
    'P001': '2025-05-20', // This participant's scheduling window starts on May 20, 2025
    
    // Example without start date (will use next work day):
    'P002': '',
    
    // Add more participants as needed:
    'P003': '',
    'P004': '2025-05-25',
    'P005': '',
    'P006': '',
    'P007': '',
    'P008': '',
    'P009': '',
    'P010': '',
    // Add more participants as needed
};

// Function to check if a participant ID is valid
function isValidParticipant(participantId) {
    return participantId && VALID_PARTICIPANTS.hasOwnProperty(participantId);
}

// Function to get a participant's start date (if specified)
function getParticipantStartDate(participantId) {
    if (isValidParticipant(participantId) && VALID_PARTICIPANTS[participantId]) {
        return VALID_PARTICIPANTS[participantId];
    }
    return null; // No specific start date, will use next work day
}

// Export the functions and data
if (typeof module !== 'undefined' && module.exports) {
    // For Node.js environment
    module.exports = { 
        VALID_PARTICIPANTS,
        isValidParticipant,
        getParticipantStartDate
    };
} else {
    // For browser environment
    // Functions and data will be available globally
}