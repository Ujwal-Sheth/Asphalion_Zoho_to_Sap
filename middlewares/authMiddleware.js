/**
 * Middleware to enforce token authentication on webhook endpoints.
 * Expects the token to be provided either as a Bearer token in the 'Authorization' header,
 * or as a raw string in the 'x-api-key' header.
 */
const authenticateWebhook = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'];

    // The secret token must be set in your .env file
    const expectedToken = process.env.WEBHOOK_SECRET_TOKEN;

    // Enforce strictly: If the server hasn't configured a secret, block requests.
    if (!expectedToken) {
        console.error('⚠️ Security Critical: WEBHOOK_SECRET_TOKEN is not defined in the .env file.');
        return res.status(500).json({ error: 'Server misconfiguration: Webhook security token is missing.' });
    }

    let providedToken = null;

    // Extract from Authorization header (e.g., "Bearer your_token_here")
    if (authHeader && authHeader.startsWith('Bearer ')) {
        providedToken = authHeader.split(' ')[1];
    } 
    // Or extract from a custom x-api-key header
    else if (apiKeyHeader) {
        providedToken = apiKeyHeader;
    }

    if (!providedToken) {
        return res.status(401).json({ error: 'Unauthorized: No authentication token provided.' });
    }

    // Compare tokens securely
    if (providedToken !== expectedToken) {
        console.warn(`🚨 Unauthorized webhook access attempt from IP: ${req.ip}`);
        return res.status(403).json({ error: 'Forbidden: Invalid authentication token.' });
    }

    // Authentication passed! Proceed to the controller.
    next();
};

module.exports = { authenticateWebhook };
