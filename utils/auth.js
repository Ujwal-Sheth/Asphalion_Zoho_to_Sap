const axios = require('axios');
require('dotenv').config();

let zohoAccessToken = null;
let zohoTokenExpiry = 0;

let graphAccessToken = null;
let graphTokenExpiry = 0;

module.exports = {
    // Used by both SAP and SharePoint controllers
    async getAccessToken() {
        if (zohoAccessToken && Date.now() < zohoTokenExpiry) {
            return zohoAccessToken;
        }
        try {
            const params = new URLSearchParams({
                refresh_token: process.env.ZOHO_REFRESH_TOKEN,
                client_id: process.env.ZOHO_CLIENT_ID,
                client_secret: process.env.ZOHO_CLIENT_SECRET,
                grant_type: 'refresh_token'
            });
            // Fallback to zoho.com if datacenter env var is missing
            const domain = process.env.ZOHO_DATACENTER || 'https://accounts.zoho.eu'; 
            const response = await axios.post(`${domain}/oauth/v2/token`, params);
            
            zohoAccessToken = response.data.access_token;
            zohoTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; 
            return zohoAccessToken;
        } catch (error) {
            console.error("Error fetching Zoho token:", error.response?.data || error.message);
            throw new Error("Failed to authenticate with Zoho CRM");
        }
    },

    // Used exclusively by the SharePoint service
    async getGraphToken() {
        if (graphAccessToken && Date.now() < graphTokenExpiry) {
            return graphAccessToken;
        }
        try {
            const tokenUrl = `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`;
            const params = new URLSearchParams();
            params.append('client_id', process.env.MS_CLIENT_ID);
            params.append('scope', 'https://graph.microsoft.com/.default');
            params.append('client_secret', process.env.MS_CLIENT_SECRET);
            params.append('grant_type', 'client_credentials');

            const response = await axios.post(tokenUrl, params);
            
            graphAccessToken = response.data.access_token;
            graphTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
            return graphAccessToken;
        } catch (error) {
            console.error("Error fetching MS Graph token:", error.response?.data || error.message);
            throw new Error("Failed to authenticate with Microsoft Graph");
        }
    }
};