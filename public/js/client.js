let ws;
let currentNickname = '';

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;

document.getElementById('btn-login').addEventListener('click', () => {
    const input = document.getElementById('nickname-input').value.trim();
    if (!input) return alert('닉네임을 입력하세요!');
    currentNickname = input;
    
    initWebSocket();
});

function initWebSocket() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        document.getElementById('login-modal').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        ws.send(JSON.stringify({ type: 'INIT', nickname: currentNickname }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'STATE_UPDATE') {
            updateUI(data.user);
            if (data.msg) addLog(data.msg);
        }

        if (data.type === 'WILD_SPAWN') {
            updateUI(data.user);
            document.getElementById('wild-card').classList.remove('hidden');
            document.getElementById('wild-title').innerText = `${data.wild.isShiny ? '✨' : ''}${data.wild.name} (Lv.${data.wild.level})`;
            updateWildHp(data.wild.hp, data.wild.maxHp);
            if (data.msg) addLog(data.msg);
        }

        if (data.type === 'WILD_HP_UPDATE') {
            updateWildHp(data.wildHp, data.wildMaxHp);
            if (data.msg) addLog(data.msg);
        }

        if (data.type === 'CATCH_SUCCESS') {
            document.getElementById('wild-card').classList.add('hidden');
            updateUI(data.user);
            if (data.msg) addLog(data.msg);
        }

        if (data.type === 'CATCH_FAIL') {
            if (data.msg) addLog(data.msg);
        }

        if (data.type === 'SIDEBAR_LIST') {
            renderTrainerList(data.users);
        }

        if (data.type === 'LOG') {
            addLog(data.msg);
        }
    };

    ws.onclose = () => {
        addLog('서버와의 연결이 끊겼습니다.');
    };
}

function updateUI(user) {
    document.getElementById('gold-display').innerText = `골드: ${user.gold.toLocaleString()}G`;
    document.getElementById('location-display').innerText = `위치: ${user.location}`;

    const p = user.partner;
    document.getElementById('partner-name').innerText = `${p.isShiny ? '✨' : ''}${p.name}`;
    document.getElementById('partner-level').innerText = `Lv. ${p.level}`;
    
    const hpPercent = (p.hp / p.stats.maxHp) * 100;
    const expPercent = (p.exp / p.maxExp) * 100;
    
    document.getElementById('hp-bar').style.width = `${hpPercent}%`;
    document.getElementById('exp-bar').style.width = `${expPercent}%`;
    document.getElementById('fatigue-val').innerText = p.fatigue;
    document.getElementById('affinity-val').innerText = p.affinity.toFixed(1);

    if (user.location === '마을') {
        document.getElementById('wild-card').classList.add('hidden');
    }
}

function updateWildHp(hp, maxHp) {
    const percent = (hp / maxHp) * 100;
    document.getElementById('wild-hp-bar').style.width = `${percent}%`;
}

function renderTrainerList(users) {
    const list = document.getElementById('trainer-list');
    list.innerHTML = '';
    users.forEach(u => {
        const li = document.createElement('li');
        li.innerText = `${u.nickname} (${u.location}) - CP:${u.power}`;
        list.appendChild(li);
    });
}

function addLog(msg) {
    const logBox = document.getElementById('game-log');
    const p = document.createElement('p');
    p.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logBox.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
}

// 이벤트 리스너 등록
document.getElementById('btn-explore').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'EXPLORE_FIELD' }));
});

document.getElementById('btn-attack').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'ATTACK_WILD' }));
});

document.getElementById('btn-catch').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'CATCH_ATTEMPT', ballType: 'poke' }));
});

document.getElementById('btn-train').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'TRAIN' }));
});

document.getElementById('btn-heal').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'HEAL' }));
});

document.getElementById('btn-evolve').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'EVOLVE' }));
});