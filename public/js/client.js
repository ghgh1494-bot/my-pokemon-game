let ws;
let currentNickname = '';
let currentUserData = null;

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;

document.getElementById('btn-login').addEventListener('click', () => {
    const input = document.getElementById('nickname-input').value.trim();
    if (!input) return alert('닉네임을 입력하세요!');
    
    const selectedStarter = document.querySelector('input[name="starter"]:checked').value;
    currentNickname = input;
    initWebSocket(parseInt(selectedStarter));
});

function initWebSocket(starterId) {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        document.getElementById('login-modal').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        
        ws.send(JSON.stringify({ 
            type: 'INIT', 
            nickname: currentNickname, 
            starterId: starterId 
        }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'STATE_UPDATE') {
            currentUserData = data.user;
            updateUI(data.user);
            if (data.msg) addLog(data.msg);
        }

        if (data.type === 'WILD_SPAWN') {
            currentUserData = data.user;
            updateUI(data.user);
            document.getElementById('wild-card').classList.remove('hidden');
            const titlePrefix = data.isBoss ? '⚠️ [보스전] ' : '';
            document.getElementById('wild-title').innerText = `${titlePrefix}${data.wild.isShiny ? '✨' : ''}${data.wild.name} (Lv.${data.wild.level})`;
            updateWildHp(data.wild.hp, data.wild.maxHp);
            if (data.msg) addLog(data.msg);
        }

        if (data.type === 'WILD_HP_UPDATE') {
            updateWildHp(data.wildHp, data.wildMaxHp);
            if (data.partnerHp !== undefined) {
                document.getElementById('partner-hp-text').innerText = `${data.partnerHp}/${data.partnerMaxHp}`;
                const percent = (data.partnerHp / data.partnerMaxHp) * 100;
                document.getElementById('hp-bar').style.width = `${percent}%`;
            }
            if (data.msg) addLog(data.msg);
        }

        if (data.type === 'BATTLE_END' || data.type === 'CATCH_SUCCESS') {
            document.getElementById('wild-card').classList.add('hidden');
            currentUserData = data.user;
            updateUI(data.user);
            if (data.msg) addLog(data.msg);
        }

        if (data.type === 'CATCH_FAIL') {
            if (data.msg) addLog(data.msg);
        }

        if (data.type === 'ZONE_INFO') {
            renderZoneList(data.zones, data.unlockedZones, data.currentZone);
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
    document.getElementById('zone-display').innerText = `지역: ${user.currentZoneName || '연두마을'}`;
    document.getElementById('location-display').innerText = `위치: ${user.location}`;

    const p = user.partner;
    document.getElementById('partner-name').innerText = `${p.isShiny ? '✨' : ''}${p.name}`;
    document.getElementById('partner-level').innerText = `Lv. ${p.level}`;
    document.getElementById('partner-hp-text').innerText = `${p.hp}/${p.stats.maxHp}`;
    document.getElementById('partner-exp-text').innerText = `${p.exp}/${p.maxExp}`;
    
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
    document.getElementById('wild-hp-text').innerText = `${hp}/${maxHp}`;
    const percent = Math.max(0, (hp / maxHp) * 100);
    document.getElementById('wild-hp-bar').style.width = `${percent}%`;
}

function renderZoneList(zones, unlockedZones, currentZone) {
    const container = document.getElementById('zone-list');
    container.innerHTML = '';

    zones.forEach(z => {
        const isUnlocked = unlockedZones.includes(z.id);
        const isCurrent = currentZone === z.id;

        const div = document.createElement('div');
        div.className = `zone-item ${!isUnlocked ? 'locked' : ''}`;
        
        div.innerHTML = `
            <div>
                <div class="zone-name">${z.name} ${isCurrent ? '📌(현재)' : ''}</div>
                <div class="zone-sub">추천 레벨: Lv.${z.minLevel}~${z.maxLevel} | 보스: ${z.bossName}</div>
            </div>
            <button class="btn-zone-select" ${(!isUnlocked || isCurrent) ? 'disabled' : ''} onclick="changeZone(${z.id})">
                ${!isUnlocked ? '🔒 잠김' : (isCurrent ? '이동됨' : '이동')}
            </button>
        `;
        container.appendChild(div);
    });
}

function changeZone(zoneId) {
    ws.send(JSON.stringify({ type: 'CHANGE_ZONE', zoneId: zoneId }));
    closeModal('zone-modal');
}

function renderTrainerList(users) {
    const list = document.getElementById('trainer-list');
    list.innerHTML = '';
    users.forEach(u => {
        const li = document.createElement('li');
        li.innerText = `${u.nickname} (${u.zoneName}) - CP:${u.power}`;
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

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// 모달 및 버튼 바인딩
document.getElementById('btn-open-zone').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'REQ_ZONE_INFO' }));
    document.getElementById('zone-modal').classList.remove('hidden');
});

document.getElementById('btn-boss').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'CHALLENGE_BOSS' }));
});

document.getElementById('btn-explore').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'EXPLORE_FIELD' }));
});

document.getElementById('btn-attack').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'ATTACK_WILD' }));
});

document.getElementById('btn-catch').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'CATCH_ATTEMPT', ballType: 'poke' }));
});

document.getElementById('btn-open-train').addEventListener('click', () => {
    if (!currentUserData) return;
    const level = currentUserData.partner.level;
    const cost = Math.floor(1000 * Math.pow(level, 1.2));
    document.getElementById('train-cost-val').innerText = cost.toLocaleString();
    document.getElementById('train-user-gold').innerText = currentUserData.gold.toLocaleString();
    document.getElementById('train-modal').classList.remove('hidden');
});

document.getElementById('btn-open-heal').addEventListener('click', () => {
    if (!currentUserData) return;
    const p = currentUserData.partner;
    const healCost = (p.stats.maxHp - p.hp) * 10 + (p.fatigue * 5);
    document.getElementById('heal-current-hp').innerText = `${p.hp} / ${p.stats.maxHp}`;
    document.getElementById('heal-cost-val').innerText = healCost.toLocaleString();
    document.getElementById('heal-modal').classList.remove('hidden');
});

document.getElementById('btn-open-evolve').addEventListener('click', () => {
    document.getElementById('evolve-modal').classList.remove('hidden');
});

document.getElementById('btn-confirm-train').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'TRAIN' }));
    closeModal('train-modal');
});

document.getElementById('btn-confirm-heal').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'HEAL' }));
    closeModal('heal-modal');
});

document.getElementById('btn-confirm-evolve').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'EVOLVE' }));
    closeModal('evolve-modal');
});
