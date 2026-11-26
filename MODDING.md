# Evolve Expansion: Mod Packs

Players can install **mod packs**: JSON files that add new races. Mod packs work like a small Steam Workshop. Go to **Settings → Mod Packs (Workshop) → Install Mod Pack**, pick a `.json` file, and the game reloads with the new content.

A working example is in [`mods/example-starter-pack.json`](mods/example-starter-pack.json).

## Pack format

```json
{
  "format": 1,
  "id": "starter_pack",
  "name": "Starter Pack",
  "version": "1.0.0",
  "author": "You",
  "races": {
    "lumari": {
      "name": "Lumari",
      "desc": "One-sentence description shown when evolving.",
      "entity": "luminous cave folk",
      "home": "Glimmerdeep",
      "genus": "humanoid",
      "traits": { "studious": 1, "nyctophilia": 1 },
      "fanaticism": "studious",
      "solar": { "red": "...", "hell": "...", "gas": "...", "gas_moon": "...", "dwarf": "..." },
      "extinct": { "name": "Lights Out", "desc": "...", "flair": "..." }
    }
  },
  "strings": { "any_existing_string_key": "Override text" }
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Unique pack id. Installing a pack with the same id replaces the old one. |
| `races.<key>` | | The race id: lowercase letters, numbers or `_`, 3–24 characters. It must not clash with a base-game race. |
| `genus` | yes | `humanoid`, `carnivore`, `herbivore`, `small`, `giant`, `reptilian`, `avian`, `insectoid`, `plant`, `fungi`, `aquatic`, `fey`, `heat`, `polar`, `sand`, `demonic`, `angelic`, `eldritch`. |
| `traits` | yes | 1–4 existing **major** traits. Each takes a rank of 0.1, 0.25, 0.5, 1, 2, 3 or 4. |
| `fanaticism` | | The trait boosted by the Fanaticism tech. Defaults to the first trait. |
| `solar`, `extinct`, `desc`, `home`, `entity` | | Optional flavour text. Sensible defaults are generated. |

## How mod races appear

Mod races behave like normal races. They appear on the evolution screen once you reach their genus, if you have the *Mass Extinction* achievement, are seeded, or have already played that race. Otherwise they can roll as the random result of **Sentience**. Each mod race also gets its own extinction achievement.

## Safety rules

- Text is stripped of `<` and `>`, so packs can't inject HTML.
- Invalid races are skipped and logged to the console instead of breaking the game.
- You can't remove a pack while you're playing one of its races. If a pack goes missing anyway, the save still loads with a placeholder race.

## Code map (for contributors)

- `src/mods.js` handles loading, validation, strings and install/remove.
- `src/races.js` calls `registerModRaces()` after the base races are defined.
- `src/actions.js` adds mod races to `raceList`, so they show up in evolution and Sentience.
- `src/achieve.js` adds the extinction achievements.
- `src/locale.js` merges the generated strings.
- `src/index.js` holds the Settings UI.

Next steps could be custom traits (effects scripted from a whitelist of hooks), custom events and custom planet types.

## Expansion content: Silverblood

This content is built into the game, not part of a mod pack. The code is in `src/silverblood.js`, with small hooks in other files.

- **Race:** Silverblood (humanoid). Traits: Demon Power, Outcast, and half-rank Regenerative.
- **Awakening meter**, shown beside Morale. Healthy soldiers fill it slowly, wounded soldiers faster, and each offensive campaign adds 4%. At 100% a warrior becomes an **Awakened One** and the meter drops to 25%. At most 3 can be loose at once.
- Each Awakened One sometimes kills a soldier and adds 3 stress.
- **Hunt the Awakened** (Military Complex): your army rating, with some luck, is compared to the monster's strength. A win kills the monster and pays a bounty. A loss costs soldiers but weakens the monster by 20%.
- **The Organization** (Military Complex): lowers the meter by 0.03% per second and adds one **Handler** job slot. Each Handler lowers it by a further 0.06% per second.
- Tuning numbers are in `yokiVars` at the top of `src/silverblood.js`.
