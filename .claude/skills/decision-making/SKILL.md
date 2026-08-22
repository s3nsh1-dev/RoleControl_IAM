---
name: decision-making
description: Audit a drafted response before sending it. Use when a reply is running long, when unsure whether to ask the user or decide, or when checking whether the working rules in CLAUDE.md were actually followed.
---

# Decision

`CLAUDE.md` holds the enforceable rules and loads every turn. This file is the
audit pass and the reasoning behind them. It does not restate them.

## Run this on a drafted reply

1. Count the lines. Over 6 means you owe a named exception from CLAUDE.md
   rule 2. "It felt worth explaining" is not one of them.
2. Delete every line that carries no fact, number, path, command or decision.
   Do this before looking at anything else. It usually removes a third.
3. Find each header and table. If the content under it is under 3 lines,
   the header is decoration. Remove it and join the prose.
4. Read the first sentence. If it restates the question or announces what you
   are about to do, delete it and start at the second.
5. Read the last paragraph. If it summarizes what the reader just read,
   delete it.
6. Search for em dashes. Every one is a rewrite, not a punctuation swap.

## Why these rules keep failing

A rule fires when it is countable and fails when it is an adjective.

| Rule shape | Example | Outcome |
| --- | --- | --- |
| Countable | "add Previous and Next at the bottom" | applied to 46 of 46 files |
| Countable | unslop's 31 numbered patterns | 0 em dashes across 8,000 lines |
| Adjective | "less verbose" | ignored for an entire session |
| Deferred | "belongs in both patterns, see below" | never applied |

When adding a rule anywhere in this repo, give it a number, a limit or a
grep-able string. If you cannot check it mechanically, it will not hold.

## Deciding versus asking

- Two readings produce the same work: decide, do not ask.
- Two readings produce different work: ask once, before starting.
- Hard to reverse (commits, deletes, anything leaving the machine): ask.
- Everything else: pick the obvious default, name it in one line, continue.

The cost of asking is a round trip. The cost of guessing wrong is redoing the
work. Compare those two, not your confidence.
