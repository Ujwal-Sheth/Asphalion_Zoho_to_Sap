require('dotenv').config();
const axios = require('axios');
const zohoService = require('../services/zohoService');
const { getAccessToken } = require('../utils/auth');

async function checkLayout() {
    try {
        const token = await getAccessToken();
        const response = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/settings/layouts?module=Deals`,
            { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } }
        );
        
        const layout = response.data.layouts[0];
        const subform = layout.sections.flatMap(s => s.fields).find(f => f.api_name === 'Product_Details');
        
        if (subform) {
            console.log(JSON.stringify(subform, null, 2));
        } else {
            console.log("Subform not found.");
        }

    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
    }
}
checkLayout();
