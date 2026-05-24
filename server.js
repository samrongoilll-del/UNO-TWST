const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// GAME DATA
// ============================================================
const FRUITS = [
  { id: 0, emoji: '🍎', chinese: '苹果', pinyin: 'píng guǒ' },
  { id: 1, emoji: '🍇', chinese: '葡萄', pinyin: 'pútáo' },
  { id: 2, emoji: '🍌', chinese: '香蕉', pinyin: 'xiāngjiāo' },
  { id: 3, emoji: '🍊', chinese: '橘子', pinyin: 'júzi' },
  { id: 4, emoji: '🍍', chinese: '菠萝', pinyin: 'bōluó' },
  { id: 5, emoji: '🥭', chinese: '芒果', pinyin: 'mángguǒ' },
  { id: 6, emoji: '🍓', chinese: '草莓', pinyin: 'cǎoméi' },
  { id: 7, emoji: '🍈', chinese: '木瓜', pinyin: 'mùguā' },
  { id: 8, emoji: '🍋', chinese: '榴莲', pinyin: 'liúlián' },
];
const COLORS = ['red', 'green', 'blue', 'yellow'];
const COLOR_HEX = { red: '#e74c3c', green: '#27ae60', blue: '#2980b9', yellow: '#f39c12' };

// ============================================================
// ROOMS
// ============================================================
const rooms = {}; // roomId -> gameState

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createDeck() {
  let deck = [];
  let id = 0;
  for (let ci = 0; ci < 4; ci++) {
    const color = COLORS[ci];
    for (let fi = 0; fi < 9; fi++) {
      deck.push({ id: id++, color, fruit: fi, type: 'number', value: fi });
      if (fi !== 0) deck.push({ id: id++, color, fruit: fi, type: 'number', value: fi });
    }
    ['skip', 'reverse', '+2'].forEach(s => {
      deck.push({ id: id++, color, type: s });
      deck.push({ id: id++, color, type: s });
    });
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: id++, color: null, type: 'wild' });
    deck.push({ id: id++, color: null, type: 'wild+4' });
  }
  return shuffle(deck);
}

function createRoom(roomId) {
  const deck = createDeck();
  const hands = [[], [], [], []];
  for (let i = 0; i < 7; i++) for (let p = 0; p < 4; p++) hands[p].push(deck.pop());
  let top;
  do { top = deck.pop(); } while (top.type !== 'number');
  return {
    id: roomId,
    deck,
    discard: [top],
    hands,
    players: [null, null, null, null], // socket ids
    playerNames: ['', '', '', ''],
    current: 0,
    direction: 1,
    wildColor: top.color,
    phase: 'waiting', // waiting | play | pickcolor | win
    message: 'รอผู้เล่น...',
    winner: null,
    started: false,
  };
}

function getPublicState(room, forPlayer) {
  // Send each player only their own hand; others as counts
  return {
    phase: room.phase,
    current: room.current,
    direction: room.direction,
    wildColor: room.wildColor,
    message: room.message,
    winner: room.winner,
    playerNames: room.playerNames,
    players: room.players,
    deckCount: room.deck.length,
    discardTop: room.discard[room.discard.length - 1],
    myHand: forPlayer !== null ? room.hands[forPlayer] : [],
    handCounts: room.hands.map(h => h.length),
    myIndex: forPlayer,
    started: room.started,
  };
}

function emitToAll(room) {
  room.players.forEach((socketId, i) => {
    if (socketId) {
      io.to(socketId).emit('state', getPublicState(room, i));
    }
  });
}

function canPlay(card, top, wildColor) {
  if (card.type === 'wild' || card.type === 'wild+4') return true;
  if (card.color === wildColor) return true;
  if (card.type === 'number' && top.type === 'number' && card.value === top.value) return true;
  if (card.type !== 'number' && card.type === top.type) return true;
  return false;
}

function drawOne(room) {
  if (room.deck.length === 0) {
    const top = room.discard.pop();
    room.deck = shuffle(room.discard);
    room.discard = [top];
  }
  return room.deck.pop();
}

function nextPlayer(current, direction, skip = false) {
  const step = skip ? 2 : 1;
  return (current + direction * step + 40) % 4;
}

function applyCardEffect(room, card, player) {
  const next = nextPlayer(player, room.direction);
  if (card.type === '+2') {
    for (let i = 0; i < 2; i++) room.hands[next].push(drawOne(room));
    room.message = `玩家${next + 1} 抽2张! (Player ${next + 1} draw 2)`;
    room.current = nextPlayer(player, room.direction, true);
  } else if (card.type === 'wild+4') {
    for (let i = 0; i < 4; i++) room.hands[next].push(drawOne(room));
    room.message = `玩家${next + 1} 抽4张! (Player ${next + 1} draw 4)`;
    room.current = nextPlayer(player, room.direction, true);
  } else if (card.type === 'skip') {
    room.message = `玩家${next + 1} 跳过! (Player ${next + 1} skipped)`;
    room.current = nextPlayer(player, room.direction, true);
  } else if (card.type === 'reverse') {
    room.direction *= -1;
    room.message = `方向反转! Direction reversed!`;
    room.current = nextPlayer(player, room.direction, false);
  } else {
    room.current = nextPlayer(player, room.direction, false);
  }
  if (room.hands[player].length === 0) {
    room.phase = 'win';
    room.winner = player;
    room.message = `🏆 玩家${player + 1} 获胜! Player ${player + 1} wins!`;
  } else if (room.hands[player].length === 1) {
    room.message = `⚠️ 玩家${player + 1} UNO!`;
  } else {
    if (!room.message.includes('抽') && !room.message.includes('跳') && !room.message.includes('反转')) {
      room.message = `玩家${room.current + 1} 的回合 (Player ${room.current + 1}'s turn)`;
    }
  }
}

// ============================================================
// SOCKET EVENTS
// ============================================================
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('joinRoom', ({ roomId, playerName }) => {
    let room = rooms[roomId];
    if (!room) {
      room = createRoom(roomId);
      rooms[roomId] = room;
    }
    if (room.started) {
      socket.emit('error', 'เกมเริ่มแล้ว ไม่สามารถเข้าร่วมได้');
      return;
    }
    const slot = room.players.findIndex(p => p === null);
    if (slot === -1) {
      socket.emit('error', 'ห้องเต็มแล้ว (4/4)');
      return;
    }
    room.players[slot] = socket.id;
    room.playerNames[slot] = playerName || `Player ${slot + 1}`;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerIndex = slot;
    const filled = room.players.filter(Boolean).length;
    room.message = `${filled}/4 ผู้เล่นเข้าร่วมแล้ว รอผู้เล่นครบ...`;
    emitToAll(room);
    console.log(`${playerName} joined room ${roomId} as player ${slot + 1}`);
  });

  socket.on('startGame', () => {
    const room = rooms[socket.data.roomId];
    if (!room || socket.data.playerIndex !== 0) return;
    const filled = room.players.filter(Boolean).length;
    if (filled < 2) { socket.emit('error', 'ต้องการผู้เล่นอย่างน้อย 2 คน'); return; }
    room.started = true;
    room.phase = 'play';
    room.message = `玩家1 的回合 (Player 1's turn)`;
    emitToAll(room);
  });

  socket.on('playCard', ({ cardId }) => {
    const room = rooms[socket.data.roomId];
    if (!room || room.phase !== 'play') return;
    const pi = socket.data.playerIndex;
    if (room.current !== pi) { socket.emit('error', 'ยังไม่ใช่ตาของคุณ'); return; }
    const hand = room.hands[pi];
    const idx = hand.findIndex(c => c.id === cardId);
    if (idx === -1) { socket.emit('error', 'ไม่พบไพ่นี้'); return; }
    const card = hand[idx];
    const top = room.discard[room.discard.length - 1];
    if (!canPlay(card, top, room.wildColor)) { socket.emit('error', 'ไม่สามารถออกไพ่ใบนี้ได้'); return; }
    hand.splice(idx, 1);
    room.discard.push(card);
    if (card.type === 'wild' || card.type === 'wild+4') {
      room.phase = 'pickcolor';
      room.message = `玩家${pi + 1} เลือกสี...`;
      room._pendingCard = card;
      room._pendingPlayer = pi;
    } else {
      room.wildColor = card.color;
      applyCardEffect(room, card, pi);
    }
    emitToAll(room);
  });

  socket.on('pickColor', ({ color }) => {
    const room = rooms[socket.data.roomId];
    if (!room || room.phase !== 'pickcolor') return;
    const pi = socket.data.playerIndex;
    if (room._pendingPlayer !== pi) return;
    if (!COLORS.includes(color)) return;
    room.wildColor = color;
    room.phase = 'play';
    applyCardEffect(room, room._pendingCard, pi);
    emitToAll(room);
  });

  socket.on('drawCard', () => {
    const room = rooms[socket.data.roomId];
    if (!room || room.phase !== 'play') return;
    const pi = socket.data.playerIndex;
    if (room.current !== pi) return;
    room.hands[pi].push(drawOne(room));
    room.message = `玩家${pi + 1} 抽牌 (Player ${pi + 1} drew a card)`;
    room.current = nextPlayer(pi, room.direction);
    emitToAll(room);
  });

  socket.on('restartGame', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || socket.data.playerIndex !== 0) return;
    const newRoom = createRoom(roomId);
    newRoom.players = room.players;
    newRoom.playerNames = room.playerNames;
    newRoom.started = true;
    newRoom.phase = 'play';
    newRoom.message = `玩家1 的回合 (Player 1's turn)`;
    rooms[roomId] = newRoom;
    room.players.forEach((sid, i) => {
      if (sid) {
        const s = io.sockets.sockets.get(sid);
        if (s) s.data.playerIndex = i;
      }
    });
    emitToAll(rooms[roomId]);
  });

  socket.on('disconnect', () => {
    const room = rooms[socket.data.roomId];
    if (!room) return;
    const pi = socket.data.playerIndex;
    room.players[pi] = null;
    room.playerNames[pi] = '';
    const remaining = room.players.filter(Boolean).length;
    if (remaining === 0) {
      delete rooms[socket.data.roomId];
    } else {
      room.message = `玩家${pi + 1} ออกจากเกม`;
      emitToAll(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`UNO 生词 server running on port ${PORT}`);
});
