require('dotenv').config();
const axios = require('axios');
const { getAccessToken } = require('../utils/auth');

async function checkSubform() {
    try {
        const token = await getAccessToken();
        const response = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/settings/layouts?module=Deals`,
            { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } }
        );
        
        const layout = response.data.layouts[0];
        const subform = layout.sections.flatMap(s => s.fields).find(f => f.api_name === 'Product_Details');
        
        const subformLayoutResponse = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/settings/layouts?module=Product_Details`,
            { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } }
        );

        const sfLayout = subformLayoutResponse.data.layouts[0];
        const uomField = sfLayout.sections.flatMap(s => s.fields).find(f => f.api_name === 'Unidad_de_medida');
        
        console.log("Unidad_de_medida type:", uomField.data_type);
        console.log("Unidad_de_medida picklist:", JSON.stringify(uomField.pick_list_values, null, 2));

    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
    }
}
checkSubform();
