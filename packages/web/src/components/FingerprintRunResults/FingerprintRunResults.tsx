import { Button } from "@charcuterie/ui"
import { useState } from "react"

import { apiBase } from "../../apiBase"
import {
  buildAcoustIdSubmissionPlans,
  type FingerprintMatchedRecord,
} from "./fingerprintResultTypes"

// Post-run report for a `fingerprintAudioFiles` job, and the only door
// to the AcoustID submission.
//
// ⚠️ Submitting is an explicit click, never part of the run. These are
// public database entries made under the owner's account: a wrong one is
// visible to everybody and has to be undone by hand. So the run
// identifies, the panel reports, and a separate press submits.
//
// This is also the most VALUABLE write the app makes. It improves the
// database the tagger reads from, and every correctly matched file is a
// free contribution — Picard does the same thing by default.

type SubmitState = {
  error: string | null
  isSubmitted: boolean
  submittedCount: number
}

const INITIAL_SUBMIT_STATE: SubmitState = {
  error: null,
  isSubmitted: false,
  submittedCount: 0,
}

type SubmitResponseBody = {
  error?: string | null
  isOk?: boolean
  submissions?: { submissionId: number }[]
}

type Props = {
  matches: FingerprintMatchedRecord[]
}

export const FingerprintRunResults = ({
  matches,
}: Props) => {
  const [submitState, setSubmitState] = useState(
    INITIAL_SUBMIT_STATE,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (matches.length === 0) {
    return null
  }

  const plans = buildAcoustIdSubmissionPlans(matches)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    const outcome = await fetch(
      `${apiBase}/music/acoustid/submit`,
      {
        body: JSON.stringify({ submissions: plans }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    )
      .then((response) =>
        response
          .json()
          .catch(() => ({}))
          .then((rawBody) => rawBody as SubmitResponseBody)
          .then(
            (body): SubmitState => ({
              error:
                body.isOk === false
                  ? (body.error ?? "Submission failed")
                  : null,
              isSubmitted: body.isOk !== false,
              submittedCount: body.submissions?.length ?? 0,
            }),
          ),
      )
      .catch(
        (error: unknown): SubmitState => ({
          error:
            error instanceof Error
              ? error.message
              : String(error),
          isSubmitted: false,
          submittedCount: 0,
        }),
      )

    setSubmitState(outcome)
    setIsSubmitting(false)
  }

  return (
    <div
      id="fingerprint-run-results"
      className="flex flex-col gap-2"
    >
      <div
        data-fingerprint-counts
        className="flex flex-wrap items-center gap-2 text-xs text-content-secondary"
      >
        <span>
          {matches.length} file
          {matches.length === 1 ? "" : "s"} identified by
          fingerprint. {plans.length} carr
          {plans.length === 1 ? "ies" : "y"} a MusicBrainz
          recording and can be contributed back.
        </span>
        {plans.length > 0 && !submitState.isSubmitted && (
          <Button
            id="acoustid-submit-trigger"
            intent="accent"
            appearance="solid"
            size="sm"
            isDisabled={isSubmitting}
            onClick={handleSubmit}
            title="Send these fingerprints to AcoustID under your account. This is a public database write."
          >
            {isSubmitting
              ? "Submitting…"
              : "↑ Contribute to AcoustID"}
          </Button>
        )}
      </div>

      {submitState.isSubmitted && (
        <p
          data-acoustid-submitted
          className="bg-intent-success-surface border border-intent-success-border text-intent-success-content rounded px-2 py-1 text-xs"
        >
          Sent {submitState.submittedCount} fingerprint
          {submitState.submittedCount === 1 ? "" : "s"} to
          AcoustID. It queues submissions rather than
          applying them at once, so they show as pending.
        </p>
      )}

      {submitState.error !== null && (
        <p
          data-acoustid-submit-error
          className="bg-intent-danger-surface border border-intent-danger-border text-intent-danger-content rounded px-2 py-1 text-xs"
        >
          {submitState.error}
        </p>
      )}
    </div>
  )
}
