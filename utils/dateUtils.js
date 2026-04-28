/**
 * Utility functions for formatting dates.
 */

/**
 * Returns the current date/time in the format expected by Zoho for shipment dates.
 * Format: YYYY-MM-DDTHH:mm:ss+00:00
 * @returns {string}
 */
const getCurrentIsoDateTimeForZoho = () => {
    return new Date().toISOString().split('.')[0] + '+00:00';
};

/**
 * Formats a given date string to YYYY-MM-DD.
 * @param {string} dateString 
 * @returns {string|null}
 */
const formatDateOnly = (dateString) => {
    return dateString ? String(dateString).split('T')[0] : null;
};

module.exports = { getCurrentIsoDateTimeForZoho, formatDateOnly };
