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
import { unlockAchieve, unlockFeat } from './achieve.js';
import { planetTraits } from './races.js';
import { warriorsTick, warriorsBattle, warriorsHuntMult, warriorsLossMult, warriorsCdMult, warriorsStressCut, warriorsStressAdd, namedBoss, namedDefeated } from './warriors.js';
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
    return global.race['yoki_power'] && global.race.species !== 'protoplasm' && !global.race['warlord'];
}

export function yokiState(){
    if (!global.race['awakening']){
        global.race['awakening'] = { m: 0, boss: 0, str: 0, rate: 0, hunts: 0 };
    }
    let a = global.race.awakening;
    if (a.woke === undefined){ a.woke = 0; }   // Awakenings this run
    if (!a.abyss){ a.abyss = { slain: 0, hp: 0, cd: 0 }; }
    return a;
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
        let mult = traits.yoki_power.vars()[1] / 100 * (1 - yokiState().abyss.slain * abyssVars.calmReward);
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
    if (a.abyss.cd > 0){ a.abyss.cd--; }
    warriorsTick();
    if (a.woke === 0 && global.tech['space'] && global.tech.space >= 2){
        unlockAchieve('unbroken');
    }

    let monsters = a.boss + (global.race['warriors'] ? global.race.warriors.named.length : 0);
    if (monsters > 0 && global.civic['garrison'] && global.civic.garrison.workers > 0){
        for (let i = 0; i < monsters; i++){
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
    a.woke++;
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
    let named = global.race['warriors'] ? global.race.warriors.named.length : 0;
    return (yokiState().boss + named) * yokiVars.stressPerBoss + warriorsStressAdd();
}

export function yokiStressCut(){
    if (!yokiActive()){ return 0; }
    return warriorsStressCut();
}

export function yokiHuntAvailable(){
    return yokiActive() && (yokiState().boss > 0 || namedBoss() !== null);
}

// The "Hunt the Awakened" action. Named bosses (your own fallen warriors) come first.
export function yokiHunt(){
    let a = yokiState();
    let named = namedBoss();
    if (a.boss <= 0 && !named){ return false; }
    let wounded = global.civic.garrison.wounded || 0;
    let ready = garrisonSize() - wounded;
    if (ready <= 0){
        messageQueue(loc('yoki_hunt_nosoldiers'),'warning',false,['combat']);
        return false;
    }
    let str = named ? named.str : a.str;
    let luck = Math.rand(8, 13) / 10;
    let army = armyRating(garrisonSize(), 'army', wounded) * luck * warriorsHuntMult();
    let lossMult = warriorsLossMult();
    a.hunts++;
    if (army >= str){
        let killed = Math.min(Math.round(Math.rand(0, Math.ceil(str / 25) + 1) * lossMult), ready);
        let hurt = Math.min(Math.round(Math.rand(0, Math.ceil(str / 10) + 1) * lossMult), ready - killed);
        soldierDeath(killed);
        global.civic.garrison.wounded = Math.min(wounded + hurt, global.civic.garrison.workers);
        let bounty = Math.round(str * 60 * (global.city.ptrait.includes('infested') ? 2 : 1));
        global.resource.Money.amount = Math.min(global.resource.Money.max, global.resource.Money.amount + bounty);
        global.stats['awakened_slain'] = (global.stats['awakened_slain'] || 0) + 1;
        if (global.stats.awakened_slain >= 50){ unlockAchieve('silver_hunter'); }
        if (named){
            namedDefeated();
            messageQueue(loc(named.kind === 'rogue' ? 'sw_hunt_rogue_win' : 'sw_hunt_named_win',[named.name, killed, hurt, bounty.toLocaleString()]),'success',false,['combat']);
        }
        else {
            a.boss--;
            a.str = a.boss > 0 ? newStrength() : 0;
            messageQueue(loc('yoki_hunt_win',[killed, hurt, bounty.toLocaleString()]),'success',false,['combat']);
        }
        warriorsBattle('hunt', true);
        if (!yokiHuntAvailable()){ drawCity(); }
    }
    else {
        let killed = Math.min(Math.round(Math.rand(2, Math.ceil(str / 12) + 3) * lossMult), ready);
        let hurt = Math.min(Math.round(Math.rand(1, Math.ceil(str / 8) + 2) * lossMult), ready - killed);
        soldierDeath(killed);
        global.civic.garrison.wounded = Math.min(wounded + hurt, global.civic.garrison.workers);
        // The beast is hurt too, so each failed hunt makes the next one easier.
        if (named){ named.str = Math.max(1, Math.round(named.str * 0.8)); }
        else { a.str = Math.max(1, Math.round(a.str * 0.8)); }
        messageQueue(loc('yoki_hunt_loss',[killed, hurt]),'danger',false,['combat']);
        warriorsBattle('hunt', false);
    }
    return false;
}

export function yokiHuntEffect(){
    let a = yokiState();
    let named = namedBoss();
    let army = global.civic['garrison'] ? Math.round(armyRating(garrisonSize(), 'army', global.civic.garrison.wounded) * warriorsHuntMult()) : 0;
    let total = a.boss + (global.race['warriors'] ? global.race.warriors.named.length : 0);
    let desc = `<div>${loc('city_hunt_awakened_effect',[total])}</div>`;
    if (named){ desc += `<div class="has-text-danger">${loc(named.kind === 'rogue' ? 'sw_hunt_target_rogue' : 'sw_hunt_target_named',[named.name])}</div>`; }
    return desc + `<div class="has-text-caution">${loc('city_hunt_awakened_effect2',[Math.round(named ? named.str : a.str), army])}</div>`;
}

// Text for the race header.
export function awakeningLabel(){
    if (!yokiActive()){ return ''; }
    let a = yokiState();
    let label = `${loc('yoki_meter')} ${Math.floor(a.m)}%`;
    let total = a.boss + (global.race['warriors'] ? global.race.warriors.named.length : 0);
    if (total > 0){ label += ` (${total})`; }
    return label;
}

export function awakeningTooltip(){
    if (!yokiActive()){ return ''; }
    let r = yokiRates();
    let fmt = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    let tip = loc('yoki_meter_tooltip',[fmt(r.gain), fmt(-r.calm), fmt(r.net)]);
    let a = yokiState();
    let total = a.boss + (global.race['warriors'] ? global.race.warriors.named.length : 0);
    if (total > 0){ tip += ' ' + loc('yoki_boss_count',[total]); }
    return tip;
}


// ---------------------------------------------------------------------------
// Monster-infested planet trait: demon raids for every race.
// ---------------------------------------------------------------------------

export function infestedTick(){
    if (!global.city['ptrait'] || !global.city.ptrait.includes('infested')){ return; }
    if (global.race.species === 'protoplasm' || global.race['warlord'] || global.race['cataclysm'] || global.race['lone_survivor']){ return; }
    if (!global.tech['military'] || !global.civic['garrison']){ return; }
    if (Math.rand(0, planetTraits.infested.vars()[1]) !== 0){ return; }
    demonRaid();
}

export function demonRaid(){
    let wounded = global.civic.garrison.wounded || 0;
    let ready = Math.max(0, garrisonSize() - wounded);
    let strength = Math.rand(10, 41) * techFactor();
    let army = ready > 0 ? armyRating(garrisonSize(), 'army', wounded) * Math.rand(8, 13) / 10 : 0;
    yokiBattle();
    if (army >= strength){
        let hurt = Math.min(Math.rand(0, Math.ceil(strength / 15) + 1), ready);
        global.civic.garrison.wounded = Math.min(wounded + hurt, global.civic.garrison.workers);
        let bounty = Math.round(strength * 25);
        global.resource.Money.amount = Math.min(global.resource.Money.max, global.resource.Money.amount + bounty);
        messageQueue(loc('infested_raid_win',[hurt, bounty.toLocaleString()]),'warning',false,['combat']);
        warriorsBattle('raid', true);
    }
    else {
        let killed = Math.min(Math.rand(1, Math.ceil(strength / 12) + 2), global.civic.garrison.workers);
        soldierDeath(killed);
        let lost = [];
        ['Food','Money'].forEach(function(res){
            if (global.resource[res] && global.resource[res].display && global.resource[res].amount > 0){
                let loss = Math.round(global.resource[res].amount * Math.rand(5, 16) / 100);
                global.resource[res].amount -= loss;
                lost.push(res === 'Money' ? `$${loss.toLocaleString()}` : `${loss.toLocaleString()} ${global.resource[res].name}`);
            }
        });
        messageQueue(loc('infested_raid_loss',[killed, lost.join(', ') || loc('infested_raid_nothing')]),'danger',false,['combat']);
        warriorsBattle('raid', false);
    }
}

// ---------------------------------------------------------------------------
// Endgame: the Abyssal Ones. Unlocked once a Silverblood civilization
// establishes a fortress in Hell. Five ancient Awakened, fought in order.
// ---------------------------------------------------------------------------

export const abyssVars = {
    hp: [4000, 9000, 18000, 36000, 75000],
    fury: [0.04, 0.05, 0.06, 0.07, 0.09],  // share of garrison put at risk per expedition
    cooldown: 60,                          // seconds between expeditions
    combatReward: 0.05,                    // +5% combat per Abyssal One slain (this run)
    calmReward: 0.1,                       // -10% Awakening build-up per Abyssal One slain
};

export function abyssAvailable(){
    if (!yokiActive() || !global.tech['portal'] || global.tech.portal < 2){ return false; }
    return yokiState().abyss.slain < abyssVars.hp.length;
}

export function abyssCombatBonus(){
    if (!global.race['yoki_power'] || !global.race['awakening'] || !global.race.awakening['abyss']){ return 0; }
    return global.race.awakening.abyss.slain * abyssVars.combatReward;
}

function currentAbyss(){
    let ab = yokiState().abyss;
    if (ab.hp <= 0 && ab.slain < abyssVars.hp.length){
        ab.hp = abyssVars.hp[ab.slain];
    }
    return ab;
}

export function abyssTitle(){
    if (!yokiActive()){ return loc('city_abyss_hunt_generic'); }
    let ab = yokiState().abyss;
    return loc('city_abyss_hunt',[loc(`abyssal_${Math.min(ab.slain, abyssVars.hp.length - 1)}`)]);
}

export function abyssEffect(){
    let ab = currentAbyss();
    let i = ab.slain;
    let army = global.civic['garrison'] ? Math.round(armyRating(garrisonSize(), 'army', global.civic.garrison.wounded)) : 0;
    let desc = `<div>${loc(`abyssal_${i}_desc`)}</div>`;
    desc += `<div class="has-text-caution">${loc('city_abyss_hunt_effect',[Math.round(ab.hp).toLocaleString(), abyssVars.hp[i].toLocaleString(), army.toLocaleString()])}</div>`;
    desc += `<div>${loc('city_abyss_hunt_reward',[abyssVars.combatReward * 100, abyssVars.calmReward * 100])}</div>`;
    if (ab.cd > 0){ desc += `<div class="has-text-danger">${loc('city_abyss_hunt_cd',[ab.cd])}</div>`; }
    return desc;
}

export function abyssHunt(){
    if (!abyssAvailable()){ return false; }
    let ab = currentAbyss();
    if (ab.cd > 0){
        messageQueue(loc('city_abyss_hunt_cd',[ab.cd]),'warning',false,['combat']);
        return false;
    }
    let wounded = global.civic.garrison.wounded || 0;
    let ready = garrisonSize() - wounded;
    if (ready <= 0){
        messageQueue(loc('yoki_hunt_nosoldiers'),'warning',false,['combat']);
        return false;
    }
    let i = ab.slain;
    let name = loc(`abyssal_${i}`);
    let dmg = Math.round(armyRating(garrisonSize(), 'army', wounded) * Math.rand(8, 13) / 10 * warriorsHuntMult());
    let risk = Math.ceil(ready * abyssVars.fury[i] * Math.rand(5, 16) / 10 * warriorsLossMult());
    let killed = Math.min(Math.ceil(risk / 2), ready);
    let hurt = Math.min(risk - killed, ready - killed);
    soldierDeath(killed);
    global.civic.garrison.wounded = Math.min(wounded + hurt, global.civic.garrison.workers);
    ab.hp -= dmg;
    ab.cd = Math.round(abyssVars.cooldown * warriorsCdMult());
    yokiBattle();
    warriorsBattle('abyss', ab.hp <= 0);

    if (ab.hp <= 0){
        ab.slain++;
        ab.hp = 0;
        global.resource.Money.amount = global.resource.Money.max;
        global.stats['abyssal_slain'] = (global.stats['abyssal_slain'] || 0) + 1;
        messageQueue(loc('city_abyss_hunt_slain',[name, killed, hurt]),'success',false,['combat']);
        unlockAchieve('abyss_walker');
        if (ab.slain >= abyssVars.hp.length){
            unlockFeat('abyssal_purge');
            messageQueue(loc('city_abyss_hunt_all'),'special',false,['progress']);
        }
        drawCity();
    }
    else {
        messageQueue(loc('city_abyss_hunt_hit',[name, dmg.toLocaleString(), Math.round(ab.hp).toLocaleString(), killed, hurt]),'warning',false,['combat']);
    }
    return false;
}
