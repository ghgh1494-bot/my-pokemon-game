let ws;
let currentNickname = '';
let currentUserData = null;
let selectedBallType = 'poke';
let inBattleState = false;

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;

const ballImages = {
    poke: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
    super: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png',
    hyper: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png'
};

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
            if (data.msg) setMessage(data.msg);
        }

        if (data.type === 'WILD_SPAWN') {
            currentUserData = data.user;
            inBattleState = true;
            updateUI(data.user);
            
            const enemyCard = document.getElementById('enemy-hp-card');
            const enemyContainer = document.getElementById('enemy-sprite-container');
            const enemyImg = document.getElementById('enemy-pokemon-img');

            enemyCard.classList.remove('invisible');
            enemyContainer.classList.remove('invisible');
            enemyImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${data.wild.id}.png`;

            // ✨ 이로치 시 시각적 후광 연출 부착
            if (data.wild.isShiny) {
                enemyImg.classList.add('shiny-glow');
            } else {
                enemyImg.classList.remove('shiny-glow');
            }

            document.getElementById('pokemon-name').innerText = `${data.wild.isShiny ? '✨ ' : ''}${data.wild.name}`;
            document.getElementById('pokemon-level').innerText = `Lv.${data.wild.level}`;
            updateWildHpUI(data.wild.hp, data.wild.maxHp);
            
            toggleBattleButtons(true);
            if (data.msg) setMessage(data.msg);
        }

        if (data.type === 'WILD_HP_UPDATE') {
            updateWildHpUI(data.wildHp, data.wildMaxHp);
            if (data.partnerHp !== undefined) {
                updatePartnerHpUI(data.partnerHp, data.partnerMaxHp);
            }

            if (data.attacker === 'partner') {
                const partnerSprite = document.getElementById('partner-sprite-container');
                const enemySprite = document.getElementById('enemy-pokemon-img');
                
                partnerSprite.classList.add('anim-partner-atk');
                setTimeout(() => partnerSprite.classList.remove('anim-partner-atk'), 200);

                enemySprite.classList.add('damage-flash');
                setTimeout(() => enemySprite.classList.remove('damage-flash'), 250);
            } else if (data.attacker === 'enemy') {
                const enemySprite = document.getElementById('enemy-sprite-container');
                const partnerSprite = document.getElementById('partner-pokemon-img');

                enemySprite.classList.add('anim-enemy-atk');
                setTimeout(() => enemySprite.classList.remove('anim-enemy-atk'), 200);

                partnerSprite.classList.add('damage-flash');
                setTimeout(() => partnerSprite.classList.remove('damage-flash'), 250);
            }

            if (data.msg) setMessage(data.msg);
        }

        if (data.type === 'BATTLE_END') {
            inBattleState = false;
            currentUserData = data.user;
            toggleBattleButtons(false);
            updateUI(data.user);
            if (data.msg) setMessage(data.msg);
        }

        if (data.type === 'CATCH_SUCCESS') {
            playPokeballAnim(true, () => {
                inBattleState = false;
                currentUserData = data.user;
                toggleBattleButtons(false);
                updateUI(data.user);
                if (data.msg) setMessage(data.msg);
            });
        }

        if (data.type === 'CATCH_FAIL') {
            playPokeballAnim(false, () => {
                if (data.msg) setMessage(data.msg);
            });
        }

        if (data.type === 'ZONE_INFO') {
            renderZoneList(data.zones, data.unlockedZones, data.currentZone);
        }

        if (data.type === 'POKEDEX_INFO') {
            renderPokedexGrid(data.caughtList);
        }

        if (data.type === 'SIDEBAR_LIST') {
            renderTrainerList(data.users);
        }

        if (data.type === 'LOG') {
            setMessage(data.msg);
        }
    };
}

function playPokeballAnim(isSuccess, callback) {
    const ballContainer = document.getElementById('thrown-pokeball');
    const ballSprite = document.getElementById('ball-sprite');
    const enemyImg = document.getElementById('enemy-pokemon-img');

    // 1. 초기화 및 볼 아이콘 설정
    ballSprite.src = ballImages[selectedBallType] || ballImages.poke;
    ballContainer.className = "absolute left-6 bottom-2 w-10 h-10 z-30"; // 내 포켓몬 위치에서 시작
    ballContainer.style.transform = "none";
    ballContainer.classList.remove('hidden');

    // Step 1: 상대 포켓몬 방향으로 볼 투척 (0.6초)
    ballContainer.classList.add('animate-throw-target');

    setTimeout(() => {
        // Step 2: 포켓몬 타격 및 볼 안으로 흡수 연출 (0.3초)
        ballContainer.classList.remove('animate-throw-target');
        enemyImg.classList.add('animate-absorb');

        setTimeout(() => {
            // Step 3: 볼 바닥 착지 (0.4초)
            ballContainer.classList.add('animate-drop');

            setTimeout(() => {
                // Step 4: 원작 스타일 4회 흔들림 (0.5초 x 4회 = 2.0초)
                ballContainer.classList.remove('animate-drop');
                ballContainer.classList.add('animate-shake-4times');

                setTimeout(() => {
                    // Step 5: 포획 결과 처리
                    ballContainer.classList.remove('animate-shake-4times');
                    ballContainer.classList.add('hidden');
                    enemyImg.classList.remove('animate-absorb');

                    if (!isSuccess) {
                        // 포획 실패 시 상대 포켓몬 재출현
                        enemyImg.style.opacity = "1";
                        enemyImg.style.transform = "scale(1)";
                    }

                    if (callback) callback();
                }, 2000); // 4회 흔들림 시간
            }, 400);
        }, 300);
    }, 600);
}

function updateUI(user) {
    document.getElementById('player-gold').innerText = `${user.gold.toLocaleString()} G`;
    document.getElementById('zone-display').innerText = user.currentZoneName || '연두마을';
    document.getElementById('location-display').innerText = user.location;
    document.getElementById('caught-count').innerText = user.caughtList ? user.caughtList.length : 0;

    const p = user.partner;
    document.getElementById('partner-name').innerText = p.name;
    document.getElementById('partner-level').innerText = `Lv.${p.level}`;
    
    document.getElementById('btn-skill-name').innerText = p.skillName || '스킬';
    document.getElementById('btn-skill-pp').innerText = `(${p.pp}/${p.maxPp})`;

    updatePartnerHpUI(p.hp, p.stats.maxHp);

    document.getElementById('status-card-img').src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`;
    document.getElementById('status-card-name').innerText = p.name;
    const expPct = Math.floor((p.exp / p.maxExp) * 100);
    document.getElementById('status-card-level').innerText = `Lv.${p.level} (EXP ${expPct}%)`;

    document.getElementById('stat-hp').innerText = `${p.hp} / ${p.stats.maxHp}`;
    document.getElementById('stat-atk').innerText = p.stats.atk;
    document.getElementById('stat-def').innerText = p.stats.def;
    document.getElementById('stat-spatk').innerText = p.stats.spAtk;
    document.getElementById('stat-spdef').innerText = p.stats.spDef;
    document.getElementById('stat-spd').innerText = p.stats.spd;
    document.getElementById('stat-affinity').innerText = `${Math.floor(p.affinity)}%`;
    document.getElementById('stat-pp').innerText = `${p.pp} / ${p.maxPp}`;

    document.getElementById('partner-pokemon-img').src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`;

    document.getElementById('count-poke').innerText = user.balls.poke || 0;
    document.getElementById('count-super').innerText = user.balls.super || 0;
    document.getElementById('count-hyper').innerText = user.balls.hyper || 0;

    // 🔥 서버에서 activeWild가 없거나 location이 마을이면 전투 상태 강제 해제 및 UI 완전 리셋
    if (!user.activeWild || user.location === '마을') {
        inBattleState = false;
        document.getElementById('enemy-hp-card').classList.add('invisible');
        document.getElementById('enemy-sprite-container').classList.add('invisible');
        toggleBattleButtons(false);
    }
}

function updateWildHpUI(hp, maxHp) {
    document.getElementById('hp-text').innerText = `${hp} / ${maxHp}`;
    const pct = Math.max(0, (hp / maxHp) * 100);
    const hpBar = document.getElementById('hp-bar');
    hpBar.style.width = `${pct}%`;

    if (pct > 50) hpBar.className = "bg-emerald-500 h-full transition-all duration-300";
    else if (pct > 20) hpBar.className = "bg-amber-500 h-full transition-all duration-300";
    else hpBar.className = "bg-red-500 h-full transition-all duration-300";
}

function updatePartnerHpUI(hp, maxHp) {
    document.getElementById('partner-hp-text').innerText = `${hp} / ${maxHp}`;
    const pct = Math.max(0, (hp / maxHp) * 100);
    document.getElementById('partner-hp-bar').style.width = `${pct}%`;
}

function toggleBattleButtons(inBattle) {
    const btnExplore = document.getElementById('btn-explore');
    const battleBtns = ['btn-attack', 'btn-skill', 'btn-defend', 'btn-catch', 'btn-run'];

    if (inBattle) {
        btnExplore.classList.add('btn-disabled');
        btnExplore.disabled = true;
        battleBtns.forEach(id => {
            const b = document.getElementById(id);
            b.classList.remove('btn-disabled');
            b.disabled = false;
        });
    } else {
        btnExplore.classList.remove('btn-disabled');
        btnExplore.disabled = false;
        battleBtns.forEach(id => {
            const b = document.getElementById(id);
            b.classList.add('btn-disabled');
            b.disabled = true;
        });
    }
}

function selectBall(type) {
    selectedBallType = type;
    ['poke', 'super', 'hyper'].forEach(b => {
        const btn = document.getElementById(`ball-select-${b}`);
        if (b === type) {
            btn.className = "px-3 py-1.5 rounded-lg border border-red-500 bg-red-500/20 text-xs font-bold flex items-center gap-1.5 ring-2 ring-red-500";
        } else {
            btn.className = "px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold flex items-center gap-1.5";
        }
    });
}

function setMessage(msg) {
    const msgEl = document.getElementById('game-message');
    msgEl.innerText = msg;
    msgEl.parentElement.scrollTop = msgEl.parentElement.scrollHeight;
}

function renderZoneList(zones, unlockedZones, currentZone) {
    const list = document.getElementById('zone-list');
    list.innerHTML = '';
    zones.forEach(z => {
        const isUnlocked = unlockedZones.includes(z.id);
        const isCurrent = currentZone === z.id;
        const div = document.createElement('div');
        div.className = `p-3 rounded-xl border flex justify-between items-center ${isUnlocked ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-50'}`;
        div.innerHTML = `
            <div>
                <div class="text-sm font-bold text-slate-200">${z.name} ${isCurrent ? '📌' : ''}</div>
                <div class="text-xs text-slate-400">Lv.${z.minLevel}~${z.maxLevel} | 보스: ${z.bossName}</div>
            </div>
            <button onclick="changeZone(${z.id})" ${(!isUnlocked || isCurrent) ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg text-xs font-bold ${isUnlocked && !isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}">
                ${!isUnlocked ? '🔒' : (isCurrent ? '현재' : '이동')}
            </button>
        `;
        list.appendChild(div);
    });
}

function changeZone(zoneId) {
    if (inBattleState) {
        alert('전투 중에는 지역을 이동할 수 없습니다! 도망치기를 먼저 이용해주세요.');
        return;
    }
    ws.send(JSON.stringify({ type: 'CHANGE_ZONE', zoneId: zoneId }));
    closeModal('zone-modal');
}

function renderPokedexGrid(caughtList) {
    const grid = document.getElementById('pokedex-grid');
    document.getElementById('modal-total-count').innerText = caughtList ? caughtList.length : 0;

    if (!caughtList || caughtList.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center p-8 text-slate-500">
                <i class="fa-solid fa-box-open text-4xl mb-3 opacity-50"></i>
                <p class="text-sm">포획한 야생 포켓몬이 없습니다.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = caughtList.map(p => `
        <div class="bg-slate-800/80 border ${p.isShiny ? 'border-amber-400/80' : 'border-slate-700/80'} rounded-xl p-3 flex flex-col items-center shadow-md relative overflow-hidden">
            ${p.isShiny ? '<span class="absolute top-1 right-1 px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-slate-950 rounded-md shadow">✨이로치</span>' : ''}
            <div class="w-20 h-20 bg-slate-900/60 rounded-lg p-2 flex items-center justify-center mb-2">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png" class="max-w-full max-h-full object-contain filter drop-shadow ${p.isShiny ? 'shiny-glow' : ''}">
            </div>
            <span class="text-xs text-slate-400 font-mono">No.${String(p.id).padStart(3, '0')}</span>
            <h3 class="font-game text-sm text-amber-300 mt-0.5">${p.isShiny ? '✨' : ''}${p.name}</h3>
            <span class="text-[10px] text-slate-400 mt-1">Lv.${p.level}</span>
        </div>
    `).join('');
}

function renderTrainerList(users) {
    const list = document.getElementById('trainer-list');
    list.innerHTML = users.map(u => `
        <li class="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
            <div class="flex flex-col">
                <span class="font-bold text-slate-200 text-xs">${u.nickname}</span>
                <span class="text-[10px] text-slate-400">${u.partnerName} (Lv.${u.partnerLevel})</span>
            </div>
            <div class="text-right">
                <div class="text-[11px] font-bold text-amber-400">⚡ CP ${u.cp.toLocaleString()}</div>
                <div class="text-[9px] text-emerald-400">${u.zoneName}</div>
            </div>
        </li>
    `).join('');
}

function openPokedexModal() {
    ws.send(JSON.stringify({ type: 'REQ_POKEDEX_INFO' }));
    document.getElementById('pokedex-modal').classList.remove('hidden');
}

function closePokedexModal() {
    document.getElementById('pokedex-modal').classList.add('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// 전투 버튼 핸들러
document.getElementById('btn-explore').addEventListener('click', () => ws.send(JSON.stringify({ type: 'EXPLORE_FIELD' })));
document.getElementById('btn-attack').addEventListener('click', () => ws.send(JSON.stringify({ type: 'BATTLE_ACTION', action: 'ATTACK' })));
document.getElementById('btn-skill').addEventListener('click', () => ws.send(JSON.stringify({ type: 'BATTLE_ACTION', action: 'SKILL' })));
document.getElementById('btn-defend').addEventListener('click', () => ws.send(JSON.stringify({ type: 'BATTLE_ACTION', action: 'DEFEND' })));
document.getElementById('btn-catch').addEventListener('click', () => ws.send(JSON.stringify({ type: 'CATCH_ATTEMPT', ballType: selectedBallType })));
document.getElementById('btn-run').addEventListener('click', () => ws.send(JSON.stringify({ type: 'BATTLE_ACTION', action: 'RUN' })));

// 시설 모달 버튼
document.getElementById('btn-boss').addEventListener('click', () => {
    if (inBattleState) {
        alert('전투 중에는 보스 도전을 새로 시작할 수 없습니다!');
        return;
    }
    ws.send(JSON.stringify({ type: 'CHALLENGE_BOSS' }));
});

document.getElementById('btn-open-train').addEventListener('click', () => {
    if (inBattleState) {
        alert('전투 중에는 훈련소를 이용할 수 없습니다!');
        return;
    }
    if (!currentUserData) return;
    const cost = Math.floor(1000 * Math.pow(currentUserData.partner.level, 1.2));
    document.getElementById('train-cost-val').innerText = cost.toLocaleString();
    document.getElementById('train-user-gold').innerText = currentUserData.gold.toLocaleString();
    document.getElementById('train-modal').classList.remove('hidden');
});

document.getElementById('btn-open-heal').addEventListener('click', () => {
    if (inBattleState) {
        alert('전투 중에는 포켓몬 센터를 이용할 수 없습니다! (도망치거나 전투 종료 후 이용하세요)');
        return;
    }
    if (!currentUserData) return;
    const p = currentUserData.partner;
    const healCost = (p.stats.maxHp - p.hp) * 10 + (p.maxPp - p.pp) * 20;
    document.getElementById('heal-current-hp').innerText = `${p.hp} / ${p.stats.maxHp}`;
    document.getElementById('heal-cost-val').innerText = healCost.toLocaleString();
    document.getElementById('heal-modal').classList.remove('hidden');
});

document.getElementById('btn-open-evolve').addEventListener('click', () => {
    if (inBattleState) {
        alert('전투 중에는 진화를 시도할 수 없습니다!');
        return;
    }
    if (!currentUserData) return;
    const p = currentUserData.partner;
    const evoInfo = {
        1: { reqLv: 16, stone: '없음 (레벨 달성 시)' },
        2: { reqLv: 32, stone: '리프의 돌' },
        4: { reqLv: 16, stone: '없음 (레벨 달성 시)' },
        5: { reqLv: 36, stone: '불꽃의 돌' },
        7: { reqLv: 16, stone: '없음 (레벨 달성 시)' },
        8: { reqLv: 36, stone: '물의 돌' },
        25: { reqLv: 20, stone: '천둥의 돌' }
    }[p.id] || { reqLv: 99, stone: '최종 진화 완료' };

    document.getElementById('evolve-req-level').innerText = `Lv.${evoInfo.reqLv}`;
    document.getElementById('evolve-stone-name').innerText = evoInfo.stone;
    document.getElementById('evolve-modal').classList.remove('hidden');
});
document.getElementById('btn-confirm-train').addEventListener('click', () => { ws.send(JSON.stringify({ type: 'TRAIN' })); closeModal('train-modal'); });
document.getElementById('btn-confirm-heal').addEventListener('click', () => { ws.send(JSON.stringify({ type: 'HEAL' })); closeModal('heal-modal'); });
document.getElementById('btn-confirm-evolve').addEventListener('click', () => { ws.send(JSON.stringify({ type: 'EVOLVE' })); closeModal('evolve-modal'); });
