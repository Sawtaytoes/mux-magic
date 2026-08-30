# Web interface

The web interface provides job status, live logs, command forms, and reusable sequences. It uses the same server and port as the REST API.

## Jobs

The Jobs view shows running and completed work. Open a job to inspect its progress, output, or error.

![Jobs overview showing running, completed, and failed jobs](images/jobs-overview.png)

## Sequence Builder

The Sequence Builder combines commands into one repeatable workflow.

![Sequence Builder with a multi-step pipeline](images/sequence-builder-overview.png)

Long sequences can collapse their steps to make the workflow easier to scan.

![Sequence Builder with steps collapsed](images/sequence-builder-collapsed.png)

The builder can export a sequence as YAML. Its URL also contains the current template, so a copied URL can open the same sequence on another Mux Magic server.

See the [REST API and sequence runner guide](api.md) for the sequence format and job lifecycle.
