const http = require('http');
const fs = require('fs');
const path = require('path');
const apiHandler = require('./log/index.js');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, '..');

// Helper to determine content type
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // API Route
    if (url.pathname === '/api/log') {
        console.log(`[API Request] ${req.method} ${req.url}`);
        
        // Mock Azure Function Context
        const context = {
            log: {
                info: console.log,
                error: console.error,
                warn: console.warn
            },
            res: {}
        };

        // Gather request body if POST
        let bodyBuffer = '';
        req.on('data', chunk => {
            bodyBuffer += chunk;
        });

        req.on('end', async () => {
            const apiReq = {
                method: req.method,
                headers: req.headers,
                query: Object.fromEntries(url.searchParams),
                body: bodyBuffer ? JSON.parse(bodyBuffer) : {}
            };

            try {
                await apiHandler(context, apiReq);
                
                // Return response to client
                const status = context.res.status || 200;
                const headers = context.res.headers || {};
                const body = context.res.body ? JSON.stringify(context.res.body) : '';
                
                res.writeHead(status, headers);
                res.end(body);
            } catch (err) {
                console.error("[Dev Server API Error]:", err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "Internal Server Error" }));
            }
        });
        return;
    }

    // Static Files Route
    let filePath = path.join(PUBLIC_DIR, url.pathname);
    
    // If directory, try index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    // Default to main index.html if not specified
    if (url.pathname === '/') {
        filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    console.log(`[Static File Request] ${req.method} ${url.pathname} -> ${filePath}`);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`Local Dev Server running at:`);
    console.log(`> Proposal Page:   http://localhost:${PORT}/4u`);
    console.log(`> Admin Dashboard: http://localhost:${PORT}/4u-admin`);
    console.log(`========================================\n`);
});
