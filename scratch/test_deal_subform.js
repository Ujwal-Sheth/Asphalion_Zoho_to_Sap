require('dotenv').config();
const zohoService = require('../services/zohoService');

async function checkDeal() {
    try {
        const dealData = await zohoService.getRecord('Deals', '931793000005589349');
        console.log("Current Deal Subform:", JSON.stringify(dealData.Product_Details, null, 2));
    } catch (err) {
        console.error(err.message);
    }
}
checkDeal();
