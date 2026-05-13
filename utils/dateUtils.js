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
    const str = String(dateString).trim();
    if (!dateString || str === '' || str.toLowerCase() === 'unlimited') return null;
    
    if (str.includes('T')) {
        try {
            const date = new Date(str);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-CA', { 
                    timeZone: 'Europe/Madrid', 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit' 
                });
            }
        } catch (e) {
            // fallback below
        }
    }
    return str.split('T')[0];
};

/**
 * Formats an SAP PeriodTerms object, extracting the inclusive End Date.
 * Handles exact midnight boundaries by subtracting 1 millisecond if it's a non-zero duration interval.
 * @param {Object} periodTerms 
 * @returns {string|null}
 */
const formatSapDatePeriod = (periodTerms) => {
    if (!periodTerms || !periodTerms.EndDateTime) return null;
    const endStr = typeof periodTerms.EndDateTime === 'object' ? periodTerms.EndDateTime._ : periodTerms.EndDateTime;
    const endTz = typeof periodTerms.EndDateTime === 'object' ? periodTerms.EndDateTime.$?.timeZoneCode : null;
    const startStr = periodTerms.StartDateTime ? (typeof periodTerms.StartDateTime === 'object' ? periodTerms.StartDateTime._ : periodTerms.StartDateTime) : null;
    
    if (!endStr || String(endStr).trim() === '' || String(endStr).trim().toLowerCase() === 'unlimited') return null;

    try {
        let endDate = new Date(endStr);
        if (isNaN(endDate.getTime())) return String(endStr).split('T')[0];

        let startDate = startStr ? new Date(startStr) : null;
        let ianaTz = 'UTC';
        if (endTz === 'CET' || endTz === 'CEST') ianaTz = 'Europe/Madrid';
        
        // Check if the time is exactly midnight in the target timezone
        const timeInTz = endDate.toLocaleTimeString('en-GB', { timeZone: ianaTz, hourCycle: 'h23' });
        if (timeInTz === '00:00:00') {
            // If it's a non-zero interval, subtract 1 ms to get the inclusive end date (the previous day)
            if (startDate && endDate.getTime() > startDate.getTime()) {
                endDate = new Date(endDate.getTime() - 1);
            }
        }
        
        return endDate.toLocaleDateString('en-CA', { timeZone: ianaTz, year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
        return String(endStr).split('T')[0];
    }
};

module.exports = { getCurrentIsoDateTimeForZoho, formatDateOnly, formatSapDatePeriod };
