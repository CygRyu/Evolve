// Expansion: Silverblood warriors.
//
// Recruitable named warriors with random stats, Fire Emblem-style growth
// rates, perks, temperament and loyalty. Each has her own Awakening meter.
// Warriors can be rested, retired, killed (with a chance to defy death),
// Awaken into named bosses, or turn on you out of a grudge.
//
// State: global.race.warriors (per run), global.stats.silver_hall (across runs).

import { global, sizeApproximation } from './vars.js';
import { loc } from './locale.js';
import { vBind, messageQueue, clearElement } from './functions.js';
import { yokiActive, yokiState } from './silverblood.js';

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
    activeGain: 0.2,          // personal meter gained per day while active
    armyDivisor: 800,         // army bonus = total might / this
    senseDivisor: 500,        // hunt damage bonus = total sense / this
    willDivisor: 1000,        // army stress reduction = total will / this (max 50%)
    speedCdCut: 1000,         // abyss cooldown cut = total speed / this (max 50%)
    defyBase: 5,
    defyMax: 25,
};

export const fights = {
    // [meter gain, xp win, xp loss, death% win, death% loss]
    hunt:     [6, 40, 20, 2, 10],
    abyss:    [10, 50, 50, 4, 4],
    raid:     [3, 15, 10, 0.5, 3],
    campaign: [2, 10, 10, 0, 0],
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

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function warriorState(){
    if (!global.race['warriors']){
        global.race['warriors'] = { roster: [], pool: [], refresh: 0, nextId: 1, lastDay: global.stats.days || 0, named: [], grudges: [], msg: '' };
    }
    let w = global.race.warriors;
    ['roster','pool','named','grudges'].forEach(k => { if (!Array.isArray(w[k])){ w[k] = []; } });
    return w;
}

function hall(){
    if (!Array.isArray(global.stats['silver_hall'])){ global.stats['silver_hall'] = []; }
    return global.stats.silver_hall;
}

function addHall(wr, fate){
    let h = hall();
    h.unshift({ n: wr.name, r: rankOf(wr), l: wr.lvl, f: fate, d: global.stats.days || 0 });
    if (h.length > 50){ h.length = 50; }
}

export function slots(){
    let orgs = global.city['organization'] ? global.city.organization.count : 0;
    return Math.min(warriorVars.maxSlots, orgs);
}

export function active(){
    if (!yokiActive() || !global.race['warriors']){ return []; }
    return global.race.warriors.roster.filter(x => x.status === 'active');
}

function rand(min, max){ return Math.rand(min, max + 1); } // inclusive
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function pick(list){ return list[Math.rand(0, list.length)]; }

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
    let used = w.roster.concat(w.pool).map(x => x.name);
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
// Player actions
// ---------------------------------------------------------------------------

export function hire(id){
    let w = warriorState();
    let idx = w.pool.findIndex(x => x.id === id);
    if (idx < 0 || w.roster.length >= slots()){ return false; }
    let wr = w.pool[idx];
    if (global.resource.Money.amount < wr.fee){ return false; }
    global.resource.Money.amount -= wr.fee;
    w.pool.splice(idx, 1);
    w.roster.push(wr);
    messageQueue(loc('sw_hired',[wr.name, rankOf(wr)]),'success',false,['combat']);
    return true;
}

export function toggleRest(id){
    let wr = warriorState().roster.find(x => x.id === id);
    if (!wr || wr.cd > 0){ return false; }
    wr.status = wr.status === 'active' ? 'resting' : 'active';
    wr.cd = warriorVars.restCooldown;
    return true;
}

export function rename(id, name){
    let wr = warriorState().roster.find(x => x.id === id);
    if (!wr || typeof name !== 'string'){ return; }
    let clean = name.replace(/[<>]/g, '').trim().slice(0, 24);
    if (clean.length){ wr.name = clean; }
}

export function retire(id){
    let w = warriorState();
    let idx = w.roster.findIndex(x => x.id === id);
    if (idx < 0){ return; }
    let wr = w.roster[idx];
    w.roster.splice(idx, 1);
    addHall(wr, 'retired');
    // A warrior who leaves unhappy may come back for revenge.
    let chance = Math.max(0, 40 - wr.loyalty) * 2.5 * temperaments[wr.temper].rogue;
    if (Math.rand(0, 100) < chance){
        w.grudges.push({ name: wr.name, str: bossStrength(wr, 1.2), due: (global.stats.days || 0) + rand(60, 200) });
    }
    messageQueue(loc('sw_retired',[wr.name]),'info',false,['combat']);
}

// ---------------------------------------------------------------------------
// Bosses made from your own warriors
// ---------------------------------------------------------------------------

function techFactor(){
    return global.tech['high_tech'] ? global.tech['high_tech'] + 1 : 1;
}

function bossStrength(wr, mult){
    return Math.round((might(wr) * 2 + wr.lvl * 10) * mult * techFactor());
}

function turnBoss(wr, kind, mult){
    let w = warriorState();
    w.named.push({ name: wr.name, str: bossStrength(wr, mult), kind });
}

export function namedBoss(){
    let w = global.race['warriors'];
    return w && w.named.length ? w.named[0] : null;
}

export function namedDefeated(){
    let w = warriorState();
    let b = w.named.shift();
    if (b){ addHall({ name: b.name, lvl: 0, stats: { str: 0, spd: 0, ctl: 0, sns: 0, wil: 0 } }, b.kind === 'rogue' ? 'slain_rogue' : 'slain_awakened'); }
    return b;
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
}

function awaken(wr){
    let w = warriorState();
    w.roster.splice(w.roster.findIndex(x => x.id === wr.id), 1);
    turnBoss(wr, 'awakened', 1);
    addHall(wr, 'awakened');
    yokiState().woke++;
    moraleHit(3, wr.id);
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
    if (slots() > 0 && w.pool.length === 0 && w.refresh <= 0){
        refreshPool(false);
    }
    let today = global.stats.days || 0;
    if (today !== w.lastDay){
        let n = Math.max(0, Math.min(10, today - w.lastDay));
        w.lastDay = today;
        for (let i = 0; i < n; i++){ dailyTick(w); }
    }
}

function meterMult(wr){
    let m = 1.5 - wr.stats.ctl / 100;
    if (wr.perks.includes('hot_headed')){ m *= 2; }
    if (wr.perks.includes('iron_control')){ m *= 0.6; }
    return Math.max(0.1, m);
}

function dailyTick(w){
    if (w.refresh > 0){ w.refresh--; }
    if (w.refresh <= 0 && slots() > 0){ refreshPool(false); }

    // Wages, loyalty, meters
    w.roster.slice().forEach(wr => {
        if (global.resource.Money.amount >= wr.wage){
            global.resource.Money.amount -= wr.wage;
            wr.unpaid = 0;
            changeLoyalty(wr, 0.3);
        }
        else {
            wr.unpaid++;
            changeLoyalty(wr, wr.perks.includes('greedy') ? -8 : -4);
            if (wr.unpaid === 1){ messageQueue(loc('sw_unpaid',[wr.name]),'warning',false,['combat']); }
        }
        if (wr.status === 'resting'){
            wr.meter = Math.max(0, wr.meter - warriorVars.restDecay);
            if (wr.temper === 'proud'){ changeLoyalty(wr, -0.4); }
        }
        else {
            wr.meter += warriorVars.activeGain * meterMult(wr);
        }
        if (wr.meter >= 100){ awaken(wr); return; }

        // Desertion
        if ((wr.loyalty < 10 || (wr.loyalty < 20 && wr.unpaid >= 3)) && Math.rand(0, 100) < 3){
            w.roster.splice(w.roster.findIndex(x => x.id === wr.id), 1);
            addHall(wr, 'deserted');
            let rogue = (wr.loyalty < 5 ? 60 : 30) * temperaments[wr.temper].rogue;
            if (Math.rand(0, 100) < rogue){
                w.grudges.push({ name: wr.name, str: bossStrength(wr, 1.2), due: (global.stats.days || 0) + rand(30, 90) });
            }
            messageQueue(loc('sw_deserted',[wr.name]),'danger',false,['combat']);
        }
    });

    // Old grudges come due
    let today = global.stats.days || 0;
    for (let i = w.grudges.length - 1; i >= 0; i--){
        if (today >= w.grudges[i].due){
            let g = w.grudges.splice(i, 1)[0];
            w.named.push({ name: g.name, str: g.str, kind: 'rogue' });
            messageQueue(loc('sw_grudge',[g.name]),'danger',false,['combat']);
        }
    }
}

// ---------------------------------------------------------------------------
// Combat hooks
// ---------------------------------------------------------------------------

export function warriorsArmyBonus(){
    let total = active().reduce((t, wr) => t + might(wr), 0);
    return total / warriorVars.armyDivisor;
}

export function warriorsHuntMult(){
    let a = active();
    let sense = a.reduce((t, wr) => t + wr.stats.sns, 0) / warriorVars.senseDivisor;
    let quick = a.filter(wr => wr.perks.includes('quick_draw')).length * 0.1;
    return 1 + sense + quick;
}

export function warriorsLossMult(){
    let def = active().filter(wr => wr.perks.includes('defensive')).length * 0.25;
    return 1 - Math.min(0.75, def);
}

export function warriorsStressCut(){
    let will = active().reduce((t, wr) => t + wr.stats.wil, 0) / warriorVars.willDivisor;
    return Math.min(0.5, will);
}

export function warriorsStressAdd(){
    return active().filter(wr => wr.perks.includes('haunted')).length;
}

export function warriorsCdMult(){
    let spd = active().reduce((t, wr) => t + wr.stats.spd, 0) / warriorVars.speedCdCut;
    return 1 - Math.min(0.5, spd);
}

function defyChance(wr){
    let c = warriorVars.defyBase + (wr.stats.wil + wr.stats.ctl) / 10;
    if (wr.perks.includes('unyielding')){ c += 10; }
    return clamp(c, warriorVars.defyBase, warriorVars.defyMax);
}

// Called after any fight. kind: hunt | abyss | raid | campaign
export function warriorsBattle(kind, won){
    if (!yokiActive()){ return; }
    let f = fights[kind];
    if (!f){ return; }
    let w = warriorState();
    active().forEach(wr => {
        // Death check
        let death = (won ? f[3] : f[4]) * (1.25 - wr.stats.spd / 200);
        if (death > 0 && Math.rand(0, 10000) < death * 100){
            if (Math.rand(0, 100) < defyChance(wr)){
                wr.meter += 20;
                messageQueue(loc('sw_defied',[wr.name]),'special',false,['combat']);
            }
            else {
                w.roster.splice(w.roster.findIndex(x => x.id === wr.id), 1);
                addHall(wr, 'fell');
                moraleHit(3, wr.id);
                messageQueue(loc('sw_fell',[wr.name]),'danger',false,['combat']);
                return;
            }
        }
        wr.meter += f[0] * meterMult(wr);
        changeLoyalty(wr, won ? 1 : -1);
        gainXp(wr, won ? f[1] : f[2]);
        if (wr.meter >= 100){ awaken(wr); }
    });
}

// ---------------------------------------------------------------------------
// UI (Civics → Military)
// ---------------------------------------------------------------------------

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

    panel.append(`
        <h2 class="has-text-warning">${loc('sw_title')} <span class="has-text-label" style="font-size:0.9rem">({{ w.roster.length }} / {{ slots() }})</span></h2>
        <div class="has-text-label" style="font-size:0.85rem; margin-bottom:0.5rem">${loc('sw_intro')}</div>

        <div style="display:flex; flex-wrap:wrap; gap:0.75rem;">
            <div v-for="wr in w.roster" :key="wr.id" style="border:1px solid rgba(128,128,128,0.4); border-radius:4px; padding:0.5rem; width:18rem;">
                <div style="display:flex; justify-content:space-between">
                    <span><b class="has-text-warning">{{ wr.name }}</b> <span class="has-text-label">No. {{ rank(wr) }}</span></span>
                    <span>${loc('sw_level')} {{ wr.lvl }} <span class="has-text-label" style="font-size:0.8rem">({{ wr.xp }}/${warriorVars.xpPerLevel})</span></span>
                </div>
                <div style="font-size:0.85rem">
                    <span :class="wr.status === 'active' ? 'has-text-success' : 'has-text-caution'">{{ wr.status === 'active' ? '${loc('sw_active')}' : '${loc('sw_resting')}' }}</span>
                    · {{ temperName(wr.temper) }} · ${loc('sw_potential')} {{ pot(wr) }}
                </div>
                ${statRow('wr')}
                <div>${perkChips('wr')}</div>
                <div style="font-size:0.85rem">${loc('sw_loyalty')}: <span :class="loyClass(wr)">{{ Math.round(wr.loyalty) }} ({{ mood(wr) }})</span></div>
                <div style="font-size:0.85rem">${loc('sw_meter')}: <span :class="wr.meter >= 75 ? 'has-text-danger' : 'has-text-warning'">{{ Math.floor(wr.meter) }}%</span></div>
                <div style="font-size:0.85rem">${loc('sw_wage')}: \${{ money(wr.wage) }} ${loc('sw_per_day')}<span v-if="wr.unpaid > 0" class="has-text-danger"> (${loc('sw_unpaid_short')} {{ wr.unpaid }})</span></div>
                <div style="margin-top:0.4rem; display:flex; gap:0.3rem;">
                    <button class="button is-small" :disabled="wr.cd > 0" @click="rest(wr.id)">{{ wr.cd > 0 ? wr.cd + 's' : (wr.status === 'active' ? '${loc('sw_rest')}' : '${loc('sw_activate')}') }}</button>
                    <button class="button is-small" @click="renameW(wr)">${loc('sw_rename')}</button>
                    <button class="button is-small" @click="retireW(wr)">${loc('sw_retire')}</button>
                </div>
            </div>
        </div>

        <h3 class="has-text-warning" style="margin-top:1rem">${loc('sw_recruits')}
            <span class="has-text-label" style="font-size:0.85rem">${loc('sw_refresh_in')} {{ w.refresh }} ${loc('sw_days')}</span>
            <button class="button is-small" style="margin-left:0.5rem" @click="refresh()">${loc('sw_refresh')} (\${{ money(refreshCost()) }})</button>
        </h3>
        <div style="display:flex; flex-wrap:wrap; gap:0.75rem;">
            <div v-for="wr in w.pool" :key="wr.id" style="border:1px dashed rgba(128,128,128,0.4); border-radius:4px; padding:0.5rem; width:18rem;">
                <div style="display:flex; justify-content:space-between">
                    <span><b>{{ wr.name }}</b> <span class="has-text-label">No. {{ rank(wr) }}</span></span>
                    <span>${loc('sw_level')} {{ wr.lvl }}</span>
                </div>
                <div style="font-size:0.85rem">{{ temperName(wr.temper) }} · ${loc('sw_potential')} {{ pot(wr) }}</div>
                ${statRow('wr')}
                <div>${perkChips('wr')}</div>
                <div style="font-size:0.85rem">${loc('sw_fee')}: \${{ money(wr.fee) }} · ${loc('sw_wage')}: \${{ money(wr.wage) }} ${loc('sw_per_day')}</div>
                <button class="button is-small" style="margin-top:0.4rem" :disabled="w.roster.length >= slots() || !afford(wr.fee)" @click="hireW(wr.id)">${loc('sw_hire')}</button>
            </div>
        </div>

        <div v-if="hallList().length" style="margin-top:1rem">
            <h3 class="has-text-warning">${loc('sw_hall')}</h3>
            <div v-for="(h, i) in hallList()" :key="i" style="font-size:0.85rem">
                <b>{{ h.n }}</b><span v-if="h.l"> (No. {{ h.r }}, ${loc('sw_level')} {{ h.l }})</span>: {{ fate(h.f) }}
            </div>
        </div>
    `);

    vBind({
        el: '#silverWarriors',
        data: { w: w },
        methods: {
            unlocked(){ return yokiActive() && slots() > 0; },
            slots(){ return slots(); },
            rank(wr){ return rankOf(wr); },
            pot(wr){ return potential(wr); },
            money(v){ return sizeApproximation(v, 1); },
            afford(v){ return global.resource.Money.amount >= v; },
            perkName(p){ return loc(`sw_perk_${p}`); },
            perkDesc(p){ return loc(`sw_perk_${p}_desc`); },
            perkClass(p){ return perkList[p] && perkList[p].good ? 'has-text-success' : 'has-text-danger'; },
            temperName(t){ return loc(`sw_temper_${t}`); },
            mood(wr){ return wr.loyalty >= 75 ? loc('sw_mood_devoted') : wr.loyalty >= 50 ? loc('sw_mood_content') : wr.loyalty >= 25 ? loc('sw_mood_uneasy') : loc('sw_mood_resentful'); },
            loyClass(wr){ return wr.loyalty >= 50 ? 'has-text-success' : wr.loyalty >= 25 ? 'has-text-warning' : 'has-text-danger'; },
            fate(f){ return loc(`sw_fate_${f}`); },
            hallList(){ return hall().slice(0, 15); },
            refreshCost(){ return refreshCost(); },
            refresh(){ refreshPool(true); },
            hireW(id){ hire(id); },
            rest(id){ toggleRest(id); },
            renameW(wr){
                this.$buefy.dialog.prompt({
                    message: loc('sw_rename_prompt'),
                    inputAttrs: { value: wr.name, maxlength: 24 },
                    trapFocus: true,
                    onConfirm: (value) => rename(wr.id, value)
                });
            },
            retireW(wr){
                this.$buefy.dialog.confirm({
                    message: loc('sw_retire_confirm',[wr.name]),
                    confirmText: loc('sw_retire'),
                    onConfirm: () => retire(wr.id)
                });
            }
        }
    });
}
