---
name: create-docs
description: Create markdown in Learning or a Professional pattern.
disable-model-invocation: true
---

# Create Docs

Write markdown files a reader understands on the first pass.

## Must follow

1. Load the `unslop` skill and keep it applied for the whole write.
2. Pick the pattern before writing anything.
   - Learning: the user wants to understand a topic. Answering a user question in a file is always Learning.
   - Professional: the user wants a record of something that exists or is finished. Feature docs, API reference, runbook, ADR, README.
   - State the pattern you picked in your reply, in one line, every time. Not only when the request fits both. If you did not state it, you did not pick it.
3. Apply "Preferred patterns" to every doc.
4. Then apply the section for the pattern you picked.
5. Conflict rule: in a Professional doc, the industry convention for that doc type beats anything in "Preferred patterns". In a Learning doc, "Preferred patterns" wins.
6. These rules apply to reviewing and editing an existing doc, not only to writing a new one. On a review or reshaping pass, first audit the doc against every rule here and report which rules it fails. Only then change anything. "Reshape" includes adding what is missing, not only fixing what is written.

## Preferred patterns

Both patterns follow these.

1. One doc covers one main topic: what it is, how it works, how it is used.
2. Sub-topics:
   - Large sub-topic: own file, linked from the main doc.
   - Short sub-topic: brief summary inside the main doc, written in the same shape as the parent topic.
3. Deep dive on the main topic only. Summarize sub-topics and link out.
4. Length is not the problem. Word vomit and info dump are. Concretely:
   - Every sentence adds a fact, a step, a number or a constraint the reader did not already have.
   - No restating the heading, no "in this section we will", no closing paragraph that repeats what was just read.
   - Delete any paragraph whose removal costs the reader nothing.
5. When a doc runs long across several sub-topics, split it into files and put a numbered table of contents in the main file.
6. Headings, subheadings and bullets carry the structure. Someone scanning headings alone should get the shape of the topic.
7. Before calling any doc finished, scan every section for these three shapes and act on each one found:
   - A sequence of steps, or a flow the prose describes in order, becomes a diagram or a numbered list.
   - Two or more options weighed on two or more axes becomes a table.
   - Any API, config or command becomes a snippet.
   Skipping one is allowed, but you must be able to say why prose is better in that spot. "The doc type does not usually have them" is not that reason.
8. In the bottom of the doc add reference to the Previous and Next topics reader should visit, guiding the project flow.

## Learning docs

The reader is learning the topic, not looking it up.

0. Depth of knowledge depend of 2 factor: prompter's knowledge and project scope. Never my default explain over the project scope but do mention the depth topic can go.
1. Visual aids are required whenever they explain the point better than prose: diagrams, tables, bullet lists, reference code snippets, charts. "Better than prose" is the test, decoration is not.
2. If helpful in logical way not forcefully pushed, a sequence of steps becomes a diagram or a numbered list. Two or more options compared on two or more axes becomes a table. Any API, config or command becomes a snippet.
3. Add a comparison when the topic has alternatives, or when a "which one do I use" question is hiding in it.
4. Casual, human tone. Second person is fine. Write the sentence the way you would say it out loud.
5. Read the reader's level from the question and match it.
6. Judge from that whether a sub-topic needs its own file or a few extra lines inline.
7. Close with short real-world examples: where this shows up, what breaks without it.

## Professional documentation

The reader is looking something up, or picking up work someone else finished.

1. The industry convention for the doc type decides the format, not personal preference. Name the type first: API reference, README, ADR, runbook, migration guide, release notes, changelog, RFC, design doc. Then write what that type normally contains, in the order it normally contains it.
2. The same rule governs visuals, with one limit: omit a diagram or table only when the convention for that named doc type actively excludes it, and say which convention you mean. Absence of a convention is not exclusion. If the doc teaches as well as records, treat it as Learning for visuals and apply rule 7 above. Referencing code snippets are nice to have.
3. Formal tone, no filler. Clear instructions, working code snippets, links to source and to related docs.
4. An AI agent and a human both read these. Use exact names, paths and commands instead of "the file above". State preconditions instead of assuming them. Keep each section usable when read on its own.
5. Document what is there, not what is planned. Versions, dates and commands that actually run.
