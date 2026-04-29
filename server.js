require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const bodyParser = require('body-parser');
const { runWeeklyReconciliation } = require('./cron/weeklySyncJob');
const syncController = require('./controllers/syncController');
const sharepointController = require('./controllers/sharepointController');
const { authenticateWebhook } = require('./middlewares/authMiddleware');

const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// runWeeklyReconciliation();
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; padding: 50px; text-align: center;">
            <h1 style="color: #4CAF50;">✅ Request Successful!</h1>
            <p>Your Node.js server is running perfectly on port ${PORT || 3000}.</p>
        </div>
    `);
});

//Sync Route
app.get('/api/sync-deal/:dealId', syncController.syncDealToSap);
// app.post('/api/webhook/zoho-deal', authenticateWebhook, syncController.handleWebhook);

// 1. The SAP ByDesign Integration Route
app.post('/api/webhook/zoho-deal-to-sap', authenticateWebhook, syncController.handleWebhook);

// 2. The SharePoint Integration Route
app.post('/api/webhook/zoho-deal-sharepoint', authenticateWebhook, sharepointController.handleQuoteApproval);

app.post('/api/webhook/zoho-deal-draft', authenticateWebhook, sharepointController.handleDraftProposalSync);



// Connect to MongoDB
connectDB();


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running. Trigger sync at http://localhost:${PORT}/api/webhook/zoho-deal`);
});