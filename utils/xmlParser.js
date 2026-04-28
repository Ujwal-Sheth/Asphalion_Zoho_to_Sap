const xml2js = require('xml2js');

/**
 * Standardized XML parser for SAP responses.
 * @param {string} xmlString - The raw XML string from SAP.
 * @returns {Promise<Object>} - Parsed Javascript object.
 */
const parseSapXml = async (xmlString) => {
    return xml2js.parseStringPromise(xmlString, {
        explicitArray: false,
        tagNameProcessors: [xml2js.processors.stripPrefix],
    });
};

module.exports = { parseSapXml };
