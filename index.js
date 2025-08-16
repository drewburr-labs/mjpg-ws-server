const http = require('http');
const WebSocket = require('ws');

const baseUrl = process.env.MJPEG_STREAM_URL;
const serverPort = process.env.PORT || 8080;
let mjpgRequest = null;

if (!baseUrl) {
    console.error('FATAL: The MJPEG_STREAM_URL environment variable is not set.');
    console.error('Please set it to the base URL of your M-JPEG stream source (e.g., a Creality K1 printer\'s IP address).');
    console.error('Example: export MJPEG_STREAM_URL="http://192.168.1.100"');
    process.exit(1);
}

const url = new URL(baseUrl);
url.searchParams.set('action', 'stream');
const streamUrl = url.toString();

// Create an HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('MJPG-to-WebSocket server is running.');
});

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    console.log(`Client connected. Total clients: ${wss.clients.size}`);

    if (wss.clients.size === 1) {
        console.log('First client connected, starting MJPG stream.');
        startMjpgStream();
    }

    ws.on('close', () => {
        console.log(`Client disconnected. Total clients: ${wss.clients.size}`);
        if (wss.clients.size === 0) {
            console.log('Last client disconnected, stopping MJPG stream.');
            stopMjpgStream();
        }
    });
});

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

function stopMjpgStream() {
    if (mjpgRequest) {
        mjpgRequest.destroy();
        mjpgRequest = null;
    }
}

function startMjpgStream() {
    if (mjpgRequest) {
        console.log('MJPG stream is already running.');
        return;
    }

    mjpgRequest = http.get(streamUrl, (res) => {
        console.log(`Connected to MJPG stream. Status: ${res.statusCode}`);

        const contentType = res.headers['content-type'];
        console.log(`Received Content-Type: ${contentType}`);

        if (res.statusCode !== 200) {
            console.error(`Upstream server at ${streamUrl} returned an error: ${res.statusCode}. Will retry.`);
            res.destroy(); // Consume and discard response data
            mjpgRequest = null;
            if (wss.clients.size > 0) {
                setTimeout(startMjpgStream, 5000);
            }
            return;
        }

        mjpgRequest.res = res; // Attach res to the request object

        const boundaryMatch = contentType ? contentType.match(/boundary=(.*)/) : null;
        if (!boundaryMatch) {
            console.error(`Could not find stream boundary in response from ${streamUrl}.`);
            console.error('This often means the source URL is incorrect or the wrong port is being used.');
            console.error('Please ensure the URL points to a valid M-JPEG stream, not a standard web page.');

            res.destroy();
            mjpgRequest = null;
            // Retry if clients are still connected, as the stream might become available later.
            if (wss.clients.size > 0) {
                console.log('Retrying connection in 5 seconds...');
                setTimeout(startMjpgStream, 5000);
            }
            return;
        }
        const boundary = Buffer.from(`--${boundaryMatch[1]}`);
        let buffer = Buffer.alloc(0);

        res.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            let boundaryIndex;
            while ((boundaryIndex = buffer.indexOf(boundary)) !== -1) {
                const framePart = buffer.slice(0, boundaryIndex);
                buffer = buffer.slice(boundaryIndex + boundary.length);

                if (framePart.length > 0) {
                    const jpegStart = framePart.indexOf(Buffer.from([0xFF, 0xD8]));
                    if (jpegStart !== -1) {
                        const jpegData = framePart.slice(jpegStart);
                        broadcast(jpegData);
                    }
                }
            }
        });

        res.on('end', () => {
            console.log('MJPG stream ended.');
            mjpgRequest = null;
            // Reconnect if clients are still connected
            if (wss.clients.size > 0) {
                console.log('Reconnecting to stream...');
                setTimeout(startMjpgStream, 5000);
            }
        });
    });

    mjpgRequest.setTimeout(10000); // 10-second timeout

    mjpgRequest.on('timeout', () => {
        console.error(`Connection to ${streamUrl} timed out.`);
        mjpgRequest.destroy(new Error('Connection timed out')); // Destroy and trigger 'error'
    });

    mjpgRequest.on('error', (e) => {
        console.error(`Error fetching MJPG stream from ${streamUrl}: ${e.message}`);
        mjpgRequest = null;
        // Retry if clients are still connected
        if (wss.clients.size > 0) {
            console.log('Retrying connection in 5 seconds...');
            setTimeout(startMjpgStream, 5000);
        }
    });
}

server.listen(serverPort, () => {
    console.log(`Server listening on http://localhost:${serverPort}`);
    console.log(`Proxying M-JPEG stream from: ${streamUrl}`);
    console.log('Waiting for clients to connect to start stream...');
});
