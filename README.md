# MJPG to WebSocket Proxy Server

This is a lightweight, efficient Node.js server that proxies an M-JPEG (Motion JPEG) stream over a WebSocket connection. It was originally created to provide a stable and efficient way to view the camera stream from Creality 3D printers (like the K1/K1C series), but it is designed to work with any standard M-JPEG stream source.

## Why Use This?

Accessing an M-JPEG stream directly via HTTP can be inefficient, especially with multiple clients. This server acts as an intelligent proxy, offering several key advantages over a direct connection:

- **Connection Multiplexing**: It establishes a single connection to the source M-JPEG stream and broadcasts the frames to all connected WebSocket clients. This significantly reduces the load on the source device (e.g., your printer's camera) and conserves network bandwidth.
- **Automatic Stream Management**: The server automatically starts fetching the M-JPEG stream when the first client connects and stops when the last client disconnects. No more idle streams consuming resources.
- **Resilience**: It automatically attempts to reconnect to the source stream if the connection is dropped, ensuring a more stable viewing experience for clients.
- **Simplified Client Implementation**: Clients connect via a standard WebSocket, which is simpler to implement and more standardized across platforms than parsing a multipart HTTP stream.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v24 or later recommended)
- An M-JPEG stream URL.

### Configuration

This server is configured via environment variables. You must set `MJPEG_STREAM_URL` before running the application.

- `MJPEG_STREAM_URL`: **(Required)** The base URL of the source M-JPEG stream (e.g., `http://192.168.1.100`). The `?action=stream` parameter will be added automatically.
- `PORT`: (Optional) The port for the server to listen on. Defaults to `8080`.

### Running Locally

1. Clone the repository.
2. Install dependencies:

    ```sh
    npm install
    ```

3. Set the environment variable and start the server:

    ```sh
    export MJPEG_STREAM_URL="http://your-printer-ip"
    npm start
    ```

The server will be running at `http://localhost:8080`, and the WebSocket endpoint will be `ws://localhost:8080`.

### Running with Docker

A multi-stage `Dockerfile` is included for building a lean, optimized container.

1. Build the Docker image:

    ```sh
    docker build -t mjpg-ws-server .
    ```

2. Run the container, passing the required environment variable:

    ```sh
    docker run -d -p 8080:8080 \
      -e MJPEG_STREAM_URL="http://your-printer-ip" \
      --name mjpg-proxy mjpg-ws-server
    ```

This will run the server in the background, mapping port 8080 on your host to port 8080 in the container.

## Client-Side Usage

Connect your client application to the WebSocket server (e.g., `ws://<server-ip>:8080`). To stop receiving frames, simply close the WebSocket connection.

- **Receiving Frames**: The server will send raw JPEG image data in binary WebSocket frames.

## Example Client

An example HTML client is available in the `examples/` directory. Once the server is running locally, you can open the `examples/index.html` file in your web browser to view the stream. This provides a simple way to test that the server is working correctly.

## Troubleshooting

### "Could not find stream boundary" Error

If you see this error in the server logs, it typically means one of the following:

- **Incorrect URL or Port**: The `MJPEG_STREAM_URL` environment variable is pointing to a valid web server, but not to the M-JPEG stream itself. This commonly happens if you use the printer's web interface port (e.g., port 80) instead of the dedicated camera stream port (often 8080 for Creality printers).
- **Not an M-JPEG Stream**: The URL is for a different type of video stream (e.g., HLS, RTSP) or a static web page.

**Solution**: Double-check the IP address and port number for your camera's M-JPEG stream. The server logs will show the `Content-Type` and a snippet of the response body it received, which can help you diagnose what the server is actually returning (e.g., `text/html` for a web page).
