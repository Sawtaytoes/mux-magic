import { useAtomValue } from "jotai";
import { JobCard } from "../components/JobCard";
import { StatusBar } from "../components/StatusBar";
import { useSseStream } from "../hooks/useSseStream";
import { jobsAtom } from "../state/jobsAtom";

const JobsList = () => {
  const jobs = useAtomValue(jobsAtom);
  // Top-level jobs have no parentJobId; prepend newest (Map preserves insertion order).
  const topLevel = [...jobs.values()]
    .filter((job) => !job.parentJobId)
    .reverse();

  if (topLevel.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-12">
        No jobs yet. Run a command in the{" "}
        <a href="/builder" className="text-blue-400 hover:text-blue-300">
          Sequence Builder
        </a>{" "}
        to get started.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {topLevel.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
};

export const JobsPage = () => {
  useSseStream();

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Jobs{" "}
          <a
            href="/builder"
            className="text-sm font-normal text-blue-400 hover:text-blue-300 ml-3"
          >
            Sequence Builder ↗
          </a>
        </h1>
        <StatusBar />
      </div>
      <JobsList />
    </main>
  );
};
