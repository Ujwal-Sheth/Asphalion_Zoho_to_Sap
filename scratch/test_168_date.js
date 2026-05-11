require('dotenv').config();
const { getSapQuoteDetails } = require('../services/sapService');
const { formatDateOnly } = require('../utils/dateUtils');

async function test168() {
    const rawSapQuote = await getSapQuoteDetails('168');
    if (!rawSapQuote) {
        console.log("Could not find quote 168");
        return;
    }
    
    const getVal = (field) => {
        if (field == null) return null;
        if (typeof field === 'object') return field._ !== undefined ? field._ : null;
        return field;
    };
    
    const rawDateObj = rawSapQuote.RequestedFulfillmentPeriodPeriodTerms?.EndDateTime;
    const rawDateVal = getVal(rawDateObj);
    
    console.log("Raw EndDateTime object from SAP:", JSON.stringify(rawDateObj, null, 2));
    console.log("Value extracted via getVal:", rawDateVal);
    console.log("Value passed through formatDateOnly:", formatDateOnly(rawDateVal));
}

test168();
