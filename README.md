# Evolve: Silverblood Expansion

A fan-made expansion for [Evolve](https://github.com/pmotschmann/Evolve) by Demagorddon, inspired by the anime and manga *Claymore*. It adds a new race with its own gameplay loop, a new planet type, an endgame boss hunt, new achievements and support for community mod packs.

**This is not the official game.** For the original, see https://pmotschmann.github.io/Evolve/

## Play

https://cygryu.github.io/Evolve/

## What's new

**Silverblood, a new race**
Humans infused with demon flesh: elite warriors who are slowly becoming the monsters they hunt. Silverblood is a humanoid race and can be picked on the evolution screen from your very first run.

- **Demon Power:** +25% combat rating, but your soldiers build up the Awakening meter.
- **Outcast:** your citizens fear the warriors who protect them, so the army causes more stress.

**The Awakening meter**
- Shown beside Morale. Soldiers fill it slowly, wounded soldiers faster, and every battle adds to it.
- At 100%, a warrior Awakens into a monster that kills soldiers and adds stress until you hunt it down with **Hunt the Awakened**.
- **The Organization** (a new building) and **Handlers** (a new job) hold the meter back.

**Endgame: the Abyssal Ones**
After building a fortress in Hell, Silverbloods can hunt five ancient Awakened, each stronger than the last. Every kill makes your army stronger for the rest of the run.

**Monster-infested planets**
A new planet trait that can appear for any race: +5% combat, but demons raid your settlements.

**And also**
- Silverbloods can appear as Hell invaders (Warlord mode) and as thralls.
- New achievements: Silver Hunter, Unbroken, Abyss Walker and Beast Country, plus the feat The Last Abyssal.
- **Mod packs:** install JSON files from Settings to add your own races. See [MODDING.md](MODDING.md).

Everything is documented in the in-game wiki.

## Bringing your save from the original game

Saves don't carry over automatically, because each website keeps its own saves.

1. In the original game, go to **Settings** and use **Export Game** (or **Save as File**).
2. Here, go to **Settings**, paste it into the Import/Export box and click **Import Game**.

Your progress carries over and the new content switches on as you play.

> **Warning:** moving a save the other way, from this expansion back to the original game, can break it if the save uses Silverblood, a Monster-infested planet or the new achievements. Keep a copy of your original export if you might want to go back.

## Feedback and bugs

Please report problems with the expansion as [issues on this repository](https://github.com/cygryu/Evolve/issues), **not** on the official Evolve repository. The official developer isn't responsible for this content.

## Building

The original game's `npm run build` command fails on newer Node.js versions. Run the steps one at a time instead:

```
npm install
npm run evolve
npm run evolve-less
npm run wiki
npm run wiki-less
```

See [TESTING.md](TESTING.md) for a playtesting checklist.

## Credits and license

Evolve is created by Peter Motschmann (Demagorddon) and its contributors, and licensed under the [Mozilla Public License 2.0](LICENSE). This expansion is released under the same license. *Claymore* is the work of Norihiro Yagi. This is an unofficial fan project; all names in the expansion are original.

---

# Original Evolve README

## Play

https://pmotschmann.github.io/Evolve/

## About

An incremental game about evolving a civilization from primordial ooze into a space faring empire.
Evolve combines elements of a clicker with an idler and has lots of micromanagement.

What will you evolve into?

## Submitting Issues
If you think you have discovered a bug or have some other issue with the game then you can open an issue here on Github.
Please do not open Github issues to ask gameplay questions, use Reddit or Discord for that.
Links for both can be found in the footer of the game.

## Contributing a Language file
If you are interested in a contributing a new language for Evolve the process is fairly straight forward (although a bit tedious).

Make a copy of strings/strings.json and name the copy as strings/strings.\<locale\>.json (EX: strings.es_US.json). The locale format is the language alpha-2 code joined with the country alpha-2 code.

The strings are stored in a json format and will look like this:
```
"job_farmer_desc": "Farmers create food to feed your population. Each farmer generates %0 food per second.",
```
If you are unfamiliar with json the first part is a **key** and cannot be altered, **do not translate or modify the key in any way**. The second part is the string to be translated. Many game strings use **tokens** (**%0**, **%1**, **%2**, etc) to represent game values, as such these tokens must remain in the final translated string. Their position can be moved accordingly, the number represents a specific value and not its position in the string.

To enable your language translation in the game you must add it to the locales constant in locale.js (bottom of the file).

Once you feel your translation file is ready send a pull request with it to the Evolve main branch.


## Contributing to the game
Bug fixes, additional translations, themes, or UI improvements can simply be submitted as pull requests; once reviewed and accepted they will be merged into the main game branch. If you want to contribute a new feature it can not arbitrarily make something easier without making something else harder. If your new feature idea simply makes the game easier it will not be accepted.

All pull requests should be based off current dev branch.
The dev branch is either master or named after its version number.
Please check the current game version and what branches are available before contributing.
Pull requests should not contain the JS/CSS files generated by the build.

## CSS Changes
Evolve uses LESS to build its CSS, you can not just edit the minified CSS file. You must instead edit src/evolve.less then use the less compiler to rebuild the CSS file.

## Build Commands
Assuming you configured your build environment correctly the game can be built, deployed to GitHub Pages or launched using
```
# Builds everything on Linux
npm run build
# Builds everything on Windows
npm run build-win
# Builds the game bundle
npm run evolve
# Builds the CSS file for the game on Linux
npm run evolve-less
# Builds the CSS file for the game on Windows
npm run evolve-less-win
# Builds the wiki bundle
npm run wiki
# Builds the Wiki CSS file on Linux
npm run wiki-less
# Builds the Wiki CSS file on Windows
npm run wiki-less-win
# Launches the game server locally on localhost:4400
npm run serve
# Deploys the game to GitHub Pages on Linux (requires forking)
npm run deploy
# Deploys the game to GitHub Pages on Windows (requires forking)
npm run deploy-win
```

## Docker
If you already have a Docker environment set up and want to run an evolve server using Docker, you can execute the following command to build a Docker image for the evolve server.

```
# Build evolve server image
docker build . -t evolve

# Run evolve server. Default address: http://localhost:8080/
docker run --name evolve -p 8080:80 -d evolve
```
