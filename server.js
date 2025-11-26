// Ejecutar con: npm install && node server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

const sanitizeName = (name) => {
  if (typeof name !== 'string') return '';
  return name.trim().slice(0, 20);
};

const generateRoomId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(id) ? generateRoomId() : id;
};

const getRoomData = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return null;
  return {
    roomId,
    players: room.players,
    hostId: room.hostId,
    status: room.status,
    winner: room.winner
  };
};

const broadcastRoomUpdate = (roomId) => {
  const data = getRoomData(roomId);
  if (data) {
    io.to(roomId).emit('roomUpdate', data);
  }
};

io.on('connection', (socket) => {
  let currentRoom = null;

  const leaveRoom = () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(currentRoom);
      currentRoom = null;
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      io.to(currentRoom).emit('hostChanged', room.players[0]);
    }

    broadcastRoomUpdate(currentRoom);
    currentRoom = null;
  };

  socket.on('createRoom', ({ name }) => {
    const cleanName = sanitizeName(name);
    if (!cleanName) {
      socket.emit('errorMessage', 'Debes escribir tu nombre.');
      return;
    }

    const roomId = generateRoomId();
    const player = { id: socket.id, name: cleanName, isHost: true };
    const roomState = {
      players: [player],
      hostId: socket.id,
      status: 'waiting',
      winner: null
    };

    rooms.set(roomId, roomState);
    socket.join(roomId);
    currentRoom = roomId;
    socket.emit('roomJoined', getRoomData(roomId));
    broadcastRoomUpdate(roomId);
  });

  socket.on('joinRoom', ({ roomId, name }) => {
    const code = typeof roomId === 'string' ? roomId.trim().toUpperCase() : '';
    const room = rooms.get(code);
    if (!room) {
      socket.emit('errorMessage', 'La sala no existe.');
      return;
    }

    const cleanName = sanitizeName(name);
    if (!cleanName) {
      socket.emit('errorMessage', 'Debes escribir tu nombre.');
      return;
    }

    const player = { id: socket.id, name: cleanName, isHost: false };
    room.players.push(player);
    socket.join(code);
    currentRoom = code;
    socket.emit('roomJoined', getRoomData(code));
    broadcastRoomUpdate(code);
  });

  socket.on('startRound', () => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;

    room.status = 'running';
    room.winner = null;
    io.to(currentRoom).emit('roundStarted');
    broadcastRoomUpdate(currentRoom);
  });

  socket.on('nextRound', () => {
    const room = rooms.get(currentRoom);
    if (!room || room.hostId !== socket.id) return;

    room.status = 'waiting';
    room.winner = null;
    io.to(currentRoom).emit('roundReset');
    broadcastRoomUpdate(currentRoom);
  });

  socket.on('pressButton', () => {
    const room = rooms.get(currentRoom);
    if (!room || room.status !== 'running' || room.winner) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    room.winner = player.name;
    room.status = 'ended';
    io.to(currentRoom).emit('roundEnded', { winner: room.winner });
    broadcastRoomUpdate(currentRoom);
  });

  socket.on('disconnect', () => {
    leaveRoom();
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
