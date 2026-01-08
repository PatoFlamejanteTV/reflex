require('dotenv').config();

/**
 * The port number on which the server listens.
 * Defaults to 3000 if not specified in environment variables.
 * @constant {number|string}
 */
const PORT = process.env.PORT || 3000;

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

/**
 * Allowed origins for CORS.
 * Retrieved from environment variables as a comma-separated string.
 * Defaults to 'http://localhost:3000'.
 * @constant {string[]}
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

module.exports = {
    PORT,
    API_KEY,
    MODEL,
    ALLOWED_ORIGINS
};
