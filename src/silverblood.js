// Expansion: Silverblood race mechanics.
//
// Awakening meter: soldiers with Demon Power (yoki_power) slowly build up
// Awakening. The Organization building and Handler job hold it back.
// At 100% a warrior Awakens and becomes a monster that must be hunted.
//
// State lives in global.race.awakening = { m, boss, str, rate, hunts }.

import { global } from './vars.js';
import { loc } from './locale.js';
import { traits } from './races.js';
import { armyRating, garrisonSize, soldierDeath } from './civics.js';
import { messageQueue } from './functions.js';
import { drawCity, initStruct, actions } from './actions.js';

export const yokiVars = {
    soldierGain: 0.004,   // meter %/s per healthy soldier
    woundGain: 0.012,     // extra meter %/s per wounded soldier
    battleGain: 4,        // meter % per offensive campaign
    orgCalm: 0.03,        // meter %/s removed per Organization
    handlerCalm: 0.06,    // meter %/s removed per Handler
    resetTo: 25,          // meter after an Awakening
    maxBoss: 3,           // most Awakened Ones alive at once
    rampage: 40,          // ~1 in N chance per second, per Awakened One, to kill a soldier
    stressPerBoss: 3,     // morale stress per Awakened One
};

export function yokiActive(){
    return global.race['yoki_power'] && global.race.species !== 'protoplasm';
}

export function yokiState(){
    if (!global.race['awakening']){
        global.race['awakening'] = { m: 0, boss: 0, str: 0, rate: 0, hunts: 0 };
    }
    return global.race.awakening;
}

function techFactor(){
    return global.tech['high_tech'] ? global.tech['high_tech'] + 1 : 1;
}

function newStrength(){
    return Math.rand(30, 61) * techFactor();
}

function orgCount(){
    return global.city['organization'] ? global.city.organization.count : 0;
}

function handlers(){
    return global.civic['handler'] ? global.civic.handler.workers : 0;
}

// Per-second rates, also used for tooltips.
export function yokiRates(){
    let gain = 0;
    if (global.civic['garrison']){
        let mult = traits.yoki_power.vars()[1] / 100;
        let wounded = global.civic.garrison.wounded || 0;
        let healthy = Math.max(0, garrisonSize() - wounded);
        gain = (healthy * yokiVars.soldierGain + wounded * yokiVars.woundGain) * mult;
    }
    let calm = orgCount() * yokiVars.orgCalm + handlers() * yokiVars.handlerCalm;
    return { gain, calm, net: gain - calm };
}

// Called once per game second from midLoop.
export function yokiTick(){
    if (!yokiActive()){ return; }
    let a = yokiState();
    if (!global.city['organization']){
        initStruct(actions.city.organization);
    }
    let r = yokiRates();
    a.rate = r.net;
    a.m = Math.min(100, Math.max(0, a.m + r.net));

    if (a.m >= 100){
        awaken(a);
    }

    if (a.boss > 0 && global.civic['garrison'] && global.civic.garrison.workers > 0){
        for (let i = 0; i < a.boss; i++){
            if (Math.rand(0, yokiVars.rampage) === 0){
                soldierDeath(1);
                messageQueue(loc('yoki_rampage'),'danger',false,['combat']);
                break;
            }
        }
    }
}

function awaken(a){
    a.m = yokiVars.resetTo;
    if (a.boss >= yokiVars.maxBoss){
        // Already overrun: the new monster takes soldiers with it instead.
        let killed = Math.min(Math.rand(2, 6), global.civic.garrison.workers);
        soldierDeath(killed);
        messageQueue(loc('yoki_awaken_overrun',[killed]),'danger',false,['combat']);
        return;
    }
    let wasZero = a.boss === 0;
    a.boss++;
    a.str = Math.max(a.str, newStrength());
    messageQueue(loc('yoki_awaken',[a.boss]),'danger',false,['combat']);
    if (wasZero){ drawCity(); }
}

// Battles push warriors closer to the edge.
export function yokiBattle(){
    if (!yokiActive()){ return; }
    let a = yokiState();
    a.m = Math.min(100, a.m + yokiVars.battleGain);
}

export function yokiStress(){
    if (!yokiActive()){ return 0; }
    return yokiState().boss * yokiVars.stressPerBoss;
}

// The "Hunt the Awakened" action.
export function yokiHunt(){
    let a = yokiState();
    if (a.boss <= 0){ return false; }
    let wounded = global.civic.garrison.wounded || 0;
    let ready = garrisonSize() - wounded;
    if (ready <= 0){
        messageQueue(loc('yoki_hunt_nosoldiers'),'warning',false,['combat']);
        return false;
    }
    let luck = Math.rand(8, 13) / 10;
    let army = armyRating(garrisonSize(), 'army', wounded) * luck;
    a.hunts++;
    if (army >= a.str){
        let killed = Math.min(Math.rand(0, Math.ceil(a.str / 25) + 1), ready);
        let hurt = Math.min(Math.rand(0, Math.ceil(a.str / 10) + 1), ready - killed);
        soldierDeath(killed);
        global.civic.garrison.wounded = Math.min(wounded + hurt, global.civic.garrison.workers);
        let bounty = Math.round(a.str * 60);
        global.resource.Money.amount = Math.min(global.resource.Money.max, global.resource.Money.amount + bounty);
        a.boss--;
        a.str = a.boss > 0 ? newStrength() : 0;
        messageQueue(loc('yoki_hunt_win',[killed, hurt, bounty.toLocaleString()]),'success',false,['combat']);
        if (a.boss === 0){ drawCity(); }
    }
    else {
        let killed = Math.min(Math.rand(2, Math.ceil(a.str / 12) + 3), ready);
        let hurt = Math.min(Math.rand(1, Math.ceil(a.str / 8) + 2), ready - killed);
        soldierDeath(killed);
        global.civic.garrison.wounded = Math.min(wounded + hurt, global.civic.garrison.workers);
        // The beast is hurt too, so each failed hunt makes the next one easier.
        a.str = Math.max(1, Math.round(a.str * 0.8));
        messageQueue(loc('yoki_hunt_loss',[killed, hurt]),'danger',false,['combat']);
    }
    return false;
}

export function yokiHuntEffect(){
    let a = yokiState();
    let army = global.civic['garrison'] ? Math.round(armyRating(garrisonSize(), 'army', global.civic.garrison.wounded)) : 0;
    return `<div>${loc('city_hunt_awakened_effect',[a.boss])}</div><div class="has-text-caution">${loc('city_hunt_awakened_effect2',[Math.round(a.str), army])}</div>`;
}

// Text for the race header.
export function awakeningLabel(){
    if (!yokiActive()){ return ''; }
    let a = yokiState();
    let label = `${loc('yoki_meter')} ${Math.floor(a.m)}%`;
    if (a.boss > 0){ label += ` (${a.boss})`; }
    return label;
}

export function awakeningTooltip(){
    if (!yokiActive()){ return ''; }
    let r = yokiRates();
    let fmt = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    let tip = loc('yoki_meter_tooltip',[fmt(r.gain), fmt(-r.calm), fmt(r.net)]);
    let a = yokiState();
    if (a.boss > 0){ tip += ' ' + loc('yoki_boss_count',[a.boss]); }
    return tip;
}
