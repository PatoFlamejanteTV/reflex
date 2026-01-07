require('dotenv').config();
const http = require('http');
const zlib = require('zlib');
const Groq = require('groq-sdk');

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
const MODEL = 'llama-3.1-8b-instant';//old unsupported model: 'llama3-70b-8192';

/**
 * The Groq client instance initialized with the API key.
 * @constant {Groq}
 */
const groq = new Groq({ apiKey: API_KEY });

/**
 * Calls the Groq API with the provided messages.
 *
 * @async
 * @param {Array<{role: string, content: string}>} messages - The array of message objects to send to the API.
 * @returns {Promise<string>} The content of the response message.
 * @throws {Error} If API_KEY is missing or if the API call fails.
 */
async function callGroq(messages) {
    if (!API_KEY) {
        console.error("GROQ_API_KEY is missing");
        throw new Error("GROQ_API_KEY not configured");
    }

    console.log(`[callGroq] sending request to Groq SDK with model ${MODEL}`);
    console.log(`[callGroq] messages count: ${messages.length}`);

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: MODEL,
            temperature: 0
        });

        console.log(`[callGroq] Success. Usage: ${JSON.stringify(chatCompletion.usage)}`);
        return chatCompletion.choices[0]?.message?.content || "";
    } catch (e) {
        console.error(`[callGroq] API Error: ${e.message}`);
        throw e;
    }
}

/**
 * Extracts and returns the code from the given content, removing markdown formatting if present.
 *
 * @param {string} content - The content string, potentially containing markdown code blocks.
 * @returns {string} The raw code string.
 */
function normalizeCode(content) {
    // Extract code from markdown block if present
    const match = content.match(/```python([\s\S]*?)```/);
    if (match) {
        return match[1].trim();
    }
    // Retrieve extracting just code if no blocks, but usually models use blocks.
    // If no block, assume the whole text is code (risky) or try to find code.
    // For now, let's assume the system prompt forces code blocks or clean code.
    return content.replace(/```/g, "").trim();
}

/**
 * Obfuscates Python code using zlib compression and base64 encoding with a reversed payload.
 * unique variable names are generated to make the wrapper slightly dynamic.
 */
function obfuscateCode(script) {
    try {
        const compressed = zlib.deflateSync(script);
        const b64 = compressed.toString('base64');
        const reversed = b64.split('').reverse().join('');

        // Generate random variable names
        const r = () => '_' + Math.random().toString(36).substring(2, 7);
        const [vZlib, vB64, vPayload] = [r(), r(), r()];

        return `import zlib as ${vZlib}, base64 as ${vB64}
${vPayload} = "${reversed}"
exec(${vZlib}.decompress(${vB64}.b64decode(${vPayload}[::-1])))`;
    } catch (e) {
        console.error("Obfuscation failed:", e);
        return script;
    }
}

/**
 * Attempts to de-obfuscate Python code that matches the obfuscation pattern.
 * This is necessary for the /fix endpoint to show clear code to the LLM.
 */
function deobfuscateCode(script) {
    // Basic heuristic to detect our obfuscation pattern
    if (script.includes("import zlib") && script.includes("base64") && script.includes("exec(") && script.includes("[::-1]")) {
        try {
            // regex to capture the payload string
            // looks for any variable assignment of a string
            const match = script.match(/([a-zA-Z0-9_]+)\s*=\s*"([^"]+)"/);
            if (match && match[2]) {
                const reversed = match[2];
                const b64 = reversed.split('').reverse().join('');
                const buffer = Buffer.from(b64, 'base64');
                const decompressed = zlib.inflateSync(buffer);
                return decompressed.toString('utf-8');
            }
        } catch (e) {
            console.log("De-obfuscation attempt failed, using original script:", e.message);
        }
    }
    return script;
}

/**
 * Creates the HTTP server handling /gen, /fix, and /ping routes.
 * 
 * @param {http.IncomingMessage} req - The incoming HTTP request.
 * @param {http.ServerResponse} res - The HTTP response object.
 */
const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

    if (req.method === 'GET' && pathname === '/ping') {
        // Logic for returning 418 could be added here based on some condition/config
        // For now, simple 200 OK
        console.log("Ping received, sending pong");
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('pong');
        return;
    }

    if (req.method === 'POST' && pathname === '/gen') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            console.log(`[${new Date().toISOString()}] /gen received body length: ${body.length}`);
            try {
                const { master_prompt, obfuscate } = JSON.parse(body);
                console.log(`[${new Date().toISOString()}] MASTER_PROMPT: ${master_prompt}, Obfuscate: ${!!obfuscate}`);
                if (!master_prompt) {
                    console.error("Missing master_prompt");
                    res.writeHead(400);
                    res.end('Missing master_prompt');
                    return;
                }

                const systemPrompt = "You are a Python code generator. Output ONLY a standalone Python script. No explanations. The script should perform the requested action and exit with code 0 on success. If an error occurs during execution of the script, it should print the error and exit with a non-zero code. Do not use external packages.";

                const messages = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Generate python code for: ${master_prompt}` }
                ];

                console.log("Calling Groq for /gen...");
                const gResponse = await callGroq(messages);
                console.log("Groq response received:", gResponse.substring(0, 50) + "...");
                let code = normalizeCode(gResponse);

                if (obfuscate) {
                    console.log("Obfuscating generated code...");
                    code = obfuscateCode(code);
                }

                console.log("Final code length:", code.length);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code }));
            } catch (e) {
                console.error("/gen Error:", e);
                res.writeHead(500);
                res.end(e.toString());
            }
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/fix') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            console.log(`[${new Date().toISOString()}] /fix received body length: ${body.length}`);
            try {
                const { code, error, master_prompt, obfuscate } = JSON.parse(body);
                console.log(`[${new Date().toISOString()}] FIX request for Master Prompt: ${master_prompt}, Obfuscate: ${!!obfuscate}`);
                console.log(`Error log provided: ${error.substring(0, 100)}...`);

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
                console.log("Groq response for /fix:", gResponse.substring(0, 50) + "...");

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
                console.error("/fix Error:", e);
                res.writeHead(500);
                res.end(e.toString());
            }
        });
        return;
    }

    console.log(`[${new Date().toISOString()}] 404 Not Found: ${req.method} ${pathname}`);
    res.writeHead(404);
    res.end('Not Found');
});

/**
 * Starts the server listening on the specified port.
 */
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
