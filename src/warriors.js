// Expansion: Silverblood warriors.
//
// Recruitable named warriors with random stats, Fire Emblem-style growth
// rates, perks, temperament and loyalty. Only these warriors can Awaken:
// each has a personal meter and a hidden breaking point. Warriors can be
// rested, pushed to Full Power, handed a Black Card, retired, dismissed,
// killed (with a chance to defy death), Awaken into named bosses, or come
// back later as veterans or as enemies.
//
// State: global.race.warriors (per run), global.stats.silver_hall (across runs).

import { global, sizeApproximation } from './vars.js';
import { loc } from './locale.js';
import { vBind, messageQueue, clearElement } from './functions.js';
import { yokiActive, yokiState, hallsFunded, abyssVars } from './silverblood.js';
import { traits } from './races.js';
import { armyRating, garrisonSize } from './civics.js';

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

export const warriorVars = {
    stats: ['str','spd','ctl','sns','wil'],
    maxSlots: 8,
    poolSize: 3,
    poolRefreshDays: 30,
    refreshCostPct: 0.1,      // paid refresh, share of the average fee
    feeMin: 400,
    feeMoneyPct: 0.2,         // fee scales with your Money cap
    wagePct: 0.01,            // daily wage, share of the hiring fee
    wageLevelPct: 0.08,       // +8% wage per level above 1
    xpPerLevel: 100,
    maxLevel: 20,
    growMin: 2,               // stat gain on a successful growth roll
    growMax: 5,
    restCooldown: 120,        // seconds between rest/activate switches
    restDecay: 3,             // personal meter lost per day while resting
    activeGain: 0.12,         // personal meter gained per day while active
    armyDivisor: 800,         // army bonus = total might / this
    senseDivisor: 500,        // hunt damage bonus = total sense / this
    willDivisor: 1000,        // army stress reduction = total will / this (max 50%)
    speedCdCut: 1000,         // abyss cooldown cut = total speed / this (max 50%)
    defyBase: 5,
    defyMax: 25,
    defyMeter: 20,            // meter added when she defies death

    // Breaking point (hidden): average of two rolls in this range
    breakMin: 70,
    breakMax: 130,
    warn: [0.6, 0.8, 0.92],   // flicker, strained, on the brink (share of her breaking point)

    // Rising floor (share of her breaking point that rest can't go below)
    floorLevel: 0.015,        // per level above 1
    floorDefy: 0.06,          // per death defied
    floorCap: 0.6,
    floorHallCut: 0.04,       // each funded Silent Hall lowers the cap
    floorCapMin: 0.4,

    // Full Power
    fullBonus: 2,             // her bonuses x2
    fullMeter: 3,             // her meter gain x3

    // Calming
    handlerCut: 0.4,          // assigned Handler: -40% meter gain for her
    orgCalm: 0.02,            // each Organization: -2% meter gain for all
    orgCalmMax: 0.2,
    hallRest: 0.3,            // each funded Silent Hall: +30% rest recovery
    hallRestMax: 1.5,

    // Stillwater Tonic
    tonicDays: 60,            // days per tonic, per Apothecary
    tonicBase: 2,             // storage: base + 1 per Apothecary
    tonicCut: 40,             // meter removed (ignores the floor)
    tonicFail: 15,            // % chance a Black Card tonic fails (+5 meter)
    restSaveRisk: 12,         // % chance resting her at the brink is too late

    // Black Card
    cardLoyalty: 4,           // sisters' loyalty change on honour (+) or ignore (-)

    // Leaving
    sevBase: 10,              // severance = wage x (base + days served / div)
    sevDiv: 10,
    dismissBase: 2,           // sisters lose base + days served / div loyalty (max)
    dismissDiv: 25,
    dismissMax: 10,
    vetMin: 30,               // days away before a veteran can return
    vetChance: 30,            // % per pool refresh (one veteran at most)
    vetMax: 12,
    exileRiseAt: 0.75,        // leaving above this share of her limit: meter may keep rising
    exileRise: 0.15,          // per day
    exileFall: 1,             // per day
    exileCalm: 1,             // % per day that a restless veteran settles down

    chronMax: 10,
    hallChron: 5,
};

// Seats: [milestone check, cost]. Seat 1 is free with the first Organization.
export const seatList = [
    { req: 'org',      cost: {} },
    { req: 'iron',     cost: { Money: 2000, Iron: 500 } },
    { req: 'hall',     cost: { Money: 5000, Iron: 1500, Furs: 1000 } },
    { req: 'boot',     cost: { Money: 12000, Cement: 3000 } },
    { req: 'apoth',    cost: { Money: 25000, Cement: 6000, Steel: 1500 } },
    { req: 'electric', cost: { Money: 45000, Steel: 4000, Copper: 4000 } },
    { req: 'industry', cost: { Money: 80000, Steel: 10000 } },
    { req: 'space',    cost: { Money: 300000, Steel: 40000, Titanium: 12000 } },
];

const seatReq = {
    org(){ return orgCount() >= 1; },
    iron(){ return (global.tech['mining'] || 0) >= 3; },
    hall(){ return global.city['silent_hall'] && global.city.silent_hall.count >= 1; },
    boot(){ return (global.tech['boot_camp'] || 0) >= 1; },
    apoth(){ return global.city['apothecary'] && global.city.apothecary.count >= 1; },
    electric(){ return (global.tech['high_tech'] || 0) >= 2; },
    industry(){ return (global.tech['high_tech'] || 0) >= 3; },
    space(){ return (global.tech['space'] || 0) >= 2; },
};

// Wild Awakened Ones: average days between sightings, by era (high_tech level).
export const wildVars = {
    era: [[0, 360], [2, 240], [5, 160], [8, 120]],
    infested: 1.5,           // more often on Monster-infested planets
    fameLevels: 60,          // total roster levels for the full fame bonus
    fameMax: 1,              // up to 2x as often
    max: 3,                  // most wild Awakened at large at once
    minSoldiers: 10,         // none appear until your garrison has this many soldiers
    strMin: 30, strMax: 60, strMult: 1.25, // era strength: x the era multiplier
    armyMin: 0.6,            // ...but never above 60% to 110% of your army rating when it appears
    armyMax: 1.1,
    strFloor: 10,
};

// Duels: warriors stepping in when an Awakened One attacks the garrison.
export const duelVars = {
    noticeDiv: 2,            // chance to notice = Sense / 2 %
    maxTeam: 2,              // at most two warriors per duel
    cooldown: 60,            // seconds before the same monster can be fought this way again
    winMin: 5, winMax: 95,   // win chance limits (%)
    repelShare: 0.6,         // share of non-wins that drive the monster off
    repelWeaken: 0.8,        // monster strength after being driven off
    repelQuiet: 120,         // seconds it stops attacking after being driven off
    outDays: 3,              // days a warrior needs to recover after a repelled duel
    brink: [1, 1, 1.1, 1.25],// strength by warning stage (calm, flicker, strained, brink)
    mercyBase: 20,           // mercy blow chance = base + partner Will / div %
    mercyWilDiv: 4,
    mercyMeter: 10,          // meter added to the sister who strikes the mercy blow
    hotIgnore: 25,           // % chance Hot-headed ignores Hold back
    volatileIgnore: 10,      // % chance Volatile ignores Hold back
};

export const fights = {
    // [meter gain, xp win, xp loss, death% win, death% loss]
    hunt:     [6, 40, 20, 2, 10],
    abyss:    [10, 50, 50, 4, 4],
    raid:     [3, 15, 10, 0.5, 3],
    campaign: [2, 10, 10, 0, 0],
    duel:     [8, 30, 15, 0, 30],
};

export const perkList = {
    quick_draw:    { good: true },  // +10% hunt damage each
    defensive:     { good: true },  // -25% soldier losses in hunts each (max 75%)
    loyal:         { good: true },  // -30% wage, +20 starting loyalty
    iron_control:  { good: true },  // personal meter gain x0.6
    prodigy:       { good: true },  // +15 to all growth rates
    unyielding:    { good: true },  // +10% defy death
    veteran:       { good: true },  // starts at level 3
    hot_headed:    { good: false }, // +20 str growth, personal meter gain x2
    haunted:       { good: false }, // +15 sense, +1 army stress
    greedy:        { good: false }, // +40% wage, double loyalty loss when unpaid
    frail_mind:    { good: false }, // -20 control growth
    grudge_bearer: { good: false }, // double loyalty losses
};

export const temperaments = {
    stoic:    { start: 55, gain: 0.5, loss: 0.5, rogue: 1 },
    proud:    { start: 50, gain: 1,   loss: 1,   rogue: 1 },   // dislikes resting
    gentle:   { start: 65, gain: 2,   loss: 1.5, rogue: 0.5 }, // feels comrades' deaths more
    volatile: { start: 45, gain: 1,   loss: 1.5, rogue: 2 },
};

const names = [
    'Ilsa','Mirren','Vael','Corra','Sefa','Ondine','Kaelis','Rhosyn','Tamsin','Liesel',
    'Brenna','Isolde','Maren','Velka','Saoirse','Edda','Ysolde','Nerys','Calla','Thessaly',
    'Wren','Astrid','Halvey','Ilka','Jorunn','Kestrel','Lisbet','Marit','Noor','Orla',
    'Petra','Quilla','Runa','Sigrun','Tove','Ulla','Verity','Wilhelmina','Yrsa','Zelde',
    'Agna','Branwen','Cerys','Dagny','Elske','Fenna','Greta','Hedda','Inga','Jessamy'
];

const wildFirst = ['Gor','Vesh','Mal','Thra','Ur','Skel','Nyx','Brak','Oss','Zul','Kra','Hesk','Drav','Yth','Gash','Quor'];
const wildSecond = ['oth','ra','gul','ven','mire','ax','esh','ul','orn','ith','ak','ys','umbra','eth'];
const wildEpithets = 12;  // sw_epithet_0 .. 11

const battleKinds = Object.keys(fights);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function warriorState(){
    if (!global.race['warriors']){
        global.race['warriors'] = { roster: [], pool: [], refresh: 0, nextId: 1, lastDay: global.stats.days || 0, named: [], grudges: [] };
    }
    let w = global.race.warriors;
    ['roster','pool','named','grudges','vets'].forEach(k => { if (!Array.isArray(w[k])){ w[k] = []; } });
    if (w.seats === undefined){
        // Older saves: keep every warrior already hired.
        w.seats = Math.min(warriorVars.maxSlots, Math.max(w.roster.length, orgCount() >= 1 ? 1 : 0));
    }
    if (w.tonic === undefined){ w.tonic = 0; }
    if (w.woke === undefined){ w.woke = 0; }
    if (w.wildSlain === undefined){ w.wildSlain = 0; }
    if (w.msg !== undefined){ delete w.msg; }
    w.roster.forEach(wr => {
        fixWarrior(wr);
        if (wr.rec.j === null){ wr.rec.j = today(); wr.rec.st = 1; }
    });
    w.pool.forEach(fixWarrior);
    w.vets.forEach(fixWarrior);
    return w;
}

// Adds fields from newer versions to an existing warrior.
function fixWarrior(wr){
    if (wr.bp === undefined){ wr.bp = rollBreak(); }
    if (wr.fp === undefined){ wr.fp = false; }
    if (wr.hd === undefined){ wr.hd = false; }
    if (wr.card === undefined){ wr.card = false; }
    if (wr.ws === undefined){ wr.ws = 0; }
    if (wr.defied === undefined){ wr.defied = 0; }
    if (wr.hold === undefined){ wr.hold = false; }
    if (wr.out === undefined){ wr.out = 0; }
    if (!Array.isArray(wr.chron)){ wr.chron = []; }
    if (!wr.rec){ wr.rec = newRecord(wr); }
    battleKinds.forEach(k => { if (!wr.rec.b[k]){ wr.rec.b[k] = [0, 0]; } });
}

function newRecord(wr){
    let b = {};
    battleKinds.forEach(k => { b[k] = [0, 0]; });
    return {
        j: null,             // day she first joined (null while a recruit)
        st: 0,               // stints served
        sd: 0,               // days served
        r0: rankOf(wr),      // rank when recruited
        rb: rankOf(wr),      // best rank reached
        fee: 0, wg: 0,       // fees paid, total wages
        rd: 0, rn: 0,        // days rested, number of rests
        ud: 0,               // days unpaid
        b,                   // battles: kind -> [won, lost]
        aw: 0, ns: 0, fs: 0, // Awakened slain, named enemies slain, former sisters slain
        ad: 0, ak: 0,        // Abyssal damage, Abyssal killing blows
        cl: 0, dd: 0,        // comrades lost, deaths defied
        pm: Math.floor(wr.meter || 0),
        ll: Math.round(wr.loyalty || 0),
        s0: Object.assign({}, wr.stats),
    };
}

function hall(){
    if (!Array.isArray(global.stats['silver_hall'])){ global.stats['silver_hall'] = []; }
    return global.stats.silver_hall;
}

function addHall(wr, fate){
    let h = hall();
    let entry = { n: wr.name, r: rankOf(wr), l: wr.lvl, f: fate, d: global.stats.days || 0 };
    if (wr.rec){
        entry.t = wr.temper;
        entry.rec = JSON.parse(JSON.stringify(wr.rec));
        entry.ch = (wr.chron || []).slice(-warriorVars.hallChron);
        entry.s = Object.assign({}, wr.stats);
    }
    h.unshift(entry);
    if (h.length > 50){ h.length = 50; }
}

function chron(wr, key, args){
    wr.chron.push({ d: global.stats.days || 0, k: key, a: args || [] });
    if (wr.chron.length > warriorVars.chronMax){ wr.chron.splice(0, wr.chron.length - warriorVars.chronMax); }
}

function orgCount(){
    return global.city && global.city['organization'] ? global.city.organization.count : 0;
}

export function seats(){
    if (!global.race['warriors']){ return 0; }
    return global.race.warriors.seats || 0;
}

// Kept for older callers.
export function slots(){ return seats(); }

export function active(){
    if (!yokiActive() || !global.race['warriors']){ return []; }
    return global.race.warriors.roster.filter(x => x.status === 'active' && !(x.out > 0));
}

function rand(min, max){ return Math.rand(min, max + 1); } // inclusive
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function pick(list){ return list[Math.rand(0, list.length)]; }
function today(){ return global.stats.days || 0; }

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export function might(wr){
    return wr.stats.str * (1 + 0.05 * (wr.lvl - 1));
}

export function rankOf(wr){
    let power = warriorVars.stats.reduce((t, s) => t + wr.stats[s], 0) + 8 * (wr.lvl - 1);
    return clamp(47 - Math.floor((power - 150) / 9), 1, 47);
}

export function potential(wr){
    let avg = warriorVars.stats.reduce((t, s) => t + wr.growth[s], 0) / warriorVars.stats.length;
    return avg >= 60 ? 'S' : avg >= 50 ? 'A' : avg >= 40 ? 'B' : avg >= 30 ? 'C' : 'D';
}

function rollStat(){
    // Average of two rolls: most warriors are middling, standouts are rare.
    return Math.round((rand(10, 90) + rand(10, 90)) / 2);
}

function rollBreak(){
    return Math.round((rand(warriorVars.breakMin, warriorVars.breakMax) + rand(warriorVars.breakMin, warriorVars.breakMax)) / 2);
}

function rollPerks(){
    let good = Object.keys(perkList).filter(p => perkList[p].good);
    let bad = Object.keys(perkList).filter(p => !perkList[p].good);
    let perks = [pick(good)];
    if (Math.rand(0, 100) < 40){
        let second = pick(good);
        if (!perks.includes(second)){ perks.push(second); }
    }
    if (Math.rand(0, 100) < 35){ perks.push(pick(bad)); }
    return perks;
}

function feeFor(stats){
    let sum = warriorVars.stats.reduce((t, s) => t + stats[s], 0);
    let q = sum / 250;
    let base = Math.max(warriorVars.feeMin, (global.resource.Money.max || 0) * warriorVars.feeMoneyPct);
    return Math.round(base * q * q);
}

export function makeWarrior(){
    let w = warriorState();
    let stats = {}, growth = {};
    warriorVars.stats.forEach(s => {
        stats[s] = rollStat();
        growth[s] = rand(20, 70);
    });
    let perks = rollPerks();
    if (perks.includes('prodigy')){ warriorVars.stats.forEach(s => growth[s] += 15); }
    if (perks.includes('hot_headed')){ growth.str += 20; }
    if (perks.includes('frail_mind')){ growth.ctl = Math.max(5, growth.ctl - 20); }
    if (perks.includes('haunted')){ stats.sns = Math.min(100, stats.sns + 15); }
    let temper = pick(Object.keys(temperaments));
    let used = w.roster.concat(w.pool, w.vets).map(x => x.name);
    let free = names.filter(n => !used.includes(n));
    let wr = {
        id: w.nextId++,
        name: free.length ? pick(free) : pick(names),
        lvl: 1, xp: 0,
        stats, growth, perks,
        temper,
        loyalty: clamp(temperaments[temper].start + (perks.includes('loyal') ? 20 : 0), 0, 100),
        meter: 0,
        status: 'active',
        cd: 0,
        unpaid: 0,
        fee: 0, wage: 0
    };
    if (perks.includes('veteran')){
        for (let i = 0; i < 2; i++){ levelUp(wr, true); }
    }
    fixWarrior(wr);
    wr.fee = feeFor(wr.stats);
    wr.wage = baseWage(wr);
    return wr;
}

function baseWage(wr){
    let wage = wr.fee * warriorVars.wagePct * (1 + warriorVars.wageLevelPct * (wr.lvl - 1));
    if (wr.perks.includes('loyal')){ wage *= 0.7; }
    if (wr.perks.includes('greedy')){ wage *= 1.4; }
    return Math.max(1, Math.round(wage));
}

export function refreshPool(paid){
    let w = warriorState();
    if (paid){
        let cost = refreshCost();
        if (global.resource.Money.amount < cost){ return false; }
        global.resource.Money.amount -= cost;
    }
    w.pool.splice(0, w.pool.length);
    for (let i = 0; i < warriorVars.poolSize; i++){ w.pool.push(makeWarrior()); }

    // A former warrior may ask to come back.
    let ready = w.vets.filter(v => v.mood !== 'bitter' && today() - v.left >= warriorVars.vetMin);
    if (ready.length && Math.rand(0, 100) < warriorVars.vetChance){
        let v = pick(ready);
        let offer = JSON.parse(JSON.stringify(v));
        offer.returning = true;
        offer.fee = Math.round(feeFor(offer.stats) * (v.mood === 'grateful' ? 0.5 : 1));
        w.pool[w.pool.length - 1] = offer;
    }
    w.refresh = warriorVars.poolRefreshDays;
    return true;
}

export function refreshCost(){
    let w = warriorState();
    let avg = w.pool.length ? w.pool.reduce((t, x) => t + x.fee, 0) / w.pool.length : warriorVars.feeMin;
    return Math.round(avg * warriorVars.refreshCostPct);
}

// ---------------------------------------------------------------------------
// Leveling (Fire Emblem style: each stat rolls its own growth chance)
// ---------------------------------------------------------------------------

function levelUp(wr, silent){
    if (wr.lvl >= warriorVars.maxLevel){ return []; }
    wr.lvl++;
    let gains = [];
    warriorVars.stats.forEach(s => {
        if (Math.rand(0, 100) < wr.growth[s] && wr.stats[s] < 100){
            let g = rand(warriorVars.growMin, warriorVars.growMax);
            wr.stats[s] = Math.min(100, wr.stats[s] + g);
            gains.push(`${loc(`sw_stat_${s}`)} +${g}`);
        }
    });
    wr.wage = baseWage(wr);
    if (wr.rec){
        wr.rec.rb = Math.min(wr.rec.rb, rankOf(wr));
        if (!silent && wr.lvl % 5 === 0){ chron(wr, 'sw_ch_level', [wr.lvl, rankOf(wr)]); }
    }
    if (!silent){
        messageQueue(loc('sw_levelup',[wr.name, wr.lvl, gains.length ? gains.join(', ') : loc('sw_levelup_none')]),'success',false,['combat']);
    }
    return gains;
}

function gainXp(wr, xp){
    if (wr.lvl >= warriorVars.maxLevel){ return; }
    wr.xp += xp;
    while (wr.xp >= warriorVars.xpPerLevel && wr.lvl < warriorVars.maxLevel){
        wr.xp -= warriorVars.xpPerLevel;
        levelUp(wr);
    }
}

// ---------------------------------------------------------------------------
// Awakening: breaking point, floor, warnings
// ---------------------------------------------------------------------------

export function floorCap(){
    return Math.max(warriorVars.floorCapMin, warriorVars.floorCap - hallsFunded() * warriorVars.floorHallCut);
}

export function floorOf(wr){
    let share = warriorVars.floorLevel * (wr.lvl - 1) + warriorVars.floorDefy * (wr.defied || 0);
    return wr.bp * Math.min(floorCap(), share);
}

// 0 calm, 1 eyes flicker gold, 2 strained, 3 on the brink
export function stageOf(wr){
    let r = wr.meter / wr.bp;
    let s = 0;
    warriorVars.warn.forEach((v, i) => { if (r >= v){ s = i + 1; } });
    return s;
}

export function meterMult(wr){
    let m = 1.5 - wr.stats.ctl / 100;
    if (wr.perks.includes('hot_headed')){ m *= 2; }
    if (wr.perks.includes('iron_control')){ m *= 0.6; }
    if (global.race['yoki_power']){ m *= traits.yoki_power.vars()[1] / 100; }
    m *= Math.max(0, 1 - yokiState().abyss.slain * abyssVars.calmReward);
    if (wr.hd){ m *= 1 - warriorVars.handlerCut; }
    m *= 1 - Math.min(warriorVars.orgCalmMax, orgCount() * warriorVars.orgCalm);
    if (wr.fp){ m *= warriorVars.fullMeter; }
    return Math.max(0.05, m);
}

function restRate(){
    return warriorVars.restDecay * (1 + Math.min(warriorVars.hallRestMax, hallsFunded() * warriorVars.hallRest));
}

// Call after any change to her meter. Returns true if she Awakened.
function checkMeter(wr){
    if (wr.rec){ wr.rec.pm = Math.max(wr.rec.pm, Math.floor(wr.meter)); }
    if (wr.meter >= wr.bp){
        awaken(wr);
        return true;
    }
    let s = stageOf(wr);
    if (s > wr.ws){
        wr.ws = s;
        if (s === 1){ messageQueue(loc('sw_warn_1',[wr.name]),'caution',false,['combat']); }
        else if (s === 2){
            messageQueue(loc('sw_warn_2',[wr.name]),'warning',false,['combat']);
            chron(wr, 'sw_ch_strained');
        }
        else if (s === 3){
            wr.card = true;
            messageQueue(loc('sw_card_msg',[wr.name]),'danger',false,['combat']);
            chron(wr, 'sw_ch_card');
        }
    }
    else if (s < wr.ws){
        wr.ws = s;
        if (s < 3){ wr.card = false; }
    }
    return false;
}

function findWarrior(id){
    return warriorState().roster.find(x => x.id === id);
}

function removeFromRoster(wr){
    let w = warriorState();
    let i = w.roster.findIndex(x => x.id === wr.id);
    if (i >= 0){ w.roster.splice(i, 1); }
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

export function hire(id){
    let w = warriorState();
    let idx = w.pool.findIndex(x => x.id === id);
    if (idx < 0 || w.roster.length >= seats()){ return false; }
    let offer = w.pool[idx];
    if (global.resource.Money.amount < offer.fee){ return false; }
    let wr = offer;
    if (offer.returning){
        let vi = w.vets.findIndex(v => v.id === offer.id);
        if (vi < 0){ w.pool.splice(idx, 1); return false; }
        wr = w.vets.splice(vi, 1)[0];
        let away = today() - wr.left;
        if (wr.mood === 'grateful'){ wr.loyalty = clamp(wr.loyalty + 10, 0, 100); }
        wr.loyalty = Math.max(wr.loyalty, temperaments[wr.temper].start - 10);
        ['left','mood','how','rise','returning'].forEach(k => delete wr[k]);
        wr.fee = offer.fee;
        wr.status = 'active'; wr.cd = 0; wr.unpaid = 0;
        wr.fp = false; wr.hd = false; wr.card = false;
        wr.ws = 0; wr.out = 0; wr.hold = false;
        chron(wr, 'sw_ch_return', [away]);
        messageQueue(loc('sw_returned',[wr.name, rankOf(wr)]),'success',false,['combat']);
    }
    else {
        wr.rec.r0 = rankOf(wr);
        wr.rec.rb = wr.rec.r0;
        wr.rec.s0 = Object.assign({}, wr.stats);
        messageQueue(loc('sw_hired',[wr.name, rankOf(wr)]),'success',false,['combat']);
    }
    global.resource.Money.amount -= offer.fee;
    w.pool.splice(idx, 1);
    if (wr.rec.j === null){ wr.rec.j = today(); }
    wr.rec.st++;
    wr.rec.fee += offer.fee;
    wr.wage = baseWage(wr);
    if (!offer.returning){ chron(wr, 'sw_ch_joined', [rankOf(wr)]); }
    w.roster.push(wr);
    return true;
}

export function toggleRest(id){
    let wr = findWarrior(id);
    if (!wr || wr.cd > 0){ return false; }
    wr.status = wr.status === 'active' ? 'resting' : 'active';
    if (wr.status === 'resting'){
        wr.fp = false;
        wr.rec.rn++;
    }
    wr.cd = warriorVars.restCooldown;
    return true;
}

export function toggleFull(id){
    let wr = findWarrior(id);
    if (!wr || wr.status !== 'active'){ return false; }
    wr.fp = !wr.fp;
    if (wr.fp){ messageQueue(loc('sw_full_on',[wr.name]),'caution',false,['combat']); }
    return true;
}

export function toggleHold(id){
    let wr = findWarrior(id);
    if (!wr){ return false; }
    wr.hold = !wr.hold;
    return true;
}

export function handlerCount(){
    return global.civic['handler'] ? global.civic.handler.workers : 0;
}

export function handlersUsed(){
    return global.race['warriors'] ? global.race.warriors.roster.filter(x => x.hd).length : 0;
}

export function toggleHandler(id){
    let wr = findWarrior(id);
    if (!wr){ return false; }
    if (wr.hd){ wr.hd = false; return true; }
    if (handlersUsed() >= handlerCount()){ return false; }
    wr.hd = true;
    return true;
}

export function tonicCap(){
    let ap = global.city['apothecary'] ? global.city.apothecary.count : 0;
    return ap > 0 ? warriorVars.tonicBase + ap : 0;
}

export function useTonic(id){
    let w = warriorState();
    let wr = findWarrior(id);
    if (!wr || w.tonic < 1){ return false; }
    w.tonic--;
    wr.meter = Math.max(0, wr.meter - warriorVars.tonicCut);
    chron(wr, 'sw_ch_tonic');
    messageQueue(loc('sw_tonic_used',[wr.name]),'info',false,['combat']);
    checkMeter(wr);
    return true;
}

// Black Card choices: honour | tonic | rest | ignore
export function blackCard(id, choice){
    let wr = findWarrior(id);
    if (!wr || !wr.card){ return false; }
    let w = warriorState();
    switch (choice){
        case 'honour':
            removeFromRoster(wr);
            chron(wr, 'sw_ch_honoured');
            addHall(wr, 'honoured');
            w.roster.forEach(o => changeLoyalty(o, warriorVars.cardLoyalty));
            messageQueue(loc('sw_card_honoured',[wr.name]),'special',false,['combat']);
            return true;
        case 'tonic':
            if (w.tonic < 1){ return false; }
            w.tonic--;
            wr.fp = false;
            if (Math.rand(0, 100) < warriorVars.tonicFail){
                wr.meter += 5;
                messageQueue(loc('sw_card_tonic_fail',[wr.name]),'danger',false,['combat']);
                checkMeter(wr);
                return true;
            }
            wr.card = false;
            wr.meter = Math.max(0, wr.meter - warriorVars.tonicCut);
            chron(wr, 'sw_ch_saved');
            messageQueue(loc('sw_card_saved',[wr.name]),'success',false,['combat']);
            checkMeter(wr);
            return true;
        case 'rest':
            wr.card = false;
            if (Math.rand(0, 100) < warriorVars.restSaveRisk){
                messageQueue(loc('sw_card_too_late',[wr.name]),'danger',false,['combat']);
                awaken(wr);
                return true;
            }
            if (wr.status === 'active'){ wr.rec.rn++; }
            wr.status = 'resting';
            wr.fp = false;
            wr.cd = warriorVars.restCooldown;
            chron(wr, 'sw_ch_saved');
            messageQueue(loc('sw_card_rest',[wr.name]),'warning',false,['combat']);
            return true;
        case 'ignore':
            wr.card = false;
            chron(wr, 'sw_ch_ignored');
            w.roster.forEach(o => { if (o.id !== wr.id){ changeLoyalty(o, -warriorVars.cardLoyalty); } });
            messageQueue(loc('sw_card_ignored',[wr.name]),'warning',false,['combat']);
            return true;
    }
    return false;
}

export function rename(id, name){
    let wr = findWarrior(id);
    if (!wr || typeof name !== 'string'){ return; }
    let clean = name.replace(/[<>]/g, '').trim().slice(0, 24);
    if (clean.length){ wr.name = clean; }
}

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

export function nextSeat(){
    let n = seats();
    if (n >= seatList.length){ return null; }
    let s = seatList[n];
    return { n: n + 1, req: s.req, cost: s.cost, ready: seatReq[s.req]() };
}

function canPay(cost){
    return Object.keys(cost).every(r => global.resource[r] && global.resource[r].amount >= cost[r]);
}

export function commissionSeat(){
    let w = warriorState();
    let s = nextSeat();
    if (!s || !s.ready || !canPay(s.cost)){ return false; }
    Object.keys(s.cost).forEach(r => { global.resource[r].amount -= s.cost[r]; });
    w.seats++;
    messageQueue(loc('sw_seat_done',[w.seats]),'success',false,['combat']);
    return true;
}

// ---------------------------------------------------------------------------
// Leaving: retire, dismiss, veterans
// ---------------------------------------------------------------------------

export function severance(wr){
    return Math.round(wr.wage * (warriorVars.sevBase + wr.rec.sd / warriorVars.sevDiv));
}

export function backPay(wr){
    return wr.unpaid * wr.wage;
}

export function retireCost(wr){
    return severance(wr) + backPay(wr);
}

export function partingMood(wr, how){
    let score = wr.loyalty + Math.min(20, wr.rec.sd / 10) - Math.min(15, wr.rec.ud) - Math.min(15, 3 * wr.rec.cl);
    score += how === 'retired' ? 10 : -20 - 5 * wr.unpaid;
    return score >= 60 ? 'grateful' : score >= 35 ? 'neutral' : 'bitter';
}

function dismissHit(wr){
    return Math.min(warriorVars.dismissMax, warriorVars.dismissBase + wr.rec.sd / warriorVars.dismissDiv);
}

function leave(wr, how){
    let w = warriorState();
    let mood = partingMood(wr, how);
    removeFromRoster(wr);
    chron(wr, how === 'retired' ? 'sw_ch_retired' : 'sw_ch_dismissed', [loc(`sw_mood_${mood}`)]);
    addHall(wr, how);
    wr.left = today();
    wr.mood = mood;
    wr.how = how;
    wr.rise = wr.meter >= wr.bp * warriorVars.exileRiseAt;
    wr.status = 'resting'; wr.fp = false; wr.hd = false; wr.card = false; wr.unpaid = 0;
    w.vets.unshift(wr);
    if (w.vets.length > warriorVars.vetMax){ w.vets.length = warriorVars.vetMax; }
    if (mood === 'bitter'){
        let chance = 50 * temperaments[wr.temper].rogue;
        if (Math.rand(0, 100) < chance){
            w.grudges.push({ id: wr.id, name: wr.name, str: bossStrength(wr, 1.2), due: today() + rand(60, 200), former: formerOf(wr) });
        }
    }
    messageQueue(loc(how === 'retired' ? 'sw_retired' : 'sw_dismissed',[wr.name, loc(`sw_mood_${mood}`)]),'info',false,['combat']);
}

export function retire(id){
    let wr = findWarrior(id);
    if (!wr){ return false; }
    let cost = retireCost(wr);
    if (global.resource.Money.amount < cost){ return false; }
    global.resource.Money.amount -= cost;
    wr.rec.wg += cost;
    leave(wr, 'retired');
    return true;
}

export function dismiss(id){
    let wr = findWarrior(id);
    if (!wr){ return false; }
    let hit = dismissHit(wr);
    leave(wr, 'dismissed');
    warriorState().roster.forEach(o => changeLoyalty(o, -hit));
    return true;
}

function exileTick(w){
    for (let i = w.vets.length - 1; i >= 0; i--){
        let v = w.vets[i];
        if (v.rise){
            v.meter += warriorVars.exileRise * Math.max(0.3, 1.5 - v.stats.ctl / 100);
            if (Math.rand(0, 100) < warriorVars.exileCalm){ v.rise = false; }
        }
        else {
            v.meter = Math.max(0, v.meter - warriorVars.exileFall);
        }
        if (v.meter >= v.bp){
            w.vets.splice(i, 1);
            let away = today() - v.left;
            w.woke++;
            chron(v, 'sw_ch_exile_awakened', [away]);
            addHall(v, 'awakened_exile');
            w.named.push({ id: v.id, name: v.name, str: bossStrength(v, 1), kind: 'awakened', former: formerOf(v) });
            w.grudges = w.grudges.filter(g => g.id !== v.id);
            messageQueue(loc('sw_exile_awakened',[v.name, away]),'danger',false,['combat']);
        }
    }
}

// ---------------------------------------------------------------------------
// Bosses made from your own warriors, and wild Awakened Ones
// ---------------------------------------------------------------------------

function techFactor(){
    return global.tech['high_tech'] ? global.tech['high_tech'] + 1 : 1;
}

function bossStrength(wr, mult){
    return Math.round((might(wr) * 2 + wr.lvl * 10) * mult * techFactor());
}

function formerOf(wr){
    return { r: rankOf(wr), sd: wr.rec ? wr.rec.sd : 0 };
}

export function namedBoss(){
    let w = global.race['warriors'];
    return w && w.named.length ? w.named[0] : null;
}

export function namedDefeated(){
    let w = warriorState();
    return namedRemove(w.named[0]);
}

// Removes a specific named boss after she is slain.
export function namedRemove(b){
    let w = warriorState();
    let i = w.named.indexOf(b);
    if (i < 0){ return null; }
    w.named.splice(i, 1);
    if (b && b.kind === 'wild'){ w.wildSlain++; }
    else if (b){ addHall({ name: b.name, lvl: 0, stats: { str: 0, spd: 0, ctl: 0, sns: 0, wil: 0 } }, b.kind === 'rogue' ? 'slain_rogue' : 'slain_awakened'); }
    return b;
}

export function wildCount(){
    let w = global.race['warriors'];
    return w ? w.named.filter(b => b.kind === 'wild').length : 0;
}

function wildName(){
    return `${pick(wildFirst)}${pick(wildSecond)}, ${loc(`sw_epithet_${Math.rand(0, wildEpithets)}`)}`;
}

export function wildInterval(){
    let tech = global.tech['high_tech'] || 0;
    let days = wildVars.era[0][1];
    wildVars.era.forEach(e => { if (tech >= e[0]){ days = e[1]; } });
    let mult = 1;
    if (global.city.ptrait && global.city.ptrait.includes('infested')){ mult *= wildVars.infested; }
    let fame = global.race['warriors'] ? global.race.warriors.roster.reduce((t, x) => t + x.lvl, 0) : 0;
    mult *= 1 + Math.min(wildVars.fameMax, fame / wildVars.fameLevels * wildVars.fameMax);
    return days / mult;
}

export function spawnWild(){
    let w = warriorState();
    let army = global.civic['garrison'] ? armyRating(garrisonSize(), 'army', global.civic.garrison.wounded || 0) : 0;
    let eraStr = rand(wildVars.strMin, wildVars.strMax) * techFactor() * wildVars.strMult;
    let armyStr = army * rand(wildVars.armyMin * 100, wildVars.armyMax * 100) / 100;
    let str = Math.round(Math.max(wildVars.strFloor, Math.min(eraStr, armyStr)));
    let b = { name: wildName(), str, kind: 'wild' };
    w.named.push(b);
    messageQueue(loc('sw_wild_spawn',[b.name]),'danger',false,['combat']);
    return b;
}

function wildTick(w){
    if (orgCount() < 1 || !global.tech['military'] || wildCount() >= wildVars.max){ return; }
    if (!global.civic['garrison'] || global.civic.garrison.workers < wildVars.minSoldiers){ return; }
    if (Math.rand(0, 10000) < 10000 / wildInterval()){
        spawnWild();
    }
}

function moraleHit(amount, except){
    warriorState().roster.forEach(o => {
        if (o.id !== except){
            changeLoyalty(o, -amount * (o.temper === 'gentle' ? 1.5 : 1));
        }
    });
}

function changeLoyalty(wr, delta){
    let t = temperaments[wr.temper];
    if (delta < 0){
        delta *= t.loss;
        if (wr.perks.includes('grudge_bearer')){ delta *= 2; }
    }
    else {
        delta *= t.gain;
    }
    wr.loyalty = clamp(wr.loyalty + delta, 0, 100);
    if (wr.rec){ wr.rec.ll = Math.min(wr.rec.ll, Math.round(wr.loyalty)); }
}

function comradeLost(wr){
    warriorState().roster.forEach(o => {
        if (o.id !== wr.id){
            o.rec.cl++;
            chron(o, 'sw_ch_comrade', [wr.name]);
        }
    });
}

function awaken(wr){
    let w = warriorState();
    removeFromRoster(wr);
    w.woke++;
    chron(wr, 'sw_ch_awakened');
    w.named.push({ id: wr.id, name: wr.name, str: bossStrength(wr, 1), kind: 'awakened', former: formerOf(wr) });
    addHall(wr, 'awakened');
    comradeLost(wr);
    moraleHit(3 + (wr.card ? warriorVars.cardLoyalty : 0), wr.id);
    messageQueue(loc('sw_awakened',[wr.name]),'danger',false,['combat']);
}

// ---------------------------------------------------------------------------
// Ticks
// ---------------------------------------------------------------------------

// Every game second (from yokiTick).
export function warriorsTick(){
    if (!yokiActive()){ return; }
    let w = warriorState();
    w.roster.forEach(wr => { if (wr.cd > 0){ wr.cd--; } });
    if (w.seats === 0 && orgCount() >= 1){
        w.seats = 1;
        messageQueue(loc('sw_seat_done',[1]),'success',false,['combat']);
    }
    // Handlers who lost their jobs leave their warriors.
    let over = handlersUsed() - handlerCount();
    for (let i = w.roster.length - 1; i >= 0 && over > 0; i--){
        if (w.roster[i].hd){ w.roster[i].hd = false; over--; }
    }
    if (seats() > 0 && w.pool.length === 0 && w.refresh <= 0){
        refreshPool(false);
    }
    let now = today();
    if (now !== w.lastDay){
        let n = Math.max(0, Math.min(10, now - w.lastDay));
        w.lastDay = now;
        for (let i = 0; i < n; i++){ dailyTick(w); }
    }
}

function dailyTick(w){
    if (w.refresh > 0){ w.refresh--; }
    if (w.refresh <= 0 && seats() > 0){ refreshPool(false); }

    // Stillwater Tonic
    let cap = tonicCap();
    if (cap > 0 && w.tonic < cap){
        w.tonic = Math.min(cap, w.tonic + global.city.apothecary.count / warriorVars.tonicDays);
    }

    // Wages, loyalty, meters
    w.roster.slice().forEach(wr => {
        wr.rec.sd++;
        if (wr.out > 0){ wr.out--; }
        if (global.resource.Money.amount >= wr.wage){
            global.resource.Money.amount -= wr.wage;
            wr.rec.wg += wr.wage;
            wr.unpaid = 0;
            changeLoyalty(wr, 0.3);
        }
        else {
            wr.unpaid++;
            wr.rec.ud++;
            changeLoyalty(wr, wr.perks.includes('greedy') ? -8 : -4);
            if (wr.unpaid === 1){
                messageQueue(loc('sw_unpaid',[wr.name]),'warning',false,['combat']);
                chron(wr, 'sw_ch_unpaid');
            }
        }
        if (wr.status === 'resting'){
            wr.rec.rd++;
            let floor = floorOf(wr);
            if (wr.meter > floor){ wr.meter = Math.max(floor, wr.meter - restRate()); }
            if (wr.temper === 'proud'){ changeLoyalty(wr, -0.4); }
        }
        else {
            wr.meter += warriorVars.activeGain * meterMult(wr);
        }
        if (checkMeter(wr)){ return; }

        // Desertion
        if ((wr.loyalty < 10 || (wr.loyalty < 20 && wr.unpaid >= 3)) && Math.rand(0, 100) < 3){
            removeFromRoster(wr);
            chron(wr, 'sw_ch_deserted');
            addHall(wr, 'deserted');
            let rogue = (wr.loyalty < 5 ? 60 : 30) * temperaments[wr.temper].rogue;
            if (Math.rand(0, 100) < rogue){
                w.grudges.push({ id: wr.id, name: wr.name, str: bossStrength(wr, 1.2), due: today() + rand(30, 90), former: formerOf(wr) });
            }
            messageQueue(loc('sw_deserted',[wr.name]),'danger',false,['combat']);
        }
    });

    exileTick(w);
    wildTick(w);

    // Old grudges come due
    let now = today();
    for (let i = w.grudges.length - 1; i >= 0; i--){
        if (now >= w.grudges[i].due){
            let g = w.grudges.splice(i, 1)[0];
            w.named.push({ id: g.id, name: g.name, str: g.str, kind: 'rogue', former: g.former });
            if (g.id !== undefined){ w.vets = w.vets.filter(v => v.id !== g.id); }
            messageQueue(loc('sw_grudge',[g.name]),'danger',false,['combat']);
        }
    }
}

// ---------------------------------------------------------------------------
// Combat hooks
// ---------------------------------------------------------------------------

function pw(wr){ return wr.fp ? warriorVars.fullBonus : 1; }

export function warriorsArmyBonus(){
    let total = active().reduce((t, wr) => t + might(wr) * pw(wr), 0);
    return total / warriorVars.armyDivisor;
}

export function warriorsHuntMult(){
    let a = active();
    let sense = a.reduce((t, wr) => t + wr.stats.sns * pw(wr), 0) / warriorVars.senseDivisor;
    let quick = a.reduce((t, wr) => t + (wr.perks.includes('quick_draw') ? 0.1 * pw(wr) : 0), 0);
    return 1 + sense + quick;
}

export function warriorsLossMult(){
    let def = active().reduce((t, wr) => t + (wr.perks.includes('defensive') ? 0.25 * pw(wr) : 0), 0);
    return 1 - Math.min(0.75, def);
}

export function warriorsStressCut(){
    let will = active().reduce((t, wr) => t + wr.stats.wil * pw(wr), 0) / warriorVars.willDivisor;
    return Math.min(0.5, will);
}

export function warriorsStressAdd(){
    return active().filter(wr => wr.perks.includes('haunted')).length;
}

export function warriorsCdMult(){
    let spd = active().reduce((t, wr) => t + wr.stats.spd * pw(wr), 0) / warriorVars.speedCdCut;
    return 1 - Math.min(0.5, spd);
}

function defyChance(wr){
    let c = warriorVars.defyBase + (wr.stats.wil + wr.stats.ctl) / 10;
    if (wr.perks.includes('unyielding')){ c += 10; }
    return clamp(c, warriorVars.defyBase, warriorVars.defyMax);
}

// Called after any fight. kind: hunt | abyss | raid | campaign
// info (optional): { target: named boss or 'generic', dmg: Abyssal damage, kill: Abyssal One slain }
export function warriorsBattle(kind, won, info){
    if (!yokiActive()){ return; }
    let f = fights[kind];
    if (!f){ return; }
    info = info || {};
    let fighters = active();

    // Credit for the fight goes to everyone who was there.
    if (fighters.length){
        let totalMight = fighters.reduce((t, wr) => t + might(wr) * pw(wr), 0) || 1;
        let blow = null;
        if (info.kill){
            let roll = Math.rand(0, 1000) / 1000 * totalMight;
            blow = fighters.find(wr => (roll -= might(wr) * pw(wr)) <= 0) || fighters[fighters.length - 1];
        }
        fighters.forEach(wr => {
            wr.rec.b[kind][won ? 0 : 1]++;
            if (info.dmg){ wr.rec.ad += Math.round(info.dmg * might(wr) * pw(wr) / totalMight); }
            if (blow && blow.id === wr.id){
                wr.rec.ak++;
                chron(wr, 'sw_ch_abyss_blow', [info.killName || '']);
            }
            if (won && info.target){ creditKill(wr, info.target); }
        });
    }

    fighters.forEach(wr => {
        // Death check
        if (deathCheck(wr, won ? f[3] : f[4])){ return; }
        wr.meter += f[0] * meterMult(wr);
        changeLoyalty(wr, won ? 1 : -1);
        gainXp(wr, won ? f[1] : f[2]);
        checkMeter(wr);
    });
}

function creditKill(wr, t){
    if (t === 'generic' || t.kind === 'wild' || t.kind === 'awakened'){ wr.rec.aw++; }
    if (t !== 'generic'){
        wr.rec.ns++;
        if (t.kind === 'awakened' || t.kind === 'rogue'){
            wr.rec.fs++;
            chron(wr, 'sw_ch_slew_sister', [t.name]);
        }
        else {
            chron(wr, 'sw_ch_slew', [t.name]);
        }
    }
}

// Rolls a death chance (%) for her. Returns true if she died.
function deathCheck(wr, pct){
    let death = pct * (1.25 - wr.stats.spd / 200);
    if (death <= 0 || Math.rand(0, 10000) >= death * 100){ return false; }
    if (Math.rand(0, 100) < defyChance(wr)){
        wr.meter += warriorVars.defyMeter;
        wr.defied++;
        wr.rec.dd++;
        chron(wr, 'sw_ch_defied');
        messageQueue(loc('sw_defied',[wr.name]),'special',false,['combat']);
        return false;
    }
    removeFromRoster(wr);
    chron(wr, 'sw_ch_fell');
    addHall(wr, 'fell');
    comradeLost(wr);
    moraleHit(3, wr.id);
    messageQueue(loc('sw_fell',[wr.name]),'danger',false,['combat']);
    return true;
}

// ---------------------------------------------------------------------------
// Duels: warriors stepping in when an Awakened One attacks
// ---------------------------------------------------------------------------

export function duelPower(wr){
    return might(wr) * techFactor() * (1 + wr.stats.spd / 200) * pw(wr) * duelVars.brink[stageOf(wr)];
}

export function duelChance(team, str){
    let p2 = team.reduce((t, wr) => t + Math.pow(duelPower(wr), 2), 0);
    let c = p2 / (p2 + str * str) * 100;
    return clamp(c, duelVars.winMin, duelVars.winMax);
}

function pickWeighted(list, weight){
    let total = list.reduce((t, x) => t + Math.max(1, weight(x)), 0);
    let roll = Math.rand(0, 10000) / 10000 * total;
    for (let x of list){
        roll -= Math.max(1, weight(x));
        if (roll <= 0){ return x; }
    }
    return list[list.length - 1];
}

// Who steps in: warriors who notice, the fastest usually first, at most two.
export function duelTeam(){
    let noticed = [];
    active().forEach(wr => {
        if (Math.rand(0, 10000) >= wr.stats.sns / duelVars.noticeDiv * 100){ return; }
        let charged = false;
        if (wr.hold){
            let ignore = (wr.perks.includes('hot_headed') ? duelVars.hotIgnore : 0) + (wr.temper === 'volatile' ? duelVars.volatileIgnore : 0);
            if (Math.rand(0, 100) >= ignore){ return; }
            charged = true;
        }
        noticed.push({ wr, charged });
    });
    let team = [];
    while (team.length < duelVars.maxTeam && noticed.length){
        let x = pickWeighted(noticed, n => n.wr.stats.spd);
        noticed.splice(noticed.indexOf(x), 1);
        team.push(x);
    }
    return team;
}

// Called when an Awakened One attacks the garrison.
// m = { target: named boss or 'generic', str, weaken(mult), quiet(seconds) }, slay() pays and removes it.
// Returns false (nobody stepped in), 'saved' or 'lost' (the soldier dies anyway).
export function warriorsIntercept(m, slay){
    if (!yokiActive()){ return false; }
    let team = duelTeam();
    if (!team.length){ return false; }
    let name = m.target === 'generic' ? loc('sw_duel_generic') : m.target.name;
    team.forEach(x => {
        if (x.charged){
            messageQueue(loc('sw_duel_charged',[x.wr.name]),'warning',false,['combat']);
            chron(x.wr, 'sw_ch_charged', [name]);
        }
    });
    messageQueue(team.length > 1 ? loc('sw_duel_pair',[team[0].wr.name, team[1].wr.name, name]) : loc('sw_duel_solo',[team[0].wr.name, name]),'info',false,['combat']);

    // Her power surges as the fight begins. A warrior near her limit may cross it here.
    let f = fights.duel;
    team.forEach(x => { x.wr.meter += f[0] * meterMult(x.wr); x.wr.rec.pm = Math.max(x.wr.rec.pm, Math.floor(x.wr.meter)); });
    let crossed = team.filter(x => x.wr.meter >= x.wr.bp).map(x => x.wr);
    let fighters = team.filter(x => x.wr.meter < x.wr.bp).map(x => x.wr);
    crossed.forEach(wr => {
        let partner = fighters[0];
        if (partner && Math.rand(0, 100) < duelVars.mercyBase + partner.stats.wil / duelVars.mercyWilDiv){
            let w = warriorState();
            removeFromRoster(wr);
            w.woke++;
            chron(wr, 'sw_ch_mercy_victim', [partner.name]);
            addHall(wr, 'mercy');
            comradeLost(wr);
            moraleHit(2, wr.id);
            partner.meter += duelVars.mercyMeter;
            chron(partner, 'sw_ch_mercy', [wr.name]);
            messageQueue(loc('sw_duel_mercy',[partner.name, wr.name]),'special',false,['combat']);
            if (checkMeter(partner)){ fighters.splice(fighters.indexOf(partner), 1); }
        }
        else {
            messageQueue(loc('sw_duel_awaken',[wr.name, name]),'danger',false,['combat']);
            awaken(wr);
        }
    });
    fighters = fighters.filter(wr => !checkMeter(wr));
    if (!fighters.length){ return 'lost'; }

    let chance = duelChance(fighters, m.str);
    let roll = Math.rand(0, 10000) / 100;
    let names = fighters.map(wr => wr.name).join(' & ');
    if (roll < chance){
        let blow = pickWeighted(fighters, wr => Math.pow(duelPower(wr), 2));
        fighters.forEach(wr => {
            wr.rec.b.duel[0]++;
            creditKill(wr, m.target);
            changeLoyalty(wr, 1);
            gainXp(wr, f[1]);
        });
        chron(blow, 'sw_ch_duel_blow', [name]);
        let bounty = slay();
        messageQueue(loc('sw_duel_win',[names, name, bounty.toLocaleString()]),'success',false,['combat']);
        return 'saved';
    }
    if (roll < chance + (100 - chance) * duelVars.repelShare){
        m.weaken(duelVars.repelWeaken);
        m.quiet(duelVars.repelQuiet);
        fighters.forEach(wr => {
            wr.rec.b.duel[0]++;
            wr.out = duelVars.outDays;
            gainXp(wr, f[2]);
            chron(wr, 'sw_ch_duel_repel', [name]);
        });
        messageQueue(loc('sw_duel_repel',[names, name, duelVars.outDays]),'warning',false,['combat']);
        return 'saved';
    }
    fighters.forEach(wr => {
        wr.rec.b.duel[1]++;
        changeLoyalty(wr, -1);
        gainXp(wr, f[2]);
    });
    messageQueue(loc('sw_duel_lost',[names, name]),'danger',false,['combat']);
    let victim = pickWeighted(fighters, wr => 200 - wr.stats.spd);
    deathCheck(victim, f[4]);
    return 'lost';
}

// The rewritten Unbroken achievement: first space mission with 3+ warriors, none ever Awakened.
export function unbrokenCheck(){
    let w = global.race['warriors'];
    return w && w.woke === 0 && w.roster.length >= 3;
}

// ---------------------------------------------------------------------------
// Service record
// ---------------------------------------------------------------------------

function battlesOf(rec){
    let won = 0, lost = 0;
    battleKinds.forEach(k => { won += rec.b[k][0]; lost += rec.b[k][1]; });
    return { won, lost, total: won + lost };
}

export function recordSummary(wr){
    let rec = wr.rec;
    if (!rec){ return ''; }
    let b = battlesOf(rec);
    return loc('sw_rec_summary',[rec.j === null ? '-' : rec.j, rec.sd, b.total, b.won, rec.aw, rec.dd]);
}

function esc(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Full record as HTML for a warrior (roster, veteran) or a Hall entry.
export function recordHtml(src, isHall){
    let rec = src.rec;
    let name = isHall ? src.n : src.name;
    if (!rec){ return `<p>${loc('sw_rec_none')}</p>`; }
    let stats = isHall ? src.s : src.stats;
    let rank = isHall ? src.r : rankOf(src);
    let lvl = isHall ? src.l : src.lvl;
    let b = battlesOf(rec);
    let row = (k, v) => `<tr><td class="has-text-label" style="padding:0.1rem 0.6rem 0.1rem 0">${k}</td><td style="padding:0.1rem 0">${v}</td></tr>`;
    let html = `<div style="font-size:0.9rem"><table>`;
    html += row(loc('sw_rec_rank'), loc('sw_rec_rank_v',[rank, rec.r0, rec.rb, lvl]));
    html += row(loc('sw_rec_service'), loc('sw_rec_service_v',[rec.j === null ? '-' : rec.j, rec.sd, rec.st]));
    html += row(loc('sw_rec_pay'), loc('sw_rec_pay_v',[sizeApproximation(rec.fee, 1), sizeApproximation(rec.wg, 1), rec.ud]));
    html += row(loc('sw_rec_rest'), loc('sw_rec_rest_v',[rec.rd, rec.rn]));
    html += row(loc('sw_rec_battles'), loc('sw_rec_battles_v',[b.total, b.won, b.lost]));
    html += row('', battleKinds.filter(k => rec.b[k][0] + rec.b[k][1] > 0).map(k => `${loc(`wiki_warriors_fight_${k}`)} ${rec.b[k][0]}/${rec.b[k][1]}`).join(' · ') || '-');
    html += row(loc('sw_rec_kills'), loc('sw_rec_kills_v',[rec.aw, rec.ns, rec.fs]));
    if (rec.ad > 0 || rec.ak > 0){ html += row(loc('sw_rec_abyss'), loc('sw_rec_abyss_v',[Math.round(rec.ad).toLocaleString(), rec.ak])); }
    html += row(loc('sw_rec_trials'), loc('sw_rec_trials_v',[rec.cl, rec.dd, rec.pm, rec.ll]));
    if (stats && rec.s0){
        html += row(loc('sw_rec_stats'), warriorVars.stats.map(s => `${loc(`sw_stat_${s}`).slice(0,3)} ${rec.s0[s]}→${stats[s]}`).join(' · '));
    }
    html += `</table>`;
    let ch = isHall ? (src.ch || []) : (src.chron || []);
    if (ch.length){
        html += `<div class="has-text-warning" style="margin-top:0.5rem">${loc('sw_rec_chronicle')}</div>`;
        html += ch.slice().reverse().map(c => `<div><span class="has-text-label">${loc('sw_rec_day',[c.d])}</span> ${esc(loc(c.k, c.a.map(a => esc(a))))}</div>`).join('');
    }
    html += `</div>`;
    return `<div class="has-text-warning" style="font-size:1.1rem; margin-bottom:0.4rem">${esc(name)}</div>` + html;
}

// ---------------------------------------------------------------------------
// UI (Civics → Military)
// ---------------------------------------------------------------------------

function costText(cost){
    let parts = Object.keys(cost).map(r => r === 'Money' ? `$${sizeApproximation(cost[r], 1)}` : `${sizeApproximation(cost[r], 1)} ${global.resource[r] ? global.resource[r].name : r}`);
    return parts.length ? parts.join(', ') : loc('sw_seat_free');
}

export function drawWarriors(){
    let el = $('#silverWarriors');
    if (el.length){ clearElement(el); el.remove(); }
    if (!global.race['yoki_power'] || global.race['warlord']){ return; }
    let w = warriorState();

    let panel = $(`<div id="silverWarriors" class="tile is-child" v-show="unlocked()" style="margin-top: 1rem; display: block;"></div>`);
    $('#military').append(panel);

    let statRow = (src) => warriorVars.stats.map(s => `
        <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem;">
            <span style="width:4.5rem" class="has-text-label">${loc(`sw_stat_${s}`)}</span>
            <span style="flex:1; height:0.5rem; background:rgba(128,128,128,0.25); border-radius:2px;"><span :style="{display:'block', height:'100%', width: ${src}.stats.${s} + '%', background:'currentColor'}" class="has-text-info"></span></span>
            <span style="width:2rem; text-align:right">{{ ${src}.stats.${s} }}</span>
        </div>`).join('');

    let perkChips = (src) => `<span v-for="p in ${src}.perks" :key="p" :title="perkDesc(p)" :class="perkClass(p)" style="margin-right:0.5rem; font-size:0.85rem;">{{ perkName(p) }}</span>`;
    let box = 'border:1px solid rgba(128,128,128,0.4); border-radius:4px; padding:0.5rem; width:18rem; max-width:100%;';

    panel.append(`
        <h2 class="has-text-warning">${loc('sw_title')} <span class="has-text-label" style="font-size:0.9rem">({{ w.roster.length }} / {{ seats() }})</span></h2>
        <div class="has-text-label" style="font-size:0.85rem; margin-bottom:0.5rem">${loc('sw_intro')}</div>

        <div style="font-size:0.85rem; margin-bottom:0.5rem">
            <div v-if="next()">
                <span class="has-text-warning">${loc('sw_seat')} {{ next().n }}:</span>
                <span :class="next().ready ? 'has-text-success' : 'has-text-danger'">{{ seatReq(next().req) }}</span>
                · {{ seatCost(next().cost) }}
                <button class="button is-small" style="margin-left:0.3rem" :disabled="!next().ready || !canPay(next().cost)" @click="commission()">${loc('sw_seat_buy')}</button>
            </div>
            <div v-else class="has-text-label">${loc('sw_seat_all')}</div>
            <div>${loc('sw_handlers')}: {{ hUsed() }} / {{ hCount() }}<span v-if="tCap() > 0"> · ${loc('sw_tonic')}: {{ Math.floor(w.tonic) }} / {{ tCap() }}</span></div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:0.75rem;">
            <div v-for="wr in w.roster" :key="wr.id" :style="'${box}' + (wr.fp ? ' border-color:#c33;' : '')">
                <div style="display:flex; justify-content:space-between">
                    <span><a class="has-text-warning" style="font-weight:bold" :title="summary(wr)" @click="showRecord(wr)">{{ wr.name }}</a> <span class="has-text-label">No. {{ rank(wr) }}</span></span>
                    <span>${loc('sw_level')} {{ wr.lvl }} <span class="has-text-label" style="font-size:0.8rem">({{ wr.xp }}/${warriorVars.xpPerLevel})</span></span>
                </div>
                <div style="font-size:0.85rem">
                    <span :class="wr.status === 'active' ? 'has-text-success' : 'has-text-caution'">{{ wr.status === 'active' ? '${loc('sw_active')}' : '${loc('sw_resting')}' }}</span>
                    · {{ temperName(wr.temper) }} · ${loc('sw_potential')} {{ pot(wr) }}
                    <span v-if="wr.fp" class="has-text-danger"> · ${loc('sw_full')}</span>
                    <span v-if="wr.out > 0" class="has-text-caution"> · ${loc('sw_recovering')} ({{ wr.out }} ${loc('sw_days')})</span>
                    <span v-if="wr.hold" class="has-text-label"> · ${loc('sw_hold_on')}</span>
                </div>
                ${statRow('wr')}
                <div>${perkChips('wr')}</div>
                <div style="font-size:0.85rem">${loc('sw_loyalty')}: <span :class="loyClass(wr)">{{ Math.round(wr.loyalty) }} ({{ mood(wr) }})</span></div>
                <div style="font-size:0.85rem">${loc('sw_meter')}: <span :class="meterClass(wr)">{{ Math.floor(wr.meter) }}</span>
                    <span v-if="stage(wr) > 0" :class="meterClass(wr)"> · {{ warnText(wr) }}</span>
                    <span v-if="atFloor(wr)" class="has-text-label"> · ${loc('sw_at_floor')}</span>
                </div>
                <div style="font-size:0.85rem">${loc('sw_wage')}: \${{ money(wr.wage) }} ${loc('sw_per_day')}<span v-if="wr.unpaid > 0" class="has-text-danger"> (${loc('sw_unpaid_short')} {{ wr.unpaid }})</span>
                    <span v-if="wr.hd" class="has-text-success"> · ${loc('sw_handler_on')}</span></div>
                <div v-if="wr.card" style="margin-top:0.4rem; border:1px solid #c33; border-radius:4px; padding:0.4rem; font-size:0.85rem;">
                    <div class="has-text-danger">${loc('sw_card_title')}</div>
                    <div>${loc('sw_card_text')}</div>
                    <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.3rem;">
                        <button class="button is-small" title="${loc('sw_card_honour_tip')}" @click="card(wr.id,'honour')">${loc('sw_card_honour')}</button>
                        <button class="button is-small" :disabled="w.tonic < 1" title="${loc('sw_card_tonic_tip',[warriorVars.tonicFail])}" @click="card(wr.id,'tonic')">${loc('sw_card_tonic')}</button>
                        <button class="button is-small" title="${loc('sw_card_rest_tip',[warriorVars.restSaveRisk])}" @click="card(wr.id,'rest')">${loc('sw_card_rest')}</button>
                        <button class="button is-small" title="${loc('sw_card_ignore_tip')}" @click="card(wr.id,'ignore')">${loc('sw_card_ignore')}</button>
                    </div>
                </div>
                <div style="margin-top:0.4rem; display:flex; flex-wrap:wrap; gap:0.3rem;">
                    <button class="button is-small" :disabled="wr.cd > 0" @click="rest(wr.id)">{{ wr.cd > 0 ? wr.cd + 's' : (wr.status === 'active' ? '${loc('sw_rest')}' : '${loc('sw_activate')}') }}</button>
                    <button class="button is-small" :class="wr.fp ? 'is-danger' : ''" :disabled="wr.status !== 'active'" title="${loc('sw_full_tip',[warriorVars.fullBonus, warriorVars.fullMeter])}" @click="full(wr.id)">${loc('sw_full_btn')}</button>
                    <button class="button is-small" title="${loc('sw_hold_tip')}" @click="hold(wr.id)">{{ wr.hold ? '${loc('sw_stance_intercept')}' : '${loc('sw_stance_hold')}' }}</button>
                    <button class="button is-small" :disabled="!wr.hd && hUsed() >= hCount()" title="${loc('sw_handler_tip',[warriorVars.handlerCut * 100])}" @click="handler(wr.id)">{{ wr.hd ? '${loc('sw_handler_off')}' : '${loc('sw_handler_btn')}' }}</button>
                    <button v-if="tCap() > 0" class="button is-small" :disabled="w.tonic < 1" title="${loc('sw_tonic_tip',[warriorVars.tonicCut])}" @click="tonic(wr.id)">${loc('sw_tonic_btn')}</button>
                    <button class="button is-small" @click="showRecord(wr)">${loc('sw_record')}</button>
                    <button class="button is-small" @click="renameW(wr)">${loc('sw_rename')}</button>
                    <button class="button is-small" @click="retireW(wr)">${loc('sw_retire')}</button>
                    <button class="button is-small" @click="dismissW(wr)">${loc('sw_dismiss')}</button>
                </div>
            </div>
        </div>

        <h3 class="has-text-warning" style="margin-top:1rem">${loc('sw_recruits')}
            <span class="has-text-label" style="font-size:0.85rem">${loc('sw_refresh_in')} {{ w.refresh }} ${loc('sw_days')}</span>
            <button class="button is-small" style="margin-left:0.5rem" @click="refresh()">${loc('sw_refresh')} (\${{ money(refreshCost()) }})</button>
        </h3>
        <div style="display:flex; flex-wrap:wrap; gap:0.75rem;">
            <div v-for="wr in w.pool" :key="wr.id" style="${box} border-style:dashed;">
                <div v-if="wr.returning" class="has-text-success" style="font-size:0.85rem">${loc('sw_former')} ({{ moodName(wr.mood) }})</div>
                <div style="display:flex; justify-content:space-between">
                    <span><b>{{ wr.name }}</b> <span class="has-text-label">No. {{ rank(wr) }}</span></span>
                    <span>${loc('sw_level')} {{ wr.lvl }}</span>
                </div>
                <div style="font-size:0.85rem">{{ temperName(wr.temper) }} · ${loc('sw_potential')} {{ pot(wr) }}</div>
                ${statRow('wr')}
                <div>${perkChips('wr')}</div>
                <div style="font-size:0.85rem">${loc('sw_fee')}: \${{ money(wr.fee) }} · ${loc('sw_wage')}: \${{ money(wage(wr)) }} ${loc('sw_per_day')}</div>
                <div style="margin-top:0.4rem; display:flex; gap:0.3rem;">
                    <button class="button is-small" :disabled="w.roster.length >= seats() || !afford(wr.fee)" @click="hireW(wr.id)">${loc('sw_hire')}</button>
                    <button v-if="wr.returning" class="button is-small" @click="showRecord(wr)">${loc('sw_record')}</button>
                </div>
            </div>
        </div>

        <div v-if="w.vets.length" style="margin-top:1rem">
            <h3 class="has-text-warning">${loc('sw_vets')}</h3>
            <div v-for="v in w.vets" :key="v.id" style="font-size:0.85rem">
                <a class="has-text-warning" @click="showRecord(v)">{{ v.name }}</a> (No. {{ rank(v) }}, ${loc('sw_level')} {{ v.lvl }}):
                {{ howName(v.how) }}, <span :class="moodClass(v.mood)">{{ moodName(v.mood) }}</span>, ${loc('sw_vet_away')} {{ away(v) }} ${loc('sw_days')}<span v-if="v.rise" class="has-text-danger"> · ${loc('sw_vet_restless')}</span>
            </div>
        </div>

        <div v-if="hallList().length" style="margin-top:1rem">
            <h3 class="has-text-warning">${loc('sw_hall')}</h3>
            <div v-for="(h, i) in hallList()" :key="i" style="font-size:0.85rem">
                <a v-if="h.rec" @click="showHall(h)"><b>{{ h.n }}</b></a><b v-else>{{ h.n }}</b><span v-if="h.l"> (No. {{ h.r }}, ${loc('sw_level')} {{ h.l }})</span>: {{ fate(h.f) }}
            </div>
        </div>
    `);

    vBind({
        el: '#silverWarriors',
        data: { w: w },
        methods: {
            unlocked(){ return yokiActive() && (seats() > 0 || orgCount() > 0); },
            seats(){ return seats(); },
            next(){ return nextSeat(); },
            seatReq(r){ return loc(`sw_seat_req_${r}`); },
            seatCost(c){ return costText(c); },
            canPay(c){ return canPay(c); },
            commission(){ commissionSeat(); },
            hCount(){ return handlerCount(); },
            hUsed(){ return handlersUsed(); },
            tCap(){ return tonicCap(); },
            rank(wr){ return rankOf(wr); },
            pot(wr){ return potential(wr); },
            wage(wr){ return baseWage(wr); },
            money(v){ return sizeApproximation(v, 1); },
            afford(v){ return global.resource.Money.amount >= v; },
            perkName(p){ return loc(`sw_perk_${p}`); },
            perkDesc(p){ return loc(`sw_perk_${p}_desc`); },
            perkClass(p){ return perkList[p] && perkList[p].good ? 'has-text-success' : 'has-text-danger'; },
            temperName(t){ return loc(`sw_temper_${t}`); },
            mood(wr){ return wr.loyalty >= 75 ? loc('sw_mood_devoted') : wr.loyalty >= 50 ? loc('sw_mood_content') : wr.loyalty >= 25 ? loc('sw_mood_uneasy') : loc('sw_mood_resentful'); },
            moodName(m){ return loc(`sw_mood_${m}`); },
            moodClass(m){ return m === 'grateful' ? 'has-text-success' : m === 'neutral' ? 'has-text-warning' : 'has-text-danger'; },
            howName(h){ return loc(`sw_fate_${h}`); },
            away(v){ return today() - v.left; },
            loyClass(wr){ return wr.loyalty >= 50 ? 'has-text-success' : wr.loyalty >= 25 ? 'has-text-warning' : 'has-text-danger'; },
            stage(wr){ return stageOf(wr); },
            warnText(wr){ return loc(`sw_warn_short_${stageOf(wr)}`); },
            meterClass(wr){ let s = stageOf(wr); return s >= 2 ? 'has-text-danger' : s === 1 ? 'has-text-caution' : 'has-text-warning'; },
            atFloor(wr){ return wr.status === 'resting' && wr.meter > 0 && wr.meter <= floorOf(wr) + 0.01; },
            summary(wr){ return recordSummary(wr); },
            fate(f){ return loc(`sw_fate_${f}`); },
            hallList(){ return hall().slice(0, 15); },
            refreshCost(){ return refreshCost(); },
            refresh(){ refreshPool(true); },
            hireW(id){ hire(id); },
            rest(id){ toggleRest(id); },
            full(id){ toggleFull(id); },
            handler(id){ toggleHandler(id); },
            hold(id){ toggleHold(id); },
            tonic(id){ useTonic(id); },
            card(id, c){ blackCard(id, c); },
            showRecord(wr){
                this.$buefy.dialog.alert({ message: recordHtml(wr, false), confirmText: loc('sw_close'), canCancel: ['escape','outside'] });
            },
            showHall(h){
                this.$buefy.dialog.alert({ message: recordHtml(h, true), confirmText: loc('sw_close'), canCancel: ['escape','outside'] });
            },
            renameW(wr){
                this.$buefy.dialog.prompt({
                    message: loc('sw_rename_prompt'),
                    inputAttrs: { value: wr.name, maxlength: 24 },
                    trapFocus: true,
                    onConfirm: (value) => rename(wr.id, value)
                });
            },
            retireW(wr){
                let cost = retireCost(wr);
                let msg = loc('sw_retire_confirm',[wr.name, sizeApproximation(severance(wr), 1), sizeApproximation(backPay(wr), 1), sizeApproximation(cost, 1), loc(`sw_mood_${partingMood(wr,'retired')}`)]);
                if (global.resource.Money.amount < cost){ msg += `<br><span class="has-text-danger">${loc('sw_retire_poor')}</span>`; }
                this.$buefy.dialog.confirm({
                    message: msg,
                    confirmText: loc('sw_retire'),
                    onConfirm: () => retire(wr.id)
                });
            },
            dismissW(wr){
                this.$buefy.dialog.confirm({
                    message: loc('sw_dismiss_confirm',[wr.name, Math.round(dismissHit(wr) * 10) / 10, loc(`sw_mood_${partingMood(wr,'dismissed')}`)]),
                    confirmText: loc('sw_dismiss'),
                    type: 'is-danger',
                    onConfirm: () => dismiss(wr.id)
                });
            }
        }
    });
}
