# System Design

Desk-HUD utilizes a client-server architecture where both the client and server components run on the same machine, leveraging the Raspberry Pi hardware platform. The server is implemented in JavaScript using Node.js with Express.js and Socket.IO, and it runs locally at localhost:3000. The client is implemented in JavaScript and utilizes Pixi.js for rendering graphics.

On the client side, multiple widgets runs, each corresponding to a specific backend service. These widgets communicate with their respective backend services to retrieve and display relevant data. This modular design allows for flexibility and scalability in adding or modifying widgets based on individual preferences and requirements.

![System Design Diagram](img/systemDesign.png)

## Communication

Communication between the client and server is established through web sockets, allowing real-time data exchange. Additionally, an HTTP connection is used to serve static content to the client. This architecture enables seamless and efficient communication between the two components.

The server component of Desk-HUD encompasses multiple services, each responsible for the logic of a specific widget. These services handle data retrieval, processing, and communication with external sources: the Google Calendar and Tasks APIs, a published Outlook calendar (ICS), the US National Weather Service, StockData, Jolpica-F1 and OpenF1 (Formula 1 standings and session results), and local network checks. The server also reports the Pi's CPU, memory, temperature and fan speed, and controls the power of the HDMI monitor. A distance-sensor service is included; without a sensor fitted it simulates a constant reading.

### Incoming messages

There are several web socket events emitted by the server:

- `config` - configuration details sent after client connected
- `widget` - update of widget data, `{widgetId, payload}`. The payload is specific to each widget; one widget can take messages from several services (the Calendar widget shows both the Google and the Outlook calendar)
- `distance` - distance readings and sleep/wake actions
- `system` - CPU, memory, temperature and fan updates from the system monitor
- `log` - stream of server side logs to show them in browser's dev tool console

### Outgoing messages

There is one web socket event emitted by the client:

- `service` - command for a service, `{serviceId, payload}` (e.g. tick off a task or run a network speed test)

## Persistence

To store essential data, the server employs simple JSON files on the local disk, utilizing the `node-persist` library (pomodoro history, stock quotes, network history). A few per-screen settings live in the browser's `localStorage`: the accent colour and rainbow mode, and the running pomodoro timer.
