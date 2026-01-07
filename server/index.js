require('dotenv').config();
const http = require('http');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GROQ_API_KEY;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';//old unsupported model: 'llama3-70b-8192';

async function callGroq(messages) {
    if (!API_KEY) {
        throw new Error("GROQ_API_KEY not configured");
    }

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: messages,
            model: MODEL,
            temperature: 0//.2
        })
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Groq API Error: ${response.status} - ${txt}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
}

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

    if (req.method === 'GET' && pathname === '/ping') {
        // Logic for returning 418 could be added here based on some condition/config
        // For now, simple 200 OK
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('pong');
        return;
    }

    if (req.method === 'POST' && pathname === '/gen') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { master_prompt } = JSON.parse(body);
                if (!master_prompt) {
                    res.writeHead(400);
                    res.end('Missing master_prompt');
                    return;
                }

                const systemPrompt = "You are a Python code generator. Output ONLY a standalone Python script. No explanations. The script should perform the requested action and exit with code 0 on success. If an error occurs during execution of the script, it should print the error and exit with a non-zero code. Do not use external packages.";

                const messages = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Generate python code for: ${master_prompt}` }
                ];

                const gResponse = await callGroq(messages);
                const code = normalizeCode(gResponse);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code }));
            } catch (e) {
                console.error(e);
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
            try {
                const { code, error, master_prompt } = JSON.parse(body);

                // Check if it's really an error or if we're good
                // The client sends the error log.

                const systemPrompt = "You are a Python code fixer. You will be given a python script and an error log. Fix the script to resolve the error. Ensure it fulfills the original purpose. Output ONLY the fixed Python script. No explanations. If you believe the error is not a code failure (e.g. temporary network issue) but the code is correct, or if the error log indicates success, output 'NO_ERROR_DETECTED'.";

                const messages = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Original Task: ${master_prompt}\n\nCurrent Code:\n${code}\n\nError Log:\n${error}\n\nFix the code.` }
                ];

                const gResponse = await callGroq(messages);

                if (gResponse.includes("NO_ERROR_DETECTED")) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok' }));
                } else {
                    const fixedCode = normalizeCode(gResponse);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ code: fixedCode }));
                }

            } catch (e) {
                console.error(e);
                res.writeHead(500);
                res.end(e.toString());
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
