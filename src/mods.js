// Mod Pack ("Workshop") support.
//
// A mod pack is a JSON file that adds new races built from existing traits,
// plus optional extra strings. Installed packs are kept in localStorage under
// MOD_STORAGE_KEY and applied on page load (the game reloads after changes).
//
// This module deliberately imports nothing so it can be evaluated before
// every other game module (races.js, actions.js, achieve.js, locale.js).
//
// Example pack:
// {
//   "id": "starter_pack",
//   "name": "Starter Pack",
//   "version": "1.0.0",
//   "author": "You",
//   "races": {
//     "lumari": {
//       "name": "Lumari",
//       "desc": "Glowing cave-dwellers who read by their own light.",
//       "entity": "luminous humanoids",
//       "home": "Glimmerdeep",
//       "genus": "humanoid",
//       "traits": { "studious": 1, "nyctophilia": 1 },
//       "unlocked": true,
//       "fanaticism": "studious",
//       "solar": { "red": "Emberglow", "hell": "Duskfire", "gas": "Mistlight", "gas_moon": "Moonwick", "dwarf": "Faintstar" },
//       "extinct": { "name": "Lights Out", "desc": "Led a Lumari civilization to destruction.", "flair": "Darkness returns" }
//     }
//   },
//   "strings": { "some_existing_key": "Override text" }
// }

export const MOD_STORAGE_KEY = 'evolve_mod_packs';
export const MOD_FORMAT_VERSION = 1;

const RACE_KEY_RE = /^[a-z][a-z0-9_]{2,23}$/;
const TEXT_MAX = 400;
const SOLAR = ['red','hell','gas','gas_moon','dwarf'];
const RESERVED = ['custom','hybrid','protoplasm','junker','sludge','ultra_sludge','hellspawn','sentience','synth','nano'];

function storage(){
    try { return window.localStorage; }
    catch { return null; }
}

function cleanText(v, fallback){
    if (typeof v !== 'string' || v.trim().length === 0){ return fallback; }
    // Strings are rendered as HTML in places, so strip tags.
    return v.replace(/[<>]/g, '').slice(0, TEXT_MAX);
}

// Structural validation that does not need game data.
// Trait/genus checks happen later in registerModRaces() once races.js is loaded.
export function validatePack(pack){
    const errors = [];
    if (!pack || typeof pack !== 'object' || Array.isArray(pack)){
        return ['Pack must be a JSON object'];
    }
    if (typeof pack.id !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(pack.id)){
        errors.push('"id" must be 1-40 letters, numbers, - or _');
    }
    if (typeof pack.name !== 'string' || !pack.name.trim()){
        errors.push('"name" is required');
    }
    if (pack.races !== undefined && (typeof pack.races !== 'object' || Array.isArray(pack.races))){
        errors.push('"races" must be an object keyed by race id');
    }
    if (pack.strings !== undefined && (typeof pack.strings !== 'object' || Array.isArray(pack.strings))){
        errors.push('"strings" must be an object');
    }
    Object.keys(pack.races || {}).forEach(function(key){
        const r = pack.races[key];
        if (!RACE_KEY_RE.test(key)){
            errors.push(`race "${key}": id must be lowercase letters/numbers/_ (3-24 chars, starting with a letter)`);
        }
        if (RESERVED.includes(key)){
            errors.push(`race "${key}": id is reserved`);
        }
        if (!r || typeof r !== 'object'){
            errors.push(`race "${key}": must be an object`);
            return;
        }
        if (typeof r.name !== 'string' || !r.name.trim()){ errors.push(`race "${key}": "name" is required`); }
        if (typeof r.genus !== 'string'){ errors.push(`race "${key}": "genus" is required`); }
        if (!r.traits || typeof r.traits !== 'object' || Object.keys(r.traits).length === 0){
            errors.push(`race "${key}": "traits" must list at least one trait`);
        }
        else if (Object.keys(r.traits).length > 4){
            errors.push(`race "${key}": at most 4 traits`);
        }
    });
    return errors;
}

function readPacks(){
    const s = storage();
    if (!s){ return []; }
    try {
        const raw = s.getItem(MOD_STORAGE_KEY);
        if (!raw){ return []; }
        const packs = JSON.parse(raw);
        return Array.isArray(packs) ? packs.filter(p => validatePack(p).length === 0) : [];
    }
    catch (e){
        console.error('Failed to read mod packs', e);
        return [];
    }
}

export const modPacks = readPacks();

// Race ids contributed by mods, in install order, without duplicates.
// Filtered again in registerModRaces() against the base game.
export const modRaceKeys = [];
modPacks.forEach(function(pack){
    Object.keys(pack.races || {}).forEach(function(key){
        if (!modRaceKeys.includes(key)){ modRaceKeys.push(key); }
    });
});

// Which pack provides each race (for UI / save protection).
export function modRaceOwner(key){
    for (const pack of modPacks){
        if (pack.races && pack.races[key]){ return pack; }
    }
    return null;
}

function raceDef(key){
    const pack = modRaceOwner(key);
    return pack ? pack.races[key] : null;
}

// Strings merged into the locale table, so loc('race_<id>') etc. work.
export function modStrings(){
    const out = {};
    modPacks.forEach(function(pack){
        Object.keys(pack.strings || {}).forEach(function(k){
            if (typeof pack.strings[k] === 'string'){ out[k] = cleanText(pack.strings[k], ''); }
        });
    });
    modRaceKeys.forEach(function(key){
        const r = raceDef(key);
        const name = cleanText(r.name, key);
        out[`race_${key}`] = name;
        out[`race_${key}_desc`] = cleanText(r.desc, `${name} are a race added by a mod pack.`);
        out[`race_${key}_entity`] = cleanText(r.entity, name.toLowerCase());
        out[`race_${key}_home`] = cleanText(r.home, `${name} Prime`);
        SOLAR.forEach(function(p){
            out[`race_${key}_solar_${p}`] = cleanText(r.solar && r.solar[p], `${name} ${p.replace('_',' ')}`);
        });
        const ex = r.extinct || {};
        out[`achieve_extinct_${key}_name`] = cleanText(ex.name, `${name} Extinction`);
        out[`achieve_extinct_${key}_desc`] = cleanText(ex.desc, `Led a ${name} civilization to destruction.`);
        out[`achieve_extinct_${key}_flair`] = cleanText(ex.flair, 'Gone, but not forgotten');
    });
    return out;
}

// Called from races.js once the base races and traits exist.
// Adds valid mod races to `races` and removes invalid ones from modRaceKeys.
export function registerModRaces(races, traits, genus_def, loc){
    const valid = [];
    modRaceKeys.forEach(function(key){
        const r = raceDef(key);
        const problems = [];
        if (races[key]){ problems.push('id already used by the base game'); }
        if (!genus_def[r.genus] || ['hybrid','synthetic'].includes(r.genus)){ problems.push(`unknown or unsupported genus "${r.genus}"`); }
        const tlist = {};
        Object.keys(r.traits || {}).forEach(function(t){
            const rank = Number(r.traits[t]);
            if (!traits[t] || traits[t].type !== 'major'){ problems.push(`"${t}" is not a major trait`); return; }
            if (![0.1,0.25,0.5,1,2,3,4].includes(rank)){ problems.push(`"${t}" rank must be one of 0.1, 0.25, 0.5, 1, 2, 3, 4`); return; }
            tlist[t] = rank;
        });
        const tkeys = Object.keys(tlist);
        if (tkeys.length === 0){ problems.push('no usable traits'); }
        if (problems.length){
            console.error(`Mod race "${key}" skipped: ${problems.join('; ')}`);
            return;
        }
        const fanaticism = tkeys.includes(r.fanaticism) ? r.fanaticism : tkeys[0];
        races[key] = {
            name: loc(`race_${key}`),
            desc: loc(`race_${key}_desc`),
            type: r.genus,
            home: loc(`race_${key}_home`),
            entity: loc(`race_${key}_entity`),
            traits: tlist,
            solar: {
                red: loc(`race_${key}_solar_red`),
                hell: loc(`race_${key}_solar_hell`),
                gas: loc(`race_${key}_solar_gas`),
                gas_moon: loc(`race_${key}_solar_gas_moon`),
                dwarf: loc(`race_${key}_solar_dwarf`),
            },
            fanaticism: fanaticism,
            mod: modRaceOwner(key).id,
            unlocked(){ return r.unlocked === true; },
            basic(){ return false; }
        };
        valid.push(key);
    });
    modRaceKeys.splice(0, modRaceKeys.length, ...valid);
}

// ---- Install / remove (used by the settings UI) ----

export function installPack(text){
    let pack;
    try { pack = JSON.parse(text); }
    catch { return { ok: false, error: 'not valid JSON' }; }
    if (pack.format !== undefined && pack.format > MOD_FORMAT_VERSION){
        return { ok: false, error: `pack needs a newer game version (format ${pack.format})` };
    }
    const errors = validatePack(pack);
    if (errors.length){ return { ok: false, error: errors.join('; ') }; }
    const s = storage();
    if (!s){ return { ok: false, error: 'local storage unavailable' }; }
    let packs = [];
    try { packs = JSON.parse(s.getItem(MOD_STORAGE_KEY) || '[]'); } catch { packs = []; }
    if (!Array.isArray(packs)){ packs = []; }
    // Same id replaces the older version.
    packs = packs.filter(p => p && p.id !== pack.id);
    // A race id may only come from one pack.
    for (const p of packs){
        for (const key of Object.keys(pack.races || {})){
            if (p.races && p.races[key]){
                return { ok: false, error: `race "${key}" is already provided by "${p.name}"` };
            }
        }
    }
    packs.push(pack);
    s.setItem(MOD_STORAGE_KEY, JSON.stringify(packs));
    return { ok: true, pack: pack };
}

export function removePack(id){
    const s = storage();
    if (!s){ return; }
    let packs = [];
    try { packs = JSON.parse(s.getItem(MOD_STORAGE_KEY) || '[]'); } catch { packs = []; }
    packs = Array.isArray(packs) ? packs.filter(p => p && (id === undefined ? false : p.id !== id)) : [];
    if (packs.length){ s.setItem(MOD_STORAGE_KEY, JSON.stringify(packs)); }
    else { s.removeItem(MOD_STORAGE_KEY); }
}
