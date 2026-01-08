const http = require('http');
const { PORT } = require('./config');
const handleGen = require('./routes/gen');
const handleFix = require('./routes/fix');

/**
 * Creates the HTTP server handling /gen, /fix, and /ping routes.
 * 
 * @param {http.IncomingMessage} req - The incoming HTTP request.
 * @param {http.ServerResponse} res - The HTTP response object.
 */
const server = http.createServer(async (req, res) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; frame-ancestors 'none';");
    res.setHeader('Referrer-Policy', 'no-referrer');

    // CORS headers
    // Note: 'Access-Control-Allow-Origin: *' is permissive.
    // In production, replace '*' with specific allowed origins.
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
        return handleGen(req, res);
    }

    if (req.method === 'POST' && pathname === '/fix') {
        return handleFix(req, res);
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
