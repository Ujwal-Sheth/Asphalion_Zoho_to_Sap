require('dotenv').config();
const { getSapQuoteDetails } = require('../services/sapService');

async function testQuote() {
    const rawSapQuote = await getSapQuoteDetails('1152');
    console.log(JSON.stringify(rawSapQuote.SalesAndServiceBusinessArea, null, 2));
    console.log("Categoria:", rawSapQuote.Categoria);
    console.log("SalesUnit:", JSON.stringify(rawSapQuote.SalesUnitParty, null, 2));
}
testQuote();
