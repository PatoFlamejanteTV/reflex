const { callGroq } = require('../lib/groq');
const { normalizeCode, obfuscateCode, deobfuscateCode } = require('../lib/utils');
const { readJSONBody, sendError } = require('../lib/request-handler');

async function handleFix(req, res) {
    try {
        const { code, error, master_prompt, obfuscate } = await readJSONBody(req);

        console.log(`[${new Date().toISOString()}] /fix request received. Obfuscate: ${!!obfuscate}`);

        // Validation
        if (!code || typeof code !== 'string') {
             return sendError(res, 400, 'Missing or invalid code');
        }
        if (!error || typeof error !== 'string') {
             return sendError(res, 400, 'Missing or invalid error log');
        }
        if (!master_prompt || typeof master_prompt !== 'string') {
             return sendError(res, 400, 'Missing or invalid master_prompt');
        }

        console.log(`Error log length: ${error.length}`);

        // De-obfuscate code if needed before showing to LLM
        const clearCode = deobfuscateCode(code);
        if (clearCode !== code) {
            console.log("De-obfuscated code for LLM analysis.");
        }

        const systemPrompt = "You are a Python code fixer. You will be given a python script and an error log. Fix the script to resolve the error. Ensure it fulfills the original purpose. Output ONLY the fixed Python script. No explanations. If you believe the error is not a code failure (e.g. temporary network issue) but the code is correct, or if the error log indicates success, output 'NO_ERROR_DETECTED'.";

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Original Task: ${master_prompt}\n\nCurrent Code:\n${clearCode}\n\nError Log:\n${error}\n\nFix the code.` }
        ];

        console.log("Calling Groq for /fix...");
        const gResponse = await callGroq(messages);
        console.log("Groq response received");

        if (gResponse.includes("NO_ERROR_DETECTED")) {
            console.log("No error detected by LLM");
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        } else {
            let fixedCode = normalizeCode(gResponse);

            if (obfuscate) {
                console.log("Obfuscating fixed code...");
                fixedCode = obfuscateCode(fixedCode);
            }

            console.log("Fixed code generated, length:", fixedCode.length);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: fixedCode }));
        }

    } catch (e) {
        console.error("/fix Error:", e.message);
        if (e.message === 'Payload Too Large') {
            return sendError(res, 413, 'Payload Too Large');
        }
        if (e.message === 'Invalid JSON') {
            return sendError(res, 400, 'Invalid JSON');
        }
        return sendError(res, 500, 'Internal Server Error');
    }
}

module.exports = handleFix;
