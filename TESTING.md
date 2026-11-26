# Silverblood Expansion: Playtest Checklist

Use this for a real playthrough before a release. Tick each box as you go. Under **Notes**, write down anything that felt off, with numbers if you can (for example "meter hit 100% after 6 minutes with 40 soldiers").

Tip: use a fresh browser profile or a private window, so your main save isn't touched. Export your save at each milestone so you can go back.

## 1. Start of the run
- [ ] On the evolution screen, after picking the humanoid path, **Silverblood** is offered next to Sentience.
- [ ] After evolving, the race name shows "Silverblood" and the home planet is named "Ashmere".
- [ ] In A.R.P.A. → Genetics, the race has Demon Power, Outcast and Regenerative.

Notes:

## 2. Early military (first barracks)
- [ ] After researching military, **The Organization** appears in the Military Complex.
- [ ] The **Awakening** meter appears beside Morale, and hovering over it shows the rates.
- [ ] The meter rises slowly with soldiers. Write down how long it takes to reach 100%: ______
- [ ] Building an Organization unlocks the **Handler** job in Civics.
- [ ] Assigning Handlers visibly slows or reverses the meter.
- [ ] Morale: Outcast makes the army stressful, but it's still manageable.

Notes:

## 3. First Awakening
- [ ] At 100%, a red message says a warrior Awakened, and the meter drops to 25%.
- [ ] The header shows the count, for example "Awakening 25% (1)".
- [ ] **Hunt the Awakened** appears in the Military Complex.
- [ ] While the monster is loose, a soldier is killed now and then, and stress rises.
- [ ] A successful hunt pays a bounty, and the button disappears when no monsters are left.
- [ ] A failed hunt costs soldiers, and the next attempt is easier.
- [ ] Is hunting worth it, or is it better to leave monsters alone? (It shouldn't be better to leave them.)

Notes:

## 4. Campaigns and mid-game
- [ ] Each offensive campaign (Civics → Military) visibly raises the meter, by about 4%.
- [ ] With 2 to 4 Organizations and a few Handlers, you can keep the meter under control.
- [ ] Can you avoid all Awakenings until your first space mission? (That's the **Unbroken** achievement.) Too easy, too hard, or about right?

Notes:

## 5. Monster-infested planet (any race)
This trait is random. To find one, check the planet traits when choosing a planet after a reset.
- [ ] The planet shows "Monster-infested" in its traits.
- [ ] Combat rating shows a +5% "Monster-infested" line in its breakdown.
- [ ] After researching military, demon raids happen roughly every 10 minutes.
- [ ] Winning a raid wounds a few soldiers and pays money. Losing a raid kills soldiers and steals food and money.
- [ ] As Silverblood, raids add to the Awakening meter, and Awakened bounties are doubled.

Notes:

## 6. Late game: the Abyssal Ones
- [ ] After building the fortress in Hell, **Hunt: Morvaine, the Hollow King** appears in the Military Complex.
- [ ] Hovering shows health, your army rating and the rewards.
- [ ] Each expedition deals damage, costs some soldiers, and starts a 60-second regroup timer.
- [ ] Killing one gives a message, the next boss's name appears, and combat rating gains an "Abyssal Trophies" line.
- [ ] Write down how many expeditions each boss took: Morvaine ___, Seskari ___, Pale Wolf ___, Vethra ___, Ul-Abyss ___
- [ ] After all five, the feat **The Last Abyssal** unlocks and the button disappears.

Notes:

## 7. Warriors of the Organization
- [ ] After the first Organization, the **Warriors of the Organization** panel appears in Civics, Military, with 3 recruits.
- [ ] Hiring takes the fee, and the roster limit equals the number of Organizations (up to 8).
- [ ] Each day the wages are paid. With no money, a warning appears and loyalty drops.
- [ ] Rest a warrior: her bonus disappears from combat rating ("Elite Warriors" line), her meter goes down, and the button is locked for 2 minutes.
- [ ] Rename works and survives a page reload.
- [ ] After a few hunts, warriors level up, and a message lists which stats grew.
- [ ] Watch for a death, a "refused to fall" (defied death) message, and an Awakened warrior who then shows up as a named target in Hunt the Awakened.
- [ ] Retire an unhappy warrior and see whether she comes back later.
- [ ] Is the wage fair? Early on, it should be noticeable but affordable. Note it late game too.

Notes:

## 8. Achievements and wiki
- [ ] Stats → Achievements lists Silver Hunter, Unbroken, Abyss Walker and Beast Country.
- [ ] Hovering over the version number (top right) shows the expansion changelog.
- [ ] In the wiki, the Silverblood race, the Demon Power trait, The Organization, the two hunts and the Monster-infested planet all have entries.

Notes:

## 9. Saves
- [ ] Export a save from the original game and import it here. It loads without errors.
- [ ] Reload the page mid-run. The meter, Awakened Ones and Abyssal progress are all kept.

Notes:

## Balance knobs

If something feels wrong, these are the numbers to change. All of them are in `src/silverblood.js`:

| What | Setting | Default |
|---|---|---|
| Meter fill per healthy soldier | `yokiVars.soldierGain` | 0.004% per second |
| Extra fill per wounded soldier | `yokiVars.woundGain` | 0.012% per second |
| Meter added per campaign | `yokiVars.battleGain` | 4% |
| Organization calming | `yokiVars.orgCalm` | 0.03% per second |
| Handler calming | `yokiVars.handlerCalm` | 0.06% per second |
| Rampage chance | `yokiVars.rampage` | about 1 in 40 per second |
| Abyssal health | `abyssVars.hp` | 4k, 9k, 18k, 36k, 75k |
| Abyssal soldier losses | `abyssVars.fury` | 4% to 9% at risk per expedition |
| Time between raids | `planetTraits.infested` in `src/races.js` | 600 seconds |
| Recruit fee | `warriorVars.feeMoneyPct` in `src/warriors.js` | 20% of your Money cap, scaled by quality |
| Daily wage | `warriorVars.wagePct` | 1% of her fee per day |
| Warrior army bonus | `warriorVars.armyDivisor` | total Strength / 800 |
| Death and defy chances | `fights` and `warriorVars.defyBase/defyMax` | see file |
