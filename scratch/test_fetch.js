require('dotenv').config();
const zohoService = require('../services/zohoService');

async function testFetch() {
    try {
        const dealData = await zohoService.getRecord('Deals', '931793000005589349');
        console.log("Subform Items:", JSON.stringify(dealData.Product_Details, null, 2));
    } catch (err) {
        console.error("Failed:", err.message);
    }
}
testFetch();
