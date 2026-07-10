// *** main {{{
ssy_var = {
    'config': {
        'nodepos': [], 'nodemov': [], 'nodestart_d': [], 'nodestart_x': [],
    },
    'ui': {},
    'state': {},
    'p2p': {
        'peer': null,
        'conns': [], // Used by host to track multiple players (max 5)
        'hostConn': null, // Used by clients to talk to host
        'isHost': true,
        'myId': null,
        'myName': 'Guest-' + Math.floor(Math.random() * 9000 + 1000),
        'players': {}, // { peerId: "Username" }
        'roleMap': { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null } // Maps player role (0-5) to a PeerID
    }
}

ssy_init = function() {
    $('#movelist, #movewrap, #replay, #config').hide();

    // Load nodes and map data
    var rows = ssy_cfg.board.map.startpos_d.trim().split('\n');
    for(var row in rows) ssy_var.config.nodestart_d.push(parseInt(rows[row]));
    
    var rows = ssy_cfg.board.map.startpos_x.trim().split('\n');
    for(var row in rows) ssy_var.config.nodestart_x.push(parseInt(rows[row]));
    
    var rows = ssy_cfg.board.map.nodes.trim().split('\n');
    for(var row in rows) {
        var itm = rows[row].split(' ');
        ssy_var.config.nodepos[parseInt(itm[0])] = [parseInt(itm[1]), parseInt(itm[2])];
        ssy_var.config.nodemov[parseInt(itm[0])] = [];
    }
    
    var rows = ssy_cfg.board.map.moves.trim().split('\n');
    for(var row in rows) {
        var itm = rows[row].split(' ');
        ssy_var.config.nodemov[parseInt(itm[0])].push(itm[2] + itm[1]);
        ssy_var.config.nodemov[parseInt(itm[1])].push(itm[2] + itm[0]);
    }

    ssy_var.ui = {...ssy_cfg.ui.defaults};
    ssy_var.state = {};

    var svgcnt = '<defs>';
    for(var i = 0; i < ssy_cfg.players.length; i++) {
        var itm = ssy_cfg.board.pieces.icons[i].split('|', 2);
        svgcnt += '<symbol id="i-p' + i + '" viewBox="' + itm[0] + '">' + itm[1] + '</symbol>';
        $('#map').append('<svg id="p' + i + '" title="' + ssy_cfg.players[i]+ '" class="player" viewBox="' + itm[0] + '"><use href="#i-p' + i + '"/></svg>');
    }
    svgcnt += '</defs>';
    $('#svgs').html(svgcnt);
    $('#p0').hide();

    ssy_ui_redraw(true);

    if (ssy_var.state && ssy_var.state.cur && ssy_var.state.cur.what) {
        ssy_ui_tomoves('history');
        $('#movelist, #movewrap').show();
        if(ssy_var.state.cur.what == 'play') ssy_step();
        else if(ssy_var.state.cur.what == 'end') {
            $('#move, #go, #move-x, #move-2').hide();
            $('#replay').show();
            ssy_ui_redraw(true);
        }
    }
    
    ssy_p2p_init();
    initPanZoom();
}

ssy_start = function() {
    if (!ssy_var.p2p.isHost) {
        alert("Only the Host can start a new game.");
        return;
    }
    if(!confirm("Do you wish to start a new game?")) return;

    var spos = [...ssy_var.config.nodestart_d];
    ssy_int_array_shuffle(spos);
    spos = spos.slice(0, ssy_cfg.players.length);
    spos[0] = ssy_var.config.nodestart_x[Math.floor(Math.random() * ssy_var.config.nodestart_x.length)];

    ssy_var.state = {
        'cur': { 'what': 'play', 'round': 1, 'player': -1 },
        'last2': -2,
        'moves': {},
        'pos': spos,
        'history': [spos.map((item, i) => { return '.' + item; })],
    };

    ssy_var.state.moves[0] = {...ssy_cfg.rules.moves_x};
    for(var i = 1; i < ssy_cfg.players.length; i++) ssy_var.state.moves[i] = {...ssy_cfg.rules.moves_d};
    ssy_var.state.history[1] = [];

    ssy_ui_tomoves('history');
    $('#movelist, #movewrap, #move, #go').show();
    $('#replay').hide();

    ssy_step();
    ssy_p2p_broadcast_state();
}

ssy_step = function() {
    var curs = ssy_var.state.cur;
    curs.player++;
    if (curs.player == ssy_cfg.players.length) {
        curs.player = 0;
        curs.round++;
        ssy_var.state.history[curs.round] = [];
        ssy_ui_tomoves('line');
    }

    if(([...ssy_var.state.pos].slice(1).includes(ssy_var.state.pos[0])) || (ssy_int_possible_moves(0, ssy_var.state.pos[0]).length == 0)) {
        alert('Mr. X Lost!');
        ssy_var.state.cur.what = 'end';
    }

    if(ssy_var.state.cur.round > ssy_cfg.rules.maxmoves) {
        alert('Mr. X Won!');
        ssy_var.state.cur.what = 'end';
    }

    if(ssy_var.state.cur.what == 'end') {
        ssy_ui_tomoves('history');
        $('#move, #go').hide();
        $('#replay').show();
    } else {
        ssy_ui_fillmove(curs.player, ssy_var.state.pos[curs.player]);
    }
    ssy_ui_redraw();
}

ssy_move = function() {
    // ENFORCE ROLE TURNS
    const currentPlayerIdAssigned = ssy_var.p2p.roleMap[ssy_var.state.cur.player];
    if (currentPlayerIdAssigned !== ssy_var.p2p.myId) {
        console.warn('Network Gate: Not your turn!');
        return;
    }

    var player = ssy_var.state.cur.player;
    var round = ssy_var.state.cur.round;
    var move = $('#move').val();
    if(move == '') return false;

    if($('#move-x').hasClass('sel')) {
        $('#move-x').removeClass('sel');
        move = 'X' + move.substring(1);
    }

    ssy_var.state.pos[player] = parseInt(move.substring(1));
    ssy_var.state.history[round][player] = move;
    ssy_ui_tomoves(ssy_int_move_display(player, round, ssy_int_x_shown(round)));

    if(move.charAt(0) != '.') ssy_var.state.moves[player][move.charAt(0)]--;

    if($('#move-2').hasClass('sel')) {
        $('#move-2').removeClass('sel');
        ssy_var.state.last2 = ssy_var.state.cur.round;
        ssy_var.state.moves[player]['2']--;
        ssy_var.state.history[ssy_var.state.cur.round] = ssy_var.state.history[ssy_var.state.cur.round].concat(ssy_var.state.history[ssy_var.state.cur.round - 1].slice(1).map((item) => { return '.' + item.substring(1); }));
        ssy_var.state.cur.player = ssy_cfg.players.length - 1;
    }

    ssy_step();
    ssy_p2p_broadcast_state(); // Send mutation to Host (or broadcast if Host)
}

ssy_ui_redraw = function(all = false) {
    if(ssy_var.state.pos) {
        var curs = ssy_var.state.cur;
        var x_shown = ssy_int_x_shown(curs.round - (curs.player == 0 ? 1 : 0));

        for(var i = 0; i < ssy_cfg.players.length; i++) {
            var npos = ssy_var.config.nodepos[ssy_var.state.pos[i]];
            $('#p' + i).css({
                'top': ((npos[1] - ssy_cfg.board.pieces.center_y) * 1) + 'px',
                'left': ((npos[0] - ssy_cfg.board.pieces.center_x) * 1) + 'px',
            });
            $('#lbl' + i).html(ssy_int_move_display(i, curs.round, x_shown).substring(1));
        }
        if(curs.what == 'play') {
            $('#row' + curs.player).addClass('cur').siblings().removeClass('cur');
            $('#p' + curs.player).addClass('cur').siblings().removeClass('cur');
        } else {
            $('.player, .roster-row').removeClass('cur');
        }
        $('#p0').toggle(x_shown);
    }

    if(all) {
        $('#map').css({
            'background-image': 'url(' + ssy_cfg.board.map.file + ')',
            'width': ssy_cfg.board.map.width + 'px',
            'height': ssy_cfg.board.map.height + 'px',
        });
        $('.player').css({'width': ssy_cfg.board.pieces.width + 'px'});
    }

    // Role Enforcement Disabling
    if (ssy_var.state && ssy_var.state.cur) {
        const expectedPeerId = ssy_var.p2p.roleMap[ssy_var.state.cur.player];
        if (expectedPeerId !== ssy_var.p2p.myId) {
            $('#move, #move-x, #move-2, #go').prop('disabled', true).css('opacity', 0.5);
        } else {
            $('#move, #move-x, #move-2, #go').prop('disabled', false).css('opacity', 1);
        }
    }
}

ssy_ui_fillmove = function(player, pos) {
    var moves = ssy_var.state.moves[player];
    var possible = ssy_int_possible_moves(player, pos);
    var mvout = '', out = '<h4>Round: ' + ssy_var.state.cur.round + '</h4>';
    
    if(possible.length == 0) possible.push('.' + pos);
    for(var item in moves) mvout += item + ': ' + moves[item] + '; ';

    $('#move-x, #move-2').hide();
    $('#move-controls').show();
    $('#mr-x-waiting').hide();

    if(player == 0) {
        $('#move-x').toggle(ssy_var.state.moves[0]['X'] > 0);
        $('#move-2').toggle((ssy_var.state.moves[0]['2'] > 0) && (ssy_var.state.last2 + 2 < ssy_var.state.cur.round));
        
        // Hide Mr X dropdown for non-Mr X players
        if (ssy_var.p2p.roleMap[0] !== ssy_var.p2p.myId) {
            $('#move-controls').hide();
            $('#mr-x-waiting').show();
        }
    }

    out += mvout;
    $('#moveinfo').html(out);

    out = '<option value="">---</option>';
    for(const[i, item] of possible.entries()) {
        out += '<option value="' + item + '">' + (player == 0 ? String.fromCharCode(65 + i ) : item.substring(1) + ' (' + item.charAt(0) + ')') + '</option>';
    }
    $('#move').html(out);
}

// Map Panning and Zooming
function initPanZoom() {
    let scale = 1, panX = 0, panY = 0, isDragging = false, startX, startY;
    const $map = $('#map');
    
    $map.on('wheel', function(e) {
        e.preventDefault();
        const delta = e.originalEvent.deltaY > 0 ? -0.1 : 0.1;
        scale = Math.max(0.3, Math.min(3, scale + delta));
        $map.css('transform', `translate(${panX}px, ${panY}px) scale(${scale})`);
    });

    $map.on('mousedown touchstart', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
        isDragging = true;
        const touch = e.type === 'touchstart' ? e.originalEvent.touches[0] : e;
        startX = touch.clientX - panX;
        startY = touch.clientY - panY;
    });

    $(window).on('mousemove touchmove', function(e) {
        if (!isDragging) return;
        const touch = e.type === 'touchmove' ? e.originalEvent.touches[0] : e;
        panX = touch.clientX - startX;
        panY = touch.clientY - startY;
        $map.css('transform', `translate(${panX}px, ${panY}px) scale(${scale})`);
    });

    $(window).on('mouseup touchend', function() { isDragging = false; });
}

// --- P2P Multi-client Architecture ---
ssy_p2p_init = function() {
    ssy_var.p2p.peer = new Peer();
    
    $('#my-username-display').text(ssy_var.p2p.myName);

    ssy_var.p2p.peer.on('open', (id) => {
        console.log('My ID:', id);
        ssy_var.p2p.myId = id;
        ssy_var.p2p.players[id] = ssy_var.p2p.myName;
        
        // As host initially, assign all roles to self
        for (let i = 0; i < 6; i++) ssy_var.p2p.roleMap[i] = id;
        
        $('#my-id').text(id);
        $('#p2p-status').addClass('connected');
        renderPlayerRoster();
    });

    // HOST receives connections
    ssy_var.p2p.peer.on('connection', (conn) => {
        if (!ssy_var.p2p.isHost) { conn.close(); return; } // Only host accepts conns
        if (ssy_var.p2p.conns.length >= 5) {
            console.warn("Room full");
            conn.send({ type: 'ERROR', msg: 'Room is full (Max 6 players)' });
            setTimeout(() => conn.close(), 1000);
            return;
        }

        console.log('Peer joined:', conn.peer);
        ssy_var.p2p.conns.push(conn);
        
        conn.on('open', () => {
            // Ask client for their name
            conn.send({ type: 'REQ_INFO' });
            // Send them current game state immediately
            conn.send({ type: 'STATE_SYNC', state: ssy_var.state, roleMap: ssy_var.p2p.roleMap, players: ssy_var.p2p.players });
        });

        conn.on('data', (payload) => handle_incoming_data(payload, conn.peer));
        
        conn.on('close', () => {
            ssy_var.p2p.conns = ssy_var.p2p.conns.filter(c => c.peer !== conn.peer);
            delete ssy_var.p2p.players[conn.peer];
            renderPlayerRoster();
        });
    });

    // UI Listeners
    $('#p2p-connect-btn').on('click', () => {
        const remoteId = $('#peer-id-input').val();
        if (remoteId) {
            ssy_var.p2p.isHost = false; // Transition to Client mode
            $('#newgame').hide(); // Clients can't start games
            
            const conn = ssy_var.p2p.peer.connect(remoteId);
            ssy_var.p2p.hostConn = conn;
            
            conn.on('open', () => {
                $('#p2p-overlay').addClass('hidden');
                alert("Connected to Host!");
            });
            
            conn.on('data', (payload) => handle_incoming_data(payload, conn.peer));
            conn.on('close', () => alert("Disconnected from Host"));
        }
    });

    $('#my-username-display').on('click', function() {
        const newName = prompt("Enter new username:", ssy_var.p2p.myName);
        if (newName && newName.trim() !== '') {
            ssy_var.p2p.myName = newName.trim();
            $(this).text(ssy_var.p2p.myName);
            ssy_var.p2p.players[ssy_var.p2p.myId] = ssy_var.p2p.myName;
            renderPlayerRoster();
            
            if (ssy_var.p2p.isHost) {
                ssy_p2p_broadcast_roster();
            } else if (ssy_var.p2p.hostConn) {
                ssy_var.p2p.hostConn.send({ type: 'UPDATE_NAME', id: ssy_var.p2p.myId, name: ssy_var.p2p.myName });
            }
        }
    });

    $('#p2p-toggle-ui').on('click', () => $('#p2p-overlay').removeClass('hidden'));
    $('#p2p-close-btn').on('click', () => $('#p2p-overlay').addClass('hidden'));
    $('#toggle-panel').on('click', function() {
        $('#play').toggleClass('minimized');
        $(this).text($('#play').hasClass('minimized') ? 'Show' : 'Hide');
    });
}

function handle_incoming_data(payload, senderId) {
    if (payload.type === 'REQ_INFO' && !ssy_var.p2p.isHost) {
        ssy_var.p2p.hostConn.send({ type: 'UPDATE_NAME', id: ssy_var.p2p.myId, name: ssy_var.p2p.myName });
    } 
    else if (payload.type === 'UPDATE_NAME' && ssy_var.p2p.isHost) {
        ssy_var.p2p.players[payload.id] = payload.name;
        renderPlayerRoster();
        ssy_p2p_broadcast_roster();
    }
    else if (payload.type === 'ROSTER_SYNC') {
        ssy_var.p2p.roleMap = payload.roleMap;
        ssy_var.p2p.players = payload.players;
        renderPlayerRoster();
        ssy_ui_redraw(); // Update disabled buttons
    }
    else if (payload.type === 'STATE_SYNC') {
        ssy_var.state = payload.state;
        if (payload.roleMap) ssy_var.p2p.roleMap = payload.roleMap;
        if (payload.players) ssy_var.p2p.players = payload.players;
        renderPlayerRoster();
        ssy_ui_redraw(true);
        if(ssy_var.state.cur) ssy_ui_fillmove(ssy_var.state.cur.player, ssy_var.state.pos[ssy_var.state.cur.player]);
        
        // If Host receives a move from a client, echo it to other clients
        if (ssy_var.p2p.isHost) ssy_p2p_broadcast_state(); 
    }
}

ssy_p2p_broadcast_state = function() {
    const payload = { type: 'STATE_SYNC', state: ssy_var.state };
    if (ssy_var.p2p.isHost) {
        ssy_var.p2p.conns.forEach(c => c.send(payload));
    } else if (ssy_var.p2p.hostConn) {
        ssy_var.p2p.hostConn.send(payload); // Client updates host
    }
}

ssy_p2p_broadcast_roster = function() {
    if (ssy_var.p2p.isHost) {
        ssy_var.p2p.conns.forEach(c => c.send({ 
            type: 'ROSTER_SYNC', roleMap: ssy_var.p2p.roleMap, players: ssy_var.p2p.players 
        }));
    }
}

function renderPlayerRoster() {
    let html = '';
    const roles = ['Mr. X', 'Detective 1', 'Detective 2', 'Detective 3', 'Detective 4', 'Detective 5'];
    
    for (let i = 0; i < 6; i++) {
        let assignedId = ssy_var.p2p.roleMap[i];
        let assignedName = ssy_var.p2p.players[assignedId] || 'Unassigned';
        
        html += `<div class="roster-row" id="row${i}">
            <span>
                <svg viewBox="${ssy_cfg.board.pieces.icons[i].split('|')[0]}"><use href="#i-p${i}"/></svg>
                ${roles[i]}
            </span>`;
            
        // Host gets dropdowns to assign roles, clients just see the text
        if (ssy_var.p2p.isHost) {
            html += `<select onchange="updateRole(${i}, this.value)">`;
            Object.keys(ssy_var.p2p.players).forEach(pId => {
                const selected = pId === assignedId ? 'selected' : '';
                html += `<option value="${pId}" ${selected}>${ssy_var.p2p.players[pId]}</option>`;
            });
            html += `</select>`;
        } else {
            html += `<span>${assignedName}</span>`;
        }
        
        html += `<b id="lbl${i}" style="margin-left:10px;">--</b></div>`;
    }
    $('#playerpos').html(html);
    if(ssy_var.state && ssy_var.state.pos) ssy_ui_redraw(); // Re-apply current turn highlight
}

// Global hook for dropdowns
window.updateRole = function(roleIndex, newPeerId) {
    ssy_var.p2p.roleMap[roleIndex] = newPeerId;
    ssy_p2p_broadcast_roster();
    ssy_ui_redraw(); // Update disable/enable buttons immediately
}

// Helpers
ssy_ui_tomoves = function(val) {
    if(val == 'line') $('#movetbl').prepend('<ul></ul>');
    else if(val == 'history') {
        var mcnt = '';
        for(var h_round = ssy_var.state.history.length - 1; h_round >= 0; h_round--) {
            mcnt += '<ul>';
            for(var h_player = 0; h_player < ssy_var.state.history[h_round].length; h_player++) {
                mcnt += ssy_ui_fmtmove(ssy_int_move_display(h_player, h_round, ssy_int_x_shown(h_round)));
            }
            mcnt += '</ul>';
        }
        $('#movetbl').html(mcnt);
    } else $('#movetbl ul:first').append(ssy_ui_fmtmove(val));
}
ssy_ui_fmtmove = function(mmov, tag = 'li') { return '<' + tag + ' class="m_' + mmov[0] + '">' + mmov + '</' + tag + '>'; }
ssy_int_possible_moves = function(player, pos) {
    var moves = ssy_var.state.moves[player];
    var occupied = [...ssy_var.state.pos].slice(1);
    return ssy_var.config.nodemov[pos].filter((x) => ((moves[x.charAt(0)] || 0) != 0) && (!occupied.includes(parseInt(x.substring(1)))));
}
ssy_int_array_shuffle = function(array) {
    for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; }
}
ssy_int_x_shown = function(round) { return ssy_cfg.rules.checkmoves.includes(round) || ssy_var.state.cur.what != 'play'; }
ssy_int_move_display = function(player, round, x_shown) {
    var lpos = ssy_var.state.history[round][player] || ssy_var.state.history[round - 1][player];
    return (player != 0 || x_shown) ? lpos : (ssy_cfg.rules.showhow ? lpos.charAt(0) : '') + '--';
}

$().ready(function() { ssy_init(); });
$('#intro').on('click', function(e) { if(e.target.tagName != 'A') { e.preventDefault(); $('#intro').hide(); }});
$('#newgame').on('click', function(e) { e.preventDefault(); ssy_start(); });
$('#move-x, #move-2').on('click', function(e) { e.preventDefault(); $(this).toggleClass('sel'); });
$('#go').on('click', function(e) { e.preventDefault(); ssy_move(); });
// *** ui handlers }}}
