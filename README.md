# tanjung-neon

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/AIep5/tanjung-neon/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/AIep5/tanjung-neon/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Tanjung Neon** — an open-world crime game in a tropical port city at night. You are Dara, a night taxi driver turned night-market courier after loan sharks seized her cab. Drive through sudden tropical rain on neon-reflecting wet asphalt, run the night market's smuggling economy, steal cars, outrun three tiers of police, and take on four story missions — from a last fare in the first downpour to a final escape through a flooding tunnel.

Rain is both the look and the mechanic: it cuts grip and visibility, puddles mirror the neon, and a heavy storm can wash away your wanted level. Earn cash at the night market, buy rain tyres, a faster engine and armour, and spend it before the police spend you.

The whole game is vanilla JavaScript on Canvas 2D with WebAudio synth sounds — no libraries, no network, no assets.

## How to play

- **WASD / arrows** drive (or walk on foot). **E** enters and exits a car. **Space** is the handbrake.
- Steal a parked car, take fares and market jobs to earn cash, and keep your wanted level down — rain helps.
- **M** opens the market to buy and sell contraband and upgrade your car. **P** pauses, **R** restarts a mission.

## Run it

```sh
# Play it locally (any static server works — the game is plain files under game/)
python3 -m http.server 8080 --directory game
# then open http://localhost:8080

# Hand it in exactly as the grader does (writes dossier.json beside the game)
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
