export interface paths {
    "/features": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Runtime feature flags
         * @description Returns feature flags sourced from server environment variables.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Feature flags JSON. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description When true, the video player uses the MSE + ffmpeg transcode path for browser-incompatible audio (TrueHD, DTS, etc.). Enabled by setting EXPERIMENTAL_FFMPEG_TRANSCODING=true in .env. Disabled by default while seek / InvalidStateError bugs are being resolved. */
                            isExperimentalFfmpegTranscodingEnabled: boolean;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Stream all job updates via Server-Sent Events */
        get: {
            parameters: {
                query?: {
                    /** @description Statuses to replay on connect, comma-separated or repeated (e.g. `?status=running,failed`). Omit it for every status. Sequence-step child jobs are judged by their parent's status, so a visible sequence keeps its whole step list. This filters the CONNECT REPLAY only — live updates are always streamed, or a job whose status changes into a hidden one would be stuck on screen at its last visible status forever. Known values: running, pending, paused, failed, completed, cancelled, skipped, exited. */
                    status?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Server-Sent Events stream of job updates. Each event is a JSON job object (without logs). Replays existing jobs on connect — every one, or only those matching `status` — then streams all new creates and status changes. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/event-stream": string;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all jobs */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of all jobs */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Job ID */
                            id: string;
                            /** @description Command name */
                            commandName: string;
                            /**
                             * @description Job status. `paused` means the job is awaiting external input (e.g. a user picking a name for an unnamed file). `skipped` is set on sequence-step child jobs that never ran because an earlier step failed or the umbrella was cancelled before reaching them; distinct from `cancelled`, which means the job was actively running when it got interrupted. `exited` is set on the umbrella job and every later flat step when a flow-control step (e.g. `exitIfEmpty`) signals a planned early exit — distinct from both `completed` (the sequence ran every step) and `skipped` (the rest of the sequence didn't run due to a failure or cancellation).
                             * @enum {string}
                             */
                            status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled" | "skipped" | "exited";
                            /**
                             * @description Human-readable reason why the job is paused. Only set when status is `paused`; null for all other statuses.
                             * @enum {string|null}
                             */
                            pauseReason: "user_input" | "rate_limit" | null;
                            /** @description Command parameters */
                            params?: unknown;
                            /** @description Job results */
                            results?: unknown[];
                            /** @description Named runtime outputs declared by the command (null when none were produced or the job is in flight) */
                            outputs: {
                                [key: string]: unknown;
                            } | null;
                            /** @description Error message if job failed */
                            error: string | null;
                            /** @description Job start timestamp */
                            startedAt: string | null;
                            /** @description Job completion timestamp */
                            completedAt: string | null;
                            /** @description If this job is a step inside a sequence, the umbrella sequence job's id. null for top-level jobs. */
                            parentJobId: string | null;
                            /** @description Sequence-step identifier (matches the SequenceStep `id` field — either user-supplied or auto-assigned `step1`, `step2`, …). Only set on sequence-step child jobs; null for top-level jobs. */
                            stepId: string | null;
                        }[];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/status-counts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Count top-level jobs by status
         * @description Counts TOP-LEVEL jobs only — sequence steps are never listed on their own, so counting them would report numbers that match nothing on screen. Exists so the jobs filter can say how many jobs a hidden status is hiding; the stream deliberately does not send those jobs, so the client cannot count them itself.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Top-level job count per status */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: number;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/:id": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get job details */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Job ID */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Job details */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Job ID */
                            id: string;
                            /** @description Command name */
                            commandName: string;
                            /**
                             * @description Job status. `paused` means the job is awaiting external input (e.g. a user picking a name for an unnamed file). `skipped` is set on sequence-step child jobs that never ran because an earlier step failed or the umbrella was cancelled before reaching them; distinct from `cancelled`, which means the job was actively running when it got interrupted. `exited` is set on the umbrella job and every later flat step when a flow-control step (e.g. `exitIfEmpty`) signals a planned early exit — distinct from both `completed` (the sequence ran every step) and `skipped` (the rest of the sequence didn't run due to a failure or cancellation).
                             * @enum {string}
                             */
                            status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled" | "skipped" | "exited";
                            /**
                             * @description Human-readable reason why the job is paused. Only set when status is `paused`; null for all other statuses.
                             * @enum {string|null}
                             */
                            pauseReason: "user_input" | "rate_limit" | null;
                            /** @description Command parameters */
                            params?: unknown;
                            /** @description Job results */
                            results?: unknown[];
                            /** @description Named runtime outputs declared by the command (null when none were produced or the job is in flight) */
                            outputs: {
                                [key: string]: unknown;
                            } | null;
                            /** @description Log lines */
                            logs: string[];
                            /** @description Error message if job failed */
                            error: string | null;
                            /** @description Job start timestamp */
                            startedAt: string | null;
                            /** @description Job completion timestamp */
                            completedAt: string | null;
                            /** @description If this job is a step inside a sequence, the umbrella sequence job's id. null for top-level jobs. */
                            parentJobId: string | null;
                            /** @description Sequence-step identifier (matches the SequenceStep `id` field — either user-supplied or auto-assigned `step1`, `step2`, …). Only set on sequence-step child jobs; null for top-level jobs. */
                            stepId: string | null;
                        };
                    };
                };
                /** @description Job not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JobNotFound"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /**
         * Cancel a running job
         * @description Idempotent. 202 with the cancelled job body when a running job was actually cancelled (the child-process tree-kill is async so the response may precede the OS-level death by a few ms). 204 No Content when the job is already in a terminal state — preserves history rather than failing the call. 404 when no job with that id exists.
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Job ID */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Job was running; cancellation has been initiated. Body is the job snapshot at the moment status flipped to cancelled. */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Job ID */
                            id: string;
                            /** @description Command name */
                            commandName: string;
                            /**
                             * @description Job status. `paused` means the job is awaiting external input (e.g. a user picking a name for an unnamed file). `skipped` is set on sequence-step child jobs that never ran because an earlier step failed or the umbrella was cancelled before reaching them; distinct from `cancelled`, which means the job was actively running when it got interrupted. `exited` is set on the umbrella job and every later flat step when a flow-control step (e.g. `exitIfEmpty`) signals a planned early exit — distinct from both `completed` (the sequence ran every step) and `skipped` (the rest of the sequence didn't run due to a failure or cancellation).
                             * @enum {string}
                             */
                            status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled" | "skipped" | "exited";
                            /**
                             * @description Human-readable reason why the job is paused. Only set when status is `paused`; null for all other statuses.
                             * @enum {string|null}
                             */
                            pauseReason: "user_input" | "rate_limit" | null;
                            /** @description Command parameters */
                            params?: unknown;
                            /** @description Job results */
                            results?: unknown[];
                            /** @description Named runtime outputs declared by the command (null when none were produced or the job is in flight) */
                            outputs: {
                                [key: string]: unknown;
                            } | null;
                            /** @description Log lines */
                            logs: string[];
                            /** @description Error message if job failed */
                            error: string | null;
                            /** @description Job start timestamp */
                            startedAt: string | null;
                            /** @description Job completion timestamp */
                            completedAt: string | null;
                            /** @description If this job is a step inside a sequence, the umbrella sequence job's id. null for top-level jobs. */
                            parentJobId: string | null;
                            /** @description Sequence-step identifier (matches the SequenceStep `id` field — either user-supplied or auto-assigned `step1`, `step2`, …). Only set on sequence-step child jobs; null for top-level jobs. */
                            stepId: string | null;
                        };
                    };
                };
                /** @description Job exists but is already in a terminal state (completed / failed / cancelled). No-op. */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Job not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JobNotFound"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/:id/logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Stream job logs via Server-Sent Events */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Job ID */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Server-Sent Events stream of job logs */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/event-stream": string;
                    };
                };
                /** @description Job not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JobNotFound"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/logs/structured": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Stream server-wide structured log records via Server-Sent Events */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description SSE stream of JSON-encoded LogRecord objects */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/event-stream": string;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/:id/input": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit a response to a job prompt */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Job ID */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Prompt ID from the SSE prompt event */
                        promptId: string;
                        /** @description Index of the selected option (-1 to skip/don't rename) */
                        selectedIndex: number;
                    };
                };
            };
            responses: {
                /** @description Input accepted */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {boolean} */
                            ok: true;
                        };
                    };
                };
                /** @description Prompt not found or already resolved */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JobNotFound"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List all available command names. */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of available command names */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            commandNames: ("analyseDiscBackup" | "makeDirectory" | "matchMusicRelease" | "matchMusicBrainzRelease" | "matchDiscogsRelease" | "matchFreedbRelease" | "matchVgmdbRelease" | "changeTrackLanguages" | "convertLosslessToFlac" | "convertContainerAudioToFlac" | "convertSrtToAss" | "findContainerAudioFiles" | "copyFiles" | "flattenOutput" | "copyOutSubtitles" | "extractDiscTitles" | "extractSubtitles" | "fixIncorrectDefaultTracks" | "getAudioOffsets" | "hasBetterAudio" | "hasBetterVersion" | "hasDuplicateMusicFiles" | "hasImaxEnhancedAudio" | "hasManyAudioTracks" | "hasSurroundSound" | "hasWrongDefaultTrack" | "isMissingSubtitles" | "deleteCopiedOriginals" | "deleteFilesByExtension" | "deleteFolder" | "exitIfEmpty" | "modifySubtitleMetadata" | "keepLanguages" | "addSubtitles" | "mergeTracks" | "moveFiles" | "moveFilesIntoNamedFolders" | "distributeFolderToSiblings" | "flattenChildFolders" | "renameFiles" | "renameFilesAndFolders" | "nameAnimeEpisodes" | "nameAnimeEpisodesAniDB" | "fetchThemeMusic" | "nameMovieCutsDvdCompareTmdb" | "nameSpecialFeaturesDvdCompareTmdb" | "onlyNameSpecialFeaturesDvdCompare" | "nameTvShowEpisodes" | "remuxToMkv" | "fingerprintAudioFiles" | "findDuplicateAudioFiles" | "compareMusicAssistantLibrary" | "scanAudioFiles" | "renumberChapters" | "renameAndMoveAudioFiles" | "renameDemos" | "renameMovieClipDownloads" | "reorderTracks" | "replaceAttachments" | "replaceFlacWithPcmAudio" | "replaceTracks" | "setDisplayWidth" | "splitChapters" | "splitCueSheet" | "storeAspectRatioData" | "trimFileTail" | "writeAudioTags")[];
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/analyseDiscBackup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Analyse a disc backup and propose which titles to rip, with a stated reason per title */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description A `[BACKUP]` folder produced by rip-deck (e.g. `/media/Disc-Rips/[BACKUP] Desk Set - Blu-ray`). Read directly as a BDMV tree — no disc needed. Nothing in it is modified. */
                        sourcePath: string;
                        /**
                         * @description Heuristic rules to switch off by name (e.g. `isChapterlessLongTitle`). Studio patterns are conventions, not standards, so a rule that turns out to be wrong for a release can be disabled without unpicking the analyser.
                         * @default []
                         */
                        disabledRuleNames?: string[];
                        /**
                         * @description MakeMKV's minimum title length. Defaults to 10, the floor that drops sub-ten-second BDMV fragments without dropping content — it takes Desk Set from 61 titles to 10, and it keeps the 12-second image gallery, 0:58 featurette and 0:30 promos that a 60-second floor silently hid. Pass 0 to see every fragment anyway.
                         * @default 10
                         */
                        minimumTitleLengthSeconds?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/makeDirectory": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a directory (or the parent directory of a file path) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory path to create, or a file path whose parent directory should be created */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/matchMusicRelease": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Match a folder against MusicBrainz, VGMdb, Discogs and freedb in that order, then combine every candidate into one tag review table. One provider failure does not prevent the others from running. Read-only. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * @description Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Which title language to ask VGMdb for. MusicBrainz and freedb ignore this field.
                         * @default default
                         * @enum {string}
                         */
                        language?: "default" | "en" | "ja" | "ja-Latn";
                        /**
                         * @description How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.
                         * @default 1
                         */
                        recursiveDepth?: number;
                        /** @description Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/matchMusicBrainzRelease": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cluster a folder's audio files into candidate albums, or use a selected MusicBrainz release UUID, and attach ranked releases with a proposed tag set per file. Read-only — the tag table is where a match is accepted. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * @description How many ranked releases are fetched in full and offered per row. MusicBrainz allows one request per second, so each extra candidate costs about a second per album. Five covers the usual wrong-country or wrong-year correction.
                         * @default 5
                         */
                        candidateFetchLimit?: number;
                        /**
                         * @description Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /** @description A selected MusicBrainz release UUID. When set, the matcher reads this release directly instead of searching by the current tags. */
                        releaseId?: string;
                        /**
                         * @description How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.
                         * @default 1
                         */
                        recursiveDepth?: number;
                        /** @description Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/matchDiscogsRelease": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Match a folder against Discogs by artist and album, then compare the returned release tracks to its files. Discogs has no CDDB endpoint, so a flattened multi-disc folder is supported. Read-only; the tag table is where a match is accepted. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * @description How many ranked Discogs releases are read in full and offered per row. Anonymous Discogs access permits 25 requests per minute, so each extra candidate costs about two and a half seconds.
                         * @default 5
                         */
                        candidateFetchLimit?: number;
                        /**
                         * @description Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.
                         * @default 1
                         */
                        recursiveDepth?: number;
                        /** @description Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/matchFreedbRelease": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Match a folder against general freedb — the FOURTH fallback, for discs MusicBrainz, VGMdb and Discogs miss. freedb is user-submitted CD metadata with no editorial review and no ids to link back to, so run it last. Like VGMdb it identifies a whole disc by track count and total playing time, so point it at ONE disc. Read-only. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * @description How many matched freedb discs to read in full and offer per row.
                         * @default 4
                         */
                        candidateLimit?: number;
                        /**
                         * @description Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.
                         * @default 1
                         */
                        recursiveDepth?: number;
                        /** @description Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/matchVgmdbRelease": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Match a folder against VGMdb for game and anime soundtracks, optionally constrained to a selected VGMdb album ID. VGMdb identifies a whole disc by track count and total playing time, so point this at ONE disc. Read-only; the tag table is where a match is accepted. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * @description How many matched VGMdb albums to read in full and offer per row. The common case is the same album released in three regions, which two or three settles.
                         * @default 4
                         */
                        candidateLimit?: number;
                        /**
                         * @description Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Which title language to ask VGMdb for. It reverts to the default when an album carries no title in the language you asked for, so two settings can return the same text.
                         * @default default
                         * @enum {string}
                         */
                        language?: "default" | "en" | "ja" | "ja-Latn";
                        /**
                         * @description How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.
                         * @default 1
                         */
                        recursiveDepth?: number;
                        /** @description Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka. */
                        sourcePath: string;
                        /** @description A VGMdb album ID from an album URL. When set, the matcher keeps only the disc whose canonical VGMdb URL has this ID. */
                        vgmdbAlbumId?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/changeTrackLanguages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Change language tags for media tracks */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory with media files whose tracks need language metadata corrections. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /** @description Language for audio tracks. Accepts a 3-letter ISO-639-2 code (e.g. 'chi') or an object with code + optional BCP 47 ietf tag (e.g. { code: 'chi', ietf: 'zh-Hant-HK' }). All tracks will be labeled with this language. */
                        audioLanguage?: ("aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul") | {
                            /** @enum {string} */
                            code: "aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul";
                            /** @enum {string} */
                            ietf?: "zh-Hans" | "zh-Hant" | "zh-Hans-CN" | "zh-Hans-SG" | "zh-Hant-HK" | "zh-Hant-TW" | "zh-Hant-MO" | "pt-BR" | "pt-PT" | "en-US" | "en-GB" | "en-AU" | "en-CA" | "es-ES" | "es-MX" | "es-419" | "fr-FR" | "fr-CA" | "de-DE" | "de-AT" | "de-CH" | "sr-Cyrl" | "sr-Latn";
                        };
                        /** @description Language for subtitle tracks. Accepts a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. */
                        subtitlesLanguage?: ("aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul") | {
                            /** @enum {string} */
                            code: "aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul";
                            /** @enum {string} */
                            ietf?: "zh-Hans" | "zh-Hant" | "zh-Hans-CN" | "zh-Hans-SG" | "zh-Hant-HK" | "zh-Hant-TW" | "zh-Hant-MO" | "pt-BR" | "pt-PT" | "en-US" | "en-GB" | "en-AU" | "en-CA" | "es-ES" | "es-MX" | "es-419" | "fr-FR" | "fr-CA" | "de-DE" | "de-AT" | "de-CH" | "sr-Cyrl" | "sr-Latn";
                        };
                        /** @description Language for video tracks. Accepts a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. */
                        videoLanguage?: ("aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul") | {
                            /** @enum {string} */
                            code: "aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul";
                            /** @enum {string} */
                            ietf?: "zh-Hans" | "zh-Hant" | "zh-Hans-CN" | "zh-Hans-SG" | "zh-Hant-HK" | "zh-Hant-TW" | "zh-Hant-MO" | "pt-BR" | "pt-PT" | "en-US" | "en-GB" | "en-AU" | "en-CA" | "es-ES" | "es-MX" | "es-419" | "fr-FR" | "fr-CA" | "de-DE" | "de-AT" | "de-CH" | "sr-Cyrl" | "sr-Latn";
                        };
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/convertLosslessToFlac": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Encode lossless audio files (.wav / .aif / .aiff / .m4a / .m4b) to FLAC in-place (strictly lossless) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing lossless audio files (.wav / .wave / .aif / .aiff / .m4a / .m4b) to encode to FLAC, or a directory of directories of those files when used with isRecursive. */
                        sourcePath: string;
                        /**
                         * @description Recursively descends into subdirectories looking for accepted lossless audio files. Depth is controlled by recursiveDepth (default 1 when isRecursive is true).
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Maximum recursion depth when isRecursive is set (0 = default depth of 1; mirrors deleteFilesByExtension). Pass 3 to descend three levels of subdirectories.
                         * @default 0
                         */
                        recursiveDepth?: number;
                        /**
                         * @description When true, deletes the source file after a successful FLAC encode. Defaults to false; the original is kept by default.
                         * @default false
                         */
                        isSourceDeleted?: boolean;
                        /**
                         * @description Dry-run: probe each file with mediainfo and report what would be converted vs. skipped (and why), but do not invoke ffmpeg or write any FLAC files. Source files are never touched. Useful for scanning a whole music library before committing to the encode.
                         * @default false
                         */
                        isAuditOnly?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/convertContainerAudioToFlac": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Encode audio tracks from container-with-video files (.mkv / .mp4 / etc.) to FLAC in-place, dropping the video stream. Requires isVideoDropAcknowledged: true to convert files that have a video track. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing container-with-video files (.mkv / .mp4 / .m4v / .mov / .webm / .avi) whose audio tracks should be encoded to FLAC in-place. */
                        sourcePath: string;
                        /**
                         * @description Recursively descends one level into subdirectories. Default false.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description When true, deletes each source container file after its FLAC encode succeeds. Defaults to false; the original is kept by default.
                         * @default false
                         */
                        isSourceDeleted?: boolean;
                        /**
                         * @description When false (the default), files that contain a video track are skipped with a warning — use findContainerAudioFiles first to review. Set to true to acknowledge that the video track will be dropped during conversion.
                         * @default false
                         */
                        isVideoDropAcknowledged?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/convertSrtToAss": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Convert SRT subtitle files to ASS in a separate output folder while preserving the source files. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing SRT subtitle files. */
                        sourcePath: string;
                        /**
                         * @description Recursively scan subdirectories for SRT files. Default false.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Maximum recursion depth when recursive scanning is enabled. Zero uses one level.
                         * @default 0
                         */
                        recursiveDepth?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "CONVERTED-SUBTITLES";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/findContainerAudioFiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Probe container-with-video files (.mkv / .mp4 / .m4v / .mov / .webm / .avi) with MediaInfo and report per-file track summaries (audio count, video count, codec, hasVideoTrack). Pure read — no filesystem mutation. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing container-with-video files (.mkv / .mp4 / .m4v / .mov / .webm / .avi) to probe with MediaInfo. Returns a per-file track summary (audio count, video count, audio codec, hasVideoTrack). Pure read — no filesystem mutation. */
                        sourcePath: string;
                        /**
                         * @description Recursively descends one level into subdirectories looking for container-with-video files. Default false.
                         * @default false
                         */
                        isRecursive?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/copyFiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Copy files (and optionally folders) from source to destination, with optional regex filtering and renaming */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory to copy files from. */
                        sourcePath: string;
                        /**
                         * @description Directory to copy files into. Created if it does not already exist.
                         * @default
                         */
                        destinationPath?: string;
                        /** @description If set, only files whose names match this regular expression are copied. Bare strings are accepted for back-compat with pre-flags templates. */
                        fileFilterRegex?: {
                            /** @description Regular expression pattern. */
                            pattern: string;
                            /** @description Optional regex flags (e.g. "i" for case-insensitive). */
                            flags?: string;
                            /** @description Optional sample filename used by the UI's live-match preview. Persisted in the template as documentation; ignored at runtime. */
                            sample?: string;
                        };
                        /** @description If set (and includeFolders is true), only folders whose names match this regular expression are copied. Bare strings are accepted for back-compat with pre-flags templates. */
                        folderFilterRegex?: {
                            /** @description Regular expression pattern. */
                            pattern: string;
                            /** @description Optional regex flags (e.g. "i" for case-insensitive). */
                            flags?: string;
                            /** @description Optional sample filename used by the UI's live-match preview. Persisted in the template as documentation; ignored at runtime. */
                            sample?: string;
                        };
                        /**
                         * @description When true, top-level subdirectories matching folderFilterRegex are copied as units (recursively). Files are only copied if fileFilterRegex is also set.
                         * @default false
                         */
                        includeFolders?: boolean;
                        /** @description Regex-based rename applied to each entry's name. Accepts a single rule object (back-compat) or an ordered array of rules applied left-to-right. For copy/move commands the result is the destination filename; for renameFiles it replaces the on-disk name in place. */
                        renameRegex?: {
                            /** @description Regular expression pattern. */
                            pattern: string;
                            /** @description Optional regex flags (e.g. "i" for case-insensitive). */
                            flags?: string;
                            /** @description Optional sample filename used by the UI's live-match preview. Persisted in the template as documentation; ignored at runtime. */
                            sample?: string;
                            /** @description Replacement string. Capture groups from `pattern` are available as $1, $2, etc. */
                            replacement: string;
                        } | {
                            /** @description Regular expression pattern. */
                            pattern: string;
                            /** @description Optional regex flags (e.g. "i" for case-insensitive). */
                            flags?: string;
                            /** @description Optional sample filename used by the UI's live-match preview. Persisted in the template as documentation; ignored at runtime. */
                            sample?: string;
                            /** @description Replacement string. Capture groups from `pattern` are available as $1, $2, etc. */
                            replacement: string;
                        }[];
                        /**
                         * @description When true, existing destination files are overwritten. Default false: the command refuses to clobber and fails fast with an EEXIST-shaped error naming the colliding path. Opt in for mirror-sync / idempotent re-run flows.
                         * @default false
                         */
                        allowOverwrite?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/flattenOutput": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Flatten a chained step's output: copies the folder's contents up one level (deletes source only if requested) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Output folder produced by a previous step (e.g. /work/SUBTITLED). Its contents are copied up one level into its parent. */
                        sourcePath: string;
                        /**
                         * @description Delete the source folder after copying. By default the source is preserved (debug-friendly).
                         * @default false
                         */
                        deleteSourceFolder?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/copyOutSubtitles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * [DEPRECATED — use extractSubtitles] Extract subtitle tracks into separate files alongside each video file.
         * @deprecated
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description ISO-639-2 codes of subtitle tracks to extract (bare code or { code, ietf? } object). Leave empty to extract every language.
                         * @default []
                         */
                        subtitlesLanguages?: (("aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul") | {
                            /** @enum {string} */
                            code: "aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul";
                            /** @enum {string} */
                            ietf?: "zh-Hans" | "zh-Hant" | "zh-Hans-CN" | "zh-Hans-SG" | "zh-Hant-HK" | "zh-Hant-TW" | "zh-Hant-MO" | "pt-BR" | "pt-PT" | "en-US" | "en-GB" | "en-AU" | "en-CA" | "es-ES" | "es-MX" | "es-419" | "fr-FR" | "fr-CA" | "de-DE" | "de-AT" | "de-CH" | "sr-Cyrl" | "sr-Latn";
                        })[];
                        /**
                         * @description How to apply subtitleTypes: 'none' ignores the list (all types extracted), 'include' keeps only listed types, 'exclude' skips listed types. With 'include' and an empty subtitleTypes list, no tracks match — the command extracts nothing.
                         * @default none
                         * @enum {string}
                         */
                        typesMode?: "none" | "include" | "exclude";
                        /**
                         * @description File extensions of subtitle formats to filter on (ass/srt/sup/sub). Ignored when typesMode is 'none'. 'sup' covers both PGS and TextST codecs.
                         * @default []
                         */
                        subtitleTypes?: ("ass" | "srt" | "sup" | "sub")[];
                        /** @description Folder names to extract subtitles into. Each extracted subtitle file is placed inside the named sub-folder relative to the source file location. Leave empty to use the default output folder. */
                        folders?: string[];
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "EXTRACTED-SUBTITLES";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/extractDiscTitles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rip the titles a disc analysis proposed keeping out of a `[BACKUP]` folder into .mkv files */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description A `[BACKUP]` folder produced by rip-deck (e.g. `/media/Disc-Rips/[BACKUP] Desk Set - Blu-ray`). The backup itself is only read. */
                        sourcePath: string;
                        /** @description Where the ripped `.mkv` files land. Defaults to `EXTRACTED-TITLES/` inside the backup, beside `DISC-ANALYSIS/`, so the files travel with the proposal that produced them. */
                        destinationPath?: string;
                        /**
                         * @description Heuristic rules to switch off by name (e.g. `isChapterlessLongTitle`). Same list the analysis takes — the rules decide which titles are `keep`, and `keep` is what gets ripped.
                         * @default []
                         */
                        disabledRuleNames?: string[];
                        /**
                         * @description MakeMKV's minimum title length. MUST match the analysis pass: makemkvcon assigns title indexes AFTER applying this filter, so the same disc read at 0 and at 10 numbers its titles differently and an index from the wrong pass rips the wrong title.
                         * @default 10
                         */
                        minimumTitleLengthSeconds?: number;
                        /** @description Explicit title indexes to rip, overriding the dispositions. Omit to rip every title the analysis proposed keeping — `merge` and `inspect` titles are not ripped automatically unless `isRippingTrackSupersets` covers them. */
                        titleIndexes?: number[];
                        /**
                         * @description Also rip the one title in a cluster that carries every track its siblings expose, grafting the chapter marks it lacks from the richest sibling playlist's `.mpls`. Replaces ripping three 65.5 GB playlists of the same film with one pass. Off by default because the superset is the very title `isChapterlessTwin` proposes discarding, so taking it is the caller's decision.
                         * @default false
                         */
                        isRippingTrackSupersets?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "EXTRACTED-TITLES";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/extractSubtitles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Extract subtitle tracks into separate files alongside each video file. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description ISO-639-2 codes of subtitle tracks to extract (bare code or { code, ietf? } object). Leave empty to extract every language.
                         * @default []
                         */
                        subtitlesLanguages?: (("aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul") | {
                            /** @enum {string} */
                            code: "aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul";
                            /** @enum {string} */
                            ietf?: "zh-Hans" | "zh-Hant" | "zh-Hans-CN" | "zh-Hans-SG" | "zh-Hant-HK" | "zh-Hant-TW" | "zh-Hant-MO" | "pt-BR" | "pt-PT" | "en-US" | "en-GB" | "en-AU" | "en-CA" | "es-ES" | "es-MX" | "es-419" | "fr-FR" | "fr-CA" | "de-DE" | "de-AT" | "de-CH" | "sr-Cyrl" | "sr-Latn";
                        })[];
                        /**
                         * @description How to apply subtitleTypes: 'none' ignores the list (all types extracted), 'include' keeps only listed types, 'exclude' skips listed types. With 'include' and an empty subtitleTypes list, no tracks match — the command extracts nothing.
                         * @default none
                         * @enum {string}
                         */
                        typesMode?: "none" | "include" | "exclude";
                        /**
                         * @description File extensions of subtitle formats to filter on (ass/srt/sup/sub). Ignored when typesMode is 'none'. 'sup' covers both PGS and TextST codecs.
                         * @default []
                         */
                        subtitleTypes?: ("ass" | "srt" | "sup" | "sub")[];
                        /** @description Folder names to extract subtitles into. Each extracted subtitle file is placed inside the named sub-folder relative to the source file location. Leave empty to use the default output folder. */
                        folders?: string[];
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "EXTRACTED-SUBTITLES";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/fixIncorrectDefaultTracks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Fix incorrect default track designations */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/getAudioOffsets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Calculate audio synchronization offsets between files */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory with media files with tracks you want to copy. */
                        sourcePath: string;
                        /** @description Directory containing media files with tracks you want replaced. */
                        destinationFilesPath: string;
                        /**
                         * @description Force re-extraction of the source/destination WAV files even when a previous extraction is already present alongside the AUDIO-OFFSETS folder. When false (default), an existing WAV whose mediaInfo duration matches its input within 1 second is reused so the slow ffmpeg PCM decode is skipped on re-runs.
                         * @default false
                         */
                        isOverwritingExtractedAudio?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "AUDIO-OFFSETS";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/hasBetterAudio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Analyze and compare audio quality across files */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description How many levels of child directories to follow when using isRecursive (0 = use default depth of 1).
                         * @default 0
                         */
                        recursiveDepth?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/hasBetterVersion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Check if better version of media exists */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description How many levels of child directories to follow when using isRecursive (0 = use default depth of 1).
                         * @default 0
                         */
                        recursiveDepth?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/hasDuplicateMusicFiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Identify duplicate music files */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing music files or containing other directories of music files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for music files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description How many levels of child directories to follow when using isRecursive (0 = use default depth of 1).
                         * @default 0
                         */
                        recursiveDepth?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/hasImaxEnhancedAudio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Check for IMAX enhanced audio tracks */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/hasManyAudioTracks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Identify files with many audio tracks */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/hasSurroundSound": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Check for surround sound audio tracks */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description How many levels of child directories to follow when using isRecursive (0 = use default depth of 1).
                         * @default 0
                         */
                        recursiveDepth?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/hasWrongDefaultTrack": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Find files with incorrect default track selection */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/isMissingSubtitles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Identify media files missing subtitle tracks */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/deleteCopiedOriginals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Delete the original source files that were copied by a prior copyFiles or moveFiles step. Receives its pathsToDelete list via linkedTo from the prior step's copiedSourcePaths output. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description List of file or folder paths to delete. Typically provided via linkedTo from a prior copyFiles step's copiedSourcePaths output. Is a no-op when the list is empty. */
                        pathsToDelete: string[];
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/deleteFilesByExtension": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Delete files that match one or more extensions */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory to search for files to delete. */
                        sourcePath: string;
                        /**
                         * @description Recursively search subdirectories for matching files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Maximum recursion depth when --isRecursive is set (0 = default depth of 1).
                         * @default 0
                         */
                        recursiveDepth?: number;
                        /**
                         * @description List of file extensions to delete (with or without leading dot), e.g. ['.srt', 'idx'].
                         * @example [
                         *       ".srt",
                         *       "idx"
                         *     ]
                         */
                        extensions: string[];
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/deleteFolder": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Recursively delete a folder (DESTRUCTIVE — requires confirm: true) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Folder to delete (recursively). */
                        sourcePath: string;
                        /**
                         * @description Required: pass --confirm to acknowledge this is destructive. Without it the command refuses to run.
                         * @enum {boolean}
                         */
                        confirm: true;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/exitIfEmpty": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Exit the umbrella sequence cleanly (status: exited) if sourcePath does not exist or contains zero entries. No-op if the folder has any contents. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory path whose emptiness gates whether the sequence continues. The step emits `isExiting: true` (causing the umbrella sequence job to end with status `exited`) when the path either does not exist or exists but contains zero entries. Otherwise emits `isExiting: false` and the sequence continues. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/modifySubtitleMetadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Apply DSL-driven modifications to ASS subtitle metadata. Set hasDefaultRules:true to prepend the in-tree default-rules heuristic. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing .ass subtitle files to modify. */
                        sourcePath: string;
                        /**
                         * @description Recursively search subdirectories for .ass files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Maximum recursion depth when --isRecursive is set (0 = default depth of 1).
                         * @default 0
                         */
                        recursiveDepth?: number;
                        /**
                         * @description When true, the command runs the in-tree default-rules heuristic (`buildDefaultSubtitleModificationRules`) against the .ass files at `sourcePath` and PREPENDS the computed rules to `rules`. Defaults run first, user rules run after, so user rules can override. The heuristic emits: `setScriptInfo ScriptType=v4.00+`, `setScriptInfo YCbCr Matrix=TV.709` (when any file has TV.601 outside SD-DVD 640x480), `setStyleFields MarginV=round(PlayResY/1080*90)`, optional `MarginL/R=round(200/1920*PlayResX)` when narrow margins are detected on non-ignored styles, with `ignoredStyleNamesRegexString="signs?|op|ed|opening|ending"`. See docs/dsl/subtitle-rules.md `Default rules toggle` for the full table.
                         * @default false
                         */
                        hasDefaultRules?: boolean;
                        /** @description Optional named-predicate map. Keys are predicate names; values are flat string-equality key→value maps. Referenced from rule `when:` clauses via `{ $ref: <name> }` inside `matches:` or `excludes:`. See docs/dsl/subtitle-rules.md Named predicates. */
                        predicates?: {
                            [key: string]: {
                                [key: string]: string;
                            };
                        };
                        /**
                         * @description Ordered list of DSL modification rules to apply to each .ass file. Empty when only relying on `hasDefaultRules: true` for the rule set.
                         * @default []
                         */
                        rules?: ({
                            /** @enum {string} */
                            type: "setScriptInfo";
                            /** @description Key name in the [Script Info] section of the ASS file (e.g. 'YCbCr Matrix', 'ScriptType', 'PlayResX'). The key is matched case-sensitively. If the key does not already exist it is appended after the last existing property. */
                            key: string;
                            /** @description New value to assign to the key (e.g. 'TV.709', 'v4.00+', '1920'). */
                            value: string;
                            /** @description Optional aggregate-batch gate. When present, the rule is skipped entirely if the predicate fails across the batch. */
                            when?: {
                                /** @description True when at least one .ass file's [Script Info] satisfies the per-file clause. */
                                anyScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when every .ass file's [Script Info] satisfies the per-file clause. */
                                allScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when no .ass file's [Script Info] satisfies the per-file clause. */
                                noneScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when at least one .ass file's [Script Info] does NOT satisfy the per-file clause. */
                                notAllScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when at least one [V4+ Styles] row across all files satisfies the per-style clause. */
                                anyStyle?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when every [V4+ Styles] row across all files satisfies the per-style clause. */
                                allStyle?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when no [V4+ Styles] row in any file satisfies the per-style clause. */
                                noneStyle?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                            };
                        } | {
                            /** @enum {string} */
                            type: "scaleResolution";
                            /**
                             * @description Optional guard: if provided and the file's current PlayResX/Y do not match, the rule is skipped entirely. Omit to apply unconditionally regardless of current resolution.
                             * @example {
                             *       "width": 640,
                             *       "height": 480
                             *     }
                             */
                            from?: {
                                /** @description Expected current PlayResX value in the file. The rule is skipped if the file does not match this width. */
                                width: number;
                                /** @description Expected current PlayResY value in the file. The rule is skipped if the file does not match this height. */
                                height: number;
                            };
                            /**
                             * @description The resolution to scale the file to.
                             * @example {
                             *       "width": 1920,
                             *       "height": 1080
                             *     }
                             */
                            to: {
                                /** @description Target PlayResX value to write (e.g. 1920). */
                                width: number;
                                /** @description Target PlayResY value to write (e.g. 1080). */
                                height: number;
                            };
                            /**
                             * @description When true, creates LayoutResX and LayoutResY even if they are not already present. Only takes effect when isLayoutResSynced is also true. Defaults to false.
                             * @default false
                             */
                            hasLayoutRes?: boolean;
                            /**
                             * @description When true, sets 'ScaledBorderAndShadow: yes' in [Script Info] after scaling, which ensures borders and shadows scale proportionally at the new resolution. Defaults to true.
                             * @default true
                             */
                            hasScaledBorderAndShadow?: boolean;
                            /**
                             * @description When true, updates LayoutResX and LayoutResY if they already exist in the file. Keys that are absent are left alone unless hasLayoutRes is also true. Defaults to true.
                             * @default true
                             */
                            isLayoutResSynced?: boolean;
                            /** @description Optional aggregate-batch gate. Distinct from the per-file `from:` guard — `when:` decides whether the rule emits at all across the batch, while `from:` is a per-file no-op when the file's resolution doesn't match. */
                            when?: {
                                /** @description True when at least one .ass file's [Script Info] satisfies the per-file clause. */
                                anyScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when every .ass file's [Script Info] satisfies the per-file clause. */
                                allScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when no .ass file's [Script Info] satisfies the per-file clause. */
                                noneScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when at least one .ass file's [Script Info] does NOT satisfy the per-file clause. */
                                notAllScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when at least one [V4+ Styles] row across all files satisfies the per-style clause. */
                                anyStyle?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when every [V4+ Styles] row across all files satisfies the per-style clause. */
                                allStyle?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when no [V4+ Styles] row in any file satisfies the per-style clause. */
                                noneStyle?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                            };
                        } | {
                            /** @enum {string} */
                            type: "setStyleFields";
                            /** @description Map of ASS style field names to their new values. Each value is either a string literal (e.g. 'MarginV: "90"') or a `computeFrom` block that derives the value from a metadata property. Field names must use the exact ASS column names from the Format line (e.g. 'MarginL', 'MarginR', 'MarginV', 'Fontsize', 'PrimaryColour'). Only the listed fields are changed; all other style fields are left untouched. */
                            fields: {
                                [key: string]: string | {
                                    computeFrom: {
                                        /** @description Source metadata key — `[Script Info]` key name when scope is 'scriptInfo', `[V4+ Styles]` field name when scope is 'style'. */
                                        property: string;
                                        /**
                                         * @description Where to read the source value from. 'scriptInfo' reads the file's [Script Info] map; 'style' reads the per-row [V4+ Styles] field.
                                         * @enum {string}
                                         */
                                        scope: "scriptInfo" | "style";
                                        /** @description Ordered list of math ops applied left-to-right to the number-coerced source value. Final accumulator is `Number.toString()`'d into the field. */
                                        ops: ({
                                            add: number;
                                        } | {
                                            subtract: number;
                                        } | {
                                            multiply: number;
                                        } | {
                                            divide: number;
                                        } | {
                                            min: number;
                                        } | {
                                            max: number;
                                        } | "round" | "floor" | "ceil" | "abs")[];
                                    };
                                };
                            };
                            /** @description Optional case-insensitive regular expression matched against each style's Name field. Styles whose name matches are left unchanged. Use this to protect sign/song styles from being overwritten — e.g. 'signs?|op|ed|opening|ending'. */
                            ignoredStyleNamesRegexString?: string;
                            /** @description Per-file applicability filter (e.g. `{ anyStyleMatches: { MarginL: { lt: 50 } } }`). When omitted, all non-ignored styles get the fields. Files with no style row that satisfies the predicate are left untouched for this rule. */
                            applyIf?: {
                                /** @description Apply the rule's `fields` only when at least one [V4+ Styles] row in the file matches every entry in this clause. */
                                anyStyleMatches?: {
                                    [key: string]: string | {
                                        /** @description Strictly equal to the style field's numeric value. */
                                        eq?: number;
                                        /** @description Strictly less than the style field's numeric value. */
                                        lt?: number;
                                        /** @description Strictly greater than the style field's numeric value. */
                                        gt?: number;
                                        /** @description Less than or equal to the style field's numeric value. */
                                        lte?: number;
                                        /** @description Greater than or equal to the style field's numeric value. */
                                        gte?: number;
                                    };
                                };
                                /** @description Apply only when every non-ignored style in the file matches every entry in this clause. */
                                allStyleMatches?: {
                                    [key: string]: string | {
                                        /** @description Strictly equal to the style field's numeric value. */
                                        eq?: number;
                                        /** @description Strictly less than the style field's numeric value. */
                                        lt?: number;
                                        /** @description Strictly greater than the style field's numeric value. */
                                        gt?: number;
                                        /** @description Less than or equal to the style field's numeric value. */
                                        lte?: number;
                                        /** @description Greater than or equal to the style field's numeric value. */
                                        gte?: number;
                                    };
                                };
                                /** @description Apply only when no style row matches every entry in this clause. */
                                noneStyleMatches?: {
                                    [key: string]: string | {
                                        /** @description Strictly equal to the style field's numeric value. */
                                        eq?: number;
                                        /** @description Strictly less than the style field's numeric value. */
                                        lt?: number;
                                        /** @description Strictly greater than the style field's numeric value. */
                                        gt?: number;
                                        /** @description Less than or equal to the style field's numeric value. */
                                        lte?: number;
                                        /** @description Greater than or equal to the style field's numeric value. */
                                        gte?: number;
                                    };
                                };
                            };
                            /** @description Optional aggregate-batch gate. When present, the rule is skipped entirely if the predicate fails across the batch. */
                            when?: {
                                /** @description True when at least one .ass file's [Script Info] satisfies the per-file clause. */
                                anyScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when every .ass file's [Script Info] satisfies the per-file clause. */
                                allScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when no .ass file's [Script Info] satisfies the per-file clause. */
                                noneScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when at least one .ass file's [Script Info] does NOT satisfy the per-file clause. */
                                notAllScriptInfo?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when at least one [V4+ Styles] row across all files satisfies the per-style clause. */
                                anyStyle?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when every [V4+ Styles] row across all files satisfies the per-style clause. */
                                allStyle?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                                /** @description True when no [V4+ Styles] row in any file satisfies the per-style clause. */
                                noneStyle?: {
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    matches?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                    /** @description Predicate body — either an inline literal key→value map or a `{ $ref: <name> }` pointer at a named predicate. */
                                    excludes?: {
                                        $ref: string;
                                    } | {
                                        [key: string]: string;
                                    };
                                } | {
                                    [key: string]: string;
                                };
                            };
                        })[];
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/keepLanguages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Filter media tracks by language */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory where media files are located. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Language selections for audio tracks to keep. Each entry is a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. All others will be removed.
                         * @default []
                         */
                        audioLanguages?: (("aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul") | {
                            /** @enum {string} */
                            code: "aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul";
                            /** @enum {string} */
                            ietf?: "zh-Hans" | "zh-Hant" | "zh-Hans-CN" | "zh-Hans-SG" | "zh-Hant-HK" | "zh-Hant-TW" | "zh-Hant-MO" | "pt-BR" | "pt-PT" | "en-US" | "en-GB" | "en-AU" | "en-CA" | "es-ES" | "es-MX" | "es-419" | "fr-FR" | "fr-CA" | "de-DE" | "de-AT" | "de-CH" | "sr-Cyrl" | "sr-Latn";
                        })[];
                        /**
                         * @description Language selections for subtitles tracks to keep. Each entry is a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. All others will be removed.
                         * @default []
                         */
                        subtitlesLanguages?: (("aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul") | {
                            /** @enum {string} */
                            code: "aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul";
                            /** @enum {string} */
                            ietf?: "zh-Hans" | "zh-Hant" | "zh-Hans-CN" | "zh-Hans-SG" | "zh-Hant-HK" | "zh-Hant-TW" | "zh-Hant-MO" | "pt-BR" | "pt-PT" | "en-US" | "en-GB" | "en-AU" | "en-CA" | "es-ES" | "es-MX" | "es-419" | "fr-FR" | "fr-CA" | "de-DE" | "de-AT" | "de-CH" | "sr-Cyrl" | "sr-Latn";
                        })[];
                        /**
                         * @description The language of the first audio track is the only language kept for audio tracks.
                         * @default false
                         */
                        useFirstAudioLanguage?: boolean;
                        /**
                         * @description The language of the first subtitles track is the only language kept for subtitles tracks.
                         * @default false
                         */
                        useFirstSubtitlesLanguage?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "LANGUAGE-TRIMMED";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/addSubtitles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mux a folder of per-file subtitle directories into matching media files (preserves attachments and optional chapters.xml). */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory with media files that need subtitles. */
                        sourcePath: string;
                        /** @description Directory containing subdirectories with subtitle files and attachments/ that match the name of the media files in sourcePath. */
                        subtitlesPath: string;
                        /**
                         * @description Compute the audio sync offset by aligning chapter 1 between the destination media file's Menu track and a chapters.xml inside the subtitles path. Falls back to globalOffset (or per-file offsets) when no chapters.xml is found.
                         * @default false
                         */
                        hasChapterSyncOffset?: boolean;
                        /**
                         * @description The offset in milliseconds to apply to all audio being transferred.
                         * @default 0
                         */
                        globalOffset?: number;
                        /**
                         * @description Adds chapters along with other tracks.
                         * @default false
                         */
                        includeChapters?: boolean;
                        /**
                         * @description Offsets (milliseconds, one per episode). Provide one offset per source file. The order must match the order of episodes selected above. Negative values shift the subtitle earlier; positive values shift it later. This field is only useful for manual runs; sequences and schedules should rely on auto-aligned tracks.
                         * @default []
                         */
                        offsets?: number[];
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "SUBTITLED";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/mergeTracks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * [DEPRECATED — use addSubtitles] Merge subtitle tracks into media files.
         * @deprecated
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory with media files that need subtitles. */
                        sourcePath: string;
                        /** @description Directory containing subdirectories with subtitle files and attachments/ that match the name of the media files in sourcePath. */
                        subtitlesPath: string;
                        /**
                         * @description Compute the audio sync offset by aligning chapter 1 between the destination media file's Menu track and a chapters.xml inside the subtitles path. Falls back to globalOffset (or per-file offsets) when no chapters.xml is found.
                         * @default false
                         */
                        hasChapterSyncOffset?: boolean;
                        /**
                         * @description The offset in milliseconds to apply to all audio being transferred.
                         * @default 0
                         */
                        globalOffset?: number;
                        /**
                         * @description Adds chapters along with other tracks.
                         * @default false
                         */
                        includeChapters?: boolean;
                        /**
                         * @description Offsets (milliseconds, one per episode). Provide one offset per source file. The order must match the order of episodes selected above. Negative values shift the subtitle earlier; positive values shift it later. This field is only useful for manual runs; sequences and schedules should rely on auto-aligned tracks.
                         * @default []
                         */
                        offsets?: number[];
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "SUBTITLED";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/moveFiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Move files from source to destination, with optional regex filtering and renaming */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory to move files from. Deleted after all files are copied. */
                        sourcePath: string;
                        /**
                         * @description Directory to move files into. Created if it does not already exist.
                         * @default
                         */
                        destinationPath?: string;
                        /** @description If set, only files whose names match this regular expression are moved. Bare strings are accepted for back-compat with pre-flags templates. */
                        fileFilterRegex?: {
                            /** @description Regular expression pattern. */
                            pattern: string;
                            /** @description Optional regex flags (e.g. "i" for case-insensitive). */
                            flags?: string;
                            /** @description Optional sample filename used by the UI's live-match preview. Persisted in the template as documentation; ignored at runtime. */
                            sample?: string;
                        };
                        /** @description Regex-based rename applied to each entry's name. Accepts a single rule object (back-compat) or an ordered array of rules applied left-to-right. For copy/move commands the result is the destination filename; for renameFiles it replaces the on-disk name in place. */
                        renameRegex?: {
                            /** @description Regular expression pattern. */
                            pattern: string;
                            /** @description Optional regex flags (e.g. "i" for case-insensitive). */
                            flags?: string;
                            /** @description Optional sample filename used by the UI's live-match preview. Persisted in the template as documentation; ignored at runtime. */
                            sample?: string;
                            /** @description Replacement string. Capture groups from `pattern` are available as $1, $2, etc. */
                            replacement: string;
                        } | {
                            /** @description Regular expression pattern. */
                            pattern: string;
                            /** @description Optional regex flags (e.g. "i" for case-insensitive). */
                            flags?: string;
                            /** @description Optional sample filename used by the UI's live-match preview. Persisted in the template as documentation; ignored at runtime. */
                            sample?: string;
                            /** @description Replacement string. Capture groups from `pattern` are available as $1, $2, etc. */
                            replacement: string;
                        }[];
                        /**
                         * @description When true, existing destination files are overwritten. Default false: the command refuses to clobber and fails fast with an EEXIST-shaped error naming the colliding path. Opt in for mirror-sync / idempotent re-run flows.
                         * @default false
                         */
                        allowOverwrite?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/moveFilesIntoNamedFolders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Foldarize a directory: each file is moved into a new same-named subdirectory (extension stripped from the folder name) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Folder whose files are each moved into a same-named subdirectory (file extension stripped from the folder name). Casper.mkv → Casper/Casper.mkv. Pre-existing subdirectories are untouched. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/distributeFolderToSiblings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Copy a folder (default ./attachments) into every sibling directory of its parent, with optional source-folder cleanup */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Folder to copy into every sibling directory of its parent. Canonical use case is an `attachments` folder beside per-episode dirs. */
                        sourceFolderPath: string;
                        /**
                         * @description Delete the source folder after all copies succeed. Default false: source is preserved so the destructive step is explicit and opt-in.
                         * @default false
                         */
                        deleteSourceFolderAfterDistributing?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/flattenChildFolders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Move every file from each immediate child directory of parentPath up to parentPath itself, with optional empty-child cleanup */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Folder whose immediate child directories should each have their files moved up to this folder. Files already at the parent level are untouched. */
                        parentPath: string;
                        /**
                         * @description Delete the now-empty child directories after the moves complete. Default false: the empties are preserved for inspection (matches flattenOutput's default).
                         * @default false
                         */
                        deleteEmptyChildFoldersAfterFlattening?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/renameFiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rename files in place via regex (no copy, no move). Pre-flight halts the run if two files would map to the same target name. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing files to rename. */
                        sourcePath: string;
                        /**
                         * @description Recursively descend into subdirectories. Default false.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Maximum recursion depth when --isRecursive is set (0 = default depth of 1; mirrors deleteFilesByExtension).
                         * @default 0
                         */
                        recursiveDepth?: number;
                        /** @description If set, only files whose names match this regular expression are renamed. Bare strings are accepted for back-compat with pre-flags templates. */
                        fileFilterRegex?: {
                            /** @description Regular expression pattern. */
                            pattern: string;
                            /** @description Optional regex flags (e.g. "i" for case-insensitive). */
                            flags?: string;
                            /** @description Optional sample filename used by the UI's live-match preview. Persisted in the template as documentation; ignored at runtime. */
                            sample?: string;
                        };
                        /** @description Required. Applied to each matched filename (including extension) via String.replace. */
                        renameRegex: {
                            /** @description Regular expression pattern. */
                            pattern: string;
                            /** @description Optional regex flags (e.g. "i" for case-insensitive). */
                            flags?: string;
                            /** @description Optional sample filename used by the UI's live-match preview. Persisted in the template as documentation; ignored at runtime. */
                            sample?: string;
                            /** @description Replacement string. Capture groups from `pattern` are available as $1, $2, etc. */
                            replacement: string;
                        } | {
                            /** @description Regular expression pattern. */
                            pattern: string;
                            /** @description Optional regex flags (e.g. "i" for case-insensitive). */
                            flags?: string;
                            /** @description Optional sample filename used by the UI's live-match preview. Persisted in the template as documentation; ignored at runtime. */
                            sample?: string;
                            /** @description Replacement string. Capture groups from `pattern` are available as $1, $2, etc. */
                            replacement: string;
                        }[];
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/renameFilesAndFolders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rename files and folders by regex. The general renamer — renaming was previously only ever a side effect of a naming command, and renameFiles covers files only. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * @description Report the planned renames without touching anything.
                         * @default false
                         */
                        isDryRun?: boolean;
                        /**
                         * @description Apply the rename to files.
                         * @default true
                         */
                        isRenamingFiles?: boolean;
                        /**
                         * @description Apply the rename to folders. Folders rename deepest-first so a parent rename cannot invalidate a child that has not been renamed yet.
                         * @default true
                         */
                        isRenamingFolders?: boolean;
                        /** @description Only rename entries whose name matches this pattern. Omit to consider every entry. */
                        nameFilterRegex?: string | {
                            pattern: string;
                            flags?: string;
                        };
                        /**
                         * @description How many folder levels below the source to walk. 0 renames only the direct children of the source folder.
                         * @default 0
                         */
                        recursiveDepth?: number;
                        /** @description The rename itself: a pattern and its replacement, or an ordered list applied left to right. The extension is part of the name a file rule sees. */
                        renameRegex: {
                            pattern: string;
                            replacement: string;
                            flags?: string;
                            sample?: string;
                        } | {
                            pattern: string;
                            replacement: string;
                            flags?: string;
                            sample?: string;
                        }[];
                        /** @description Folder whose contents are renamed. The folder itself is never renamed. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/nameAnimeEpisodes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rename anime episode files using MyAnimeList metadata */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory where all episodes are located. */
                        sourcePath: string;
                        /** @description Name of the anime for searching MyAnimeList.com. */
                        searchTerm?: string;
                        /**
                         * @description The season number to output when renaming useful for TVDB which has separate season number. For aniDB, use the default value 1.
                         * @default 1
                         */
                        seasonNumber?: number;
                        /** @description MyAnimeList ID — when provided, skips the interactive search and uses this ID directly. */
                        malId?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/nameAnimeEpisodesAniDB": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rename anime episode files using AniDB metadata (regular, specials with length-matched picker, or type=6 alternates) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory where all episodes are located. */
                        sourcePath: string;
                        /** @description Anime name for searching AniDB (via DuckDuckGo). */
                        searchTerm?: string;
                        /**
                         * @description Season number for the output filename (Plex-style sNNeNN). Ignored when --episodeType=specials.
                         * @default 1
                         */
                        seasonNumber?: number;
                        /** @description AniDB anime id (aid). When provided, skips the interactive search. */
                        anidbId?: number;
                        /**
                         * @description Which AniDB episode types to rename. Each non-regular sub-type is run separately: specials (S), credits (C, OP/ED), trailers (T), parodies (P) all run the length-matched per-file picker and emit Plex's s00eNN. Others (type=6 alts) and regular are index-paired with a duration sanity-check warning.
                         * @default regular
                         * @enum {string}
                         */
                        episodeType?: "regular" | "specials" | "credits" | "trailers" | "parodies" | "others";
                        /** @description Regex with a named capture group (?<episodeNumber>…) used to pair each file to the AniDB episode whose number matches the captured value (e.g. "S\\d+E(?<episodeNumber>\\d+)"). Matched case-insensitively. Fixes mis-pairing on partial, non-contiguous, or out-of-order sets. Files that don't match fall back to index pairing (see startEpisodeNumber). Applies to the index-paired regular/others types only. */
                        filenameRegex?: string;
                        /** @description First episode number when pairing a partial set by natural-sort index (e.g. 5 names the files s01e05, s01e06, …). Ignored for files matched by filenameRegex. Defaults to 1. Applies to the index-paired regular/others types only. */
                        startEpisodeNumber?: number;
                        /** @description Overrides AniDB's auto-picked series title in output filenames and the seriesFolderName output. Used verbatim (backticks, apostrophes and all) — pick a candidate with the AniDB title-picker then character-clean it. When omitted, AniDB's title is used. */
                        seriesName?: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/fetchThemeMusic": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Resolve AniDB-tagged anime folders through AnimeThemes and create a reviewable Plex theme music manifest. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Anime library root, or one [anidb-#####] show folder. */
                        sourcePath: string;
                        /**
                         * @description Write theme.mp3 files. The default only writes the review manifest.
                         * @default false
                         */
                        isApplied?: boolean;
                        /**
                         * @description Replace an existing theme.mp3 only after AnimeThemes resolves a replacement.
                         * @default true
                         */
                        isOverwrite?: boolean;
                        /** @description JSON manifest path. Defaults to theme-music-manifest.json in the source directory. */
                        manifestPath?: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/nameMovieCutsDvdCompareTmdb": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rename main-feature movie cuts (Director's Cut, Theatrical, etc.) and move into Plex edition-folder layout. Skips any file whose duration doesn't match a DVDCompare cut. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing movie cut files (e.g. Movie.mkv, Movie.Directors.Cut.mkv). */
                        sourcePath: string;
                        /** @description DVDCompare.net URL including the chosen release's hash tag. */
                        url?: string;
                        /** @description DVDCompare film ID — when provided, constructs URL directly and bypasses search. */
                        dvdCompareId?: number;
                        /**
                         * @description Release hash (URL fragment #) on the DVDCompare page. Defaults to 1 (the first release option).
                         * @default 1
                         */
                        dvdCompareReleaseHash?: number;
                        /** @description Title to search on DVDCompare.net (used when no url or dvdCompareId). */
                        searchTerm?: string;
                        /**
                         * @description Constant offset (in seconds) subtracted from each file's duration before matching.
                         * @default 0
                         */
                        fixedOffset?: number;
                        /**
                         * @description Seconds of slack when matching a file's duration against a cut's listed timecode. Defaults to 15 — the floor used by the cut matcher to accommodate typical rip-vs-DVDCompare drift on main features.
                         * @default 15
                         */
                        timecodePadding?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/nameSpecialFeaturesDvdCompareTmdb": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rename special features (and the main movie file) based on DVDCompare timecodes; movie title is canonicalized via TMDB */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory where special features are located. */
                        sourcePath: string;
                        /** @description DVDCompare.net URL including the chosen release's hash tag. */
                        url?: string;
                        /** @description DVDCompare film ID — when provided, constructs URL directly and bypasses search. */
                        dvdCompareId?: number;
                        /**
                         * @description The hash (URL fragment #) from the DVDCompare release page denoting which release variant is selected for that film. Defaults to 1 (the first release option).
                         * @default 1
                         */
                        dvdCompareReleaseHash?: number;
                        /** @description Title to search on DVDCompare.net (used when no url or dvdCompareId). */
                        searchTerm?: string;
                        /**
                         * @description Timecodes are pushed positively or negatively by this amount (in seconds).
                         * @default 0
                         */
                        fixedOffset?: number;
                        /**
                         * @description Seconds that timecodes may be off. Defaults to 2, matching typical DVDCompare-vs-rip drift. Pass 0 for exact-match-only.
                         * @default 2
                         */
                        timecodePadding?: number;
                        /**
                         * @description After renaming, move main-feature files that carry a {edition-…} tag into a nested folder: <sourceParent>/<Title (Year)>/<Title (Year) {edition-…}>/<file>. Special-feature files are not moved.
                         * @default false
                         */
                        moveToEditionFolders?: boolean;
                        /**
                         * @description When a rename target already exists on disk, automatically append (2), (3), … instead of emitting a review-needed collision event. Use this in scripts or when running without a UI that can display the collision prompt.
                         * @default false
                         */
                        nonInteractive?: boolean;
                        /**
                         * @description When two-or-more files match the same target name within a single run, auto-disambiguate them with (2)/(3)/… suffixes deterministically. Pass false to instead emit a duplicate-pick prompt for each ambiguous group. Defaults to false so interactive runs prompt the user.
                         * @default false
                         */
                        autoNameDuplicates?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/onlyNameSpecialFeaturesDvdCompare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rename special features by timecode matching against DVDCompare.net — no TMDB lookup. Suited for concerts, documentaries, and other non-movie workflows. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing special-features files. */
                        sourcePath: string;
                        /** @description DVDCompare film ID — when provided, constructs URL directly and bypasses search. */
                        dvdCompareId?: number;
                        /**
                         * @description The hash (URL fragment #) from the DVDCompare release page denoting which release variant is selected for that film. Defaults to 1 (the first release option).
                         * @default 1
                         */
                        dvdCompareReleaseHash?: number;
                        /** @description DVDCompare.net URL including the chosen release's hash tag. */
                        url?: string;
                        /** @description Title to search on DVDCompare.net (used when no url or dvdCompareId). */
                        searchTerm?: string;
                        /**
                         * @description Seconds that timecodes may be off. Defaults to 2, matching typical DVDCompare-vs-rip drift. Pass 0 for exact-match-only.
                         * @default 2
                         */
                        timecodePadding?: number;
                        /**
                         * @description Timecodes are pushed positively or negatively by this amount (in seconds).
                         * @default 0
                         */
                        fixedOffset?: number;
                        /**
                         * @description When two-or-more files match the same target name within a single run, auto-disambiguate them with (2)/(3)/… suffixes deterministically. Pass false to instead emit a duplicate-pick prompt for each ambiguous group. Defaults to false so interactive runs prompt the user.
                         * @default false
                         */
                        autoNameDuplicates?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/nameTvShowEpisodes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rename TV show episode files based on metadata */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory where all episodes for that season are located. */
                        sourcePath: string;
                        /** @description Name of the TV show for searching TVDB.com. */
                        searchTerm?: string;
                        /**
                         * @description The season number to lookup when renaming.
                         * @default 1
                         */
                        seasonNumber?: number;
                        /** @description TVDB ID — when provided, skips the interactive search and uses this ID directly. */
                        tvdbId?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/remuxToMkv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Pass-through container remux of every matching file into an .mkv sibling using mkvmerge */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing files to remux. */
                        sourcePath: string;
                        /**
                         * @description List of file extensions to remux (with or without leading dot), e.g. ['.ts', '.m2ts'].
                         * @example [
                         *       ".ts"
                         *     ]
                         */
                        extensions: string[];
                        /**
                         * @description Recursively scan subdirectories.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Maximum recursion depth when --isRecursive is set (0 = default depth of 1).
                         * @default 0
                         */
                        recursiveDepth?: number;
                        /**
                         * @description Delete each source file after its remux completes successfully.
                         * @default false
                         */
                        isSourceDeletedOnSuccess?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/fingerprintAudioFiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Fingerprint each audio file with fpcalc and ask AcoustID which recording it is. Identifies untagged and mis-tagged files, which the MusicBrainz cluster match cannot. Read-only. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * @description Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Lowest AcoustID score that counts as the same recording. Below about 0.5 AcoustID is reporting similar audio rather than the same audio — a different take, a different mix, or a cover.
                         * @default 0.5
                         */
                        minimumScore?: number;
                        /**
                         * @description How many MusicBrainz recordings to offer per file. A well-known song accumulates dozens of linked recordings, and past the first few they are compilation re-issues of the same one.
                         * @default 5
                         */
                        recordingLimit?: number;
                        /**
                         * @description How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.
                         * @default 1
                         */
                        recursiveDepth?: number;
                        /** @description Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/findDuplicateAudioFiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Find duplicates inside the source or against an optional library path. Match by identical decoded audio, by AcoustID fingerprint, or by tags, then rank which copy to keep — lossless first, then bit depth and sample rate. Read-only: it recommends, the compare table confirms, and nothing is deleted here. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Optional library or other tree to compare with the source. Only duplicate groups that include a source file are reported. */
                        comparisonPath?: string;
                        /**
                         * @description How many folder levels below the comparison path to scan. Three covers the normal Artist/Album/track library layout.
                         * @default 3
                         */
                        comparisonRecursiveDepth?: number;
                        /**
                         * @description Also fingerprint every file so a FLAC and an MP3 of the same recording pair up. They can never hash-match, because the encoders produce different samples. Costs a two-minute decode per file.
                         * @default false
                         */
                        isFingerprintCompared?: boolean;
                        /**
                         * @description Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.
                         * @default 1
                         */
                        recursiveDepth?: number;
                        /** @description Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/compareMusicAssistantLibrary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Compare source albums with the existing Music Assistant Music library provider. It is read-only and reports album matches, album misses, and files that need tags before they can be compared. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * @description Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.
                         * @default 1
                         */
                        recursiveDepth?: number;
                        /** @description Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/scanAudioFiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Walk a folder for audio files and report each one's existing tags, codec, bit depth, sample rate and duration. Pure read — no filesystem mutation. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * @description Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.
                         * @default 1
                         */
                        recursiveDepth?: number;
                        /** @description Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/renumberChapters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Renumber `Chapter NN`-style chapter names sequentially via a metadata-only mkvmerge remux (preserves timecodes, UIDs, custom-named chapters) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Zero-pad chapter numbers (default true) — produces `Chapter 01..N` (width ≥ 2). Set false for `Chapter 1..N`.
                         * @default true
                         */
                        isPaddingChapterNumbers?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/renameAndMoveAudioFiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** File tagged audio into the library tree using the Picard naming script. Each file's own tags decide its destination, so run this after the tags are right. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * @description Report the planned moves without touching a file. Run this first: the destination comes from each file's own tags, so a wrong tag becomes a wrong folder.
                         * @default false
                         */
                        isDryRun?: boolean;
                        /**
                         * @description Allow a move to replace an existing file at the destination. Off by default — a clash is reported and the file is left alone.
                         * @default false
                         */
                        isOverwriteAllowed?: boolean;
                        /**
                         * @description Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /** @description Root of the destination library tree. The naming script builds every folder below it, so this is the only path the command is given. */
                        libraryRoot: string;
                        /** @description Picard naming script to use instead of the default. The default is the owner's own script, verified byte-identical across two machines and eight years — override it only for a one-off. */
                        namingScript?: string;
                        /**
                         * @description How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.
                         * @default 1
                         */
                        recursiveDepth?: number;
                        /** @description Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/renameDemos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rename demo files based on content analysis */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory where demo files are located. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/renameMovieClipDownloads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rename downloaded movie clip files */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory where downloaded movie demos are located. */
                        sourcePath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/reorderTracks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reorder media tracks */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory with media files whose tracks need reordering. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description The order of all video tracks that will appear in the resulting file by their index. Indexes start at 0. If you leave out any track indexes, they will not appear in the resulting file.
                         * @default []
                         */
                        videoTrackIndexes?: number[];
                        /**
                         * @description The order of all audio tracks that will appear in the resulting file by their index. Indexes start at 0. If you leave out any track indexes, they will not appear in the resulting file.
                         * @default []
                         */
                        audioTrackIndexes?: number[];
                        /**
                         * @description The order of all subtitles tracks that will appear in the resulting file by their index. Indexes start at 0. If you leave out any track indexes, they will not appear in the resulting file.
                         * @default []
                         */
                        subtitlesTrackIndexes?: number[];
                        /**
                         * @description When enabled, files whose track count does not match the supplied indexes are skipped with a warning instead of causing an error. Tracks should align if the command was added correctly.
                         * @default false
                         */
                        isSkipOnTrackMisalignment?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "REORDERED-TRACKS";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/replaceAttachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Replace attachments in media files */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory with media files with attachments you want to copy. */
                        sourcePath: string;
                        /** @description Directory containing media files with attachments you want replaced. */
                        destinationFilesPath: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "REPLACED-ATTACHMENTS";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/replaceFlacWithPcmAudio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Replace FLAC audio with PCM audio */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "AUDIO-CONVERTED";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/replaceTracks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Replace media tracks in destination files */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory with media files with tracks you want to copy. */
                        sourcePath: string;
                        /** @description Directory containing media files with tracks you want replaced. */
                        destinationFilesPath: string;
                        /**
                         * @description Per-file automatic audio sync: extract both source and destination audio to WAV via ffmpeg and run audio-offset-finder to compute the delay, then use that per-file offset when remuxing. Falls back to globalOffset (or per-file offsets) when disabled.
                         * @default false
                         */
                        hasAudioSyncOffset?: boolean;
                        /**
                         * @description The offset in milliseconds to apply to all audio being transferred.
                         * @default 0
                         */
                        globalOffset?: number;
                        /**
                         * @description Adds chapters along with other tracks.
                         * @default false
                         */
                        includeChapters?: boolean;
                        /**
                         * @description Force re-extraction of the source/destination WAV files used for per-file audio-sync offset detection. Only applies when hasAudioSyncOffset is true. When false (default), an existing WAV whose mediaInfo duration matches its input within 1 second is reused so ffmpeg doesn't re-decode the audio on every run.
                         * @default false
                         */
                        isOverwritingExtractedAudio?: boolean;
                        /**
                         * @description Language selections for audio tracks to keep. Each entry is a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. All others will be removed.
                         * @default []
                         */
                        audioLanguages?: (("aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul") | {
                            /** @enum {string} */
                            code: "aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul";
                            /** @enum {string} */
                            ietf?: "zh-Hans" | "zh-Hant" | "zh-Hans-CN" | "zh-Hans-SG" | "zh-Hant-HK" | "zh-Hant-TW" | "zh-Hant-MO" | "pt-BR" | "pt-PT" | "en-US" | "en-GB" | "en-AU" | "en-CA" | "es-ES" | "es-MX" | "es-419" | "fr-FR" | "fr-CA" | "de-DE" | "de-AT" | "de-CH" | "sr-Cyrl" | "sr-Latn";
                        })[];
                        /**
                         * @description Language selections for subtitles tracks to keep. Each entry is a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. All others will be removed.
                         * @default []
                         */
                        subtitlesLanguages?: (("aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul") | {
                            /** @enum {string} */
                            code: "aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul";
                            /** @enum {string} */
                            ietf?: "zh-Hans" | "zh-Hant" | "zh-Hans-CN" | "zh-Hans-SG" | "zh-Hant-HK" | "zh-Hant-TW" | "zh-Hant-MO" | "pt-BR" | "pt-PT" | "en-US" | "en-GB" | "en-AU" | "en-CA" | "es-ES" | "es-MX" | "es-419" | "fr-FR" | "fr-CA" | "de-DE" | "de-AT" | "de-CH" | "sr-Cyrl" | "sr-Latn";
                        })[];
                        /**
                         * @description Language selections for video tracks to keep. Each entry is a 3-letter ISO-639-2 code or an object with code + optional BCP 47 ietf tag. All others will be removed.
                         * @default []
                         */
                        videoLanguages?: (("aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul") | {
                            /** @enum {string} */
                            code: "aar" | "abk" | "afr" | "aka" | "alb" | "amh" | "ara" | "arg" | "arm" | "asm" | "ava" | "ave" | "aym" | "aze" | "bak" | "bam" | "baq" | "bel" | "ben" | "bih" | "bis" | "bod" | "bos" | "bre" | "bul" | "bur" | "cat" | "ces" | "cha" | "che" | "chi" | "chu" | "chv" | "cor" | "cos" | "cre" | "cym" | "cze" | "dan" | "deu" | "div" | "dut" | "dzo" | "ell" | "eng" | "enm" | "epo" | "est" | "eus" | "ewe" | "fao" | "fas" | "fij" | "fin" | "fra" | "fre" | "fry" | "ful" | "geo" | "ger" | "gla" | "gle" | "glg" | "glv" | "gre" | "grn" | "guj" | "hat" | "hau" | "heb" | "her" | "hin" | "hmo" | "hrv" | "hun" | "hye" | "ibo" | "ice" | "ido" | "iii" | "iku" | "ile" | "ina" | "ind" | "ipk" | "isl" | "ita" | "jav" | "jpn" | "kal" | "kan" | "kas" | "kat" | "kau" | "kaz" | "khm" | "kik" | "kin" | "kir" | "kom" | "kon" | "kor" | "kua" | "kur" | "lao" | "lat" | "lav" | "lim" | "lin" | "lit" | "ltz" | "lub" | "lug" | "mac" | "mah" | "mal" | "mao" | "mar" | "may" | "mkd" | "mlg" | "mlt" | "mon" | "mri" | "msa" | "mya" | "nau" | "nav" | "nbl" | "nde" | "ndo" | "nep" | "nld" | "nno" | "nob" | "nor" | "nya" | "oci" | "oji" | "ori" | "orm" | "oss" | "pan" | "per" | "pli" | "pol" | "por" | "pus" | "que" | "roh" | "ron" | "rum" | "run" | "rus" | "sag" | "san" | "sin" | "slk" | "slo" | "slv" | "sme" | "smo" | "sna" | "snd" | "som" | "sot" | "spa" | "sqi" | "srd" | "srp" | "ssw" | "sun" | "swa" | "swe" | "tah" | "tam" | "tat" | "tel" | "tgk" | "tgl" | "tha" | "tib" | "tir" | "ton" | "tsn" | "tso" | "tuk" | "tur" | "twi" | "uig" | "ukr" | "urd" | "uzb" | "ven" | "vie" | "vol" | "wel" | "wln" | "wol" | "xho" | "yid" | "yor" | "zha" | "zho" | "zul";
                            /** @enum {string} */
                            ietf?: "zh-Hans" | "zh-Hant" | "zh-Hans-CN" | "zh-Hans-SG" | "zh-Hant-HK" | "zh-Hant-TW" | "zh-Hant-MO" | "pt-BR" | "pt-PT" | "en-US" | "en-GB" | "en-AU" | "en-CA" | "es-ES" | "es-MX" | "es-419" | "fr-FR" | "fr-CA" | "de-DE" | "de-AT" | "de-CH" | "sr-Cyrl" | "sr-Latn";
                        })[];
                        /**
                         * @description Space-separated list of time-alignment offsets to set for each individual file in milliseconds.
                         * @default []
                         */
                        offsets?: number[];
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "REPLACED-TRACKS";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/setDisplayWidth": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Set display width for video tracks */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory where video files are located. */
                        sourcePath: string;
                        /**
                         * @description Recursively looks in folders for media files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description How many levels of child directories to follow when using isRecursive (0 = use default depth of 1).
                         * @default 0
                         */
                        recursiveDepth?: number;
                        /**
                         * @description Display width of the video file. For DVDs, they're all 3:2, but you can set them to the proper 4:3 or 16:9 aspect ratio with anamorphic (non-square) pixels using this value.
                         * @default 853
                         */
                        displayWidth?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/splitChapters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Split media files by chapter markers */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory where video files are located. */
                        sourcePath: string;
                        /** @description Space-separated list of comma-separated chapter markers. Splits occur at the beginning of the chapter. */
                        chapterSplits: string[];
                        /**
                         * @description Renumber each split file's `Chapter NN` names so they start at 1 (default true). A split part inherits the play-all file's numbering, so part 2 opens on `Chapter 04` without this. Parts with custom chapter names (`Opening`, `Eyecatch`) are left alone.
                         * @default true
                         */
                        isRenumberingChapters?: boolean;
                        /**
                         * @description Zero-pad the renumbered chapter names (default true) — produces `Chapter 01..N` (width ≥ 2). Set false for `Chapter 1..N`. Ignored when chapter renumbering is off.
                         * @default true
                         */
                        isPaddingChapterNumbers?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "SPLITS";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/splitCueSheet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Split CUE sheet to FLAC */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Music library root containing albums with CUE sheets. */
                        sourcePath: string;
                        /**
                         * @description Recursively descend into subdirectories looking for CUE files. Default true.
                         * @default true
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Folder name created under sourcePath that holds all per-album subfolders.
                         * @default CUE-SPLITS
                         */
                        outputFolderName?: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "CUE-SPLITS";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/storeAspectRatioData": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Analyze and store aspect ratio metadata */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing media files or containing other directories of media files. */
                        sourcePath: string;
                        /**
                         * @description Recursively look in folders for media files. Defaults to true since Plex-style libraries are nested (Movies/<title>/<file>); pass --no-isRecursive to scan only sourcePath.
                         * @default true
                         */
                        isRecursive?: boolean;
                        /**
                         * @description How many directory levels deep to scan, counting sourcePath as level 1. Default 3 covers Plex's edition layout (e.g. Movies/Soldier (1998)/Soldier (1998) {edition-Director's Cut}/file.mkv — 4 segments long, 3 levels of descent from Movies). Non-editioned Movies/<title>/<file> only needs 2, but over-recursing is safer than missing files. Only used with --isRecursive.
                         * @default 3
                         */
                        recursiveDepth?: number;
                        /** @description Location of the resulting JSON file. If using append mode, it will search here for the JSON file. By default, this uses the sourcePath. */
                        outputPath?: string;
                        /** @description Path your media player (Plex, Jellyfin, Emby) sees for your library — written into the output JSON's file paths so the player can match its catalog. The path does not have to exist on this machine and is not validated; in many setups it won't (e.g. Plex sees /media/Movies but you're scanning G:\Movies — pass /media/Movies here). Path separator is auto-converted to match the format you provide. */
                        rootPath?: string;
                        /**
                         * @description List of folder names relative to the sourcePath that you want to look through. If you're searching a root path with lots of media files, but only some are in Plex, this can reduce the list down to only those provided to Plex. Ensure these folder names match the ones in Plex.
                         * @default []
                         */
                        folders?: string[];
                        /**
                         * @description Instead of appending the current JSON file, it will rescan every file.
                         * @default false
                         */
                        force?: boolean;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/trimFileTail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Trim everything after a timestamp from one file */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing the file to trim. */
                        sourcePath: string;
                        /** @description Exact file name inside sourcePath. One file per run — a tail trim is a per-file decision, not a folder-wide one. */
                        fileName: string;
                        /** @description Keep everything before this timestamp and discard the rest (HH:MM:SS[.mmm]). mkvmerge cuts on a keyframe, so the delivered endpoint can land later than the requested one; the job output reports both. */
                        endTime: string;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /**
                             * @description Output folder name where files are written, or null for in-place operations
                             * @enum {string}
                             */
                            outputFolderName: "TRIMMED";
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/commands/writeAudioTags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Set the same tag fields on every audio file under a folder — MP3Tag's bulk edit. The reviewed, per-file write behind the tag table is POST /music/tags, not this command. */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Album title to set on every matched file. Leave empty to keep whatever each file already has. */
                        album?: string;
                        /** @description Album artist to set on every matched file. This is the field that decides the library folder, so it is the most common bulk edit. */
                        albumArtist?: string;
                        /** @description Track artist to set on every matched file. On a compilation this differs per track, so set it here only when every file really does share one artist. */
                        artist?: string;
                        /** @description Comment to set on every matched file. */
                        comment?: string;
                        /** @description Composer to set on every matched file. */
                        composer?: string;
                        /** @description Release date to set on every matched file. MusicBrainz style is `YYYY-MM-DD`, and a bare `YYYY` is accepted. */
                        date?: string;
                        /** @description Disc number to set on every matched file. Point the command at one disc folder when a multi-disc release is still split across folders. */
                        discNumber?: number;
                        /** @description Genres to set on every matched file. Multi-value: the tag holds each entry separately, never one joined string. */
                        genres?: string[];
                        /**
                         * @description Report which files would change, and which fields, without writing anything. Run this first — the report is the same shape as the real run.
                         * @default false
                         */
                        isDryRun?: boolean;
                        /**
                         * @description Walk child folders as well. An album usually lives in one folder, so this is off by default; turn it on to point a run at a whole inbox of albums at once.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Restore each file's modified time after writing. On by default so a re-tag does not make every album look new to the library scanner.
                         * @default true
                         */
                        isTimestampPreserved?: boolean;
                        /**
                         * @description How many folder levels below the source to walk when `isRecursive` is on. 1 covers the normal `Inbox/<Album>/` layout.
                         * @default 1
                         */
                        recursiveDepth?: number;
                        /** @description Folder to walk. Only audio files are read — .flac, .mp3, .m4a, .ogg, .opus, .wav, .aiff, .wv, .ape and .mka. */
                        sourcePath: string;
                        /** @description Total disc count to set on every matched file. */
                        totalDiscs?: number;
                    };
                };
            };
            responses: {
                /** @description Job started successfully */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description Unique job identifier
                             * @example 123e4567-e89b-12d3-a456-426614174000
                             */
                            jobId: string;
                            /**
                             * @description URL to stream job logs via SSE
                             * @example /jobs/123e4567-e89b-12d3-a456-426614174000/logs
                             */
                            logsUrl: string;
                            /** @description Output folder name where files are written, or null for in-place operations */
                            outputFolderName?: null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/music/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Write the reviewed tag set for one audio file
         * @description One row of the tag review table, one request. The table's Apply button posts these sequentially so a per-row failure stays a per-row failure and lands on that row. Only the fields present in `tags` are compared and written — an absent field leaves whatever the file already has. Returns the fields that changed, which is empty when the file already carried these values.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Absolute path of the audio file to write. Must be absolute and traversal-free. */
                        filePath: string;
                        /**
                         * @description Report which fields would change without writing the file.
                         * @default false
                         */
                        isDryRun?: boolean;
                        /**
                         * @description Restore the file's modified time after writing.
                         * @default true
                         */
                        isTimestampPreserved?: boolean;
                        /** @description The tag set to write. Only the fields present are compared and written; an absent field means leave whatever the file already has. */
                        tags: {
                            album?: string;
                            albumArtist?: string;
                            artist?: string;
                            comment?: string;
                            composer?: string;
                            date?: string;
                            discNumber?: number;
                            genres?: string[];
                            isCompilation?: boolean;
                            musicBrainzAlbumArtistId?: string;
                            musicBrainzArtistId?: string;
                            musicBrainzRecordingId?: string;
                            musicBrainzReleaseGroupId?: string;
                            musicBrainzReleaseId?: string;
                            title?: string;
                            totalDiscs?: number;
                            totalTracks?: number;
                            trackNumber?: number;
                        };
                    };
                };
            };
            responses: {
                /** @description Write result for the file, successful or not */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Names of the fields that changed, or would change under `isDryRun`. Empty when the file already carried these values. */
                            changedFields: string[];
                            /** @description Why the write failed; null on success. The tag table renders this on the row. */
                            error: string | null;
                            /** @description Whether the write succeeded. The tag table marks the row from this field. */
                            isOk: boolean;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/music/duplicates/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Move one redundant duplicate copy to a holding folder
         * @description One confirmed row of the duplicate compare table, one request. The copy is MOVED, never deleted — the library share has no Recycle Bin, so a move into a holding folder is what makes the decision reversible. The copy's path below `sourceRootPath` is recreated under `holdingFolderPath`, so two same-named tracks from different albums cannot collide.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Absolute path of the redundant copy to move out of the library. Must be absolute and traversal-free. */
                        filePath: string;
                        /** @description Absolute path of the folder the copy is moved into. The copy's folder structure below the source root is recreated there, so two files with the same name never collide. */
                        holdingFolderPath: string;
                        /**
                         * @description Report where the copy would go without moving it.
                         * @default false
                         */
                        isDryRun?: boolean;
                        /** @description The folder the duplicate scan walked. Used to work out the copy's path relative to the library so the holding folder mirrors it. */
                        sourceRootPath: string;
                    };
                };
            };
            responses: {
                /** @description Move result for the copy, successful or not */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Where the copy was moved, or would be moved under `isDryRun`. Null when the move failed. */
                            destination: string | null;
                            /** @description Why the move failed; null on success. The compare table renders this on the row. */
                            error: string | null;
                            /** @description Whether the move succeeded. The compare table marks the row from this field. */
                            isOk: boolean;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/music/acoustid/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit reviewed fingerprints to AcoustID
         * @description Sends a batch of fingerprint-to-recording links to AcoustID under the owner's account. Explicit and reviewed only — this route is never called by a sequence step. The two AcoustID keys are not interchangeable: ACOUSTID_API_KEY is the application key sent as `client`, and ACOUSTID_USER_API_KEY is the account key sent as `user`, which is what authorises the submission.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /**
                         * @description Report what would be submitted without sending anything to AcoustID.
                         * @default false
                         */
                        isDryRun?: boolean;
                        /** @description The reviewed submissions. The whole batch goes in one request; AcoustID indexes each entry by position. */
                        submissions: {
                            albumArtistName?: string;
                            albumName?: string;
                            artistName?: string;
                            /** @description Track length in seconds. AcoustID rounds it to a whole number and rejects a fractional one. */
                            durationSeconds: number;
                            /** @description The Chromaprint fingerprint from `fpcalc`, as produced by the fingerprintAudioFiles command. */
                            fingerprint: string;
                            /** @description The recording this fingerprint belongs to. Without it the submission adds a fingerprint that is linked to nothing, which helps nobody. */
                            musicBrainzRecordingId?: string;
                            title?: string;
                            trackNumber?: number;
                            year?: number;
                        }[];
                    };
                };
            };
            responses: {
                /** @description Submission result, successful or not */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Why the submission failed; null on success. */
                            error: string | null;
                            /** @description Whether AcoustID accepted the batch. */
                            isOk: boolean;
                            /** @description One entry per accepted submission, empty on failure or a dry run. */
                            submissions: {
                                /** @description AcoustID's own status for the entry, normally `pending` — it queues submissions rather than applying them at once. */
                                status: string;
                                submissionId: number;
                            }[];
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/music/musicbrainz/seed-release": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Build a seeded MusicBrainz release-editor form
         * @description Returns a self-submitting HTML form that opens the MusicBrainz release editor pre-filled with this album. Opening the editor saves nothing — the owner steps through the tabs and clicks the green "Enter edit" to create the release. This exists because the web service cannot create a release at all.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        albumArtistName: string;
                        /** @description MusicBrainz artist id to link the credit to. Without it the release is created with an unlinked artist name. */
                        artistMbid?: string;
                        /** @description Release country. Defaults to XW (Worldwide), which suits a digital release. */
                        countryCode?: string;
                        /** @description Release date, `YYYY-MM-DD` or `YYYY`. */
                        date?: string;
                        editNote?: string;
                        label?: string;
                        mediumFormat?: string;
                        primaryType?: string;
                        releaseTitle: string;
                        secondaryTypes?: string[];
                        /** @description The tracklist, in order. */
                        tracks: {
                            /** @description Exact track length. The release editor wants milliseconds, and an approximate length is the most common reason a seeded release needs hand correction. */
                            lengthMilliseconds: number;
                            title: string;
                            trackNumber: number;
                        }[];
                        /** @description A relationship URL, normally the album's purchase page. */
                        url?: string;
                    };
                };
            };
            responses: {
                /** @description The self-submitting release-editor form */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/html": string;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/getSubtitleMetadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Read .ass subtitle file metadata without making any changes
         * @description Parses every .ass file in the given directory and returns their [Script Info] properties and [V4+ Styles] entries as JSON. Use this to inspect files before deciding which DSL rules to send to POST /commands/modifySubtitleMetadata.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory containing .ass subtitle files to inspect. */
                        sourcePath: string;
                        /**
                         * @description Recursively search subdirectories for .ass files.
                         * @default false
                         */
                        isRecursive?: boolean;
                        /**
                         * @description Maximum recursion depth when --isRecursive is set (0 = default depth of 1).
                         * @default 0
                         */
                        recursiveDepth?: number;
                    };
                };
            };
            responses: {
                /** @description Script Info and style metadata for each .ass file found */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Metadata for each .ass file found */
                            subtitlesMetadata: {
                                /** @description Absolute path to the .ass file */
                                filePath: string;
                                /** @description Key-value properties from the [Script Info] section (e.g. PlayResX, PlayResY, YCbCr Matrix, ScriptType, LayoutResX, LayoutResY) */
                                scriptInfo: {
                                    [key: string]: string;
                                };
                                /** @description Style entries from [V4+ Styles], each as a map of ASS field name to value (e.g. Name, Alignment, MarginL, MarginR, MarginV, Fontsize). Events are excluded. */
                                styles: {
                                    [key: string]: string;
                                }[];
                            }[];
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/searchMusicBrainzReleases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search MusicBrainz for an album release
         * @description Returns MusicBrainz releases matching an album name. The builder uses this before a provider-specific match so the selected release UUID can constrain the matcher.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Title to search for */
                        searchTerm: string;
                    };
                };
            };
            responses: {
                /** @description MusicBrainz release search results */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description MusicBrainz release search results */
                            results: {
                                /** @description The release artist credit */
                                artistName: string;
                                /** @description The release country code */
                                country?: string;
                                /** @description The media formats on this release */
                                format?: string;
                                /** @description The release label */
                                label?: string;
                                /** @description MusicBrainz release UUID */
                                releaseId: string;
                                /** @description Album title */
                                releaseTitle: string;
                                /** @description Total track count */
                                trackCount: number;
                                /** @description Release year */
                                year?: string;
                            }[];
                            /** @description Error message if the search failed. When present, results is empty. */
                            error?: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/searchMal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search MyAnimeList for an anime title
         * @description Returns up to 10 anime matching the search term. Use this from the builder UI to populate the malId field.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Title to search for */
                        searchTerm: string;
                    };
                };
            };
            responses: {
                /** @description MAL search results */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description MAL search results */
                            results: {
                                /** @description Air date string from MAL */
                                airDate?: string;
                                /** @description Thumbnail URL */
                                imageUrl?: string;
                                /** @description MyAnimeList ID */
                                malId: number;
                                /** @description Media type (TV, Movie, OVA, etc.) */
                                mediaType?: string;
                                /** @description Anime title */
                                name: string;
                            }[];
                            /** @description Error message if the search failed (e.g. network/server error). When present, results is empty. */
                            error?: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/searchAnidb": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search AniDB for an anime title
         * @description Returns up to 50 anime matching the search term. Backed by the manami-project anime-offline-database (cached locally, refreshed weekly) — anidb.net itself sits behind Cloudflare and the HTTP API has no name-search endpoint.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Title to search for */
                        searchTerm: string;
                    };
                };
            };
            responses: {
                /** @description AniDB search results */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description AniDB search results (sourced from manami-project dataset) */
                            results: {
                                /** @description AniDB anime id */
                                aid: number;
                                /** @description Display title (English-preferred via manami synonyms heuristic, falling back to romaji title) */
                                name: string;
                                /** @description Romaji title — surfaced as a subtitle in the picker when the primary name is an English synonym */
                                nameJapanese?: string;
                                /** @description Format type: TV, MOVIE, OVA, ONA, SPECIAL, etc. */
                                type?: string;
                                /** @description Total episode count */
                                episodes?: number;
                                /** @description Release year (4-digit, sourced from manami's animeSeason.year) */
                                year?: string;
                            }[];
                            /** @description Error message if the search failed. When present, results is empty. */
                            error?: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/lookupAnidb": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reverse-lookup an AniDB anime by aid
         * @description Used by the builder when the user manually edits the AniDB ID — returns the display name resolved from the AniDB HTTP API.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description AniDB anime id (aid) */
                        anidbId: number;
                    };
                };
            };
            responses: {
                /** @description Series name (or null if not found) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Display name, or null if not found */
                            name: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/lookupAnidbTitles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * List an AniDB anime's candidate titles by aid
         * @description Used by the AniDB title-picker: returns every title AniDB carries for the anime (each with its language and type) so the user can pick one, then character-clean it. AniDB's synthetic (aXXXXX) reference form is filtered out.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description AniDB anime id (aid) */
                        anidbId: number;
                    };
                };
            };
            responses: {
                /** @description Candidate titles (empty on error) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Candidate titles for the anime (AniDB's synthetic (aXXXXX) reference form filtered out). */
                            titles: {
                                /** @description Language tag (e.g. en, x-jat, ja) */
                                lang: string;
                                /** @description AniDB title type (main, official, synonym, short) */
                                type: string;
                                /** @description The title text, verbatim from AniDB */
                                value: string;
                            }[];
                            /** @description Error message if the fetch failed; titles is empty when present. */
                            error: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/searchTvdb": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search TheTVDB for a series
         * @description Returns series matching the search term. Use this from the builder UI to populate the tvdbId field.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Title to search for */
                        searchTerm: string;
                    };
                };
            };
            responses: {
                /** @description TVDB search results */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description TVDB search results */
                            results: {
                                /** @description Series image URL */
                                imageUrl?: string;
                                /** @description Series name */
                                name: string;
                                /** @description Status (e.g. Continuing, Ended) */
                                status?: string;
                                /** @description TVDB ID */
                                tvdbId: number;
                                /** @description Year of first air */
                                year?: string;
                            }[];
                            /** @description Error message if the search failed (e.g. network/server error). When present, results is empty. */
                            error?: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/searchMovieDb": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search The Movie Database (TMDB) for a film
         * @description Returns up to 20 movies matching the search term. Optional `year` narrows results so the builder can resolve the right film when title is shared across eras (e.g. 'Soldier' 1998 vs 1982). Used by the builder to populate the movieDbId field for nameMovies and to confirm the canonical match for nameSpecialFeaturesDvdCompareTmdb. Requires TMDB_API_KEY in the environment.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Title to search for */
                        searchTerm: string;
                        /** @description Release year to narrow results (4-digit yyyy). Disambiguates same-titled films across eras. */
                        year?: string;
                    };
                };
            };
            responses: {
                /** @description TMDB search results */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description TMDB search results */
                            results: {
                                /** @description Poster image URL */
                                imageUrl?: string;
                                /** @description TMDB movie ID */
                                movieDbId: number;
                                /** @description Plot summary, when TMDB has one on file */
                                overview?: string;
                                /** @description Movie title */
                                title: string;
                                /** @description Release year (4-digit yyyy, or empty when TMDB has no release date) */
                                year: string;
                            }[];
                            /** @description Error message if the search failed (e.g. network/server error). When present, results is empty. */
                            error?: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/searchDvdCompare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search DVDCompare.net for a film
         * @description Returns film entries (DVD/Blu-ray/4K variants) matching the search term. Each result includes the variant so the builder UI can group by base title.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Title to search for */
                        searchTerm: string;
                    };
                };
            };
            responses: {
                /** @description DVDCompare search results */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description True when DVDCompare's search redirected straight to a film page instead of returning a list of candidates. When true the single entry in results was auto-selected — callers should skip the movie-picker step and prompt for a Release Hash directly. */
                            isDirectListing?: boolean;
                            /** @description DVDCompare search results */
                            results: {
                                /** @description Movie title without variant or year suffix */
                                baseTitle: string;
                                /** @description DVDCompare film ID */
                                id: number;
                                /**
                                 * @description Media format variant
                                 * @enum {string}
                                 */
                                variant: "DVD" | "Blu-ray" | "Blu-ray 4K";
                                /** @description Release year */
                                year: string;
                            }[];
                            /** @description Error message if the search failed (e.g. network/server error). When present, results is empty. */
                            error?: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/listDvdCompareReleases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * List release packages for a DVDCompare film
         * @description Scrapes the film page to enumerate the release packages (e.g., 'Blu-ray ALL America - Arrow Films - Limited Edition'). Each release has a hash that becomes the URL fragment.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description DVDCompare film ID */
                        dvdCompareId: number;
                    };
                };
            };
            responses: {
                /** @description Release packages for the film */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Diagnostic info for empty-result debugging */
                            debug?: {
                                /** @description Total <input type="checkbox"> elements on the fetched page (regardless of name attribute) */
                                checkboxCount: number;
                                /** @description Byte length of the response body */
                                htmlLength: number;
                                /** @description HTTP status of the page fetch */
                                httpStatus: number;
                                /** @description Text content of the <title> tag */
                                pageTitle: string;
                                /** @description Up to 800 chars of HTML around the release form (or the start of the page) */
                                snippet: string;
                                /** @description URL we fetched */
                                url: string;
                            };
                            /** @description Release packages available for the film */
                            releases: {
                                /** @description Release package URL hash (form checkbox name attribute) */
                                hash: string;
                                /** @description Release package description */
                                label: string;
                            }[];
                            /** @description Error message if the fetch failed (e.g. network/server error). When present, releases is empty. */
                            error?: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/lookupMal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reverse-lookup a MAL series by ID
         * @description Used by the builder when the user manually edits the MAL ID — returns the display name.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description MyAnimeList ID */
                        malId: number;
                    };
                };
            };
            responses: {
                /** @description Series name (or null if not found) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Display name, or null if not found */
                            name: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/lookupTvdb": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reverse-lookup a TVDB series by ID
         * @description Used by the builder when the user manually edits the TVDB ID — returns the series name.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description TVDB ID */
                        tvdbId: number;
                    };
                };
            };
            responses: {
                /** @description Series name (or null if not found) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Display name, or null if not found */
                            name: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/lookupMovieDb": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reverse-lookup a TMDB film by ID
         * @description Used by the builder when the user manually edits the TMDB ID — returns the formatted display name 'Title (Year)'.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description TMDB movie ID */
                        movieDbId: number;
                    };
                };
            };
            responses: {
                /** @description Movie display name (or null if not found) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Display name, or null if not found */
                            name: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/lookupDvdCompare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reverse-lookup a DVDCompare film by ID
         * @description Used by the builder when the user manually edits the DVDCompare film ID — returns the formatted display name (with variant + year).
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description DVDCompare film ID */
                        dvdCompareId: number;
                    };
                };
            };
            responses: {
                /** @description Film display name (or null if not found) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Display name, or null if not found */
                            name: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/lookupDvdCompareRelease": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reverse-lookup a DVDCompare release package by film ID + hash
         * @description Used by the builder when the user manually edits the release hash — returns the release package label.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description DVDCompare film ID */
                        dvdCompareId: number;
                        /** @description Release package hash */
                        hash: string;
                    };
                };
            };
            responses: {
                /** @description Release label (or null if not found) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Release label, or null if not found */
                            label: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/queries/listDirectoryEntries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * List entries in a directory (typeahead for path fields)
         * @description Returns the directory entries at `path`. If `path` is a file, lists its parent directory instead. Used by the builder UI to autocomplete path inputs as the user types.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Directory path to list. If the path is a file, the parent directory is listed instead. */
                        path: string;
                    };
                };
            };
            responses: {
                /** @description Directory entries (or an error message if the listing failed) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Entries in the directory */
                            entries: {
                                /** @description True if this entry is a directory */
                                isDirectory: boolean;
                                /** @description Basename of the entry (no path prefix) */
                                name: string;
                            }[];
                            /** @description OS-native path separator ('\\' on Windows, '/' on Linux/macOS). Use this when joining new path segments client-side. */
                            separator: string;
                            /** @description Error message if the listing failed (e.g. missing path, permission denied). When present, entries is empty. */
                            error?: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sequences/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Run a sequence of steps as a single umbrella job.
         * @description Run a list of commands in order under a single umbrella job. Used whenever you'd otherwise script multiple `POST /commands/<name>` calls in sequence — one job id, one SSE log stream, automatic teardown on first failure.
         *
         *     **Body shapes** (the route accepts either):
         *
         *     - `{ "yaml": "<yaml string>" }` — the same YAML the builder UI's *View YAML* modal shows. Parsed server-side.
         *     - `{ "paths": {...}, "steps": [...] }` — pre-parsed JSON in the same document shape (`ParsedSequenceBody`).
         *
         *     **Param value forms.** Inside any `steps[].params` value, three shapes are recognized:
         *
         *     1. **Literal** — string, number, boolean, array, object. Passed through unchanged.
         *     2. **`'@pathId'`** — string starting with `@`, names a key from the top-level `paths` map. Resolved to that path's `value` at runtime.
         *     3. **`{ linkedTo, output }`** — references a previous step's output. `output: 'folder'` (or omitted) resolves to that step's synthesized output folder; any other value names a runtime output the source command publishes via its `extractOutputs` projector (e.g. `computeDefaultSubtitleRules` → `'rules'`).
         *
         *     **Resolution rules.** A step can only reference steps earlier in the array. References to a missing path/step/output fail the umbrella job with a clear error in the SSE log stream. Empty arrays / nullish values pass through; commands that should be conditional implement an empty-input no-op themselves (no `if:` predicate exists in the YAML).
         *
         *     **Per-command param schemas.** The shape of `params` for a given command matches the request body of `POST /commands/<command>` once any `'@pathId'` / `{ linkedTo, output }` references are resolved. Look up the per-command endpoint to see the exact required/optional fields and their types.
         *
         *     The full reference, including a worked anime-subtitle pipeline example, lives in [README.md](README.md) under "Sequence Runner — multi-step pipelines as YAML".
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["YamlSequenceBody"] | components["schemas"]["ParsedSequenceBody"];
                };
            };
            responses: {
                /** @description Sequence job started. Subscribe to `/jobs/:id/logs` for the log stream. */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SequenceJobAccepted"];
                    };
                };
                /** @description Body did not match either accepted shape, or YAML failed to parse / validate. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Human-readable description of what went wrong. */
                            error: string;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sequences/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Validate a sequence document without running it.
         * @description Validate a sequence document **without running it** — no job is created and no files are touched. Use this to check a hand-written or generated sequence before `POST /sequences/run`.
         *
         *     Accepts the same two body shapes as `/sequences/run` (`{ "yaml": "<yaml string>" }` or a pre-parsed `ParsedSequenceBody`), but always responds `200` with `{ isValid, errors }` rather than `400` — a malformed document is a validation result, not a request error.
         *
         *     Two layers of checks run:
         *
         *     1. **Envelope** — YAML parses; unique step ids; no `linkedTo` between parallel-group siblings; every `command` is a known command; `@ref` format. (Same schema `/sequences/run` applies before starting a job.)
         *     2. **Per-step params** — each step's `params`, after resolving `@pathId` variables and `{ linkedTo, output: 'folder' }` references, is validated against that command's request schema (the same check the runner does per step at execution time). Named step-output links can't be resolved without running and are treated as satisfied once the target step exists.
         *
         *     Each entry in `errors` carries an optional `stepId` and `command` plus a human-readable `message`. `isValid` is `true` only when `errors` is empty.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            responses: {
                /** @description Validation result. `isValid` is true only when `errors` is empty. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SequenceValidationResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files/default-path": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Suggested starting path when the explorer opens with no input
         * @description The Builder's Browse triggers fall back to this when the field they're attached to is empty. Returns the OS user's home directory (`os.homedir()`) — a safe, always-existing root the user can navigate from. Could later be extended to remember the last-used path per session.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Suggested default starting path */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Absolute path the file-explorer should open at when the calling field is empty (currently the OS user's home directory). */
                            path: string;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files/list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List files in a directory with metadata
         * @description Used by the file-explorer modal in the Builder UI. Returns one entry per direct child of `path`, with isFile/isDirectory + size + mtime. Path must be absolute and traversal-free; this is a read-only operation, so it is NOT gated by ALLOWED_DELETE_ROOTS.
         */
        get: {
            parameters: {
                query: {
                    /** @description Absolute directory path to list. Must be absolute and traversal-free. */
                    path: string;
                    /** @description Pass '1' / 'true' to compute video runtime per file via mediainfo. Adds ~50-200ms per file (concurrent up to 8). Off by default. */
                    includeDuration?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Directory listing or error message */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Entries in the directory, sorted directories-first then alphabetically */
                            entries: {
                                /** @description Basename of the entry */
                                name: string;
                                /** @description True for regular files (not directories or symlinks) */
                                isFile: boolean;
                                /** @description True for directories */
                                isDirectory: boolean;
                                /** @description File size in bytes; 0 for directories */
                                size: number;
                                /** @description Last-modified ISO timestamp; null when the per-entry stat() failed */
                                mtime: string | null;
                                /** @description Video runtime as 'M:SS' / 'H:MM:SS' (DVDCompare format). null when not requested, not a video extension, or mediainfo failed. */
                                duration: string | null;
                            }[];
                            /** @description OS-native path separator */
                            separator: string;
                            /** @description Error message when the listing failed; null on success */
                            error: string | null;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files/delete-mode": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Report whether deletes go to the OS trash or are permanent
         * @description Called by the file-explorer modal so the confirm dialog can label its action accurately. The base mode is controlled by the DELETE_MODE env var (default 'trash'). When `path` is supplied AND the path lives on a Windows network drive, the response downgrades to 'permanent' since the OS Recycle Bin can't service network shares — the UI surfaces this via the badge so the user isn't surprised when 'trash' silently became permanent.
         */
        get: {
            parameters: {
                query?: {
                    /** @description Optional folder path. When supplied, the response reflects the EFFECTIVE mode for that path — e.g. 'trash' downgrades to 'permanent' on Windows network drives where the Recycle Bin can't service the file. Without a path, the response carries the global DELETE_MODE setting. */
                    path?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Active delete mode for the queried path (or the global setting when no path supplied) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /**
                             * @description 'trash' = files go to the OS Recycle Bin (default). 'permanent' = files are unlinked outright. Controlled via the DELETE_MODE env var; downgraded automatically for Windows network drives.
                             * @enum {string}
                             */
                            mode: "trash" | "permanent";
                            /** @description Explains why mode is 'permanent' when the global setting is 'trash' — typically network-drive detection. Null when mode matches the global setting. */
                            reason: string | null;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files/audio-codec": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Report the audio codec/format of a file's first audio track
         * @description Used by the file-explorer modal's <video> sub-modal to decide whether to point at /files/stream (browser can decode) or /transcode/audio (browser can't decode the source audio — DTS, TrueHD, AC-3 outside Edge, etc.). Returns the raw mediainfo `Format` value of the first audio track; the caller maps that to a MediaSource.isTypeSupported() probe and picks the URL. Validates path via `validateReadablePath` (absolute, no traversal). Returns audioFormat=null on no-audio-track or mediainfo failure rather than 5xx-ing.
         */
        get: {
            parameters: {
                query: {
                    /** @description Absolute path to a media file. Must be absolute and traversal-free. */
                    path: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description First audio track's raw mediainfo Format, or null when unavailable */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Raw mediainfo `Format` value of the first audio track (e.g. 'AC-3', 'DTS', 'AAC', 'MLP FBA', 'E-AC-3', 'Opus'). null when the file has no audio track or mediainfo failed. */
                            audioFormat: string | null;
                            /** @description Error message when validation or mediainfo failed; null on success. */
                            error: string | null;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files/open-external": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Hand a file off to the OS shell to open in the default app
         * @description Used by the file-explorer modal as a fallback when a video's codecs (DTS / TrueHD / HEVC without hardware decode) can't be decoded in-browser. Calls the platform's shell-open mechanism: `cmd /C start` on Windows, `open` on macOS, `xdg-open` on Linux. The launcher process is detached + unref'd so the API request returns immediately.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Absolute path to hand off to the OS shell. The default application for the file's extension opens it (VLC for .mkv, Preview for .pdf, etc.). */
                        path: string;
                    };
                };
            };
            responses: {
                /** @description Launcher spawned (or validation/spawn error) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description True when the launcher process spawned. The launcher is detached/unref'd so this only reports the spawn — actual app launch may still fail asynchronously. */
                            isOk: boolean;
                            /** @description Error message when validation or spawn failed; null on success */
                            error: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete one or more files
         * @description Bulk delete used by the file-explorer modal. Each path is validated against ALLOWED_DELETE_ROOTS independently; a failure on one path does NOT abort the batch — the response carries per-path success/failure. Strategy (Recycle Bin vs permanent) is set globally via DELETE_MODE and reported through GET /files/delete-mode.
         */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Absolute paths to delete. Each is independently validated for absolute-path / no-traversal safety. */
                        paths: string[];
                    };
                };
            };
            responses: {
                /** @description Per-path delete results */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Per-path outcome — partial successes are surfaced rather than rolled back */
                            results: {
                                /** @description The path the API attempted to delete */
                                path: string;
                                /** @description True when the delete succeeded */
                                isOk: boolean;
                                /**
                                 * @description Strategy actually used for this path — may be 'permanent' even when the global setting is 'trash' (network-drive paths)
                                 * @enum {string}
                                 */
                                mode: "trash" | "permanent";
                                /** @description Error message on failure; null on success */
                                error: string | null;
                            }[];
                        };
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files/rename": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rename a single file in place
         * @description Used by the nameSpecialFeaturesDvdCompareTmdb result card so the user can fix unrenamed entries one row at a time. Both `oldPath` and `newPath` are validated for absolute / no-traversal safety. The underlying helper aborts when `newPath` already exists, so the API can't silently overwrite an existing file.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @description Absolute path to the file currently on disk. */
                        oldPath: string;
                        /** @description Absolute destination path the file should be renamed to. Must already not exist on disk — the underlying helper aborts to avoid silent overwrites. */
                        newPath: string;
                    };
                };
            };
            responses: {
                /** @description Rename outcome — `isOk: true` plus the validated new path on success, `isOk: false` plus a message on failure. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description True when the rename completed successfully. */
                            isOk: boolean;
                            /** @description The validated/normalized new absolute path on success; null on failure. */
                            newPath: string | null;
                            /** @description Error message on failure (path validation, target-already-exists, missing source, etc.); null on success. */
                            error: string | null;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/server-id/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Stream the server's per-process boot id (SSE)
         * @description Emits a single { bootId } event on connect, then keepalives. The bootId is regenerated on every server restart, so clients can compare the first id they see against the id received after an auto-reconnect — a mismatch means the server restarted and the page should reload.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Server-Sent Events stream emitting one { bootId } event on connect. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/event-stream": string;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/system/threads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Thread concurrency limits
         * @description Returns the resolved thread-concurrency configuration. The UI calls this to pre-fill the threadCount variable default and display the system ceiling in the Edit Variables modal.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Thread limits JSON. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description Resolved MAX_THREADS — the hard ceiling on concurrent task slots across all jobs. Defaults to os.availableParallelism() when MAX_THREADS is unset or zero. */
                            maxThreads: number;
                            /** @description Resolved DEFAULT_THREAD_COUNT — the per-job thread claim applied when a sequence has no threadCount variable. Defaults to 2. Clamped to maxThreads. Set DEFAULT_THREAD_COUNT=0 to use maxThreads as the default instead. */
                            defaultThreadCount: number;
                            /** @description os.availableParallelism() — informational; the parallelism the OS reports as available to this process (honors cgroup/CPU-affinity limits), which maxThreads defaults to when MAX_THREADS is unset. */
                            totalCpus: number;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List saved sequence templates
         * @description Returns the per-user library of saved sequence templates. Each entry includes only metadata; fetch the full body (including YAML) via GET /api/templates/:id.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of saved templates. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            templates: {
                                id: string;
                                name: string;
                                description?: string;
                                updatedAt: string;
                            }[];
                        };
                    };
                };
            };
        };
        put?: never;
        /**
         * Save a new sequence template
         * @description Server assigns the id (kebab-case of name with a -2/-3/... collision suffix). YAML is validated for structural shape before persistence; semantic command-name validation happens on the web side at apply time.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        name: string;
                        description?: string;
                        yaml: string;
                    };
                };
            };
            responses: {
                /** @description Created template, with server-assigned id. */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: string;
                            name: string;
                            description?: string;
                            updatedAt: string;
                            yaml: string;
                            createdAt: string;
                        };
                    };
                };
                /** @description Invalid YAML body. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            error: string;
                            details?: string;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/templates/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Fetch a single saved template by id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Full template body. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: string;
                            name: string;
                            description?: string;
                            updatedAt: string;
                            yaml: string;
                            createdAt: string;
                        };
                    };
                };
                /** @description No template with that id. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            error: string;
                            details?: string;
                        };
                    };
                };
            };
        };
        /**
         * Update a saved template
         * @description Bumps updatedAt; createdAt + id are preserved. YAML body is required and re-validated.
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        name?: string;
                        description?: string;
                        yaml: string;
                    };
                };
            };
            responses: {
                /** @description Updated template. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: string;
                            name: string;
                            description?: string;
                            updatedAt: string;
                            yaml: string;
                            createdAt: string;
                        };
                    };
                };
                /** @description Invalid YAML body. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            error: string;
                            details?: string;
                        };
                    };
                };
                /** @description No template with that id. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            error: string;
                            details?: string;
                        };
                    };
                };
            };
        };
        post?: never;
        /** Delete a saved template */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Deleted. */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description No template with that id. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            error: string;
                            details?: string;
                        };
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/version": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Build identity (git sha, build time, package + node version)
         * @description Returns the build identity stamped into `public/api/version.json` by `scripts/build-version.cjs`. Mirrors Mux Magic's existing `/server-id/stream` precedent — boot identity has its sibling here in build identity. Falls back to `{ gitSha: "dev" }` when the prebuild hook didn't run, so dev environments still answer.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Build identity JSON. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            gitSha: string;
                            gitShaShort: string;
                            buildTime: string | null;
                            packageVersion: string | null;
                            nodeVersion: string;
                            /** @description True when running inside a container. Detection order: (1) IS_CONTAINERIZED env var set to the literal string "true" (stamped by the Dockerfile at build time); (2) /proc/1/cgroup substring match for "docker", "containerd", or "kubepods" (catches Linux containers built from other base images). Returns false on Windows/macOS hosts and bare-metal Linux where neither signal is present. */
                            isContainerized: boolean;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/errors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List persisted job error records, newest first */
        get: {
            parameters: {
                query?: {
                    jobId?: string;
                    state?: "pending" | "delivered" | "exhausted";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description List of persisted job errors */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            errorName?: string;
                            fileId?: string;
                            id: string;
                            jobId: string;
                            /** @enum {string} */
                            level: "error";
                            msg: string;
                            occurredAt: string;
                            spanId?: string;
                            stack?: string;
                            stepIndex?: number;
                            traceId?: string;
                            webhookDelivery: {
                                attempts: number;
                                lastAttemptAt?: string;
                                lastError?: string;
                                /** @enum {string} */
                                state: "pending" | "delivered" | "exhausted";
                            };
                        }[];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/errors/:id": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a single persisted job error record */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Error record ID */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Error record */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            errorName?: string;
                            fileId?: string;
                            id: string;
                            jobId: string;
                            /** @enum {string} */
                            level: "error";
                            msg: string;
                            occurredAt: string;
                            spanId?: string;
                            stack?: string;
                            stepIndex?: number;
                            traceId?: string;
                            webhookDelivery: {
                                attempts: number;
                                lastAttemptAt?: string;
                                lastError?: string;
                                /** @enum {string} */
                                state: "pending" | "delivered" | "exhausted";
                            };
                        };
                    };
                };
                /** @description Error record not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            error: string;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Dismiss / delete a persisted error record */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Error record ID */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Record deleted */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Error record not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            error: string;
                        };
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/errors/:id/redeliver": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Manually re-queue an exhausted (or any) error for webhook delivery
         * @description Resets attempts to 0 and flips state back to pending, then enqueues an immediate delivery attempt. Idempotent against already-delivered records: they will simply be re-attempted as pending.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description Error record ID */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Record flipped back to pending */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            errorName?: string;
                            fileId?: string;
                            id: string;
                            jobId: string;
                            /** @enum {string} */
                            level: "error";
                            msg: string;
                            occurredAt: string;
                            spanId?: string;
                            stack?: string;
                            stepIndex?: number;
                            traceId?: string;
                            webhookDelivery: {
                                attempts: number;
                                lastAttemptAt?: string;
                                lastError?: string;
                                /** @enum {string} */
                                state: "pending" | "delivered" | "exhausted";
                            };
                        };
                    };
                };
                /** @description Error record not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            error: string;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        JobNotFound: {
            /**
             * @description Job not found error
             * @enum {string}
             */
            error: "Job not found";
        };
        /**
         * @example {
         *       "jobId": "9d2f8c3e-4a1b-4c2d-9e7f-8a3b2c1d5e7f",
         *       "logsUrl": "/jobs/9d2f8c3e-4a1b-4c2d-9e7f-8a3b2c1d5e7f/logs"
         *     }
         */
        SequenceJobAccepted: {
            /** @description Umbrella job id. Subscribe to `GET /jobs/<jobId>/logs` (SSE) for the unified log stream of every step, or poll `GET /jobs/<jobId>` for status. */
            jobId: string;
            /** @description Convenience URL for the SSE log stream — same as `/jobs/<jobId>/logs`. */
            logsUrl: string;
        };
        /**
         * @description YAML-string sequence body. The yaml field carries the raw text the builder UI's `View YAML` modal shows.
         * @example {
         *       "yaml": "paths:\n  workDir:\n    label: Work Directory\n    value: 'D:\\Anime\\Show\\__work'\nsteps:\n  - id: filterLangs\n    command: keepLanguages\n    params:\n      sourcePath: '@workDir'\n      audioLanguages: [jpn]\n      subtitlesLanguages: [eng]\n  - id: copyBack\n    command: copyFiles\n    params:\n      sourcePath:\n        linkedTo: filterLangs\n        output: folder\n      destinationPath: '@workDir'"
         *     }
         */
        YamlSequenceBody: {
            /** @description YAML source. The server parses with js-yaml and validates against the same schema as the parsed-JSON body — see the `ParsedSequenceBody` schema for the document shape. Parse failures and shape-mismatch validation errors return 400 with a descriptive message. */
            yaml: string;
        };
        /**
         * @description Pre-parsed sequence body. Use this shape if you have the sequence as JSON; otherwise post a YAML string under `yaml` (the server parses with js-yaml and validates against this same schema).
         * @example {
         *       "paths": {
         *         "workDir": {
         *           "label": "Work Directory",
         *           "value": "D:\\Anime\\Show\\__work"
         *         },
         *         "parentDir": {
         *           "label": "Parent Series Folder",
         *           "value": "D:\\Anime\\Show"
         *         }
         *       },
         *       "steps": [
         *         {
         *           "id": "filterLangs",
         *           "command": "keepLanguages",
         *           "params": {
         *             "sourcePath": "@workDir",
         *             "audioLanguages": [
         *               "jpn"
         *             ],
         *             "subtitlesLanguages": [
         *               "eng"
         *             ]
         *           }
         *         },
         *         {
         *           "id": "copyBack",
         *           "command": "copyFiles",
         *           "params": {
         *             "sourcePath": {
         *               "linkedTo": "filterLangs",
         *               "output": "folder"
         *             },
         *             "destinationPath": "@workDir"
         *           }
         *         },
         *         {
         *           "id": "computeRules",
         *           "command": "computeDefaultSubtitleRules",
         *           "params": {
         *             "sourcePath": "@workDir"
         *           }
         *         },
         *         {
         *           "id": "applyRules",
         *           "command": "modifySubtitleMetadata",
         *           "params": {
         *             "sourcePath": "@workDir",
         *             "rules": {
         *               "linkedTo": "computeRules",
         *               "output": "rules"
         *             }
         *           }
         *         }
         *       ]
         *     }
         */
        ParsedSequenceBody: {
            /** @description Top-level path-variable map keyed by path id. Each entry is referenced from step params via `'@<pathId>'`. Superseded by the `variables` block — both are accepted for backward compatibility. */
            paths?: {
                [key: string]: components["schemas"]["SequencePath"];
            };
            /** @description Typed variable map (introduced by the Variables system). Entries with `type: 'path'` are resolved the same as legacy `paths` entries; entries with `type: 'threadCount'` set the per-job thread cap. */
            variables?: {
                [key: string]: components["schemas"]["SequenceVariable"];
            };
            /** @description Sequence of items to run in order. Each item is either a single step (the existing flat form) or a `kind: "group"` container (new). Stops on the first failure; remaining items don't run. */
            steps: (components["schemas"]["SequenceStep"] | components["schemas"]["SequenceGroup"])[];
        };
        /**
         * @description A path-variable definition. Path variables are referenced from step params via the `'@pathId'` string form.
         * @example {
         *       "label": "Work Directory",
         *       "value": "D:\\Anime\\Show\\__work"
         *     }
         */
        SequencePath: {
            /** @description Display label for the path variable (used by the builder UI; ignored at runtime). */
            label?: string;
            /** @description The actual path string this variable resolves to. */
            value: string;
        };
        /**
         * @description A typed variable definition. Path variables (type='path') are referenced from step params via `'@<id>'`. Other types (e.g. 'threadCount') carry runtime configuration consumed by the server.
         * @example {
         *       "label": "Max threads",
         *       "value": "4",
         *       "type": "threadCount"
         *     }
         */
        SequenceVariable: {
            /** @description Display label (used by the builder UI; ignored at runtime). */
            label?: string;
            /** @description The variable's current value as a string. */
            value: string;
            /** @description Variable type discriminator (e.g. `'path'`, `'threadCount'`). The server uses this to apply type-specific semantics at runtime. */
            type: string;
        };
        /**
         * @description A single step inside a sequence.
         * @example {
         *       "id": "filterLangs",
         *       "command": "keepLanguages",
         *       "params": {
         *         "sourcePath": "@workDir",
         *         "audioLanguages": [
         *           "jpn"
         *         ],
         *         "subtitlesLanguages": [
         *           "eng"
         *         ]
         *       }
         *     }
         */
        SequenceStep: {
            /**
             * @description Discriminator marking this entry as a single step. May be omitted on input — the server treats a missing `kind` as `"step"` for backward compatibility with the original flat-step YAML form. The other allowed value is `"group"` (see `SequenceGroup`). (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            kind: "step";
            /** @description Stable identifier for this step. Optional on input — auto-assigned (`step1`, `step2`, ...) when omitted. Used as the target of `{ linkedTo, output }` references from later steps. */
            id?: string;
            /** @description Optional human-readable alias. Surfaced by the builder UI's step header; ignored at runtime. */
            alias?: string;
            /** @description Name of the registered command to run. Must be one of the names listed at `GET /commands` (or surfaced individually as `POST /commands/<name>` endpoints). Empty string `''` marks a placeholder/blank step from the Builder UI — the runner skips it as a no-op so YAML round-trips don't lose the slot. */
            command: "" | ("analyseDiscBackup" | "makeDirectory" | "matchMusicRelease" | "matchMusicBrainzRelease" | "matchDiscogsRelease" | "matchFreedbRelease" | "matchVgmdbRelease" | "changeTrackLanguages" | "convertLosslessToFlac" | "convertContainerAudioToFlac" | "convertSrtToAss" | "findContainerAudioFiles" | "copyFiles" | "flattenOutput" | "copyOutSubtitles" | "extractDiscTitles" | "extractSubtitles" | "fixIncorrectDefaultTracks" | "getAudioOffsets" | "hasBetterAudio" | "hasBetterVersion" | "hasDuplicateMusicFiles" | "hasImaxEnhancedAudio" | "hasManyAudioTracks" | "hasSurroundSound" | "hasWrongDefaultTrack" | "isMissingSubtitles" | "deleteCopiedOriginals" | "deleteFilesByExtension" | "deleteFolder" | "exitIfEmpty" | "modifySubtitleMetadata" | "keepLanguages" | "addSubtitles" | "mergeTracks" | "moveFiles" | "moveFilesIntoNamedFolders" | "distributeFolderToSiblings" | "flattenChildFolders" | "renameFiles" | "renameFilesAndFolders" | "nameAnimeEpisodes" | "nameAnimeEpisodesAniDB" | "fetchThemeMusic" | "nameMovieCutsDvdCompareTmdb" | "nameSpecialFeaturesDvdCompareTmdb" | "onlyNameSpecialFeaturesDvdCompare" | "nameTvShowEpisodes" | "remuxToMkv" | "fingerprintAudioFiles" | "findDuplicateAudioFiles" | "compareMusicAssistantLibrary" | "scanAudioFiles" | "renumberChapters" | "renameAndMoveAudioFiles" | "renameDemos" | "renameMovieClipDownloads" | "reorderTracks" | "replaceAttachments" | "replaceFlacWithPcmAudio" | "replaceTracks" | "setDisplayWidth" | "splitChapters" | "splitCueSheet" | "storeAspectRatioData" | "trimFileTail" | "writeAudioTags");
            /** @description Command params. Each value can be a literal (string / number / boolean / array / object), a `'@pathId'` path-variable reference, or a `{ linkedTo, output }` step-output reference. Per-command param shapes are documented under `POST /commands/<command>` — the same schema each command exposes for direct invocation also applies here once references are resolved. */
            params?: {
                [key: string]: unknown;
            };
            /** @description Builder-UI accordion state. When `true`, the card renders with its body hidden. Pure view state; ignored at runtime. */
            isCollapsed?: boolean;
        };
        /**
         * @description A container for a set of steps. Marked `isParallel: true` to run concurrently; otherwise the inner steps run sequentially. Groups are flat — they can contain steps but not other groups.
         * @example {
         *       "kind": "group",
         *       "id": "extractParallel",
         *       "label": "Extract subs + media info",
         *       "isParallel": true,
         *       "steps": [
         *         {
         *           "id": "subs",
         *           "command": "copyOutSubtitles",
         *           "params": {
         *             "sourcePath": "@workDir"
         *           }
         *         },
         *         {
         *           "id": "info",
         *           "command": "getSubtitleMetadata",
         *           "params": {
         *             "sourcePath": "@workDir"
         *           }
         *         }
         *       ]
         *     }
         */
        SequenceGroup: {
            /**
             * @description Discriminator marking this entry as a group of steps rather than a single step. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            kind: "group";
            /** @description Optional stable identifier for the group. Currently used only by the builder UI; not referenceable from `linkedTo` (`linkedTo` always targets steps, not groups). */
            id?: string;
            /** @description Optional human-readable label rendered in the group's header by the builder UI. Ignored at runtime. */
            label?: string;
            /** @description When `true`, the group's inner steps run concurrently (Promise.all). When omitted or `false`, they run sequentially in array order. The builder UI also lays parallel groups out side-by-side on wide viewports. */
            isParallel?: boolean;
            /** @description Builder-UI accordion state for the group as a whole. When `true`, the group's inner step cards are hidden. Pure view state; ignored at runtime. */
            isCollapsed?: boolean;
            /** @description Inner steps. Groups don't nest — each entry must be a step, not another group. */
            steps: components["schemas"]["SequenceStep"][];
        };
        /**
         * @example {
         *       "errors": [
         *         {
         *           "command": "keepLanguages",
         *           "message": "sourcePath: Required",
         *           "stepId": "trimFeature"
         *         }
         *       ],
         *       "isValid": false
         *     }
         */
        SequenceValidationResult: {
            errors: {
                /** @description The step's command name, when the error is attributable to a specific step. */
                command?: string;
                /** @description Human-readable description of the problem. */
                message: string;
                /** @description The offending step's id, when the error is attributable to a specific step. */
                stepId?: string;
            }[];
            isValid: boolean;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
