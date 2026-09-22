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

// 포켓몬 DB
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
    25: { name: '피카츄',   type: 'electric', baseCatchRate: 40, stage: 1, nextEvo: 26, reqStone: '천둥의 돌', baseStats: { hp: 35, atk: 55, def: 40, spAtk: 50, spDef: 50, spd: 90 } },
    26: { name: '라이츄',   type: 'electric', baseCatchRate: 10, stage: 2, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 90, def: 55, spAtk: 90, spDef: 80, spd: 110 } }
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

function calculatePower(stats, level) {
    return Math.floor((stats.atk + stats.spAtk + stats.spd) * (level * 0.8) + (stats.def + stats.spDef));
}

function calculateCatchProbability(ballType, wildMon, partnerPower) {
    const ballRates = { poke: 1.0, super: 1.5, hyper: 2.0, master: 255.0 };
    const ballBonus = ballRates[ballType] || 1.0;
    const hpFactor = (3 * wildMon.maxHp - 2 * wildMon.hp) / (3 * wildMon.maxHp);

    const wildPower = calculatePower(wildMon.stats, wildMon.level);
    let levelBonus = partnerPower >= wildPower 
        ? Math.min(1.3, 1.0 + (partnerPower - wildPower) / 2000)
        : Math.max(0.5, 1.0 - (wildPower - partnerPower) / 1000);

    const catchRatePercent = hpFactor * wildMon.baseCatchRate * ballBonus * levelBonus;
    return Math.min(100, Math.max(1, catchRatePercent));
}

function getTrainingCost(level) {
    return Math.floor(10000 * Math.pow(level, 1.5));
}

wss.on('connection', (ws) => {
    let userId = null;

    ws.on('message', (raw) => {
        try {
            const data = JSON.parse(raw);

            if (data.type === 'INIT') {
                userId = data.nickname;
                if (!USERS[userId]) {
                    const defaultStats = calculateStats(4, 5);
                    USERS[userId] = {
                        nickname: userId,
                        gold: 10000,
                        balls: { poke: 5, super: 0, hyper: 0, master: 0 },
                        inventory: { '불꽃의 돌': 1, '물의 돌': 0, '리프의 돌': 0, '천둥의 돌': 0 },
                        partner: {
                            id: 4,
                            name: '파이리',
                            level: 5,
                            exp: 0,
                            maxExp: 100,
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
                ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: USERS[userId] }));
                broadcastUserList();
            }

            if (data.type === 'EXPLORE_FIELD') {
                const user = USERS[userId];
                user.location = '필드';
                const wildPool = [1, 4, 7, 25];
                const wildId = wildPool[Math.floor(Math.random() * wildPool.length)];
                const isShiny = Math.random() < (1 / 4096);
                const wildLevel = Math.max(1, user.partner.level + Math.floor(Math.random() * 5) - 2);
                const wildStats = calculateStats(wildId, wildLevel);

                user.activeWild = {
                    id: wildId,
                    name: POKEMON_DB[wildId].name,
                    level: wildLevel,
                    hp: wildStats.maxHp,
                    maxHp: wildStats.maxHp,
                    baseCatchRate: POKEMON_DB[wildId].baseCatchRate,
                    isShiny: isShiny,
                    stats: wildStats
                };

                ws.send(JSON.stringify({
                    type: 'WILD_SPAWN',
                    wild: user.activeWild,
                    user: user,
                    msg: `야생의 ${isShiny ? '✨이로치 ' : ''}${user.activeWild.name}이(가) 나타났다!`
                }));
                broadcastUserList();
            }

            if (data.type === 'ATTACK_WILD') {
                const user = USERS[userId];
                if (!user.activeWild) return;
                const damage = Math.floor(user.activeWild.maxHp * 0.35); 
                user.activeWild.hp = Math.max(1, user.activeWild.hp - damage);

                ws.send(JSON.stringify({
                    type: 'WILD_HP_UPDATE',
                    wildHp: user.activeWild.hp,
                    wildMaxHp: user.activeWild.maxHp,
                    msg: `${user.partner.name}의 공격! 야생 ${user.activeWild.name}의 체력이 감소했다!`
                }));
            }

            if (data.type === 'CATCH_ATTEMPT') {
                const user = USERS[userId];
                const ballType = data.ballType;
                if (!user.activeWild) return;
                if (user.balls[ballType] <= 0) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '선택한 몬스터볼이 부족합니다!' }));
                    return;
                }

                user.balls[ballType] -= 1;
                const partnerPower = calculatePower(user.partner.stats, user.partner.level);
                const catchChance = calculateCatchProbability(ballType, user.activeWild, partnerPower);
                const isCaught = (Math.random() * 100) < catchChance;

                if (isCaught) {
                    const caught = user.activeWild;
                    if (caught.isShiny && !user.partner.isShiny) {
                        user.partner.isShiny = true;
                        user.partner.affinity = 0.0;
                    } else {
                        user.partner.affinity = Math.min(100, user.partner.affinity + 0.5);
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
                const user = USERS[userId];
                const cost = getTrainingCost(user.partner.level);
                if (user.partner.fatigue >= 100) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '포켓몬이 지쳤습니다! 센터에서 치료하세요.' }));
                    return;
                }
                if (user.gold >= cost) {
                    user.gold -= cost;
                    user.partner.exp += 35;
                    user.partner.fatigue = Math.min(100, user.partner.fatigue + 15);
                    user.partner.affinity = Math.min(100, user.partner.affinity + 0.2);

                    if (user.partner.exp >= user.partner.maxExp) {
                        user.partner.level += 1;
                        user.partner.exp -= user.partner.maxExp;
                        user.partner.maxExp = Math.floor(user.partner.maxExp * 1.25);
                        user.partner.stats = calculateStats(user.partner.id, user.partner.level);
                        user.partner.hp = user.partner.stats.maxHp;
                    }
                    ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: user, msg: `훈련 완료! (-${cost.toLocaleString()}G)` }));
                } else {
                    ws.send(JSON.stringify({ type: 'LOG', msg: `골드가 부족합니다! (필요: ${cost.toLocaleString()}G)` }));
                }
            }

            if (data.type === 'HEAL') {
                const user = USERS[userId];
                user.partner.hp = user.partner.stats.maxHp;
                user.partner.fatigue = 0;
                ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: user, msg: '🏥 포켓몬이 치료되었습니다.' }));
            }

            if (data.type === 'EVOLVE') {
                const user = USERS[userId];
                const pInfo = POKEMON_DB[user.partner.id];

                if (!pInfo.nextEvo) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '이미 최종 진화 상태입니다.' }));
                    return;
                }
                if (user.inventory[pInfo.reqStone] <= 0) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: `진화에 [${pInfo.reqStone}]이 필요합니다.` }));
                    return;
                }

                user.inventory[pInfo.reqStone] -= 1;
                user.partner.id = pInfo.nextEvo;
                user.partner.name = POKEMON_DB[pInfo.nextEvo].name;
                user.partner.affinity = Math.max(0, user.partner.affinity * 0.7);
                user.partner.stats = calculateStats(user.partner.id, user.partner.level);
                user.partner.hp = user.partner.stats.maxHp;

                ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: user, msg: `✨ [${user.partner.name}](으)로 진화했습니다!` }));
            }
        } catch (err) {
            console.error('Error handling message:', err);
        }
    });

    function broadcastUserList() {
        const list = Object.values(USERS).map(u => ({
            nickname: u.nickname,
            location: u.location,
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