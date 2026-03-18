# Fueling Curiosity

Local workflow and release guide for the Fueling Curiosity homepage and game.

## Branch Model

- `main`: production only
- `staging`: release candidate branch
- `codex/*`: feature and workflow branches

Do not implement directly on `main`.

## Standard Workflow

1. Start from `staging`
   - `git checkout staging`
   - `git checkout -b codex/<feature-name>`
2. Implement on the `codex/*` branch.
3. Run repo checks:
   - `node --check script.js`
   - `node --check tests\full-flow-check.js`
   - `cmd /c node tests\full-flow-check.js`
4. Test the branch on desktop and phone.
5. Merge the feature branch into `staging`.
6. Test `staging` again on desktop and phone.
7. Merge `staging` into `main` only after the release pass is clean.

## Phone Preview

Use a local static server from the repo root.

Local desktop preview:

```powershell
node tests\static-server.js
```

LAN phone preview:

```powershell
$env:HOST='0.0.0.0'
$env:PORT='8000'
node tests\static-server.js
```

Find the machine IP:

```powershell
ipconfig
```

Open on the phone, on the same Wi-Fi:

```text
http://YOUR-IP:8000/index.html
http://YOUR-IP:8000/game.html
```

If Windows asks, allow private-network access.

## Source-of-Truth Rules

- `index.html`: homepage/marketing content can follow the live homepage version.
- `game.html`: repo game shell is authoritative.
- `styles.css`: merge by subsystem, not by file age.
- `script.js`: current repo behavior and required DOM hooks are authoritative.

Never lose these game hooks without explicit intent:

- `#fun-fact-label`
- `#fun-fact-counter`
- `#fun-fact-controls`
- `#fun-fact-prev-btn`
- `#fun-fact-next-btn`
- `#fun-fact-close-btn`
- `#phase-sru`
- `#sru-root`
- splash `Just the Facts`
- V-804 count/max at `16`

## Core Workflow Skills

- `release-gate`
  - final branch sanity, checks, and release-blocker review
- `visual-qa-game`
  - desktop/phone UI review for overflow, clipping, dead controls, and game readability
- `merge-guardian`
  - protects the `index.html` / `game.html` / `styles.css` ownership split during merges
- `static-phone-preview`
  - provides the local server and phone-preview workflow

## Specialist Review Team

These are review-first agents. They should surface findings, risks, and suggested changes before implementation.

- `fueling-curiosity-brand-manager`
  - homepage/game tone, CTA consistency, audience fit, and brand discipline
- `game-style-director`
  - visual hierarchy, affordances, HUD/overlay quality, and whether a minigame feels like a system instead of webpage UI
- `chemical-engineer-consultant`
  - technical correctness, refinery/process plausibility, and safe simplification
- `educator-consultant`
  - readability, sequencing, age accessibility, and misconception risk

### Conflict Resolution Order

If specialist reviewers disagree, resolve in this order:

1. `chemical-engineer-consultant`
2. `educator-consultant`
3. `game-style-director`
4. `fueling-curiosity-brand-manager`

## Recommended Review Order

### New gameplay mechanic

1. `chemical-engineer-consultant`
2. `educator-consultant`
3. `game-style-director`
4. `release-gate`

### Homepage or facts copy

1. `fueling-curiosity-brand-manager`
2. `educator-consultant`
3. `chemical-engineer-consultant` if technical content changed

### Live-file merge

1. `merge-guardian`
2. `fueling-curiosity-brand-manager` for homepage copy review
3. `release-gate`

### Mobile UI cleanup

1. `game-style-director`
2. `visual-qa-game`
3. `release-gate`

## Branch Review Cadence

For each `codex/*` branch:

1. Implement locally.
2. Run `game-style-director` if UI or game feel changed.
3. Run `chemical-engineer-consultant` if facts, specs, or process logic changed.
4. Run `educator-consultant` if onboarding, instructions, or learning flow changed.
5. Run `fueling-curiosity-brand-manager` if homepage or game copy changed.
6. Run `visual-qa-game` for desktop and phone layout review.
7. Run `release-gate` before merging into `staging`.
8. Run `static-phone-preview` for the final branch or `staging` phone pass.

## Release Checklist

- Branch is not `main` during active work.
- Working tree is clean or intentionally staged.
- `node --check script.js` passes.
- `node --check tests\full-flow-check.js` passes.
- `cmd /c node tests\full-flow-check.js` passes.
- Splash screen and `Just the Facts` work.
- Gasoline intro and cost HUD work.
- SRU renders cleanly on desktop and phone.
- V-804 shows `16`.
- Homepage activity-pack link still points to `fueling-curiosity-stem-activity-pack.pdf`.
