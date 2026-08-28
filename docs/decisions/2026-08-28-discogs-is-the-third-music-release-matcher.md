# Discogs is the third music-release matcher

**Status:** Accepted
**Date:** 2026-08-28
**Type:** Product behavior
**Supersedes:** [Automatic music matching tries every provider; specific matchers own release selection](2026-08-28-auto-music-matching-tries-every-provider-and-specific-matchers-own-release-lookup.md)
**Superseded by:** None

## Decision

Mux-Magic searches Discogs as the third provider in `matchMusicRelease`:
MusicBrainz, VGMdb, Discogs, then freedb.

Discogs uses its REST API. It searches by album artist and album title, reads the
shortlisted release records, then matches their tracks to the scanned files. It is
not a CDDB provider.

The anonymous client limit is 25 requests per minute. Responses use the existing
disposable provider cache. A Discogs token is optional future configuration, not a
requirement for matching.

## Context

Discogs has no working CDDB endpoint. Its REST database has release searches and
full release tracklists, but it does not have a disc id. Its curated release data is
more useful than freedb when the other primary providers miss an album.

## Why

This keeps one automatic matcher while preserving the review step before tag writes.
Discogs runs before freedb because freedb is user-submitted and unreviewed. The cache
and anonymous limiter keep the integration polite without adding a credential.

## Evidence

User, T3 Code chat `t3code-97938242`:

> "I wanna build in a Discogs API to Mux-Magic."

The preceding field report established that Discogs REST search works without a token
and that a token raises the request limit from 25 to 60 requests per minute.

## What we rejected — DO NOT revert to this

- Do not treat Discogs as a fourth CDDB server.
- Do not move freedb ahead of Discogs in the automatic matcher.
- Do not require a personal Discogs token for basic matching.
