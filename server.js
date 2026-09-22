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

// 포켓몬 데이터베이스
const POKEMON_DB = {
    1:  { name: '이상해씨', type: 'grass', baseCatchRate: 45, stage: 1, nextEvo: 2, reqStone: '리프의 돌', baseStats: { hp: 45, atk: 49, def: 49, spAtk: 65, spDef: 65, spd: 45 } },
    2:  { name: '이상해풀', type: 'grass', baseCatchRate: 20, stage: 2, nextEvo: 3, reqStone: '리프의 돌', baseStats: { hp: 60, atk: 62, def: 63, spAtk: 80, spDef: 80, spd: 60 } },
    3:  { name: '이상해꽃', type: 'grass', baseCatchRate: 5,  stage: 3, nextEvo: null, reqStone: null, baseStats: { hp: 80, atk: 82, def: 83, spAtk: 100, spDef: 100, spd: 80 } },
    4:  { name: '파이리',   type: 'fire',  baseCatchRate: 45, stage: 1, nextEvo: 5, reqStone: '불꽃의 돌', baseStats: { hp: 39, atk: 52, def: 43, spAtk: 60, spDef: 50, spd: 65 } },
    5:  { name: '리자드',   type: 'fire',  baseCatchRate: 20, stage: 2, nextEvo: 6, reqStone: '불꽃의 돌', baseStats: { hp: 58, atk: 64, def: 58, spAtk: 80, spDef: 65, spd: 80 } },
    6:  { name: '리자몽',   type: 'fire',  baseCatchRate: 5,  stage: 3, nextEvo: null, reqStone: null, baseStats: { hp: 78, atk: 84, def: 78, spAtk: 109, spDef: 85, spd: 100 } },
    7:  { name: '꼬부기',   type: 'water', baseCatchRate: 45, stage: 1, nextEvo: 8, reqStone: '물의 돌', baseStats: { hp: 44, atk: 48, def: 65, spAtk: 50, spDef: 64, spd: 43 } },
    8:  { name: '어니부기', type: 'water', baseCatchRate: 20, stage: 2, nextEvo: 9, reqStone: '물의 돌', baseStats: { hp: 59, atk: 63, def: 80, spAtk: 65, spDef: 80, spd: 58 } },
    9:  { name: '거북왕',   type: 'water', baseCatchRate: 5,  stage: 3, nextEvo: null, reqStone: null, baseStats: { hp: 79, atk: 83, def: 100, spAtk: 85, spDef: 105, spd: 78 } },
    16: { name: '구구',     type: 'normal', baseCatchRate: 50, stage: 1, nextEvo: 17, reqStone: null, baseStats: { hp: 40, atk: 45, def: 40, spAtk: 35, spDef: 35, spd: 56 } },
    17: { name: '피전트',   type: 'normal', baseCatchRate: 30, stage: 2, nextEvo: 18, reqStone: null, baseStats: { hp: 63, atk: 60, def: 55, spAtk: 50, spDef: 50, spd: 71 } },
    18: { name: '피죤투',   type: 'normal', baseCatchRate: 15, stage: 3, nextEvo: null, reqStone: null, baseStats: { hp: 83, atk: 80, def: 75, spAtk: 70, spDef: 70, spd: 101 } },
    19: { name: '꼬렛',     type: 'normal', baseCatchRate: 50, stage: 1, nextEvo: null, reqStone: null, baseStats: { hp: 30, atk: 56, def: 35, spAtk: 25, spDef: 35, spd: 72 } },
    25: { name: '피카츄',   type: 'electric', baseCatchRate: 40, stage: 1, nextEvo: 26, reqStone: '천둥의 돌', baseStats: { hp: 35, atk: 55, def: 40, spAtk: 50, spDef: 50, spd: 90 } },
    26: { name: '라이츄',   type: 'electric', baseCatchRate: 10, stage: 2, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 90, def: 55, spAtk: 90, spDef: 80, spd: 110 } },
    41: { name: '주뱃',     type: 'poison', baseCatchRate: 45, stage: 1, nextEvo: null, reqStone: null, baseStats: { hp: 40, atk: 45, def: 35, spAtk: 30, spDef: 40, spd: 55 } },
    79: { name: '야돈',     type: 'water', baseCatchRate: 40, stage: 1, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 65, def: 65, spAtk: 40, spDef: 40, spd: 15 } }
};

// 🗺️ 포켓몬 골드 기반 지역(필드) 및 보스 정의
const ZONES = {
    1: { id: 1, name: '29번 도로 (연두마을 근처)', minLevel: 2, maxLevel: 5, pool: [16, 19], bossId: 17, bossLevel: 7, bossName: '실버의 피전트', nextZoneId: 2 },
    2: { id: 2, name: '30번 도로 & 어둠의 동굴', minLevel: 6, maxLevel: 9, pool: [16, 19, 41], bossId: 41, bossLevel: 10, bossName: '동굴의 왕 주뱃', nextZoneId: 3 },
    3: { id: 3, name: '모구리탑 & 도라지체육관', minLevel: 10, maxLevel: 13, pool: [16, 19, 25, 41], bossId: 18, bossLevel: 14, bossName: '체육관 관장 비상 (피죤투)', nextZoneId: 4 },
    4: { id: 4, name: '야돈의 우물 & 고동마을', minLevel: 14, maxLevel: 18, pool: [41, 79, 25], bossId: 79, bossLevel: 20, bossName: '우물의 수호자 거대 야돈', nextZoneId: null }
};

const DROP_ITEMS = ['몬스터볼', '슈퍼볼', '하이퍼볼', '상처약'];
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

function calculatePower(stats, level) {
    return Math.floor((stats.atk + stats.spAtk + stats.spd) * (level * 0.8) + (stats.def + stats.spDef));
}

function calculateCatchProbability(ballType, wildMon, partnerMon) {
    if (ballType === 'master') return 100.0;
    const ballRates = { poke: 1.0, super: 1.5, hyper: 2.0 };
    const ballBonus = ballRates[ballType] || 1.0;

    const hpRatio = wildMon.hp / wildMon.maxHp;
    const hpBonus = 1.0 + (1.0 - hpRatio) * 2.0;

    const partnerPower = calculatePower(partnerMon.stats, partnerMon.level);
    const wildPower = calculatePower(wildMon.stats, wildMon.level);
    
    let levelBonus = 1.0;
    if (partnerPower >= wildPower) {
        const powerDiff = partnerPower - wildPower;
        levelBonus = 1.2 + Math.min(1.3, powerDiff / 100);
    } else {
        const powerDiff = wildPower - partnerPower;
        levelBonus = Math.max(0.5, 1.0 - (powerDiff / 200));
    }

    const baseRate = wildMon.baseCatchRate;
    let finalProbability = (baseRate / 100) * hpBonus * ballBonus * levelBonus * 100;
    return Math.min(100.0, Math.max(1.0, finalProbability));
}

function checkNeedsHeal(user) {
    return user.partner.hp <= 0 || user.partner.fatigue >= 100;
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
                    USERS[userId] = {
                        nickname: userId,
                        gold: 5000,
                        currentZone: 1,
                        unlockedZones: [1],
                        balls: { poke: 10, super: 0, hyper: 0, master: 0 },
                        inventory: { '불꽃의 돌': 1, '물의 돌': 1, '리프의 돌': 1, '천둥의 돌': 1 },
                        partner: {
                            id: starterId,
                            name: POKEMON_DB[starterId].name,
                            level: 1,
                            exp: 0,
                            maxExp: 50,
                            hp: defaultStats.maxHp,
                            maxHp: defaultStats.maxHp,
                            fatigue: 0,
                            affinity: 10.0,
                            isShiny: false,
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

            if (data.type === 'CHANGE_ZONE') {
                const targetZoneId = parseInt(data.zoneId);
                if (user.unlockedZones.includes(targetZoneId)) {
                    user.currentZone = targetZoneId;
                    user.currentZoneName = ZONES[targetZoneId].name;
                    user.location = '마을';
                    user.activeWild = null;
                    ws.send(JSON.stringify({
                        type: 'STATE_UPDATE',
                        user: user,
                        msg: `🗺️ [${user.currentZoneName}](으)로 이동했습니다.`
                    }));
                }
            }

            if (data.type === 'EXPLORE_FIELD') {
                if (checkNeedsHeal(user)) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 체력이 없거나 지쳤습니다! 포켓몬 센터에서 치료하세요.' }));
                    return;
                }

                user.location = '필드';
                const zone = ZONES[user.currentZone];
                const wildId = zone.pool[Math.floor(Math.random() * zone.pool.length)];
                const isShiny = Math.random() < (1 / 4096);
                const wildLevel = Math.floor(Math.random() * (zone.maxLevel - zone.minLevel + 1)) + zone.minLevel;
                const wildStats = calculateStats(wildId, wildLevel);

                user.activeWild = {
                    id: wildId,
                    name: POKEMON_DB[wildId].name,
                    level: wildLevel,
                    hp: wildStats.maxHp,
                    maxHp: wildStats.maxHp,
                    baseCatchRate: POKEMON_DB[wildId].baseCatchRate,
                    isShiny: isShiny,
                    isBoss: false,
                    stats: wildStats
                };

                ws.send(JSON.stringify({
                    type: 'WILD_SPAWN',
                    wild: user.activeWild,
                    isBoss: false,
                    user: user,
                    msg: `야생의 ${isShiny ? '✨' : ''}${user.activeWild.name}(Lv.${wildLevel})이(가) 나타났다!`
                }));
            }

            if (data.type === 'CHALLENGE_BOSS') {
                if (checkNeedsHeal(user)) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 체력이 없거나 지쳤습니다! 센터에서 치료 후 보스에 도전하세요.' }));
                    return;
                }

                const zone = ZONES[user.currentZone];
                user.location = '보스전';
                const bossStats = calculateStats(zone.bossId, zone.bossLevel);
                bossStats.maxHp = Math.floor(bossStats.maxHp * 1.5);

                user.activeWild = {
                    id: zone.bossId,
                    name: zone.bossName,
                    level: zone.bossLevel,
                    hp: bossStats.maxHp,
                    maxHp: bossStats.maxHp,
                    baseCatchRate: 0,
                    isShiny: false,
                    isBoss: true,
                    stats: bossStats
                };

                ws.send(JSON.stringify({
                    type: 'WILD_SPAWN',
                    wild: user.activeWild,
                    isBoss: true,
                    user: user,
                    msg: `🔥 [보스전 개시] ${zone.name}의 보스 [${zone.bossName}](Lv.${zone.bossLevel})이(가) 나타났습니다!`
                }));
            }

            if (data.type === 'ATTACK_WILD') {
                if (!user.activeWild) return;
                if (checkNeedsHeal(user)) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 포켓몬이 전투 불능 상태입니다. 센터에서 치료하세요!' }));
                    return;
                }

                // 1. 플레이어 공격
                const playerAtk = user.partner.stats.atk;
                const wildDef = user.activeWild.stats.def;
                const damageToWild = Math.max(5, Math.floor((playerAtk * 1.5) - (wildDef * 0.5)));
                user.activeWild.hp -= damageToWild;

                user.partner.fatigue = Math.min(100, user.partner.fatigue + 5);

                // 처치 승리 시
                if (user.activeWild.hp <= 0) {
                    user.activeWild.hp = 0;
                    const isBoss = user.activeWild.isBoss;
                    const currentZoneObj = ZONES[user.currentZone];

                    const rewardGold = user.activeWild.level * (isBoss ? 1000 : 350);
                    const rewardExp = user.activeWild.level * (isBoss ? 100 : 25);
                    user.gold += rewardGold;
                    user.partner.exp += rewardExp;

                    let dropMsg = '';
                    if (!isBoss && Math.random() < 0.4) {
                        const droppedItem = DROP_ITEMS[Math.floor(Math.random() * DROP_ITEMS.length)];
                        if (droppedItem.includes('볼')) {
                            const ballKey = droppedItem === '몬스터볼' ? 'poke' : (droppedItem === '슈퍼볼' ? 'super' : 'hyper');
                            user.balls[ballKey] = (user.balls[ballKey] || 0) + 1;
                        } else {
                            user.inventory[droppedItem] = (user.inventory[droppedItem] || 0) + 1;
                        }
                        dropMsg = ` 🎁 [${droppedItem}] 획득!`;
                    }

                    let unlockMsg = '';
                    if (isBoss && currentZoneObj.nextZoneId) {
                        if (!user.unlockedZones.includes(currentZoneObj.nextZoneId)) {
                            user.unlockedZones.push(currentZoneObj.nextZoneId);
                            unlockMsg = ` 🎊 축하합니다! 다음 지역 [${ZONES[currentZoneObj.nextZoneId].name}]이(가) 해금되었습니다!`;
                        }
                    }

                    // 레벨업 체크
                    let levelUpMsg = '';
                    if (user.partner.exp >= user.partner.maxExp) {
                        user.partner.level += 1;
                        user.partner.exp -= user.partner.maxExp;
                        user.partner.maxExp = Math.floor(user.partner.maxExp * 1.25);
                        user.partner.stats = calculateStats(user.partner.id, user.partner.level);
                        user.partner.hp = user.partner.stats.maxHp;
                        levelUpMsg = ` 🎉 레벨 업! (Lv.${user.partner.level})`;
                    }

                    const wildName = user.activeWild.name;
                    user.activeWild = null;

                    if (user.partner.fatigue >= 100) {
                        user.location = '마을';
                        ws.send(JSON.stringify({
                            type: 'BATTLE_END',
                            user: user,
                            msg: `💥 ${wildName} 처치 성공! (+${rewardGold}G, +${rewardExp}EXP)${dropMsg}${unlockMsg}${levelUpMsg}\n⚠️ 파트너의 피로도가 100%가 되어 마을로 복귀했습니다.`
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            type: 'BATTLE_END',
                            user: user,
                            msg: `💥 ${wildName} 처치 성공! (+${rewardGold}G, +${rewardExp}EXP)${dropMsg}${unlockMsg}${levelUpMsg}`
                        }));
                    }
                    broadcastUserList();
                    return;
                }

                // 2. 야생/보스 반격
                const wildAtk = user.activeWild.stats.atk;
                const playerDef = user.partner.stats.def;
                const damageToPlayer = Math.max(3, Math.floor((wildAtk * 1.2) - (playerDef * 0.6)));
                user.partner.hp -= damageToPlayer;

                if (user.partner.hp <= 0) {
                    user.partner.hp = 0;
                    user.location = '마을';
                    user.activeWild = null;

                    ws.send(JSON.stringify({
                        type: 'BATTLE_END',
                        user: user,
                        msg: `💀 ${user.partner.name}이(가) 상대의 공격(${damageToPlayer} 피해)을 받고 기절했습니다! 마을로 복귀합니다.`
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
                    msg: `⚔️ 내 공격: ${damageToWild} 데미지 | 🛡️ 상대 반격: ${damageToPlayer} 데미지`
                }));
            }

            if (data.type === 'CATCH_ATTEMPT') {
                if (!user.activeWild) return;
                if (user.activeWild.isBoss) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 보스 포켓몬은 포획할 수 없습니다!' }));
                    return;
                }

                const ballType = data.ballType;
                if (user.balls[ballType] <= 0) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '선택한 몬스터볼이 부족합니다!' }));
                    return;
                }

                user.balls[ballType] -= 1;
                const catchChance = calculateCatchProbability(ballType, user.activeWild, user.partner);
                const isCaught = (Math.random() * 100) < catchChance;

                if (isCaught) {
                    const caught = user.activeWild;
                    if (caught.isShiny && !user.partner.isShiny) {
                        user.partner.isShiny = true;
                    }
                    user.activeWild = null;
                    user.location = '마을';

                    ws.send(JSON.stringify({
                        type: 'CATCH_SUCCESS',
                        user: user,
                        msg: `🎉 ${caught.name} 포획 성공! (포획 확률: ${catchChance.toFixed(1)}%)`
                    }));
                } else {
                    ws.send(JSON.stringify({
                        type: 'CATCH_FAIL',
                        user: user,
                        msg: `아깝다! 포켓몬이 빠져나왔다... (포획 확률: ${catchChance.toFixed(1)}%)`
                    }));
                }
            }

            if (data.type === 'TRAIN') {
                if (checkNeedsHeal(user)) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 포켓몬의 체력이 없거나 지쳤습니다! 센터에서 치료받으세요.' }));
                    return;
                }

                const cost = Math.floor(1000 * Math.pow(user.partner.level, 1.2));
                if (user.gold >= cost) {
                    user.gold -= cost;
                    user.partner.exp += 25;
                    user.partner.fatigue = Math.min(100, user.partner.fatigue + 15);

                    if (user.partner.exp >= user.partner.maxExp) {
                        user.partner.level += 1;
                        user.partner.exp -= user.partner.maxExp;
                        user.partner.maxExp = Math.floor(user.partner.maxExp * 1.25);
                        user.partner.stats = calculateStats(user.partner.id, user.partner.level);
                        user.partner.hp = user.partner.stats.maxHp;
                    }
                    ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: user, msg: `🏋️ 훈련 완료! (-${cost.toLocaleString()}G)` }));
                } else {
                    ws.send(JSON.stringify({ type: 'LOG', msg: `골드가 부족합니다!` }));
                }
            }

            if (data.type === 'HEAL') {
                const healCost = (user.partner.stats.maxHp - user.partner.hp) * 10 + (user.partner.fatigue * 5);
                if (user.gold >= healCost) {
                    user.gold -= healCost;
                    user.partner.hp = user.partner.stats.maxHp;
                    user.partner.fatigue = 0;
                    ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: user, msg: `🏥 완치되었습니다!` }));
                } else {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '치료 골드가 부족합니다.' }));
                }
            }

            if (data.type === 'EVOLVE') {
                if (checkNeedsHeal(user)) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 기절/지친 상태에서는 진화할 수 없습니다.' }));
                    return;
                }

                const pInfo = POKEMON_DB[user.partner.id];
                if (!pInfo.nextEvo) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '이미 최종 진화 상태입니다.' }));
                    return;
                }
                if ((user.inventory[pInfo.reqStone] || 0) <= 0) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: `진화에 [${pInfo.reqStone}]이 필요합니다.` }));
                    return;
                }

                user.inventory[pInfo.reqStone] -= 1;
                user.partner.id = pInfo.nextEvo;
                user.partner.name = POKEMON_DB[pInfo.nextEvo].name;
                user.partner.stats = calculateStats(user.partner.id, user.partner.level);
                user.partner.hp = user.partner.stats.maxHp;

                ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: user, msg: `✨ [${user.partner.name}](으)로 진화했습니다!` }));
            }
        } catch (err) {
            console.error(err);
        }
    });

    function broadcastUserList() {
        const list = Object.values(USERS).map(u => ({
            nickname: u.nickname,
            zoneName: u.currentZoneName || '연두마을',
            power: calculatePower(u.partner.stats, u.partner.level)
        }));
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
