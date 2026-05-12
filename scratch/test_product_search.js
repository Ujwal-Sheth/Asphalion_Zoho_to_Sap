require('dotenv').config();
const zohoService = require('../services/zohoService');

async function testSearch() {
    try {
        const coqlQuery = "select id, Product_Name, Product_Code from Products limit 5";
        const products = await zohoService.runCoqlQuery(coqlQuery);
        console.log("Products:", JSON.stringify(products, null, 2));
    } catch (err) {
        console.error(err.message);
    }
}
testSearch();
