const socket = io();

const views = {
  landing: document.getElementById('landing'),
  createForm: document.getElementById('createForm'),
  joinForm: document.getElementById('joinForm'),
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  winner: document.getElementById('winner'),
  error: document.getElementById('error'),
};

const elements = {
  createRoomBtn: document.getElementById('createRoomBtn'),
  joinRoomBtn: document.getElementById('joinRoomBtn'),
  confirmCreate: document.getElementById('confirmCreate'),
  confirmJoin: document.getElementById('confirmJoin'),
  createName: document.getElementById('createName'),
  joinName: document.getElementById('joinName'),
  joinCode: document.getElementById('joinCode'),
  roomId: document.getElementById('roomId'),
  playersList: document.getElementById('playersList'),
  statusMessage: document.getElementById('statusMessage'),
  startRound: document.getElementById('startRound'),
  nextRound: document.getElementById('nextRound'),
  controls: document.getElementById('controls'),
  hostBadge: document.getElementById('hostBadge'),
  bigButton: document.getElementById('bigButton'),
  gameStatus: document.getElementById('gameStatus'),
  winnerText: document.getElementById('winnerText'),
  errorText: document.getElementById('errorText'),
};

let isHost = false;
let currentStatus = 'waiting';
let currentRoomId = '';

const showView = (id) => {
  Object.values(views).forEach((view) => view.classList.add('hidden'));
  views[id].classList.remove('hidden');
};

const resetForms = () => {
  elements.createName.value = '';
  elements.joinName.value = '';
  elements.joinCode.value = '';
};

const renderPlayers = (players, hostId) => {
  elements.playersList.innerHTML = '';
  players.forEach((player) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = player.name;
    li.appendChild(nameSpan);

    if (player.id === hostId) {
      const tag = document.createElement('span');
      tag.textContent = 'Host';
      tag.className = 'tag';
      li.appendChild(tag);
    }

    elements.playersList.appendChild(li);
  });
};

const updateControls = () => {
  elements.controls.classList.toggle('hidden', !isHost);
  elements.startRound.classList.toggle('hidden', !(isHost && currentStatus === 'waiting'));
  elements.nextRound.classList.toggle('hidden', !(isHost && currentStatus === 'ended'));
};

const updateGameView = (status, winner) => {
  if (status === 'running') {
    elements.gameStatus.textContent = '¡Pulsa el botón lo más rápido posible!';
    elements.bigButton.disabled = false;
    showView('game');
    views.winner.classList.add('hidden');
  } else if (status === 'ended') {
    if (winner) {
      elements.winnerText.textContent = `Ganador: ${winner}`;
      views.winner.classList.remove('hidden');
    }
    elements.bigButton.disabled = true;
    views.game.classList.add('hidden');
  } else {
    elements.bigButton.disabled = true;
    views.game.classList.add('hidden');
    views.winner.classList.add('hidden');
  }
};

const setHostBadge = () => {
  elements.hostBadge.classList.toggle('hidden', !isHost);
};

const showError = (message) => {
  elements.errorText.textContent = message;
  showView('error');
};

const normalizeCode = (code) => code.trim().toUpperCase();
const normalizeName = (name) => name.trim().slice(0, 20);

// Navigation
[...document.querySelectorAll('[data-back]')].forEach((btn) => {
  btn.addEventListener('click', () => {
    showView('landing');
    resetForms();
  });
});

elements.createRoomBtn.addEventListener('click', () => showView('createForm'));
elements.joinRoomBtn.addEventListener('click', () => showView('joinForm'));

elements.confirmCreate.addEventListener('click', () => {
  const name = normalizeName(elements.createName.value);
  if (!name) return;
  socket.emit('createRoom', { name });
});

elements.confirmJoin.addEventListener('click', () => {
  const roomId = normalizeCode(elements.joinCode.value);
  const name = normalizeName(elements.joinName.value);
  if (!roomId || !name) return;
  socket.emit('joinRoom', { roomId, name });
});

elements.startRound.addEventListener('click', () => socket.emit('startRound'));
elements.nextRound.addEventListener('click', () => socket.emit('nextRound'));
elements.bigButton.addEventListener('click', () => socket.emit('pressButton'));

// Socket events
socket.on('roomJoined', (data) => {
  currentRoomId = data.roomId;
  elements.roomId.textContent = data.roomId;
  isHost = data.hostId === socket.id;
  currentStatus = data.status;
  renderPlayers(data.players, data.hostId);
  elements.statusMessage.textContent = 'Esperando a que el host inicie la ronda';
  showView('lobby');
  updateControls();
  setHostBadge();
  updateGameView(data.status, data.winner);
  resetForms();
});

socket.on('roomUpdate', (data) => {
  currentStatus = data.status;
  isHost = data.hostId === socket.id;
  renderPlayers(data.players, data.hostId);
  setHostBadge();
  updateControls();
  if (data.winner) {
    elements.statusMessage.textContent = `Ganador: ${data.winner}`;
  } else if (data.status === 'running') {
    elements.statusMessage.textContent = '¡Ronda en curso!';
  } else {
    elements.statusMessage.textContent = 'Esperando a que el host inicie la ronda';
  }
  updateGameView(data.status, data.winner);
});

socket.on('roundStarted', () => {
  currentStatus = 'running';
  updateControls();
  updateGameView('running');
  elements.statusMessage.textContent = '¡Ronda en curso!';
});

socket.on('roundEnded', ({ winner }) => {
  currentStatus = 'ended';
  elements.statusMessage.textContent = `Ganador: ${winner}`;
  updateControls();
  updateGameView('ended', winner);
});

socket.on('roundReset', () => {
  currentStatus = 'waiting';
  elements.statusMessage.textContent = 'Esperando a que el host inicie la ronda';
  updateControls();
  updateGameView('waiting');
});

socket.on('hostChanged', (newHost) => {
  isHost = newHost.id === socket.id;
  updateControls();
  setHostBadge();
});

socket.on('errorMessage', (msg) => showError(msg));

socket.on('connect_error', () => showError('No se pudo conectar con el servidor.'));
