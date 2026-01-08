require('dotenv').config();

/**
 * The port number on which the server listens.
 * Defaults to 3000 if not specified in environment variables.
 * @constant {number|string}
 */
const PORT = parseInt(process.env.PORT, 10) || 3000;

/**
 * The Groq API key retrieved from environment variables.
 * @constant {string}
 */
const API_KEY = process.env.GROQ_API_KEY;

/**
 * The model name to be used for Groq API calls.
 * @constant {string}
 */
const MODEL = 'llama-3.1-8b-instant'; //old unsupported model: 'llama3-70b-8192';

module.exports = {
    PORT,
    API_KEY,
    MODEL
};
