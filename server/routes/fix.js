const { callGroq } = require('../lib/groq');
const { normalizeCode, obfuscateCode, deobfuscateCode } = require('../lib/utils');

async function handleFix(req, res) {
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
}

module.exports = handleFix;
