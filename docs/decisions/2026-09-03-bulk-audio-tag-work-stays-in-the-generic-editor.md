# Bulk audio tag work stays in the generic editor

- **Status:** Accepted
- **Date:** 2026-09-03
- **Type:** core / cli / api / web
- **Supersedes:** [Audio Release Date is copied into Date only when Date is missing](2026-09-03-audio-release-date-is-copied-into-date-only-when-date-is-missing.md)
- **Superseded by:** —

## Decision

Mux Magic does not carry a command dedicated to copying Release Date into Date. The one-time library repair does not justify a permanent command whose name and implementation encode one source field and one destination field.

`writeAudioTags` remains the product's generic bulk audio tag surface. If repeated field-to-field transformations become necessary, extend that generic surface with a reviewed transformation model. Do not add one command for each pair of tag fields.

## Context

The music-library repair identified 139 audio files that had Release Date but no Date. The repair copied the values, preserved existing Date values, and verified the result. Pull request 280 then turned that completed repair into a reusable `copyAudioReleaseDateIntoDate` command. The user corrected the product boundary: Mux Magic already has a bulk audio tag facility, and this specific copy does not belong as its own command.

## Why

A command for one tag pair makes the command list larger without adding a general capability. It also encourages another command for every later tag mapping. The generic editor is the correct place for bulk tag behavior because it already owns fixed-value audio tag writes, review, dry-run behavior, and the supported field set.

The completed repair remains valid. This decision changes the reusable product surface, not the files that were repaired.

## What we rejected — DO NOT revert to this

- Do not restore `copyAudioReleaseDateIntoDate` as a CLI, API, or web command.
- Do not add another command whose only purpose is one audio tag source-to-destination mapping.
- Do not imply that `writeAudioTags` already supports field-to-field copying. It currently writes reviewed values.
- Do not add field-to-field transformations until a real repeated use case defines the general model.

## Evidence

User, chat `t3code-74d1b9a7`, 2026-09-03: “I don't think copying release dates needs to be in mux-magic.”

User, same chat: “Now, if it's to do bulk actions on ID3 tags, that's a separate thing that we configured already or should've configured.”
