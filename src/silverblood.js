// Expansion: Silverblood race mechanics.
//
// Only named warriors (src/warriors.js) can Awaken. Garrison soldiers are
// human. Awakened Ones at large (your own fallen warriors, grudge-holders
// and wild Awakened) kill soldiers and add stress until they are hunted.
//
// State lives in global.race.awakening = { boss, str, hunts, abyss }.
// boss/str are legacy generic Awakened Ones from saves made before v1.2.

import { global } from './vars.js';
import { loc } from './locale.js';
import { armyRating, garrisonSize, soldierDeath } from './civics.js';
import { messageQueue } from './functions.js';
import { unlockAchieve, unlockFeat } from './achieve.js';
import { planetTraits } from './races.js';
import { warriorsTick, warriorsBattle, warriorsHuntMult, warriorsLossMult, warriorsCdMult, warriorsStressCut, warriorsStressAdd, namedBoss, namedDefeated, unbrokenCheck, warriorVars, stageOf } from './warriors.js';
import { drawCity, initStruct, actions } from './actions.js';

export const yokiVars = {
    rampage: 40,          // ~1 in N chance per second, per Awakened One, to kill a soldier
    stressPerBoss: 3,     // morale stress per Awakened One
    hallUpkeep: 1.5,      // Money per second per Silent Hall
};

export function yokiActive(){
    return global.race['yoki_power'] && global.race.species !== 'protoplasm' && !global.race['warlord'];
}

export function yokiState(){
    if (!global.race['awakening']){
        global.race['awakening'] = { boss: 0, str: 0, hunts: 0 };
    }
    let a = global.race.awakening;
    if (a.boss === undefined){ a.boss = 0; }
    if (a.str === undefined){ a.str = 0; }
    if (a.hunts === undefined){ a.hunts = 0; }
    if (!a.abyss){ a.abyss = { slain: 0, hp: 0, cd: 0 }; }
    ['m','rate','woke'].forEach(k => { if (a[k] !== undefined){ delete a[k]; } }); // old global meter
    return a;
}

function techFactor(){
    return global.tech['high_tech'] ? global.tech['high_tech'] + 1 : 1;
}

function newStrength(){
    return Math.rand(30, 61) * techFactor();
}

function monsterCount(){
    return yokiState().boss + (global.race['warriors'] ? global.race.warriors.named.length : 0);
}

// ---------------------------------------------------------------------------
// Silent Hall upkeep (from the fast loop, 4 times a second)
// ---------------------------------------------------------------------------

let funded = 0;

export function hallsFunded(){
    return funded;
}

export function silentHallUpkeep(breakdown, time_multiplier){
    if (!yokiActive() || !global.city['silent_hall'] || !global.city.silent_hall.count){
        funded = 0;
        return;
    }
    let count = global.city.silent_hall.count;
    let per = yokiVars.hallUpkeep * time_multiplier;
    let on = Math.min(count, Math.floor(global.resource.Money.amount / per));
    funded = on;
    if (on > 0){
        global.resource.Money.amount -= on * per;
        breakdown.p.consume.Money[loc('city_silent_hall')] = -(on * yokiVars.hallUpkeep);
    }
}

export function silentHallEffect(isWiki){
    let desc = `<div>${loc('city_silent_hall_effect',[warriorVars.hallRest * 100, warriorVars.hallRestMax * 100])}</div>`;
    desc += `<div>${loc('city_silent_hall_effect2',[warriorVars.floorHallCut * 100, warriorVars.floorCapMin * 100])}</div>`;
    desc += `<div class="has-text-caution">${loc('city_silent_hall_upkeep',[yokiVars.hallUpkeep])}</div>`;
    if (!isWiki && global.city['silent_hall'] && global.city.silent_hall.count > funded){
        desc += `<div class="has-text-danger">${loc('city_silent_hall_unfunded',[global.city.silent_hall.count - funded])}</div>`;
    }
    return desc;
}

export function apothecaryEffect(isWiki){
    return `<div>${loc('city_apothecary_effect',[warriorVars.tonicDays, warriorVars.tonicCut])}</div><div>${loc('city_apothecary_effect2')}</div>`;
}

export function organizationEffect(){
    return `<div>${loc('city_organization_effect',[warriorVars.orgCalm * 100, warriorVars.orgCalmMax * 100])}</div><div>${loc('plus_max_resource',[1,loc('job_handler')])}</div>`;
}

// Called once per game second from midLoop.
export function yokiTick(){
    if (!yokiActive()){ return; }
    let a = yokiState();
    ['organization','silent_hall','apothecary'].forEach(b => {
        if (!global.city[b]){ initStruct(actions.city[b]); }
    });
    if (a.abyss.cd > 0){ a.abyss.cd--; }
    warriorsTick();
    if (global.tech['space'] && global.tech.space >= 2 && unbrokenCheck()){
        unlockAchieve('unbroken');
    }

    let monsters = monsterCount();
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

// Kept for older callers: battles no longer fill a global meter.
export function yokiBattle(){}

export function yokiStress(){
    if (!yokiActive()){ return 0; }
    return monsterCount() * yokiVars.stressPerBoss + warriorsStressAdd();
}

export function yokiStressCut(){
    if (!yokiActive()){ return 0; }
    return warriorsStressCut();
}

export function yokiHuntAvailable(){
    return yokiActive() && monsterCount() > 0;
}

// The "Hunt the Awakened" action. Named targets come first, then old generic ones.
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
            let key = named.kind === 'rogue' ? 'sw_hunt_rogue_win' : named.kind === 'wild' ? 'sw_hunt_wild_win' : 'sw_hunt_named_win';
            messageQueue(loc(key,[named.name, killed, hurt, bounty.toLocaleString()]),'success',false,['combat']);
        }
        else {
            a.boss--;
            a.str = a.boss > 0 ? newStrength() : 0;
            messageQueue(loc('yoki_hunt_win',[killed, hurt, bounty.toLocaleString()]),'success',false,['combat']);
        }
        warriorsBattle('hunt', true, { target: named || 'generic' });
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
        warriorsBattle('hunt', false, { target: named || 'generic' });
    }
    return false;
}

export function yokiHuntEffect(){
    let a = yokiState();
    let named = namedBoss();
    let army = global.civic['garrison'] ? Math.round(armyRating(garrisonSize(), 'army', global.civic.garrison.wounded) * warriorsHuntMult()) : 0;
    let desc = `<div>${loc('city_hunt_awakened_effect',[monsterCount()])}</div>`;
    if (named){
        let key = named.kind === 'rogue' ? 'sw_hunt_target_rogue' : named.kind === 'wild' ? 'sw_hunt_target_wild' : 'sw_hunt_target_named';
        desc += `<div class="has-text-danger">${loc(key,[named.name])}</div>`;
        if (named.former){ desc += `<div class="has-text-label">${loc('sw_hunt_former',[named.former.r, named.former.sd])}</div>`; }
    }
    return desc + `<div class="has-text-caution">${loc('city_hunt_awakened_effect2',[Math.round(named ? named.str : a.str), army])}</div>`;
}

// Text for the race header: Awakened Ones at large, or a warrior near her limit.
export function awakeningLabel(){
    if (!yokiActive()){ return ''; }
    let total = monsterCount();
    if (total > 0){ return loc('yoki_label_monsters',[total]); }
    let w = global.race['warriors'];
    if (w && w.roster.some(wr => wr.bp && stageOf(wr) >= 2)){ return loc('yoki_label_strained'); }
    return '';
}

export function awakeningTooltip(){
    if (!yokiActive()){ return ''; }
    let tip = loc('yoki_label_tooltip');
    let total = monsterCount();
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
    warriorsBattle('abyss', ab.hp <= 0, { dmg, kill: ab.hp <= 0, killName: name });

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
