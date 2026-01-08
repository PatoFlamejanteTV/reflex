const { callGroq } = require('../lib/groq');
const { normalizeCode, obfuscateCode } = require('../lib/utils');

async function handleGen(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        console.log(`[${new Date().toISOString()}] /gen received body length: ${body.length}`);
        try {
            let payload;
            try {
              payload = JSON.parse(body);
            } catch (e) {
              if (e instanceof SyntaxError) {
                res.writeHead(400);
                res.end('Invalid JSON');
                return;
              }
              throw e;
            }
            const { master_prompt, obfuscate } = payload;
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
}

module.exports = handleGen;
