const app = require("./index");
const http = require('http');
const { Server } = require('socket.io');
const debug = require('debug')('ai-work-life-balance:server');

// Normalize port and set it in Express
const normalizePort = val => {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
};

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

// Create HTTP server
const server = http.createServer(app);

// Set up Socket.io
const io = new Server(server);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('A user connected');
  
  // When a user authenticates, join them to a room with their user ID
  socket.on('authenticate', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} authenticated`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Make io accessible from other modules
app.set('io', io);

// Listen on provided port, on all network interfaces
server.listen(port);
server.on('error', error => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // Handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
});

server.on('listening', () => {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
  console.log(`Server running on http://localhost:${port}`);
});