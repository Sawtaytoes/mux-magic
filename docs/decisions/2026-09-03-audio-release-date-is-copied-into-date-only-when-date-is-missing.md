# Audio Release Date is copied into Date only when Date is missing

- **Status:** Accepted
- **Date:** 2026-09-03
- **Type:** core / cli / api / web
- **Supersedes:** The MKV scope in [worker 51](../workers/51_release-date-into-date-tag.md)
- **Superseded by:** —

## Decision

`copyAudioReleaseDateIntoDate` operates on audio metadata. It recognizes standard ID3 `TDRL`, custom ID3 Release Date fields, and Vorbis `RELEASEDATE` / `RELEASE DATE`. It writes the canonical Date field only when Date is missing. It does not remove or replace Release Date. It preserves the file modification time by default. Its default mode is a dry run.

## Context

The task came from music-library files whose Release Date appears in the tag editor while Plex and Music Assistant show no album year. The old worker brief incorrectly described Matroska tags and MKV files. A library inventory found the gap in FLAC Vorbis comments and ID3 tags instead.

## Why

Plex and Music Assistant reliably consume the canonical audio Date field. Music Assistant also sees standard ID3 `TDRL` after its metadata reader maps that frame to Date, but it does not consume a FLAC `RELEASEDATE` field. Copying the value makes the files consistent without destroying the more specific source field.

## What we rejected — DO NOT revert to this

- Do not implement this task as an MKV or Matroska tag edit.
- Do not overwrite an existing Date value.
- Do not delete Release Date after the copy.
- Do not make the write the default mode.

## Evidence

User, chat `t3code-74d1b9a7`, 2026-09-03: “In my Music/ folder, I wanna identify everything with ‘Release Date’ set and not ‘Date’.”

User, same chat: “So my final piece of this would be, after identification, copying one of them into the other. These are ID3 tags.”
