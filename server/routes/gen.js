const { callGroq } = require('../lib/groq');
const { normalizeCode, obfuscateCode } = require('../lib/utils');
const { readJSONBody, sendError } = require('../lib/request-handler');

async function handleGen(req, res) {
    try {
        const { master_prompt, obfuscate } = await readJSONBody(req);

        console.log(`[${new Date().toISOString()}] /gen request received. Obfuscate: ${!!obfuscate}`);

        if (!master_prompt || typeof master_prompt !== 'string') {
            console.error("Missing or invalid master_prompt");
            return sendError(res, 400, 'Missing or invalid master_prompt');
        }

        const systemPrompt = "You are a Python code generator. Output ONLY a standalone Python script. No explanations. The script should perform the requested action and exit with code 0 on success. If an error occurs during execution of the script, it should print the error and exit with a non-zero code. Do not use external packages.";

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate python code for: ${master_prompt}` }
        ];

        console.log("Calling Groq for /gen...");
        const gResponse = await callGroq(messages);
        console.log("Groq response received");

        let code = normalizeCode(gResponse);

        if (obfuscate) {
            console.log("Obfuscating generated code...");
            code = obfuscateCode(code);
        }

        console.log("Final code length:", code.length);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code }));
    } catch (e) {
        console.error("/gen Error:", e.message);
        if (e.message === 'Payload Too Large') {
            return sendError(res, 413, 'Payload Too Large');
        }
        if (e.message === 'Invalid JSON') {
            return sendError(res, 400, 'Invalid JSON');
        }
        return sendError(res, 500, 'Internal Server Error');
    }
}

module.exports = handleGen;
