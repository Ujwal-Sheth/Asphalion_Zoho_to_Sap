const formatSapDatePeriod = (periodTerms) => {
    if (!periodTerms || !periodTerms.EndDateTime) return null;
    const endStr = typeof periodTerms.EndDateTime === 'object' ? periodTerms.EndDateTime._ : periodTerms.EndDateTime;
    const endTz = typeof periodTerms.EndDateTime === 'object' ? periodTerms.EndDateTime.$?.timeZoneCode : null;
    const startStr = periodTerms.StartDateTime ? (typeof periodTerms.StartDateTime === 'object' ? periodTerms.StartDateTime._ : periodTerms.StartDateTime) : null;
    
    let endDate = new Date(endStr);
    let startDate = startStr ? new Date(startStr) : null;
    let ianaTz = 'UTC';
    if (endTz === 'CET' || endTz === 'CEST') ianaTz = 'Europe/Madrid';
    
    const timeInTz = endDate.toLocaleTimeString('en-GB', { timeZone: ianaTz, hourCycle: 'h23' });
    if (timeInTz === '00:00:00') {
        if (startDate && endDate.getTime() > startDate.getTime()) {
            endDate = new Date(endDate.getTime() - 1);
        }
    }
    
    return endDate.toLocaleDateString('en-CA', { timeZone: ianaTz, year: 'numeric', month: '2-digit', day: '2-digit' });
};

const q9988 = { StartDateTime: { _: '2026-07-06T22:00:00Z', "$": { timeZoneCode: 'CET' } }, EndDateTime: { _: '2026-07-06T22:00:00Z', "$": { timeZoneCode: 'CET' } } };
const q10189 = { StartDateTime: { _: '2026-08-09T00:00:00Z', "$": { timeZoneCode: 'UTC' } }, EndDateTime: { _: '2026-08-10T00:00:00Z', "$": { timeZoneCode: 'UTC' } } };

console.log('9988:', formatSapDatePeriod(q9988));
console.log('10189:', formatSapDatePeriod(q10189));
