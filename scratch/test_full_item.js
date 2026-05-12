require('dotenv').config();
const { getSapQuoteDetails } = require('../services/sapService');

async function testItem() {
    const rawSapQuote = await getSapQuoteDetails('1152');
    if (!rawSapQuote) return;
    
    const sapItems = rawSapQuote.Item ? (Array.isArray(rawSapQuote.Item) ? rawSapQuote.Item : [rawSapQuote.Item]) : [];
    console.log(JSON.stringify(sapItems[0], null, 2));
}
testItem();
