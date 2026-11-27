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
- [ ] There is **no** Awakening meter beside Morale any more. The header only shows "Awakened: N" when monsters are loose, or "A warrior is strained".
- [ ] Building an Organization unlocks the **Handler** job and opens **Seat 1** in Civics, Military, with 3 recruits.
- [ ] Morale: Outcast makes the army stressful, but it's still manageable.

Notes:

## 3. Seats
- [ ] The panel shows the next Seat, its milestone (green when met) and its cost.
- [ ] Commission Seats 2 to 8 as you reach Iron Mining, a Silent Hall, Boot Camp, an Apothecary, Electricity, Industrialization and the first space mission. Write down when each felt affordable: 2 ___ 3 ___ 4 ___ 5 ___ 6 ___ 7 ___ 8 ___
- [ ] A message appears for each Seat.

Notes:

## 4. Awakening, warnings and the Black Card
- [ ] An active warrior's meter rises slowly every day and after each battle. Write down how long a fresh warrior lasts active without rest: ______
- [ ] Warnings appear in order: "eyes flicker gold", "strained", then the **Black Card** on her panel.
- [ ] Honour it: she dies with honour, no monster, and her sisters gain loyalty. She is in the Hall as "died with honour".
- [ ] Save with Tonic and Save with Rest both work, and sometimes fail.
- [ ] Ignore it: her sisters lose loyalty. If she reaches her limit she Awakens and appears in Hunt the Awakened with "Formerly No. X, served N days".
- [ ] After a few levels and a defied death, resting stops lowering her meter at some point ("can't calm further").
- [ ] **Full Power:** her bonuses double (check the "Elite Warriors" line in combat rating), and her meter climbs much faster.
- [ ] **Handlers:** assign one to a warrior. You can't assign more than you have employed. Firing Handlers removes assignments.
- [ ] **Silent Hall:** money upkeep shows in the Money breakdown. Resting warriors calm faster.
- [ ] **Apothecary:** tonics build up slowly. A tonic lowers a warrior's meter by 40.
- [ ] Target from the design: a careful player loses about one warrior every few hours, mostly to the Black Card. Too harsh, too soft, or about right?

Notes:

## 4b. Wild Awakened Ones and duels
- [ ] After the first Organization, and once you have 10 soldiers, wild Awakened Ones with generated names appear now and then (about every 30 minutes early on). Their strength is never above what your army can hunt.
- [ ] Awakened Ones never kill your last 3 soldiers.
- [ ] When one attacks, a warrior sometimes steps in (log message). Check wins, drive-offs (she shows "recovering") and losses. How often did warriors step in? ______
- [ ] Two warriors sometimes fight together.
- [ ] Set a warrior to **Hold back**: she stays out (Hot-headed or Volatile ones may disobey).
- [ ] A warrior on the brink who steps in may Awaken mid-fight. With a sister beside her, she may be cut down instead (Hall: "cut down as she Awakened").
- [ ] Each one sometimes kills a soldier and adds stress until hunted. At most 3 at once.
- [ ] They appear more often later, on Monster-infested planets, and as your warriors level up.
- [ ] Can you avoid all warrior Awakenings until your first space mission, with at least 3 warriors? (That's **Unbroken**.)

Notes:

## 5. Monster-infested planet (any race)
This trait is random. To find one, check the planet traits when choosing a planet after a reset.
- [ ] The planet shows "Monster-infested" in its traits.
- [ ] Combat rating shows a +5% "Monster-infested" line in its breakdown.
- [ ] After researching military, demon raids happen roughly every 10 minutes.
- [ ] Winning a raid wounds a few soldiers and pays money. Losing a raid kills soldiers and steals food and money.
- [ ] As Silverblood, warriors fight in raids, and Awakened bounties are doubled.

Notes:

## 6. Late game: the Abyssal Ones
- [ ] After building the fortress in Hell, **Hunt: Morvaine, the Hollow King** appears in the Military Complex.
- [ ] Hovering shows health, your army rating and the rewards.
- [ ] Each expedition deals damage, costs some soldiers, and starts a 60-second regroup timer.
- [ ] Killing one gives a message, the next boss's name appears, and combat rating gains an "Abyssal Trophies" line.
- [ ] Write down how many expeditions each boss took: Morvaine ___, Seskari ___, Pale Wolf ___, Vethra ___, Ul-Abyss ___
- [ ] After all five, the feat **The Last Abyssal** unlocks and the button disappears.

Notes:

## 7. Warriors: records and leaving
- [ ] Hiring takes the fee, and the roster limit equals your Seats.
- [ ] Each day the wages are paid. With no money, a warning appears and loyalty drops.
- [ ] Rest a warrior: her bonus disappears from combat rating, her meter goes down, and the button is locked for 2 minutes.
- [ ] Hover over a warrior's name for a summary. Tap her name or **Record** for the full record and chronicle (try this on a phone too).
- [ ] **Retire:** the confirmation shows severance, back pay and how she would leave. The money is taken.
- [ ] **Dismiss:** free, but the others lose loyalty.
- [ ] She appears under **Veterans** and in the Hall with her record.
- [ ] After 30 days or more, a Grateful or Neutral veteran sometimes shows up as a "Former warrior" recruit (Grateful at half fee), with her old level and record.
- [ ] Retire a warrior while she is strained: she may Awaken later in exile, with a message.
- [ ] Bitter veterans and deserters sometimes come back as enemies.
- [ ] Rename works and survives a page reload.

Notes:

## 8. Achievements and wiki
- [ ] Stats → Achievements lists Silver Hunter, Unbroken, Abyss Walker and Beast Country.
- [ ] Hovering over the version number (top right) shows the expansion changelog.
- [ ] In the wiki, the Silverblood race, the Demon Power trait, The Organization, the two hunts and the Monster-infested planet all have entries.

Notes:

## 9. Saves
- [ ] Export a save from the original game and import it here. It loads without errors.
- [ ] Reload the page mid-run. Warriors, Seats, veterans, Awakened Ones and Abyssal progress are all kept.
- [ ] Load a save from before v1.2 with warriors and Awakened Ones loose: you keep at least as many Seats as warriors, and the old Awakened Ones can still be hunted.

Notes:

## Balance knobs

If something feels wrong, these are the numbers to change. Most are in `src/warriors.js` and `src/silverblood.js`:

| What | Setting | Default |
|---|---|---|
| Seat costs | `seatList` in `src/warriors.js` | $2K + 500 Iron, up to $300K + 40K Steel + 12K Titanium |
| Warrior meter per active day | `warriorVars.activeGain` | 0.12 (before Control) |
| Breaking point range | `warriorVars.breakMin/breakMax` | 70 to 130 (average of two rolls) |
| Warning thresholds | `warriorVars.warn` | 60%, 80%, 92% of her limit |
| Rising floor | `warriorVars.floorLevel/floorDefy/floorCap` | 1.5% per level, 6% per defied death, max 60% |
| Full Power | `warriorVars.fullBonus/fullMeter` | bonuses x2, meter x3 |
| Handler / Organization calm | `warriorVars.handlerCut/orgCalm` | -40% for her / -2% each (max 20%) |
| Silent Hall | `warriorVars.hallRest/floorHallCut`, `yokiVars.hallUpkeep` | +30% rest, -4% floor cap, $1.5/s |
| Stillwater Tonic | `warriorVars.tonicDays/tonicCut` | 1 per 60 days per Apothecary, -40 meter |
| Black Card risks | `warriorVars.tonicFail/restSaveRisk` | 15% / 12% |
| Wild Awakened frequency | `wildVars.era` | 360, 240, 160, 120 days by era |
| Wild Awakened strength | `wildVars.strMin/strMax/armyMin/armyMax` | era roll, capped at 60-110% of army rating |
| Duel notice chance | `duelVars.noticeDiv` | Sense / 2 % per warrior |
| Duel outcomes | `duelVars.repelShare/outDays`, `fights.duel` | win by strength², 60% of the rest repelled, 30% death check on loss |
| Mercy blow | `duelVars.mercyBase/mercyWilDiv` | 20% + Will / 4 |
| Garrison safety | `yokiVars.minSoldiers` | last 3 soldiers are never killed |
| Severance | `warriorVars.sevBase/sevDiv` | wage x (10 + days served / 10) |
| Rampage chance | `yokiVars.rampage` in `src/silverblood.js` | about 1 in 40 per second |
| Abyssal health | `abyssVars.hp` | 4k, 9k, 18k, 36k, 75k |
| Abyssal soldier losses | `abyssVars.fury` | 4% to 9% at risk per expedition |
| Time between raids | `planetTraits.infested` in `src/races.js` | 600 seconds |
| Recruit fee | `warriorVars.feeMoneyPct` in `src/warriors.js` | 20% of your Money cap, scaled by quality |
| Daily wage | `warriorVars.wagePct` | 1% of her fee per day |
| Warrior army bonus | `warriorVars.armyDivisor` | total Strength / 800 |
| Death and defy chances | `fights` and `warriorVars.defyBase/defyMax` | see file |
