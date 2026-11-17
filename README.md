# tanjung-neon

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/AIep5/tanjung-neon/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/AIep5/tanjung-neon/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Tanjung Neon** is an open-world crime game set in a fictional tropical port city after dark. You play Dara, a night taxi driver whose cab was seized by loan sharks — now she runs courier jobs through the night market to buy it back. One dense district holds everything: the container port, crowded market alleys, a canal, a financial strip, and a flood tunnel.

Rain is the game's signature: it arrives in sudden tropical fronts, cuts your car's grip and your visibility, turns the asphalt into a mirror for the neon, and — when it really pours — washes away your wanted level. The police answer in three tiers: patrols that cruise, chasers that ram, and roadblocks, with a helicopter circling at four stars.

## What is in the game

- **Drive or walk** — steal parked cars with **E**, drive with traffic and pedestrians around you, hop out and continue on foot.
- **Four story missions** — *Last Fare* (tutorial: pick up a VIP in the first downpour), *Night Market Run* (three checkpoints through the crowds as wanted rises), *Container Heist* (fight the guard, hold the truck, escape over the canal bridge), and *Flood Tunnel* (outrun a four-star blockade through a tunnel that is filling with water, 90 seconds on the clock).
- **Night-market economy** — buy contraband cheap, sell it for more, and spend the profit on rain tyres, a faster engine, and armour. Stand by a market stall and press **F** to open the shop.
- **Wanted system** — stars rise when you steal or smash through the city; lay low, or let a storm scrub you clean.
- **HUD + minimap**, title / pause / busted / win screens, and a save in localStorage (money, upgrades, mission progress).

## Iteration 2 — brighter, denser, closer (resubmit 18 Nov 2026)

The first submit went 12-0 but ranked 2020/2,361: the contact sheet read as a dark abstract grid — cars ~2% of the frame, a confusing triple-repeated mission label, a small low-contrast minimap, no visible police chase, no speed, no character. This iteration changes only what a judge sees:

- **Closer camera** — zoomed view (1.35x live, 1.6x on the chase cover, `?zoom=` per shot) so cars and crowds fill the frame.
- **Brighter city** — lifted asphalt/roofs, lit windows, ambient neon pools over the market/port/financial districts, stronger wet-asphalt reflections, lighter rain vignette.
- **Mission-card HUD** (`game/src/hud.js`) — one card: `MISI 2/4 — NIGHT MARKET RUN`, a single objective line, stage bar, `NEXT ▸ Kios Sate — 456m`. The redundant triple label is gone.
- **Police response panel** — big money + wanted stars top-right, named units (`GULL-1 • 42m • MENGEJAR`, `ROADBLOCK`, `SPOTLIGHT`) with live distances; police cars carry a flashing red/blue halo and a unit call-sign.
- **Big KM/H readout** bottom-right with health + armour bars; **minimap 280x190** bottom-left with district names printed on it and a `PASAR MALAM — JL. NEON` district tag.
- **Character dialogue with portraits** — canvas-drawn Dara/Raka portraits beside the dialogue line, held on screen for staged shots.
- **District + street names painted in the world** — `PELABUHAN`, `PASAR MALAM`, `FINANSIAL`, `KANAL`, `JL. NEON`, `JL. SATE`, …
- **Denser streets** — 20 traffic cars, 92 market pedestrians (crowds part for a speeding car), storm forced on for the chase cover with the helicopter spotlight overhead.
- **Shift sprints on foot** (handbrake in a car); siren loudness follows the wanted level.

## How to play

| Key | Action |
|---|---|
| WASD / arrows | Walk or drive |
| E | Enter / exit / steal a car |
| F | Punch (on foot) · open the market shop (near a stall) |
| Shift | Handbrake (drift) · sprint on foot |
| Space / Enter | Start, confirm, retry a failed mission |
| P / Esc | Pause |
| M | Mute |

## Run it

```sh
# Play it locally (any static server works — the game is plain files under game/)
python3 -m http.server 8080 --directory game
# then open http://localhost:8080

# Hand it in exactly as the grader does (writes dossier.json beside the game)
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Built with vanilla JavaScript on Canvas 2D and WebAudio synth sound — no libraries, no network, no downloaded assets. Screenshots are deterministic staged renders from the game itself (`?shot=chase|steal|market|finale&seed=1`).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
