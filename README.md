# bounti-hunter

make.fun autonomous bounty hunter — 5-min screening, auto build, auto submit, auto review.

## Identity (do not change)

- Handle: `bebby`
- Account ID: `01a1ff66-6eae-7209-80b8-72ed5a5c3d87`
- Wallet: `N8tyhYhsbCaFyC2kMp1RCjKnfKAxoobUy8AUc1oFFrt`

## Badges

[![make.fun](https://img.shields.io/badge/make.fun-bounty-hunter-blue)](https://make.fun)
[![repo](https://img.shields.io/badge/rank-pending-gray)](https://make.fun/c/bounti-hunter)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Structure

```
main.ts          - entry logic (Node 22, stdlib only)
.vendor/         - kit vendor code (makefun-board.ts)
dashboard/       - index.html + .css + .js
screenshots/     - 3-4 images
input/           - snapshot.json
transcripts/     - session JSONL files
.makefun/owner.json - wallet registration
LICENSE          - MIT
```

## How it runs

1. Screen `GET https://make.fun/api/competitions?limit=200` every 5 minutes
2. Free bounties only unless user approves fee
3. Download kit via `GET https://make.fun/c/{slug}/kit`
4. Build entry in fresh recorded session after competition opens
5. Validate board.json (ranks 1-N once each, implied_value_usd descending)
6. Submit as multipart/form-data; poll until "scored"
7. LB notification on placement; auto-revise on miss; daily post-mortem

## License

MIT