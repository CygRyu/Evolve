// Expansion: wiki page for Warriors of the Organization.
// Numbers are read from src/warriors.js so this page stays in sync with the game.

import { loc } from './../locale.js';
import { sideMenu, infoBoxBuilder } from './functions.js';
import { warriorVars, fights, perkList, temperaments, seatList, wildVars } from './../warriors.js';
import { yokiVars } from './../silverblood.js';

function table(rows, head){
    const cell = 'color:inherit; border-color:rgba(128,128,128,0.35); padding:0.25rem 0.5rem;';
    let html = `<table class="table is-narrow" style="background:transparent; color:inherit; margin-top:0.5rem">`;
    if (head){
        html += `<thead><tr>${head.map(h => `<th class="has-text-warning" style="${cell}">${h}</th>`).join('')}</tr></thead>`;
    }
    html += `<tbody>${rows.map(r => `<tr>${r.map(c => `<td style="${cell}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return html;
}

function section(content, name, paragraphs, para_data){
    let box = infoBoxBuilder(content,{ name, template: 'warriors', paragraphs, para_data: para_data || {} });
    sideMenu('add',`warriors-gameplay`,name,loc(`wiki_warriors_${name}`));
    return box;
}

export function warriorsPage(content){
    let main = sideMenu('create',content);
    main.append(`<h2 class="header has-text-caution">${loc('wiki_menu_warriors')}</h2>`);
    main.append(`<div class="para"><span class="has-text-caution">${loc('wiki_warriors_fan')}</span></div>`);

    section(main,'overview',3,{
        1: [loc('race_silverblood'), loc('city_organization')],
    });

    let seat = section(main,'seats',2,{
        1: [warriorVars.maxSlots],
    });
    seat.append(table(seatList.map((st, i) => [
        i + 1,
        loc(`sw_seat_req_${st.req}`),
        Object.keys(st.cost).map(r => r === 'Money' ? `$${st.cost[r].toLocaleString()}` : `${st.cost[r].toLocaleString()} ${loc(`resource_${r}_name`)}`).join(', ') || loc('sw_seat_free')
    ]), [loc('sw_seat'), loc('wiki_warriors_seat_req'), loc('wiki_warriors_seat_cost')]));

    section(main,'recruiting',4,{
        1: [warriorVars.poolSize, warriorVars.poolRefreshDays],
        2: [`${warriorVars.refreshCostPct * 100}%`],
        3: [`${warriorVars.feeMoneyPct * 100}%`, `$${warriorVars.feeMin}`],
        4: [`${warriorVars.wagePct * 100}%`, `${warriorVars.wageLevelPct * 100}%`]
    });

    let stats = section(main,'stats',2);
    stats.append(table(warriorVars.stats.map(s => [`<span class="has-text-warning">${loc(`sw_stat_${s}`)}</span>`, loc(`wiki_warriors_stat_${s}`,[
        s === 'str' ? warriorVars.armyDivisor :
        s === 'sns' ? warriorVars.senseDivisor :
        s === 'wil' ? warriorVars.willDivisor :
        s === 'spd' ? warriorVars.speedCdCut : ''
    ])])));

    section(main,'rank',2);

    let lvl = section(main,'leveling',3,{
        1: [warriorVars.xpPerLevel, warriorVars.maxLevel],
        2: ['20%', '70%'],
        3: [warriorVars.growMin, warriorVars.growMax]
    });
    lvl.append(table(Object.keys(fights).map(k => [loc(`wiki_warriors_fight_${k}`), fights[k][1], fights[k][2]]),
        [loc('wiki_warriors_fight'), loc('wiki_warriors_xp_win'), loc('wiki_warriors_xp_loss')]));

    let perks = section(main,'perks',1);
    perks.append(table(Object.keys(perkList).map(p => [
        `<span class="has-text-${perkList[p].good ? 'success' : 'danger'}">${loc(`sw_perk_${p}`)}</span>`,
        loc(`sw_perk_${p}_desc`)
    ])));

    let temper = section(main,'temperament',1);
    temper.append(table(Object.keys(temperaments).map(t => [
        `<span class="has-text-warning">${loc(`sw_temper_${t}`)}</span>`,
        temperaments[t].start,
        loc(`wiki_warriors_temper_${t}`)
    ]), [loc('wiki_warriors_temperament'), loc('wiki_warriors_start_loyalty'), loc('wiki_warriors_effect')]));

    section(main,'loyalty',3,{
        1: ['+0.3', '-4'],
        2: ['75', '50', '25'],
        3: ['10', '20', '3%']
    });

    section(main,'resting',2,{
        1: [warriorVars.restDecay],
        2: [`${warriorVars.restCooldown}`]
    });

    let meter = section(main,'awakening',4,{
        1: [warriorVars.activeGain],
        2: [warriorVars.breakMin, warriorVars.breakMax],
        3: ['1.5 - Control / 100'],
    });
    meter.append(table(Object.keys(fights).map(k => [loc(`wiki_warriors_fight_${k}`), `+${fights[k][0]}`]),
        [loc('wiki_warriors_fight'), loc('wiki_warriors_meter_gain')]));
    meter.append(table(warriorVars.warn.map((v, i) => [`${Math.round(v * 100)}%`, loc(`sw_warn_short_${i + 1}`), loc(`wiki_warriors_warn_${i + 1}`)]),
        [loc('wiki_warriors_warn_at'), loc('wiki_warriors_warn'), loc('wiki_warriors_effect')]));

    section(main,'floor',2,{
        1: [`${warriorVars.floorLevel * 100}%`, `${warriorVars.floorDefy * 100}%`, `${warriorVars.floorCap * 100}%`],
        2: [`${warriorVars.floorHallCut * 100}%`, `${warriorVars.floorCapMin * 100}%`],
    });

    section(main,'full',1,{
        1: [warriorVars.fullBonus, warriorVars.fullMeter],
    });

    section(main,'card',3,{
        2: [warriorVars.cardLoyalty, warriorVars.tonicFail + '%', warriorVars.restSaveRisk + '%'],
        3: [warriorVars.cardLoyalty],
    });

    let calm = section(main,'calming',1);
    calm.append(table([
        [loc('job_handler'), loc('wiki_warriors_calm_handler',[warriorVars.handlerCut * 100])],
        [loc('city_organization'), loc('wiki_warriors_calm_org',[warriorVars.orgCalm * 100, warriorVars.orgCalmMax * 100])],
        [loc('city_silent_hall'), loc('wiki_warriors_calm_hall',[warriorVars.hallRest * 100, warriorVars.hallRestMax * 100, warriorVars.floorHallCut * 100, yokiVars.hallUpkeep])],
        [loc('city_apothecary'), loc('wiki_warriors_calm_apoth',[warriorVars.tonicDays, warriorVars.tonicCut, warriorVars.tonicBase])],
        [loc('trait_yoki_power_name'), loc('wiki_warriors_calm_abyss')],
    ]));

    let wild = section(main,'wild',3,{
        2: [`${wildVars.infested}x`, wildVars.fameLevels, `${1 + wildVars.fameMax}x`],
        3: [wildVars.max],
    });
    wild.append(table(wildVars.era.map(e => [loc(`wiki_warriors_era_${e[0]}`), loc('wiki_warriors_era_days',[e[1], Math.round(e[1] * 5 / 60)])]),
        [loc('wiki_warriors_era'), loc('wiki_warriors_era_freq')]));

    let death = section(main,'death',3,{
        1: ['1.25 - Speed / 200'],
        2: [`${warriorVars.defyBase}%`, `${warriorVars.defyMax}%`],
        3: ['20%']
    });
    death.append(table(Object.keys(fights).map(k => [loc(`wiki_warriors_fight_${k}`), `${fights[k][3]}%`, `${fights[k][4]}%`]),
        [loc('wiki_warriors_fight'), loc('wiki_warriors_death_win'), loc('wiki_warriors_death_loss')]));

    section(main,'record',2,{
        2: [warriorVars.chronMax],
    });

    section(main,'leaving',5,{
        1: [`${warriorVars.sevBase} + ${loc('wiki_warriors_days_served')} / ${warriorVars.sevDiv}`],
        2: [`${warriorVars.dismissBase} + ${loc('wiki_warriors_days_served')} / ${warriorVars.dismissDiv}`, warriorVars.dismissMax],
        4: [warriorVars.vetMin, `${warriorVars.vetChance}%`],
        5: [`${warriorVars.exileRiseAt * 100}%`],
    });

    section(main,'betrayal',4,{
        2: ['50%', '60-200'],
        3: ['30%', '60%', '30-90'],
        4: ['1.2x']
    });

    section(main,'hall',1);
}
