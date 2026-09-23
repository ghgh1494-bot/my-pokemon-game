const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 속성 상성표 (공격 타입 -> 방어 타입 비율)
const TYPE_CHART = {
    fire:    { grass: 1.5, water: 0.6, fire: 0.6, rock: 0.6 },
    water:   { fire: 1.5, grass: 0.6, water: 0.6, dragon: 0.6 },
    grass:   { water: 1.5, fire: 0.6, grass: 0.6, flying: 0.6, dragon: 0.6 },
    electric:{ water: 1.5, flying: 1.5, electric: 0.6, grass: 0.6, dragon: 0.6 },
    normal:  { rock: 0.6 },
    flying:  { grass: 1.5, electric: 0.6, rock: 0.6 },
    rock:    { fire: 1.5, flying: 1.5, grass: 0.6 },
    dragon:  { dragon: 1.5 },
    psychic: { poison: 1.5 }
};

function getTypeEffectiveness(atkType, defType) {
    if (TYPE_CHART[atkType] && TYPE_CHART[atkType][defType]) {
        return TYPE_CHART[atkType][defType];
    }
    return 1.0;
}

const POKEMON_DB = {
    // 스타팅 & 일반 포켓몬 (필드 풀)
    1:  { name: '이상해씨', type: 'grass', skillName: '🍃 덩굴채찍', maxPp: 15, reqLevel: 16, nextEvo: 2, reqStone: null, baseStats: { hp: 45, atk: 49, def: 49, spAtk: 65, spDef: 65, spd: 45 } },
    2:  { name: '이상해풀', type: 'grass', skillName: '🍃 잎날가르기', maxPp: 12, reqLevel: 32, nextEvo: 3, reqStone: '리프의 돌', baseStats: { hp: 60, atk: 62, def: 63, spAtk: 80, spDef: 80, spd: 60 } },
    3:  { name: '이상해꽃', type: 'grass', skillName: '🍃 솔라빔', maxPp: 8, reqLevel: 99, nextEvo: null, reqStone: null, baseStats: { hp: 80, atk: 82, def: 83, spAtk: 100, spDef: 100, spd: 80 } },
    4:  { name: '파이리',   type: 'fire',  skillName: '🔥 불꽃세례', maxPp: 15, reqLevel: 16, nextEvo: 5, reqStone: null, baseStats: { hp: 39, atk: 52, def: 43, spAtk: 60, spDef: 50, spd: 65 } },
    5:  { name: '리자드',   type: 'fire',  skillName: '🔥 화염방사', maxPp: 10, reqLevel: 36, nextEvo: 6, reqStone: '불꽃의 돌', baseStats: { hp: 58, atk: 64, def: 58, spAtk: 80, spDef: 65, spd: 80 } },
    6:  { name: '리자몽',   type: 'fire',  skillName: '🔥 불대문자', maxPp: 5, reqLevel: 99, nextEvo: null, reqStone: null, baseStats: { hp: 78, atk: 84, def: 78, spAtk: 109, spDef: 85, spd: 100 } },
    7:  { name: '꼬부기',   type: 'water', skillName: '💧 물대포', maxPp: 15, reqLevel: 16, nextEvo: 8, reqStone: null, baseStats: { hp: 44, atk: 48, def: 65, spAtk: 50, spDef: 64, spd: 43 } },
    8:  { name: '어니부기', type: 'water', skillName: '💧 거품광선', maxPp: 12, reqLevel: 36, nextEvo: 9, reqStone: '물의 돌', baseStats: { hp: 59, atk: 63, def: 80, spAtk: 65, spDef: 80, spd: 58 } },
    9:  { name: '거북왕',   type: 'water', skillName: '💧 하이드로펌프', maxPp: 8, reqLevel: 99, nextEvo: null, reqStone: null, baseStats: { hp: 79, atk: 83, def: 100, spAtk: 85, spDef: 105, spd: 78 } },

    10: { name: '캐터피',   type: 'bug',    skillName: '🕸️ 몸통박치기', maxPp: 20, reqLevel: 7, nextEvo: null, reqStone: null, baseStats: { hp: 45, atk: 30, def: 35, spAtk: 20, spDef: 20, spd: 45 } },
    13: { name: '뿔충이',   type: 'bug',    skillName: '🐛 독침',       maxPp: 20, reqLevel: 7, nextEvo: null, reqStone: null, baseStats: { hp: 40, atk: 35, def: 30, spAtk: 20, spDef: 20, spd: 50 } },
    16: { name: '구구',     type: 'flying', skillName: '🌪️ 바람일으키기', maxPp: 20, reqLevel: 18, nextEvo: null, reqStone: null, baseStats: { hp: 40, atk: 45, def: 40, spAtk: 35, spDef: 35, spd: 56 } },
    19: { name: '꼬렛',     type: 'normal', skillName: '🦷 필살어금니', maxPp: 15, reqLevel: 20, nextEvo: null, reqStone: null, baseStats: { hp: 30, atk: 56, def: 35, spAtk: 25, spDef: 35, spd: 72 } },
    23: { name: '아보',     type: 'poison', skillName: '🐍 독침',       maxPp: 15, reqLevel: 22, nextEvo: null, reqStone: null, baseStats: { hp: 35, atk: 60, def: 44, spAtk: 40, spDef: 54, spd: 55 } },
    25: { name: '피카츄',   type: 'electric', skillName: '⚡ 전기쇼크', maxPp: 15, reqLevel: 20, nextEvo: 26, reqStone: '천둥의 돌', baseStats: { hp: 35, atk: 55, def: 40, spAtk: 50, spDef: 50, spd: 90 } },
    26: { name: '라이츄',   type: 'electric', skillName: '⚡ 10만볼트', maxPp: 10, reqLevel: 99, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 90, def: 55, spAtk: 90, spDef: 80, spd: 110 } },
    35: { name: '삐삐',     type: 'normal', skillName: '🌙 핑거돔',     maxPp: 15, reqLevel: 20, nextEvo: null, reqStone: null, baseStats: { hp: 70, atk: 45, def: 48, spAtk: 60, spDef: 65, spd: 35 } },
    37: { name: '식스테일', type: 'fire',   skillName: '🔥 화염방사',   maxPp: 12, reqLevel: 20, nextEvo: null, reqStone: null, baseStats: { hp: 38, atk: 41, def: 40, spAtk: 50, spDef: 65, spd: 65 } },
    39: { name: '푸린',     type: 'normal', skillName: '🎶 노래하기',   maxPp: 15, reqLevel: 20, nextEvo: null, reqStone: null, baseStats: { hp: 115, atk: 45, def: 20, spAtk: 45, spDef: 25, spd: 20 } },
    41: { name: '주뱃',     type: 'poison', skillName: '🦇 흡혈',       maxPp: 15, reqLevel: 22, nextEvo: null, reqStone: null, baseStats: { hp: 40, atk: 45, def: 35, spAtk: 30, spDef: 40, spd: 55 } },
    52: { name: '나옹',     type: 'normal', skillName: '💰 고양이돈받기', maxPp: 15, reqLevel: 28, nextEvo: null, reqStone: null, baseStats: { hp: 40, atk: 45, def: 35, spAtk: 40, spDef: 40, spd: 90 } },
    54: { name: '고라파덕', type: 'water',  skillName: '🌀 염동력',     maxPp: 12, reqLevel: 33, nextEvo: null, reqStone: null, baseStats: { hp: 50, atk: 52, def: 48, spAtk: 65, spDef: 50, spd: 55 } },
    58: { name: '가디',     type: 'fire',   skillName: '🔥 화염자동차', maxPp: 12, reqLevel: 30, nextEvo: null, reqStone: null, baseStats: { hp: 55, atk: 70, def: 45, spAtk: 70, spDef: 50, spd: 60 } },
    63: { name: '케이시',   type: 'psychic', skillName: '🔮 사이코키네시스', maxPp: 10, reqLevel: 16, nextEvo: null, reqStone: null, baseStats: { hp: 25, atk: 20, def: 15, spAtk: 105, spDef: 55, spd: 90 } },
    74: { name: '꼬마돌',   type: 'rock',   skillName: '🪨 돌날리기',   maxPp: 15, reqLevel: 25, nextEvo: null, reqStone: null, baseStats: { hp: 40, atk: 80, def: 100, spAtk: 30, spDef: 30, spd: 20 } },
    79: { name: '야돈',     type: 'water',  skillName: '🌀 염동력',     maxPp: 12, reqLevel: 37, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 65, def: 65, spAtk: 40, spDef: 40, spd: 15 } },
    129: { name: '잉어킹',  type: 'water',  skillName: '💦 튀어오르기', maxPp: 30, reqLevel: 20, nextEvo: 130, reqStone: null, baseStats: { hp: 20, atk: 10, def: 55, spAtk: 15, spDef: 20, spd: 80 } },
    147: { name: '미뇽',     type: 'dragon', skillName: '🐉 용의분노',   maxPp: 10, reqLevel: 30, nextEvo: null, reqStone: null, baseStats: { hp: 41, atk: 64, def: 45, spAtk: 50, spDef: 50, spd: 50 } },
    179: { name: '메리프',   type: 'electric', skillName: '⚡ 전기쇼크', maxPp: 15, reqLevel: 15, nextEvo: null, reqStone: null, baseStats: { hp: 55, atk: 40, def: 40, spAtk: 65, spDef: 45, spd: 35 } },

    // 🔥 보스 전용 포켓몬 (일반 필드 스폰 풀에서 완벽 제외)
    95:  { name: '롱스톤',   type: 'rock',   skillName: '🪨 암석봉인',   maxPp: 10, reqLevel: 99, nextEvo: null, reqStone: null, baseStats: { hp: 85, atk: 80, def: 160, spAtk: 30, spDef: 45, spd: 70 } },
    121: { name: '아쿠스타', type: 'water',  skillName: '💧 하이드로펌프', maxPp: 10, reqLevel: 99, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 75, def: 85, spAtk: 110, spDef: 85, spd: 115 } },
    149: { name: '망나뇽',   type: 'dragon', skillName: '🐉 역린',       maxPp: 5,  reqLevel: 99, nextEvo: null, reqStone: null, baseStats: { hp: 110, atk: 134, def: 95, spAtk: 100, spDef: 100, spd: 80 } }
};

// 보스와 야생 몬스터 완벽 분리
const ZONES = {
    1: { 
        id: 1, 
        name: '29번 도로 (연두마을)', 
        minLevel: 2, 
        maxLevel: 6, 
        pool: [10, 13, 16, 19, 52, 179, 1, 4, 7], 
        bossId: 95, 
        bossLevel: 8, 
        bossName: '웅이의 롱스톤', 
        nextZoneId: 2 
    },
    2: { 
        id: 2, 
        name: '30번 도로 & 달맞이산', 
        minLevel: 7, 
        maxLevel: 12, 
        pool: [23, 35, 39, 41, 74, 79, 19, 16], 
        bossId: 121, 
        bossLevel: 14, 
        bossName: '이슬이의 아쿠스타', 
        nextZoneId: 3 
    },
    3: { 
        id: 3, 
        name: '모구리탑 & 갈색체육관', 
        minLevel: 13, 
        maxLevel: 18, 
        pool: [25, 37, 58, 63, 179, 16], 
        bossId: 26, 
        bossLevel: 20, 
        bossName: '마티스의 라이츄', 
        nextZoneId: 4 
    },
    4: { 
        id: 4, 
        name: '야돈의 우물 & 석영고원', 
        minLevel: 19, 
        maxLevel: 25, 
        pool: [54, 79, 129, 147, 25, 2], 
        bossId: 149, 
        bossLevel: 28, 
        bossName: '목호의 망나뇽', 
        nextZoneId: null 
    }
};

const USERS = {};

function calculateStats(pokemonId, level) {
    const base = POKEMON_DB[pokemonId].baseStats;
    const maxHp = Math.floor(((2 * base.hp) * level) / 100) + level + 10;
    const atk = Math.floor(((2 * base.atk) * level) / 100) + 5;
    const def = Math.floor(((2 * base.def) * level) / 100) + 5;
    const spAtk = Math.floor(((2 * base.spAtk) * level) / 100) + 5;
    const spDef = Math.floor(((2 * base.spDef) * level) / 100) + 5;
    const spd = Math.floor(((2 * base.spd) * level) / 100) + 5;
    return { maxHp, atk, def, spAtk, spDef, spd };
}

function checkNeedsHeal(user) {
    return user.partner.hp <= 0;
}

wss.on('connection', (ws) => {
    let userId = null;

    ws.on('message', (raw) => {
        try {
            const data = JSON.parse(raw);

            if (data.type === 'INIT') {
                userId = data.nickname;
                const starterId = POKEMON_DB[data.starterId] ? data.starterId : 4;

                if (!USERS[userId]) {
                    const defaultStats = calculateStats(starterId, 1);
                    const dbInfo = POKEMON_DB[starterId];
                    USERS[userId] = {
                        nickname: userId,
                        gold: 5000,
                        currentZone: 1,
                        unlockedZones: [1],
                        caughtList: [],
                        balls: { poke: 10, super: 3, hyper: 1 },
                        inventory: { '불꽃의 돌': 1, '물의 돌': 1, '리프의 돌': 1, '천둥의 돌': 1 },
                        partner: {
                            id: starterId,
                            name: dbInfo.name,
                            type: dbInfo.type,
                            skillName: dbInfo.skillName,
                            level: 1,
                            exp: 0,
                            maxExp: 50,
                            hp: defaultStats.maxHp,
                            pp: dbInfo.maxPp,
                            maxPp: dbInfo.maxPp,
                            affinity: 10.0,
                            stats: defaultStats
                        },
                        location: '마을',
                        activeWild: null
                    };
                }
                const user = USERS[userId];
                user.currentZoneName = ZONES[user.currentZone].name;
                ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: user }));
                broadcastUserList();
            }

            const user = USERS[userId];
            if (!user) return;

            if (data.type === 'REQ_ZONE_INFO') {
                ws.send(JSON.stringify({
                    type: 'ZONE_INFO',
                    zones: Object.values(ZONES),
                    unlockedZones: user.unlockedZones,
                    currentZone: user.currentZone
                }));
            }

            if (data.type === 'REQ_POKEDEX_INFO') {
                ws.send(JSON.stringify({
                    type: 'POKEDEX_INFO',
                    caughtList: user.caughtList
                }));
            }

            if (data.type === 'CHANGE_ZONE') {
                const targetZoneId = parseInt(data.zoneId, 10);

                if (user.activeWild) {
                    ws.send(JSON.stringify({
                        type: 'LOG',
                        msg: '⚠️ 야생 포켓몬과 전투 중에는 지역을 이동할 수 없습니다!'
                    }));
                    return;
                }

                // 해금된 지역 목록 비교
                const unlocked = user.unlockedZones.map(id => parseInt(id, 10));
                if (unlocked.includes(targetZoneId) && ZONES[targetZoneId]) {
                    user.currentZone = targetZoneId;
                    user.currentZoneName = ZONES[targetZoneId].name;
                    user.location = '마을';
                    user.activeWild = null;

                    ws.send(JSON.stringify({
                        type: 'STATE_UPDATE',
                        user: user,
                        msg: `🗺️ [${user.currentZoneName}](으)로 이동했습니다.`
                    }));
                    broadcastUserList();
                } else {
                    ws.send(JSON.stringify({
                        type: 'LOG',
                        msg: '❌ 아직 해금되지 않은 지역입니다. 보스를 먼저 처치하세요!'
                    }));
                }
            }

            if (data.type === 'EXPLORE_FIELD') {
                if (checkNeedsHeal(user)) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 체력이 없습니다! 센터에서 치료하세요.' }));
                    return;
                }

                user.location = '필드';
                const zone = ZONES[user.currentZone];
                const wildId = zone.pool[Math.floor(Math.random() * zone.pool.length)];
                
                // ✨ 이로치(Shiny) 출현 확률 1% (1/100)로 대폭 상향!
                const isShiny = Math.random() < 0.01; 
                const wildLevel = Math.floor(Math.random() * (zone.maxLevel - zone.minLevel + 1)) + zone.minLevel;
                const wildStats = calculateStats(wildId, wildLevel);

                user.activeWild = {
                    id: wildId,
                    name: POKEMON_DB[wildId].name,
                    type: POKEMON_DB[wildId].type,
                    level: wildLevel,
                    hp: wildStats.maxHp,
                    maxHp: wildStats.maxHp,
                    isShiny: isShiny,
                    isBoss: false,
                    stats: wildStats
                };

                ws.send(JSON.stringify({
                    type: 'WILD_SPAWN',
                    wild: user.activeWild,
                    user: user,
                    msg: isShiny 
                        ? `✨✨ [희귀 발견!] 이로치 ${user.activeWild.name}(Lv.${wildLevel})이(가) 나타났다! ✨✨`
                        : `야생의 ${user.activeWild.name}(Lv.${wildLevel})이(가) 나타났다!`
                }));
            }

            if (data.type === 'CHALLENGE_BOSS') {
                if (checkNeedsHeal(user)) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 체력이 없습니다! 센터에서 치료 후 도전하세요.' }));
                    return;
                }

                const zone = ZONES[user.currentZone];
                user.location = '보스전';
                const bossStats = calculateStats(zone.bossId, zone.bossLevel);
                bossStats.maxHp = Math.floor(bossStats.maxHp * 1.5);

                user.activeWild = {
                    id: zone.bossId,
                    name: zone.bossName,
                    type: POKEMON_DB[zone.bossId].type,
                    level: zone.bossLevel,
                    hp: bossStats.maxHp,
                    maxHp: bossStats.maxHp,
                    isShiny: false,
                    isBoss: true,
                    stats: bossStats
                };

                ws.send(JSON.stringify({
                    type: 'WILD_SPAWN',
                    wild: user.activeWild,
                    user: user,
                    msg: `🔥 [보스전] ${zone.name}의 보스 [${zone.bossName}](Lv.${zone.bossLevel}) 출현!`
                }));
            }

            if (data.type === 'BATTLE_ACTION') {
                if (!user.activeWild) return;
                if (checkNeedsHeal(user)) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 전투 불능 상태입니다. 센터에서 치료하세요!' }));
                    return;
                }

                const action = data.action;
                let damageToWild = 0;
                let isDefending = false;
                let actionMsg = '';

                // 속성 상성 계산 적용
                const playerType = user.partner.type || 'normal';
                const enemyType = user.activeWild.type || 'normal';
                const typeMult = getTypeEffectiveness(playerType, enemyType);
                let typeMsg = '';
                if (typeMult > 1.2) typeMsg = ' (💥 효과가 뛰어났다!)';
                else if (typeMult < 0.8) typeMsg = ' (🌧️ 효과가 별로인 듯하다...)';

                if (action === 'RUN') {
                    if (user.activeWild.isBoss) {
                        ws.send(JSON.stringify({ type: 'LOG', msg: '🚫 보스전에서는 도망칠 수 없습니다!' }));
                        return;
                    }
                    if (Math.random() < 0.75) {
                        user.activeWild = null;
                        user.location = '마을';
                        ws.send(JSON.stringify({
                            type: 'BATTLE_END',
                            user: user,
                            msg: '🏃 무사히 도망쳤습니다!'
                        }));
                        return;
                    } else {
                        actionMsg = '🏃 도망치는 데 실패했습니다!';
                    }
                } else if (action === 'ATTACK') {
                    const affinityBonus = 1.0 + (user.partner.affinity / 200.0);
                    const playerAtk = user.partner.stats.atk * affinityBonus;
                    const wildDef = user.activeWild.stats.def;
                    damageToWild = Math.max(5, Math.floor(((playerAtk * 1.5) - (wildDef * 0.4)) * typeMult));
                    user.activeWild.hp -= damageToWild;
                    actionMsg = `⚔️ [일반 공격] 상대에게 ${damageToWild} 데미지!${typeMsg}`;
                } else if (action === 'SKILL') {
                    if (user.partner.pp <= 0) {
                        ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 스킬 PP가 다 소진되었습니다! 센터에서 회복하세요.' }));
                        return;
                    }
                    user.partner.pp -= 1;
                    const affinityBonus = 1.0 + (user.partner.affinity / 200.0);
                    const playerSpAtk = user.partner.stats.spAtk * affinityBonus;
                    const wildSpDef = user.activeWild.stats.spDef;
                    damageToWild = Math.max(10, Math.floor(((playerSpAtk * 2.2) - (wildSpDef * 0.3)) * typeMult));
                    user.activeWild.hp -= damageToWild;
                    actionMsg = `⚡ [스킬: ${user.partner.skillName}] ${damageToWild} 데미지!${typeMsg}`;
                } else if (action === 'DEFEND') {
                    isDefending = true;
                    actionMsg = `🛡️ [방어 태세] 피해 감소!`;
                }

                if (user.activeWild && user.activeWild.hp <= 0) {
                    user.activeWild.hp = 0;
                    const isBoss = user.activeWild.isBoss;
                    const currentZoneObj = ZONES[user.currentZone];

                    const rewardGold = user.activeWild.level * (isBoss ? 1500 : 350);
                    const rewardExp = user.activeWild.level * (isBoss ? 100 : 25);
                    user.gold += rewardGold;
                    user.partner.exp += rewardExp;
                    user.partner.affinity = Math.min(100.0, user.partner.affinity + 0.5);

                    let unlockMsg = '';
                    if (isBoss && currentZoneObj.nextZoneId) {
                        if (!user.unlockedZones.includes(currentZoneObj.nextZoneId)) {
                            user.unlockedZones.push(currentZoneObj.nextZoneId);
                            unlockMsg = `\n🎊 다음 지역 [${ZONES[currentZoneObj.nextZoneId].name}] 해금!`;
                        }
                    }

                    let levelUpMsg = '';
                    if (user.partner.exp >= user.partner.maxExp) {
                        user.partner.level += 1;
                        user.partner.exp -= user.partner.maxExp;
                        user.partner.maxExp = Math.floor(user.partner.maxExp * 1.25);
                        user.partner.stats = calculateStats(user.partner.id, user.partner.level);
                        user.partner.hp = user.partner.stats.maxHp;
                        levelUpMsg = `\n🎉 레벨 업! (Lv.${user.partner.level})`;
                    }

                    const wildName = user.activeWild.name;
                    user.activeWild = null;
                    user.location = '마을';

                    ws.send(JSON.stringify({
                        type: 'BATTLE_END',
                        user: user,
                        msg: `${actionMsg}\n💥 ${wildName} 처치 성공! (+${rewardGold}G, +${rewardExp}EXP)${unlockMsg}${levelUpMsg}`
                    }));
                    broadcastUserList();
                    return;
                }

                // 상대 공격 상성 계산
                const enemyTypeMult = getTypeEffectiveness(enemyType, playerType);
                let wildAtk = user.activeWild.stats.atk;
                let playerDef = user.partner.stats.def;
                let damageToPlayer = Math.max(3, Math.floor(((wildAtk * 1.2) - (playerDef * 0.5)) * enemyTypeMult));

                if (isDefending) {
                    damageToPlayer = Math.floor(damageToPlayer * 0.4);
                }

                user.partner.hp -= damageToPlayer;

                if (user.partner.hp <= 0) {
                    user.partner.hp = 0;
                    user.location = '마을';
                    user.activeWild = null;

                    ws.send(JSON.stringify({
                        type: 'BATTLE_END',
                        user: user,
                        msg: `${actionMsg}\n💀 ${user.partner.name}이(가) 쓰러졌습니다! 센터에서 치료해주세요.`
                    }));
                    broadcastUserList();
                    return;
                }

                ws.send(JSON.stringify({
                    type: 'WILD_HP_UPDATE',
                    wildHp: user.activeWild.hp,
                    wildMaxHp: user.activeWild.maxHp,
                    partnerHp: user.partner.hp,
                    partnerMaxHp: user.partner.stats.maxHp,
                    attacker: action === 'DEFEND' || action === 'RUN' ? 'enemy' : 'partner',
                    msg: `${actionMsg}\n💥 상대 반격: ${damageToPlayer} 데미지`
                }));
            }

            if (data.type === 'CATCH_ATTEMPT') {
                if (!user.activeWild) return;
                if (user.activeWild.isBoss) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 보스 포켓몬은 포획할 수 없습니다!' }));
                    return;
                }

                const ballType = data.ballType || 'poke';
                if ((user.balls[ballType] || 0) <= 0) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '선택한 몬스터볼이 부족합니다!' }));
                    return;
                }

                user.balls[ballType] -= 1;
                const ballBonus = { poke: 1.0, super: 1.5, hyper: 2.0 }[ballType] || 1.0;
                const hpRatio = user.activeWild.hp / user.activeWild.maxHp;
                const catchChance = Math.min(95, Math.max(10, (1.0 - hpRatio * 0.5) * 40 * ballBonus));

                if ((Math.random() * 100) < catchChance) {
                    const caught = user.activeWild;
                    user.caughtList.push({
                        id: caught.id,
                        name: caught.name,
                        level: caught.level,
                        isShiny: caught.isShiny
                    });

                    user.activeWild = null;
                    user.location = '마을';

                    ws.send(JSON.stringify({
                        type: 'CATCH_SUCCESS',
                        user: user,
                        msg: `🎉 ${caught.isShiny ? '✨이로치 ' : ''}${caught.name} 포획 성공! 수집함에 보관되었습니다.`
                    }));
                } else {
                    ws.send(JSON.stringify({
                        type: 'CATCH_FAIL',
                        user: user,
                        msg: `아깝다! ${user.activeWild.name}이(가) 볼을 튕겨냈습니다.`
                    }));
                }
            }

            if (data.type === 'TRAIN') {
                if (user.activeWild) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '⚠️ 전투 중에는 훈련소를 이용할 수 없습니다!' }));
                    return;
                }
                if (checkNeedsHeal(user)) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 체력이 없습니다! 센터에서 치료받으세요.' }));
                    return;
                }

                const cost = Math.floor(1000 * Math.pow(user.partner.level, 1.2));
                if (user.gold >= cost) {
                    user.gold -= cost;
                    user.partner.exp += 30;
                    user.partner.affinity = Math.min(100.0, user.partner.affinity + 1.5);

                    let msg = `🏋️ 훈련 완료! (+30 EXP, 친밀도 +1.5%, -${cost.toLocaleString()}G)`;

                    if (user.partner.exp >= user.partner.maxExp) {
                        user.partner.level += 1;
                        user.partner.exp -= user.partner.maxExp;
                        user.partner.maxExp = Math.floor(user.partner.maxExp * 1.25);
                        user.partner.stats = calculateStats(user.partner.id, user.partner.level);
                        user.partner.hp = user.partner.stats.maxHp;
                        msg += ` 🎉 레벨 업! (Lv.${user.partner.level})`;
                    }
                    ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: user, msg: msg }));
                } else {
                    ws.send(JSON.stringify({ type: 'LOG', msg: `골드가 부족합니다!` }));
                }
            }

            if (data.type === 'HEAL') {
                if (user.activeWild) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '⚠️ 전투 중에는 포켓몬 센터를 이용할 수 없습니다!' }));
                    return;
                }
                const healCost = (user.partner.stats.maxHp - user.partner.hp) * 10 + (user.partner.maxPp - user.partner.pp) * 20;
                if (user.gold >= healCost) {
                    user.gold -= healCost;
                    user.partner.hp = user.partner.stats.maxHp;
                    user.partner.pp = user.partner.maxPp;
                    user.partner.affinity = Math.min(100.0, user.partner.affinity + 2.0);
                    ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: user, msg: `🏥 파트너 포켓몬이 완치되고 스킬 PP가 회복되었습니다!` }));
                } else {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '치료 골드가 부족합니다.' }));
                }
            }

            if (data.type === 'EVOLVE') {
                if (user.activeWild) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '⚠️ 전투 중에는 진화를 시도할 수 없습니다!' }));
                    return;
                }
                const pInfo = POKEMON_DB[user.partner.id];
                if (!pInfo || !pInfo.nextEvo) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '이미 최종 진화 상태입니다.' }));
                    return;
                }

                if (user.partner.level < pInfo.reqLevel) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: `❌ 진화 레벨이 부족합니다! (필요 레벨: Lv.${pInfo.reqLevel})` }));
                    return;
                }

                if (pInfo.reqStone && (user.inventory[pInfo.reqStone] || 0) <= 0) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: `❌ 진화에 [${pInfo.reqStone}]이 필요합니다.` }));
                    return;
                }

                if (pInfo.reqStone) {
                    user.inventory[pInfo.reqStone] -= 1;
                }

                const nextInfo = POKEMON_DB[pInfo.nextEvo];
                user.partner.id = pInfo.nextEvo;
                user.partner.name = nextInfo.name;
                user.partner.type = nextInfo.type;
                user.partner.skillName = nextInfo.skillName;
                user.partner.maxPp = nextInfo.maxPp;
                user.partner.pp = nextInfo.maxPp;
                user.partner.stats = calculateStats(user.partner.id, user.partner.level);
                user.partner.hp = user.partner.stats.maxHp;

                ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: user, msg: `✨ 축하합니다! [${user.partner.name}](으)로 진화했습니다!` }));
            }
        } catch (err) {
            console.error(err);
        }
    });

    function broadcastUserList() {
        const list = Object.values(USERS).map(u => {
            const p = u.partner;
            const cp = p.stats.atk + p.stats.def + p.stats.spAtk + p.stats.spDef + p.stats.spd + (p.level * 10);
            return {
                nickname: u.nickname,
                zoneName: u.currentZoneName || '연두마을',
                cp: cp,
                partnerName: p.name,
                partnerLevel: p.level
            };
        });

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'SIDEBAR_LIST', users: list }));
            }
        });
    }
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
