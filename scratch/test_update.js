require('dotenv').config();
const zohoService = require('../services/zohoService');

async function testUpdate() {
    try {
        await zohoService.updateDealField('931793000005589349', {
            Product_Details: [
                {
                    Product_Code: "TestString123"
                }
            ]
        });
        console.log("Success with String");
    } catch (e) {
        console.error("Failed with String:", e.message);
    }
}
testUpdate();
