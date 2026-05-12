require('dotenv').config();
const { getSapQuoteDetails } = require('../services/sapService');
const { mapSapItemToZohoSubformItem } = require('../utils/sapMapper');

async function testItemDesc() {
    const rawSapQuote = await getSapQuoteDetails('1152');
    console.log(rawSapQuote ? "Found quote" : "Not found");
    if (!rawSapQuote) return;
    
    const sapItems = rawSapQuote.Item ? (Array.isArray(rawSapQuote.Item) ? rawSapQuote.Item : [rawSapQuote.Item]) : [];
    for (const sapItem of sapItems) {
        const mapped = mapSapItemToZohoSubformItem(sapItem);
        console.log(`Product: ${mapped.Product_Code}, Description: ${mapped.Activity_description}`);
    }
}
testItemDesc();
