const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const SAVE_FILE_PATH = path.join(__dirname, 'save_data.json');

// 서버 시작 시 파일에서 유저 데이터 불러오기
let users = {};
if (fs.existsSync(SAVE_FILE_PATH)) {
    try {
        const rawData = fs.readFileSync(SAVE_FILE_PATH, 'utf-8');
        users = JSON.parse(rawData);
        console.log('💾 [데이터베이스] 저장된 유저 데이터를 성공적으로 로드했습니다.');
    } catch (e) {
        console.error('⚠️ 저장된 유저 데이터 로드 실패, 빈 데이터베이스로 시작합니다.', e);
    }
}

// 파일에 유저 데이터 영구 저장 함수
function saveGameData() {
    try {
        fs.writeFileSync(SAVE_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
        console.log('💾 [데이터베이스] 게임 데이터가 성공적으로 파일에 저장되었습니다.');
    } catch (e) {
        console.error('⚠️ 데이터 저장 중 오류 발생:', e);
    }
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// 💡 [중요] 미들웨어와 API 라우터는 정적 파일 및 게임 로직보다 먼저 위치해야 합니다.
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 🛠️ 관리자 삭제 API 엔드포인트
// ==========================================
app.post('/api/admin/reset', (req, res) => {
    const { userId } = req.body;
    if (userId && users[userId]) {
        delete users[userId];
        saveGameData(); // 파일 및 메모리에서 제거
        res.json({ success: true, msg: '성공적으로 유저 데이터가 초기화되었습니다.' });
    } else {
        res.status(404).json({ success: false, msg: '유저를 찾을 수 없습니다.' });
    }
});

// ==========================================
// 🛠️ 관리자 웹페이지 대시보드 라우터
// ==========================================
app.get('/admin', (req, res) => {
    let userRows = '';
    const allUsers = Object.values(users);

    if (allUsers.length === 0) {
        userRows = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #888;">현재 접속 중이거나 저장된 유저가 없습니다.</td></tr>`;
    } else {
        allUsers.forEach(u => {
            const p = u.partner || {};
            userRows += `
                <tr style="border-bottom: 1px solid #334155;">
                    <td style="padding: 10px; font-family: monospace; font-size: 12px; color: #94a3b8;">${u.id}</td>
                    <td style="padding: 10px; font-weight: bold; color: #f8fafc;">${u.nickname || '익명'}</td>
                    <td style="padding: 10px; color: #38bdf8;">${p.name || '없음'} (Lv.${p.level || 1})</td>
                    <td style="padding: 10px; color: #fbbf24;">${(u.gold || 0).toLocaleString()} G</td>
                    <td style="padding: 10px; color: #a78bfa;">${u.currentZoneName || '1지역'}</td>
                    <td style="padding: 10px; color: #cbd5e1;">${u.location || '마을'}</td>
                    <td style="padding: 10px; text-align: center;">
                        <button onclick="resetUser('${u.id}')" style="background-color: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;">초기화</button>
                    </td>
                </tr>
            `;
        });
    }

    const html = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <title>포켓몬 게임 관리자 대시보드</title>
        <style>
            body { background-color: #0f172a; color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; }
            .container { max-width: 1000px; margin: 0 auto; background: #1e293b; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); }
            h1 { font-size: 24px; margin-bottom: 20px; color: #38bdf8; display: flex; align-items: center; gap: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; background: #0f172a; border-radius: 8px; overflow: hidden; }
            th { background-color: #334155; color: #cbd5e1; padding: 12px; text-align: left; font-size: 13px; }
            .refresh-btn { background-color: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; float: right; }
            .refresh-btn:hover { background-color: #059669; }
        </style>
    </head>
    <body>
        <div class="container">
            <div>
                <button class="refresh-btn" onclick="location.reload()">🔄 새로고침</button>
                <h1>🎮 포켓몬 게임 유저 관리자 패널</h1>
            </div>
            <p style="color: #94a3b8; font-size: 13px;">현재 서버에 등록되어 있는 모든 트레이너 목록입니다. 특정 유저를 초기화하면 해당 유저는 처음부터 다시 시작하게 됩니다.</p>
            <table>
                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>닉네임</th>
                        <th>파트너 포켓몬</th>
                        <th>소유 골드</th>
                        <th>현재 지역</th>
                        <th>위치</th>
                        <th style="text-align: center;">관리</th>
                    </tr>
                </thead>
                <tbody>
                    ${userRows}
                </tbody>
            </table>
        </div>

        <script>
            function resetUser(userId) {
                if (confirm('정말로 이 유저 데이터를 완전히 초기화(삭제)하시겠습니까?')) {
                    fetch('/api/admin/reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: userId })
                    })
                    .then(res => res.json())
                    .then(data => {
                        alert(data.msg);
                        location.reload();
                    })
                    .catch(err => alert('초기화 실패: ' + err));
                }
            }
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

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
    // 1~9: 스타팅 라인업
    1:   { name: '이상해씨', type: 'grass', skillName: '🍃 덩굴채찍', maxPp: 15, reqLevel: 16, reqAffinity: 0, nextEvo: 2, reqStone: null, baseStats: { hp: 45, atk: 49, def: 49, spAtk: 65, spDef: 65, spd: 45 } },
    2:   { name: '이상해풀', type: 'grass', skillName: '🍃 잎날가르기', maxPp: 12, reqLevel: 32, reqAffinity: 100, nextEvo: 3, reqStone: '리프의 돌', baseStats: { hp: 60, atk: 62, def: 63, spAtk: 80, spDef: 80, spd: 60 } },
    3:   { name: '이상해꽃', type: 'grass', skillName: '🍃 솔라빔', maxPp: 8, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 80, atk: 82, def: 83, spAtk: 100, spDef: 100, spd: 80 } },
    4:   { name: '파이리',   type: 'fire',  skillName: '🔥 불꽃세례', maxPp: 15, reqLevel: 16, reqAffinity: 0, nextEvo: 5, reqStone: null, baseStats: { hp: 39, atk: 52, def: 43, spAtk: 60, spDef: 50, spd: 65 } },
    5:   { name: '리자드',   type: 'fire',  skillName: '🔥 화염방사', maxPp: 10, reqLevel: 36, reqAffinity: 100, nextEvo: 6, reqStone: '불꽃의 돌', baseStats: { hp: 58, atk: 64, def: 58, spAtk: 80, spDef: 65, spd: 80 } },
    6:   { name: '리자몽',   type: 'fire',  skillName: '🔥 불대문자', maxPp: 5, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 78, atk: 84, def: 78, spAtk: 109, spDef: 85, spd: 100 } },
    7:   { name: '꼬부기',   type: 'water', skillName: '💧 물대포', maxPp: 15, reqLevel: 16, reqAffinity: 0, nextEvo: 8, reqStone: null, baseStats: { hp: 44, atk: 48, def: 65, spAtk: 50, spDef: 64, spd: 43 } },
    8:   { name: '어니부기', type: 'water', skillName: '💧 거품광선', maxPp: 12, reqLevel: 36, reqAffinity: 100, nextEvo: 9, reqStone: '물의 돌', baseStats: { hp: 59, atk: 63, def: 80, spAtk: 65, spDef: 80, spd: 58 } },
    9:   { name: '거북왕',   type: 'water', skillName: '💧 하이드로펌프', maxPp: 8, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 79, atk: 83, def: 100, spAtk: 85, spDef: 105, spd: 78 } },

    // 10~20: 초반 벌레/새/설치류
    10:  { name: '캐터피',   type: 'bug',    skillName: '🕸️ 몸통박치기', maxPp: 20, reqLevel: 7, reqAffinity: 0, nextEvo: 11, reqStone: null, baseStats: { hp: 45, atk: 30, def: 35, spAtk: 20, spDef: 20, spd: 45 } },
    11:  { name: '단데기',   type: 'bug',    skillName: '🛡️ 단단해지기', maxPp: 30, reqLevel: 10, reqAffinity: 0, nextEvo: 12, reqStone: null, baseStats: { hp: 50, atk: 20, def: 55, spAtk: 25, spDef: 25, spd: 30 } },
    12:  { name: '버터플',   type: 'bug',    skillName: '🦋 환상빔',     maxPp: 12, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 45, def: 50, spAtk: 90, spDef: 80, spd: 70 } },
    13:  { name: '뿔충이',   type: 'bug',    skillName: '🐛 독침',       maxPp: 20, reqLevel: 7, reqAffinity: 0, nextEvo: 14, reqStone: null, baseStats: { hp: 40, atk: 35, def: 30, spAtk: 20, spDef: 20, spd: 50 } },
    14:  { name: '딱충이',   type: 'bug',    skillName: '🛡️ 단단해지기', maxPp: 30, reqLevel: 10, reqAffinity: 0, nextEvo: 15, reqStone: null, baseStats: { hp: 45, atk: 25, def: 50, spAtk: 25, spDef: 25, spd: 35 } },
    15:  { name: '독침붕',   type: 'bug',    skillName: '🐝 더블침',     maxPp: 15, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 90, def: 40, spAtk: 45, spDef: 80, spd: 75 } },
    16:  { name: '구구',     type: 'flying', skillName: '🌪️ 바람일으키기', maxPp: 20, reqLevel: 18, reqAffinity: 0, nextEvo: 17, reqStone: null, baseStats: { hp: 40, atk: 45, def: 40, spAtk: 35, spDef: 35, spd: 56 } },
    17:  { name: '피전트',   type: 'flying', skillName: '🌪️ 제비반환', maxPp: 15, reqLevel: 36, reqAffinity: 0, nextEvo: 18, reqStone: null, baseStats: { hp: 63, atk: 60, def: 55, spAtk: 50, spDef: 50, spd: 71 } },
    18:  { name: '피죤투',   type: 'flying', skillName: '🌪️ 폭풍',     maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 83, atk: 80, def: 75, spAtk: 70, spDef: 70, spd: 101 } },
    19:  { name: '꼬렛',     type: 'normal', skillName: '🦷 몸통박치기', maxPp: 20, reqLevel: 20, reqAffinity: 0, nextEvo: 20, reqStone: null, baseStats: { hp: 30, atk: 56, def: 35, spAtk: 25, spDef: 35, spd: 72 } },
    20:  { name: '레트라',   type: 'normal', skillName: '🦷 필살어금니', maxPp: 12, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 55, atk: 81, def: 60, spAtk: 50, spDef: 70, spd: 97 } },

    // 21~40
    21:  { name: '깨비참',   type: 'flying', skillName: '🌪️ 쪼기',       maxPp: 20, reqLevel: 20, reqAffinity: 0, nextEvo: 22, reqStone: null, baseStats: { hp: 40, atk: 60, def: 30, spAtk: 31, spDef: 31, spd: 70 } },
    22:  { name: '깨비드릴조', type: 'flying', skillName: '🌪️ 회전구멍파기', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 90, def: 65, spAtk: 61, spDef: 61, spd: 100 } },
    23:  { name: '아보',     type: 'poison', skillName: '🐍 독침',       maxPp: 20, reqLevel: 22, reqAffinity: 0, nextEvo: 24, reqStone: null, baseStats: { hp: 35, atk: 60, def: 44, spAtk: 40, spDef: 54, spd: 55 } },
    24:  { name: '아보크',   type: 'poison', skillName: '🐍 뱀눈초리',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 95, def: 69, spAtk: 65, spDef: 79, spd: 80 } },
    25:  { name: '피카츄',   type: 'electric', skillName: '⚡ 전기쇼크', maxPp: 15, reqLevel: 20, reqAffinity: 100, nextEvo: 26, reqStone: '천둥의 돌', baseStats: { hp: 35, atk: 55, def: 40, spAtk: 50, spDef: 50, spd: 90 } },
    26:  { name: '라이츄',   type: 'electric', skillName: '⚡ 10만볼트', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 90, def: 55, spAtk: 90, spDef: 80, spd: 110 } },
    27:  { name: '모래두지', type: 'rock',   skillName: '🪨 모래뿌리기', maxPp: 20, reqLevel: 22, reqAffinity: 0, nextEvo: 28, reqStone: null, baseStats: { hp: 50, atk: 75, def: 85, spAtk: 20, spDef: 30, spd: 40 } },
    28:  { name: '고지',     type: 'rock',   skillName: '🪨 바위베기',   maxPp: 12, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 75, atk: 100, def: 110, spAtk: 45, spDef: 55, spd: 65 } },
    29:  { name: '니드런♀',   type: 'poison', skillName: '🟣 독침',       maxPp: 20, reqLevel: 16, reqAffinity: 0, nextEvo: 30, reqStone: null, baseStats: { hp: 55, atk: 47, def: 52, spAtk: 40, spDef: 40, spd: 41 } },
    30:  { name: '니드리나', type: 'poison', skillName: '🟣 독엄니',     maxPp: 15, reqLevel: 36, reqAffinity: 100, nextEvo: 31, reqStone: '달의 돌', baseStats: { hp: 70, atk: 62, def: 67, spAtk: 55, spDef: 55, spd: 56 } },
    31:  { name: '니드퀸',   type: 'poison', skillName: '🟣 대지의힘',   maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 92, def: 87, spAtk: 75, spDef: 85, spd: 76 } },
    32:  { name: '니드런♂',   type: 'poison', skillName: '🟣 독침',       maxPp: 20, reqLevel: 16, reqAffinity: 0, nextEvo: 33, reqStone: null, baseStats: { hp: 46, atk: 57, def: 40, spAtk: 40, spDef: 40, spd: 50 } },
    33:  { name: '니드리노', type: 'poison', skillName: '🟣 뿔찌르기',   maxPp: 15, reqLevel: 36, reqAffinity: 100, nextEvo: 34, reqStone: '달의 돌', baseStats: { hp: 61, atk: 72, def: 57, spAtk: 55, spDef: 55, spd: 65 } },
    34:  { name: '니드킹',   type: 'poison', skillName: '🟣 megahorn',   maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 81, atk: 102, def: 77, spAtk: 85, spDef: 75, spd: 85 } },
    35:  { name: '삐삐',     type: 'normal', skillName: '🌙 핑거돔',     maxPp: 15, reqLevel: 20, reqAffinity: 100, nextEvo: 36, reqStone: '달의 돌', baseStats: { hp: 70, atk: 45, def: 48, spAtk: 60, spDef: 65, spd: 35 } },
    36:  { name: '픽시',     type: 'normal', skillName: '🌙 메트로놈',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 95, atk: 70, def: 73, spAtk: 95, spDef: 90, spd: 60 } },
    37:  { name: '식스테일', type: 'fire',   skillName: '🔥 불꽃세례',   maxPp: 15, reqLevel: 20, reqAffinity: 100, nextEvo: 38, reqStone: '불꽃의 돌', baseStats: { hp: 38, atk: 41, def: 40, spAtk: 50, spDef: 65, spd: 65 } },
    38:  { name: '나인테일', type: 'fire',   skillName: '🔥 불대문자',   maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 73, atk: 76, def: 75, spAtk: 81, spDef: 100, spd: 100 } },
    39:  { name: '푸린',     type: 'normal', skillName: '🎶 노래하기',   maxPp: 15, reqLevel: 20, reqAffinity: 100, nextEvo: 40, reqStone: '달의 돌', baseStats: { hp: 115, atk: 45, def: 20, spAtk: 45, spDef: 25, spd: 20 } },
    40:  { name: '푸크린',   type: 'normal', skillName: '🎶 하이퍼보이스', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 140, atk: 70, def: 45, spAtk: 85, spDef: 50, spd: 45 } },

    // 41~60
    41:  { name: '주뱃',     type: 'poison', skillName: '🦇 흡혈',       maxPp: 15, reqLevel: 22, reqAffinity: 0, nextEvo: 42, reqStone: null, baseStats: { hp: 40, atk: 45, def: 35, spAtk: 30, spDef: 40, spd: 55 } },
    42:  { name: '골뱃',     type: 'poison', skillName: '🦇 에어슬래시', maxPp: 12, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 75, atk: 80, def: 70, spAtk: 65, spDef: 75, spd: 90 } },
    43:  { name: '뚜벅쵸',   type: 'grass',  skillName: '🌱 흡수',       maxPp: 20, reqLevel: 21, reqAffinity: 0, nextEvo: 44, reqStone: null, baseStats: { hp: 45, atk: 50, def: 55, spAtk: 75, spDef: 65, spd: 30 } },
    44:  { name: '냄새꼬',   type: 'grass',  skillName: '🌱 저주가루',   maxPp: 12, reqLevel: 36, reqAffinity: 100, nextEvo: 45, reqStone: '리프의 돌', baseStats: { hp: 60, atk: 65, def: 70, spAtk: 85, spDef: 75, spd: 40 } },
    45:  { name: '라플레시아', type: 'grass', skillName: '🌱 솔라빔',     maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 75, atk: 80, def: 85, spAtk: 110, spDef: 90, spd: 50 } },
    46:  { name: '파라스',   type: 'bug',    skillName: '🍄 할퀴기',     maxPp: 20, reqLevel: 24, reqAffinity: 0, nextEvo: 47, reqStone: null, baseStats: { hp: 35, atk: 70, def: 55, spAtk: 45, spDef: 55, spd: 30 } },
    47:  { name: '파라섹트', type: 'bug',    skillName: '🍄 버섯포자',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 95, def: 80, spAtk: 60, spDef: 80, spd: 30 } },
    48:  { name: '콘팡',     type: 'bug',    skillName: '👁️ 몸통박치기', maxPp: 20, reqLevel: 31, reqAffinity: 0, nextEvo: 49, reqStone: null, baseStats: { hp: 60, atk: 55, def: 50, spAtk: 40, spDef: 55, spd: 45 } },
    49:  { name: '도나리',   type: 'bug',    skillName: '👁️ 환상빔',     maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 70, atk: 65, def: 60, spAtk: 90, spDef: 75, spd: 90 } },
    50:  { name: '디그다',   type: 'rock',   skillName: '🪨 모래영역',   maxPp: 20, reqLevel: 26, reqAffinity: 0, nextEvo: 51, reqStone: null, baseStats: { hp: 10, atk: 55, def: 30, spAtk: 35, spDef: 45, spd: 95 } },
    51:  { name: '닥트리오', type: 'rock',   skillName: '🪨 구멍파기',   maxPp: 12, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 35, atk: 100, def: 50, spAtk: 50, spDef: 70, spd: 120 } },
    52:  { name: '나옹',     type: 'normal', skillName: '💰 고양이돈받기', maxPp: 15, reqLevel: 28, reqAffinity: 0, nextEvo: 53, reqStone: null, baseStats: { hp: 40, atk: 45, def: 35, spAtk: 40, spDef: 40, spd: 90 } },
    53:  { name: '페르시온', type: 'normal', skillName: '💰 속이기',     maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 70, def: 60, spAtk: 65, spDef: 65, spd: 115 } },
    54:  { name: '고라파덕', type: 'water',  skillName: '🌀 염동력',     maxPp: 15, reqLevel: 33, reqAffinity: 0, nextEvo: 55, reqStone: null, baseStats: { hp: 50, atk: 52, def: 48, spAtk: 65, spDef: 50, spd: 55 } },
    55:  { name: '골덕',     type: 'water',  skillName: '🌀 하이드로펌프', maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 80, atk: 82, def: 78, spAtk: 95, spDef: 80, spd: 85 } },
    56:  { name: '망키',     type: 'normal', skillName: '🥊 태권왕',     maxPp: 20, reqLevel: 28, reqAffinity: 0, nextEvo: 57, reqStone: null, baseStats: { hp: 40, atk: 80, def: 35, spAtk: 35, spDef: 45, spd: 70 } },
    57:  { name: '성원숭',   type: 'normal', skillName: '🥊 인파이트',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 105, def: 60, spAtk: 60, spDef: 70, spd: 95 } },
    58:  { name: '가디',     type: 'fire',   skillName: '🔥 불꽃세례',   maxPp: 15, reqLevel: 30, reqAffinity: 100, nextEvo: 59, reqStone: '불꽃의 돌', baseStats: { hp: 55, atk: 70, def: 45, spAtk: 70, spDef: 50, spd: 60 } },
    59:  { name: '윈디',     type: 'fire',   skillName: '🔥 신속',       maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 110, def: 80, spAtk: 100, spDef: 80, spd: 95 } },
    60:  { name: '발챙이',   type: 'water',  skillName: '💧 물대포',     maxPp: 20, reqLevel: 25, reqAffinity: 0, nextEvo: 61, reqStone: null, baseStats: { hp: 40, atk: 50, def: 40, spAtk: 40, spDef: 40, spd: 90 } },

    // 61~80
    61:  { name: '슈륙챙이', type: 'water',  skillName: '💧 거품광선',   maxPp: 12, reqLevel: 36, reqAffinity: 100, nextEvo: 62, reqStone: '물의 돌', baseStats: { hp: 65, atk: 65, def: 65, spAtk: 50, spDef: 50, spd: 90 } },
    62:  { name: '강챙이',   type: 'water',  skillName: '💧 폭포오르기', maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 95, def: 95, spAtk: 70, spDef: 90, spd: 70 } },
    63:  { name: '케이시',   type: 'psychic', skillName: '🔮 순간이동',   maxPp: 20, reqLevel: 16, reqAffinity: 0, nextEvo: 64, reqStone: null, baseStats: { hp: 25, atk: 20, def: 15, spAtk: 105, spDef: 55, spd: 90 } },
    64:  { name: '윤겔라',   type: 'psychic', skillName: '🔮 사이코키네시스', maxPp: 12, reqLevel: 36, reqAffinity: 0, nextEvo: 65, reqStone: null, baseStats: { hp: 40, atk: 35, def: 30, spAtk: 120, spDef: 70, spd: 105 } },
    65:  { name: '후딘',     type: 'psychic', skillName: '🔮 미래예지',   maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 55, atk: 50, def: 45, spAtk: 135, spDef: 95, spd: 120 } },
    66:  { name: '알통몬',   type: 'normal', skillName: '🥊 태권왕',     maxPp: 20, reqLevel: 28, reqAffinity: 0, nextEvo: 67, reqStone: null, baseStats: { hp: 70, atk: 80, def: 50, spAtk: 35, spDef: 35, spd: 35 } },
    67:  { name: '근육몬',   type: 'normal', skillName: '🥊 크로스초프', maxPp: 12, reqLevel: 40, reqAffinity: 0, nextEvo: 68, reqStone: null, baseStats: { hp: 80, atk: 100, def: 70, spAtk: 50, spDef: 60, spd: 45 } },
    68:  { name: '괴력몬',   type: 'normal', skillName: '🥊 폭발펀치',   maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 130, def: 80, spAtk: 65, spDef: 85, spd: 55 } },
    69:  { name: '모다피',   type: 'grass',  skillName: '🍃 덩굴채찍',   maxPp: 20, reqLevel: 21, reqAffinity: 0, nextEvo: 70, reqStone: null, baseStats: { hp: 50, atk: 75, def: 35, spAtk: 70, spDef: 30, spd: 40 } },
    70:  { name: '우츠동',   type: 'grass',  skillName: '🍃 잎날가르기', maxPp: 12, reqLevel: 36, reqAffinity: 100, nextEvo: 71, reqStone: '리프의 돌', baseStats: { hp: 65, atk: 90, def: 50, spAtk: 85, spDef: 45, spd: 55 } },
    71:  { name: '우츠보트', type: 'grass',  skillName: '🍃 솔라빔',     maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 80, atk: 105, def: 65, spAtk: 100, spDef: 70, spd: 70 } },
    72:  { name: '왕눈해',   type: 'water',  skillName: '💧 독침',       maxPp: 20, reqLevel: 30, reqAffinity: 0, nextEvo: 73, reqStone: null, baseStats: { hp: 40, atk: 40, def: 35, spAtk: 50, spDef: 100, spd: 70 } },
    73:  { name: '독파리',   type: 'water',  skillName: '💧 하이드로펌프', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 80, atk: 70, def: 65, spAtk: 80, spDef: 120, spd: 100 } },
    74:  { name: '꼬마돌',   type: 'rock',   skillName: '🪨 돌날리기',   maxPp: 20, reqLevel: 25, reqAffinity: 0, nextEvo: 75, reqStone: null, baseStats: { hp: 40, atk: 80, def: 100, spAtk: 30, spDef: 30, spd: 20 } },
    75:  { name: '데구리',   type: 'rock',   skillName: '🪨 암석봉인',   maxPp: 12, reqLevel: 40, reqAffinity: 0, nextEvo: 76, reqStone: null, baseStats: { hp: 55, atk: 95, def: 115, spAtk: 45, spDef: 45, spd: 35 } },
    76:  { name: '딱구리',   type: 'rock',   skillName: '🪨 대폭발',     maxPp: 5,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 80, atk: 120, def: 130, spAtk: 55, spDef: 65, spd: 45 } },
    77:  { name: '포니타',   type: 'fire',   skillName: '🔥 불꽃세례',   maxPp: 20, reqLevel: 40, reqAffinity: 0, nextEvo: 78, reqStone: null, baseStats: { hp: 50, atk: 85, def: 55, spAtk: 65, spDef: 65, spd: 90 } },
    78:  { name: '날씽마',   type: 'fire',   skillName: '🔥 플레어드라이브', maxPp: 8, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 100, def: 70, spAtk: 80, spDef: 80, spd: 105 } },
    79:  { name: '야돈',     type: 'water',  skillName: '🌀 염동력',     maxPp: 20, reqLevel: 37, reqAffinity: 0, nextEvo: 80, reqStone: null, baseStats: { hp: 90, atk: 65, def: 65, spAtk: 40, spDef: 40, spd: 15 } },
    80:  { name: '야도란',   type: 'water',  skillName: '🌀 사이코키네시스', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 95, atk: 75, def: 110, spAtk: 100, spDef: 80, spd: 30 } },

    // 81~100
    81:  { name: '코일',     type: 'electric', skillName: '⚡ 전기쇼크', maxPp: 20, reqLevel: 30, reqAffinity: 0, nextEvo: 82, reqStone: null, baseStats: { hp: 25, atk: 35, def: 70, spAtk: 95, spDef: 55, spd: 45 } },
    82:  { name: '레어코일', type: 'electric', skillName: '⚡ 10만볼트', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 50, atk: 60, def: 95, spAtk: 120, spDef: 70, spd: 70 } },
    83:  { name: '파오리',   type: 'flying', skillName: '🌪️ 칼날베기',   maxPp: 15, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 52, atk: 90, def: 55, spAtk: 58, spDef: 62, spd: 60 } },
    84:  { name: '두두',     type: 'flying', skillName: '🌪️ 회전쪼기',   maxPp: 20, reqLevel: 31, reqAffinity: 0, nextEvo: 85, reqStone: null, baseStats: { hp: 35, atk: 85, def: 45, spAtk: 35, spDef: 35, spd: 75 } },
    85:  { name: '두트리오', type: 'flying', skillName: '🌪️ 브레이브버드', maxPp: 8, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 110, def: 70, spAtk: 60, spDef: 60, spd: 110 } },
    86:  { name: '쥬쥬',     type: 'water',  skillName: '💧 박치기',     maxPp: 20, reqLevel: 34, reqAffinity: 0, nextEvo: 87, reqStone: null, baseStats: { hp: 65, atk: 45, def: 55, spAtk: 45, spDef: 70, spd: 45 } },
    87:  { name: '쥬레곤',   type: 'water',  skillName: '💧 냉동빔',     maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 70, def: 80, spAtk: 70, spDef: 95, spd: 70 } },
    88:  { name: '질퍽이',   type: 'poison', skillName: '🟣 오물공격',   maxPp: 20, reqLevel: 38, reqAffinity: 0, nextEvo: 89, reqStone: null, baseStats: { hp: 80, atk: 80, def: 50, spAtk: 40, spDef: 50, spd: 25 } },
    89:  { name: '질뻐기',   type: 'poison', skillName: '🟣 오물폭탄',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 105, atk: 105, def: 75, spAtk: 65, spDef: 100, spd: 50 } },
    90:  { name: '셀러',     type: 'water',  skillName: '💧 물대포',     maxPp: 20, reqLevel: 20, reqAffinity: 100, nextEvo: 91, reqStone: '물의 돌', baseStats: { hp: 30, atk: 65, def: 100, spAtk: 45, spDef: 25, spd: 40 } },
    91:  { name: '파르셀',   type: 'water',  skillName: '💧 고드름침',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 50, atk: 95, def: 180, spAtk: 85, spDef: 45, spd: 70 } },
    92:  { name: '고스통',   type: 'poison', skillName: '🟣 핥기',       maxPp: 20, reqLevel: 25, reqAffinity: 0, nextEvo: 93, reqStone: null, baseStats: { hp: 30, atk: 35, def: 30, spAtk: 100, spDef: 35, spd: 80 } },
    93:  { name: '고스트',   type: 'poison', skillName: '🟣 섀도볼',     maxPp: 12, reqLevel: 40, reqAffinity: 0, nextEvo: 94, reqStone: null, baseStats: { hp: 45, atk: 50, def: 45, spAtk: 115, spDef: 55, spd: 95 } },
    94:  { name: '팬텀',     type: 'poison', skillName: '🟣 악몽',       maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 65, def: 60, spAtk: 130, spDef: 75, spd: 110 } },
    95:  { name: '롱스톤',   type: 'rock',   skillName: '🪨 암석봉인',   maxPp: 15, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 35, atk: 45, def: 160, spAtk: 30, spDef: 45, spd: 70 } },
    96:  { name: '슬프기',   type: 'psychic', skillName: '🔮 최면술',     maxPp: 20, reqLevel: 26, reqAffinity: 0, nextEvo: 97, reqStone: null, baseStats: { hp: 60, atk: 48, def: 45, spAtk: 43, spDef: 90, spd: 42 } },
    97:  { name: '슬리퍼',   type: 'psychic', skillName: '🔮 사이코키네시스', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 85, atk: 73, def: 70, spAtk: 73, spDef: 115, spd: 67 } },
    98:  { name: '크랩',     type: 'water',  skillName: '💧 거품',       maxPp: 20, reqLevel: 28, reqAffinity: 0, nextEvo: 99, reqStone: null, baseStats: { hp: 30, atk: 105, def: 90, spAtk: 25, spDef: 25, spd: 50 } },
    99:  { name: '킹크랩',   type: 'water',  skillName: '💧 집게해머',   maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 55, atk: 130, def: 115, spAtk: 50, spDef: 50, spd: 75 } },
    100: { name: '찌리리공', type: 'electric', skillName: '⚡ 스파크',   maxPp: 20, reqLevel: 30, reqAffinity: 0, nextEvo: 101, reqStone: null, baseStats: { hp: 40, atk: 30, def: 50, spAtk: 55, spDef: 55, spd: 100 } },

    // 101~120
    101: { name: '붐볼',     type: 'electric', skillName: '⚡ 자폭',     maxPp: 5,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 50, def: 70, spAtk: 80, spDef: 80, spd: 150 } },
    102: { name: '아라리',   type: 'grass',  skillName: '🍃 씨뿌리기',   maxPp: 20, reqLevel: 20, reqAffinity: 100, nextEvo: 103, reqStone: '리프의 돌', baseStats: { hp: 60, atk: 40, def: 80, spAtk: 60, spDef: 45, spd: 40 } },
    103: { name: '나시',     type: 'grass',  skillName: '🍃 사이코키네시스', maxPp: 8, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 95, atk: 95, def: 85, spAtk: 125, spDef: 75, spd: 55 } },
    104: { name: '탕구리',   type: 'rock',   skillName: '🪨 뼈다귀치기', maxPp: 20, reqLevel: 28, reqAffinity: 0, nextEvo: 105, reqStone: null, baseStats: { hp: 50, atk: 50, def: 95, spAtk: 40, spDef: 50, spd: 35 } },
    105: { name: '텅구리',   type: 'rock',   skillName: '🪨 본부메랑',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 80, def: 110, spAtk: 50, spDef: 80, spd: 45 } },
    106: { name: '시라소몬', type: 'normal', skillName: '🥊 무릎차기',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 50, atk: 120, def: 53, spAtk: 35, spDef: 110, spd: 87 } },
    107: { name: '홍수몬',   type: 'normal', skillName: '🥊 마하펀치',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 50, atk: 105, def: 79, spAtk: 35, spDef: 110, spd: 76 } },
    108: { name: '내루미',   type: 'normal', skillName: '👅 핥기',       maxPp: 15, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 55, def: 75, spAtk: 60, spDef: 75, spd: 30 } },
    109: { name: '또가스',   type: 'poison', skillName: '🟣 독가스',     maxPp: 20, reqLevel: 35, reqAffinity: 0, nextEvo: 110, reqStone: null, baseStats: { hp: 40, atk: 65, def: 95, spAtk: 60, spDef: 45, spd: 35 } },
    110: { name: '또도가스', type: 'poison', skillName: '🟣 오물폭탄',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 90, def: 120, spAtk: 85, spDef: 70, spd: 60 } },
    111: { name: '뿔카노',   type: 'rock',   skillName: '🪨 뿔찌르기',   maxPp: 20, reqLevel: 42, reqAffinity: 0, nextEvo: 112, reqStone: null, baseStats: { hp: 80, atk: 85, def: 95, spAtk: 30, spDef: 30, spd: 25 } },
    112: { name: '코뿌리',   type: 'rock',   skillName: '🪨 암석해머',   maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 105, atk: 130, def: 120, spAtk: 45, spDef: 45, spd: 40 } },
    113: { name: '럭키',     type: 'normal', skillName: '💖 알낳기',     maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 250, atk: 5, def: 5, spAtk: 35, spDef: 105, spd: 50 } },
    114: { name: '덩쿠리',   type: 'grass',  skillName: '🍃 덩굴채찍',   maxPp: 15, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 55, def: 115, spAtk: 100, spDef: 40, spd: 60 } },
    115: { name: '캥카',     type: 'normal', skillName: '🥊 잼잼펀치',   maxPp: 12, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 105, atk: 95, def: 80, spAtk: 40, spDef: 80, spd: 90 } },
    116: { name: '쏘드라',   type: 'water',  skillName: '💧 물대포',     maxPp: 20, reqLevel: 32, reqAffinity: 0, nextEvo: 117, reqStone: null, baseStats: { hp: 30, atk: 40, def: 70, spAtk: 70, spDef: 25, spd: 60 } },
    117: { name: '시드라',   type: 'water',  skillName: '💧 하이드로펌프', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 55, atk: 65, def: 95, spAtk: 95, spDef: 45, spd: 85 } },
    118: { name: '콘치',     type: 'water',  skillName: '💧 뿔찌르기',   maxPp: 20, reqLevel: 33, reqAffinity: 0, nextEvo: 119, reqStone: null, baseStats: { hp: 45, atk: 67, def: 60, spAtk: 35, spDef: 50, spd: 63 } },
    119: { name: '왕콘치',   type: 'water',  skillName: '💧 폭포오르기', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 80, atk: 92, def: 65, spAtk: 65, spDef: 80, spd: 68 } },
    120: { name: '별가사리', type: 'water',  skillName: '💧 물대포',     maxPp: 20, reqLevel: 20, reqAffinity: 100, nextEvo: 121, reqStone: '물의 돌', baseStats: { hp: 30, atk: 45, def: 55, spAtk: 70, spDef: 55, spd: 85 } },

    // 121~140
    121: { name: '아쿠스타', type: 'water',  skillName: '💧 하이드로펌프', maxPp: 8,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 75, def: 85, spAtk: 100, spDef: 85, spd: 115 } },
    122: { name: '마임맨',   type: 'psychic', skillName: '🔮 빛의장막',   maxPp: 12, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 40, atk: 45, def: 65, spAtk: 100, spDef: 120, spd: 90 } },
    123: { name: '스컬지',   type: 'bug',    skillName: '⚔️ 연속베기',   maxPp: 15, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 70, atk: 110, def: 80, spAtk: 55, spDef: 80, spd: 105 } },
    124: { name: '루주라',   type: 'psychic', skillName: '🔮 악마의키스', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 50, def: 35, spAtk: 115, spDef: 95, spd: 95 } },
    125: { name: '에레브',   type: 'electric', skillName: '⚡ 번개펀치', maxPp: 12, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 83, def: 57, spAtk: 95, spDef: 85, spd: 105 } },
    126: { name: '마그마',   type: 'fire',   skillName: '🔥 화염펀치',   maxPp: 12, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 95, def: 57, spAtk: 100, spDef: 85, spd: 93 } },
    127: { name: '쁘사이저', type: 'bug',    skillName: '⚔️ 가위자르기', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 125, def: 100, spAtk: 55, spDef: 70, spd: 85 } },
    128: { name: '켄타로스', type: 'normal', skillName: '🐂 돌진',       maxPp: 12, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 75, atk: 100, def: 95, spAtk: 40, spDef: 70, spd: 110 } },
    129: { name: '잉어킹',  type: 'water',  skillName: '💦 튀어오르기', maxPp: 30, reqLevel: 20, reqAffinity: 0, nextEvo: 130, reqStone: null, baseStats: { hp: 20, atk: 10, def: 55, spAtk: 15, spDef: 20, spd: 80 } },
    130: { name: '갸라도스', type: 'water',  skillName: '🐉 파괴광선',   maxPp: 5,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 95, atk: 125, def: 79, spAtk: 60, spDef: 100, spd: 81 } },
    131: { name: '라프라스', type: 'water',  skillName: '💧 절대영도',   maxPp: 5,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 130, atk: 85, def: 80, spAtk: 85, spDef: 95, spd: 60 } },
    132: { name: '메타몽',   type: 'normal', skillName: '✨ 변신',       maxPp: 20, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 48, atk: 48, def: 48, spAtk: 48, spDef: 48, spd: 48 } },
    133: { name: '이브이',   type: 'normal', skillName: '🦊 몸통박치기', maxPp: 20, reqLevel: 20, reqAffinity: 100, nextEvo: 134, reqStone: '물의 돌', baseStats: { hp: 55, atk: 55, def: 50, spAtk: 45, spDef: 65, spd: 55 } },
    134: { name: '샤미드',   type: 'water',  skillName: '💧 하이드로펌프', maxPp: 8, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 130, atk: 65, def: 60, spAtk: 110, spDef: 95, spd: 65 } },
    135: { name: '쥬피썬더', type: 'electric', skillName: '⚡ 10만볼트', maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 65, def: 60, spAtk: 110, spDef: 95, spd: 130 } },
    136: { name: '부스터',   type: 'fire',   skillName: '🔥 화염방사',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 130, def: 60, spAtk: 95, spDef: 110, spd: 65 } },
    137: { name: '폴리곤',   type: 'normal', skillName: '💻 텍스처',     maxPp: 15, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 65, atk: 60, def: 70, spAtk: 85, spDef: 75, spd: 40 } },
    138: { name: '암나이트', type: 'rock',   skillName: '🪨 물대포',     maxPp: 20, reqLevel: 40, reqAffinity: 0, nextEvo: 139, reqStone: null, baseStats: { hp: 35, atk: 40, def: 100, spAtk: 90, spDef: 55, spd: 35 } },
    139: { name: '암스타',   type: 'rock',   skillName: '🪨 원시의힘',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 70, atk: 60, def: 125, spAtk: 115, spDef: 70, spd: 55 } },
    140: { name: '투구',     type: 'rock',   skillName: '🪨 할퀴기',     maxPp: 20, reqLevel: 40, reqAffinity: 0, nextEvo: 141, reqStone: null, baseStats: { hp: 30, atk: 80, def: 90, spAtk: 55, spDef: 45, spd: 55 } },

    // 141~151 (희귀 & 전설)
    141: { name: '투구푸스', type: 'rock',   skillName: '🪨 스톤샤워',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 60, atk: 115, def: 105, spAtk: 65, spDef: 70, spd: 80 } },
    142: { name: '프테라',   type: 'rock',   skillName: '🪨 원시의힘',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 80, atk: 105, def: 65, spAtk: 60, spDef: 75, spd: 130 } },
    143: { name: '잠만보',   type: 'normal', skillName: '💤 누르기',     maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 160, atk: 110, def: 65, spAtk: 65, spDef: 110, spd: 30 } },
    144: { name: '프리저',   type: 'flying', skillName: '❄️ 눈보라',     maxPp: 5,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 85, def: 100, spAtk: 95, spDef: 125, spd: 85 } },
    145: { name: '썬더',     type: 'electric', skillName: '⚡ 번개',     maxPp: 5,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 90, def: 85, spAtk: 125, spDef: 90, spd: 100 } },
    146: { name: '파이어',   type: 'fire',   skillName: '🔥 불대문자',   maxPp: 5,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 90, atk: 100, def: 90, spAtk: 125, spDef: 85, spd: 90 } },
    147: { name: '미뇽',     type: 'dragon', skillName: '🐉 용의분노',   maxPp: 15, reqLevel: 30, reqAffinity: 0, nextEvo: 148, reqStone: null, baseStats: { hp: 41, atk: 64, def: 45, spAtk: 50, spDef: 50, spd: 50 } },
    148: { name: '신뇽',     type: 'dragon', skillName: '🐉 용의파동',   maxPp: 10, reqLevel: 55, reqAffinity: 0, nextEvo: 149, reqStone: null, baseStats: { hp: 61, atk: 84, def: 65, spAtk: 70, spDef: 70, spd: 70 } },
    149: { name: '망나뇽',   type: 'dragon', skillName: '🐉 역린',       maxPp: 5,  reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 91, atk: 134, def: 95, spAtk: 100, spDef: 100, spd: 80 } },
    150: { name: '뮤츠',     type: 'psychic', skillName: '🔮 사이코스트라이크', maxPp: 5, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 106, atk: 110, def: 90, spAtk: 154, spDef: 90, spd: 130 } },
    151: { name: '뮤',       type: 'psychic', skillName: '✨ 미라이트',   maxPp: 10, reqLevel: 99, reqAffinity: 0, nextEvo: null, reqStone: null, baseStats: { hp: 100, atk: 100, def: 100, spAtk: 100, spDef: 100, spd: 100 } }
};

// 관동 지방 8개 지역 & 관장 보스 스폰 구성
const ZONES = {
    1: { id: 1, name: '1지역 - 회색시티 & 1, 2번 도로', minLevel: 2, maxLevel: 8, pool: [10, 11, 13, 14, 16, 19, 21, 29, 32, 43, 69, 1], bossId: 95, bossLevel: 10, bossName: '체육관 관장 웅이 (롱스톤)', nextZoneId: 2 },
    2: { id: 2, name: '2지역 - 블루시티 & 달맞이산', minLevel: 9, maxLevel: 16, pool: [23, 27, 35, 39, 41, 46, 48, 50, 74, 102, 4, 7], bossId: 121, bossLevel: 18, bossName: '체육관 관장 이슬이 (아쿠스타)', nextZoneId: 3 },
    3: { id: 3, name: '3지역 - 갈색시티 & 디그다 동굴', minLevel: 17, maxLevel: 24, pool: [12, 15, 17, 20, 22, 25, 52, 54, 56, 58, 60, 63, 66], bossId: 26, bossLevel: 26, bossName: '체육관 관장 마티스 (라이츄)', nextZoneId: 4 },
    4: { id: 4, name: '4지역 - 무지개시티 & 포켓몬 타워', minLevel: 25, maxLevel: 32, pool: [24, 28, 30, 33, 42, 44, 70, 72, 75, 81, 84, 88, 92, 93, 96, 133], bossId: 45, bossLevel: 34, bossName: '체육관 관장 민화 (라플레시아)', nextZoneId: 5 },
    5: { id: 5, name: '5지역 - 연분홍시티 & 사파리존', minLevel: 33, maxLevel: 40, pool: [36, 38, 40, 47, 49, 51, 53, 55, 57, 61, 64, 67, 77, 79, 86, 90, 98, 100, 104, 109, 111, 114, 115, 128], bossId: 89, bossLevel: 42, bossName: '체육관 관장 독수 (질뻐기)', nextZoneId: 6 },
    6: { id: 6, name: '6지역 - 노랑시티 & 실프주식회사', minLevel: 41, maxLevel: 48, pool: [18, 31, 34, 59, 62, 71, 73, 78, 80, 82, 83, 85, 87, 101, 105, 108, 110, 112, 116, 117, 118, 119, 122, 137, 143, 147], bossId: 65, bossLevel: 50, bossName: '체육관 관장 초련 (후딘)', nextZoneId: 7 },
    7: { id: 7, name: '7지역 - 홍련섬 & 포켓몬 저택', minLevel: 49, maxLevel: 56, pool: [2, 5, 8, 76, 89, 91, 94, 97, 99, 103, 106, 107, 113, 120, 123, 124, 125, 126, 127, 129, 130, 131, 138, 140, 148], bossId: 126, bossLevel: 58, bossName: '체육관 관장 강재 (마그마)', nextZoneId: 8 },
    8: { id: 8, name: '8지역 - 상록시티 & 챔피언로드 (석영고원)', minLevel: 57, maxLevel: 70, pool: [3, 6, 9, 134, 135, 136, 139, 141, 142, 144, 145, 146, 149, 150, 151], bossId: 34, bossLevel: 75, bossName: '최종 관장 비주기 (니드킹)', nextZoneId: null }
};

function calculateStats(pokemonId, level) {
    const base = POKEMON_DB[pokemonId].baseStats;
    return {
        maxHp: Math.floor((base.hp * 2 * level) / 100) + level + 10,
        atk: Math.floor((base.atk * 2 * level) / 100) + 5,
        def: Math.floor((base.def * 2 * level) / 100) + 5,
        spAtk: Math.floor((base.spAtk * 2 * level) / 100) + 5,
        spDef: Math.floor((base.spDef * 2 * level) / 100) + 5,
        spd: Math.floor((base.spd * 2 * level) / 100) + 5
    };
}

function calculateCP(stats) {
    return Math.floor((stats.maxHp * 1.5) + stats.atk + stats.def + stats.spAtk + stats.spDef + stats.spd);
}

function checkNeedsHeal(user) {
    return user.partner.hp <= 0;
}

function broadcastUserList() {
    const list = Object.values(users).map(u => ({
        id: u.id,
        nickname: u.nickname,
        partnerName: u.partner.name,
        partnerLevel: u.partner.level,
        cp: calculateCP(u.partner.stats),
        zoneName: u.currentZoneName
    }));

    const msg = JSON.stringify({ type: 'SIDEBAR_LIST', users: list });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

wss.on('connection', (ws) => {
    let userId = null;

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            return;
        }

        if (data.type === 'INIT') {
            if (data.savedUserId && users[data.savedUserId]) {
                userId = data.savedUserId;
                if (data.nickname) {
                    users[userId].nickname = data.nickname;
                }
                users[userId].activeWild = null;
                users[userId].location = '마을';

                ws.send(JSON.stringify({
                    type: 'STATE_UPDATE',
                    user: users[userId],
                    savedUserId: userId,
                    msg: `🎉 [${users[userId].nickname}]님, 모험을 재개합니다! (파트너: ${users[userId].partner.name} Lv.${users[userId].partner.level})`
                }));

                saveGameData();
                broadcastUserList();
                return;
            }

            userId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            const starterId = parseInt(data.starterId) || 1;
            const starterInfo = POKEMON_DB[starterId];
            const initialStats = calculateStats(starterId, 5);

            users[userId] = {
                id: userId,
                nickname: data.nickname || '트레이너',
                gold: 5000,
                balls: { poke: 10, super: 3, hyper: 1 },
                inventory: { '리프의 돌': 1, '불꽃의 돌': 1, '물의 돌': 1, '천둥의 돌': 1, '달의 돌': 1 },
                currentZone: 1,
                currentZoneName: ZONES[1].name,
                unlockedZones: [1],
                location: '마을',
                partner: {
                    id: starterId,
                    name: starterInfo.name,
                    type: starterInfo.type,
                    level: 5,
                    exp: 0,
                    maxExp: 100,
                    hp: initialStats.maxHp,
                    stats: initialStats,
                    skillName: starterInfo.skillName,
                    pp: starterInfo.maxPp,
                    maxPp: starterInfo.maxPp,
                    affinity: 10.0
                },
                caughtList: [],
                activeWild: null
            };

            ws.send(JSON.stringify({
                type: 'STATE_UPDATE',
                user: users[userId],
                savedUserId: userId,
                msg: `🎮 환영합니다, ${users[userId].nickname}님! 파트너 [${starterInfo.name}]와 함께 모험을 시작합니다.`
            }));

            saveGameData();
            broadcastUserList();
            return;
        }

        const user = users[userId];
        if (!user) return;

        if (data.type === 'EXPLORE_FIELD') {
            if (checkNeedsHeal(user)) {
                ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 체력이 없습니다! 센터에서 치료하세요.' }));
                return;
            }

            user.location = '필드';
            const zone = ZONES[user.currentZone];
            const wildId = zone.pool[Math.floor(Math.random() * zone.pool.length)];
            
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
                stats: wildStats,
                isShiny: isShiny,
                isBoss: false
            };

            ws.send(JSON.stringify({
                type: 'WILD_SPAWN',
                user: user,
                wild: user.activeWild,
                msg: `🌿 야생의 ${isShiny ? '✨이로치 ' : ''}[${user.activeWild.name}] (Lv.${wildLevel})이(가) 나타났다!`
            }));
        }

        if (data.type === 'BATTLE_ACTION') {
            if (!user.activeWild) return;

            const partner = user.partner;
            const wild = user.activeWild;
            const action = data.action;

            if (action === 'RUN') {
                user.activeWild = null;
                user.location = '마을';
                ws.send(JSON.stringify({
                    type: 'BATTLE_END',
                    user: user,
                    msg: '🏃 성공적으로 도망쳤습니다.'
                }));
                return;
            }

            let partnerDmg = 0;
            let logMsg = '';

            if (action === 'ATTACK') {
                const eff = getTypeEffectiveness(partner.type, wild.type);
                partnerDmg = Math.max(1, Math.floor((partner.stats.atk - wild.stats.def * 0.5) * eff));
                logMsg = `⚔️ [${partner.name}]의 기본 공격! (${partnerDmg} 데미지)`;
                if (eff > 1.0) logMsg += ' (효과가 뛰어났다!)';
                else if (eff < 1.0) logMsg += ' (효과가 별로인 듯하다...)';
            } else if (action === 'SKILL') {
                if (partner.pp <= 0) {
                    ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 스킬 PP가 부족합니다!' }));
                    return;
                }
                partner.pp -= 1;
                const eff = getTypeEffectiveness(partner.type, wild.type);
                partnerDmg = Math.max(1, Math.floor((partner.stats.spAtk * 1.3 - wild.stats.spDef * 0.4) * eff));
                logMsg = `✨ [${partner.name}]의 [${partner.skillName}]! (${partnerDmg} 데미지)`;
            } else if (action === 'DEFEND') {
                logMsg = `🛡️ [${partner.name}]이(가) 방어 자세를 취했습니다.`;
            }

            wild.hp = Math.max(0, wild.hp - partnerDmg);

            if (wild.hp <= 0) {
                const expGained = wild.level * 15;
                const goldGained = wild.level * 80 + (wild.isBoss ? 2000 : 0);

                partner.exp += expGained;
                user.gold += goldGained;
                partner.affinity = Math.min(100.0, partner.affinity + 0.5);

                logMsg += `\n🎉 야생 포켓몬을 쓰러뜨렸습니다! (+${expGained} EXP, +${goldGained}G, 친밀도 +0.5%)`;

                if (partner.exp >= partner.maxExp) {
                    partner.level += 1;
                    partner.exp -= partner.maxExp;
                    partner.maxExp = Math.floor(partner.maxExp * 1.25);
                    partner.stats = calculateStats(partner.id, partner.level);
                    partner.hp = partner.stats.maxHp;
                    logMsg += ` 🌟 레벨 업! (Lv.${partner.level})`;
                }

                if (wild.isBoss) {
                    const currentZoneObj = ZONES[user.currentZone];
                    if (currentZoneObj.nextZoneId && !user.unlockedZones.includes(currentZoneObj.nextZoneId)) {
                        user.unlockedZones.push(currentZoneObj.nextZoneId);
                        logMsg += `\n🏆 보스를 격파하여 다음 지역이 해금되었습니다!`;
                    }
                }

                user.activeWild = null;
                user.location = '마을';

                saveGameData();
                ws.send(JSON.stringify({
                    type: 'BATTLE_END',
                    user: user,
                    msg: logMsg
                }));
                broadcastUserList();
                return;
            }

            let wildDmg = Math.max(1, Math.floor(wild.stats.atk - partner.stats.def * 0.5));
            if (action === 'DEFEND') wildDmg = Math.floor(wildDmg * 0.4);

            partner.hp = Math.max(0, partner.hp - wildDmg);
            logMsg += `\n💥 야생 [${wild.name}]의 반격! (${wildDmg} 데미지 받음)`;

            if (partner.hp <= 0) {
                user.activeWild = null;
                user.location = '마을';
                logMsg += `\n💀 파트너 포켓몬이 쓰러졌습니다! 센터에서 치료받으세요.`;
                saveGameData();
                ws.send(JSON.stringify({
                    type: 'BATTLE_END',
                    user: user,
                    msg: logMsg
                }));
                broadcastUserList();
                return;
            }

            ws.send(JSON.stringify({
                type: 'WILD_HP_UPDATE',
                wildHp: wild.hp,
                wildMaxHp: wild.maxHp,
                partnerHp: partner.hp,
                partnerMaxHp: partner.stats.maxHp,
                attacker: 'partner',
                msg: logMsg
            }));
        }

        if (data.type === 'CATCH_ATTEMPT') {
            if (!user.activeWild) return;

            const ballType = data.ballType || 'poke';
            if ((user.balls[ballType] || 0) <= 0) {
                ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 해당 몬스터볼이 부족합니다!' }));
                return;
            }

            user.balls[ballType] -= 1;

            const wild = user.activeWild;
            const ballBonus = { poke: 1.0, super: 1.5, hyper: 2.0 }[ballType] || 1.0;
            const hpRatio = wild.hp / wild.maxHp;
            const catchRate = Math.min(0.95, (1.0 - hpRatio * 0.7) * ballBonus);

            if (Math.random() < catchRate) {
                user.caughtList.push({
                    id: wild.id,
                    name: wild.name,
                    level: wild.level,
                    isShiny: wild.isShiny
                });

                user.gold += wild.level * 100;
                user.partner.affinity = Math.min(100.0, user.partner.affinity + 1.0);

                const catchMsg = `🎯 축하합니다! ${wild.isShiny ? '✨이로치 ' : ''}[${wild.name}] 포획에 성공했습니다! (+${wild.level * 100}G, 친밀도 +1%)`;
                user.activeWild = null;
                user.location = '마을';

                saveGameData();
                ws.send(JSON.stringify({
                    type: 'CATCH_SUCCESS',
                    user: user,
                    msg: catchMsg
                }));
                broadcastUserList();
            } else {
                ws.send(JSON.stringify({
                    type: 'CATCH_FAIL',
                    msg: `💨 [${wild.name}]이(가) 몬스터볼을 튀겨냈습니다!`
                }));
            }
        }

        if (data.type === 'CHALLENGE_BOSS') {
            if (user.activeWild) {
                ws.send(JSON.stringify({ type: 'LOG', msg: '⚠️ 이미 전투 진행 중입니다!' }));
                return;
            }
            if (checkNeedsHeal(user)) {
                ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 체력이 없습니다! 센터에서 치료하세요.' }));
                return;
            }

            const zone = ZONES[user.currentZone];
            const bossStats = calculateStats(zone.bossId, zone.bossLevel);

            user.location = '보스전';
            user.activeWild = {
                id: zone.bossId,
                name: zone.bossName,
                type: POKEMON_DB[zone.bossId].type,
                level: zone.bossLevel,
                hp: bossStats.maxHp,
                maxHp: bossStats.maxHp,
                stats: bossStats,
                isShiny: false,
                isBoss: true
            };

            ws.send(JSON.stringify({
                type: 'WILD_SPAWN',
                user: user,
                wild: user.activeWild,
                msg: `👑 [${zone.name}] 보스전에 도전합니다! 보스: [${zone.bossName}]`
            }));
        }

        if (data.type === 'REQ_ZONE_INFO') {
            ws.send(JSON.stringify({
                type: 'ZONE_INFO',
                zones: Object.values(ZONES).map(z => ({
                    id: z.id,
                    name: z.name,
                    minLevel: z.minLevel,
                    maxLevel: z.maxLevel,
                    bossName: z.bossName
                })),
                unlockedZones: user.unlockedZones,
                currentZone: user.currentZone
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

            const unlocked = user.unlockedZones.map(id => parseInt(id, 10));
            if (unlocked.includes(targetZoneId) && ZONES[targetZoneId]) {
                user.currentZone = targetZoneId;
                user.currentZoneName = ZONES[targetZoneId].name;
                user.location = '마을';
                user.activeWild = null;

                saveGameData();
                ws.send(JSON.stringify({
                    type: 'STATE_UPDATE',
                    user: user,
                    msg: `🗺️ [${user.currentZoneName}](으)로 이동했습니다.`
                }));
                broadcastUserList();
            } else {
                ws.send(JSON.stringify({
                    type: 'LOG',
                    msg: '❌ 아직 해금되지 않은 지역입니다. 이전 지역 보스를 먼저 처치하세요!'
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

                saveGameData();
                ws.send(JSON.stringify({ type: 'STATE_UPDATE', user: user, msg: msg }));
                broadcastUserList();
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

                saveGameData();
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
                ws.send(JSON.stringify({ type: 'LOG', msg: '❌ 이미 최종 진화 상태이거나 진화가 불가능한 포켓몬입니다.' }));
                return;
            }

            if (user.partner.level < pInfo.reqLevel) {
                ws.send(JSON.stringify({ type: 'LOG', msg: `❌ 레벨이 부족합니다! (필요 레벨: Lv.${pInfo.reqLevel}, 현재: Lv.${user.partner.level})` }));
                return;
            }

            const currentAffinity = user.partner.affinity || 0;
            const reqAff = pInfo.reqAffinity || 0;
            if (reqAff > 0 && currentAffinity < reqAff) {
                ws.send(JSON.stringify({ type: 'LOG', msg: `❌ 친밀도가 부족합니다! (필요 친밀도: ${reqAff}%, 현재: ${Math.floor(currentAffinity)}%)` }));
                return;
            }

            if (pInfo.reqStone && (user.inventory[pInfo.reqStone] || 0) <= 0) {
                ws.send(JSON.stringify({ type: 'LOG', msg: `❌ 진화에 [${pInfo.reqStone}] 아이템이 필요합니다.` }));
                return;
            }

            if (pInfo.reqStone) {
                user.inventory[pInfo.reqStone] -= 1;
                if (user.inventory[pInfo.reqStone] <= 0) {
                    delete user.inventory[pInfo.reqStone];
                }
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

            saveGameData();
            ws.send(JSON.stringify({ 
                type: 'STATE_UPDATE', 
                user: user, 
                msg: `✨ 축하합니다! 파트너 포켓몬이 [${user.partner.name}](으)로 진화했습니다!` 
            }));
            broadcastUserList();
        }

        if (data.type === 'REQ_POKEDEX_INFO') {
            ws.send(JSON.stringify({
                type: 'POKEDEX_INFO',
                caughtList: user.caughtList
            }));
        }
    });

    ws.on('close', () => {
        if (userId && users[userId]) {
            saveGameData();
            delete users[userId];
            broadcastUserList();
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 포켓몬 멀티플레이어 서버가 ${PORT} 포트에서 실행 중입니다.`);
});
