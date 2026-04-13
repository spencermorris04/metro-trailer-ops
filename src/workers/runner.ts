import { claimOutboxJobs, markOutboxJobFailed, markOutboxJobSucceeded } from "@/lib/server/outbox";
import { createId } from "@/lib/server/production-utils";
import { processOutboxJob } from "@/workers/handlers";

type RunOutboxWorkerOptions = {
  workerId?: string;
  limit?: number;
  jobTypes?: string[];
};

export async function runOutboxWorkerCycle(options: RunOutboxWorkerOptions = {}) {
  const workerId = options.workerId ?? createId("worker");
  const jobs = await claimOutboxJobs({
    workerId,
    limit: options.limit ?? 10,
    jobTypes: options.jobTypes,
  });

  const results: Array<{
    jobId: string;
    status: "succeeded" | "failed";
    error?: string;
  }> = [];

  for (const job of jobs) {
    try {
      const result = await processOutboxJob(job);
      await markOutboxJobSucceeded(job.id, {
        workerId,
        result,
      });
      results.push({
        jobId: job.id,
        status: "succeeded",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markOutboxJobFailed(job.id, message);
      results.push({
        jobId: job.id,
        status: "failed",
        error: message,
      });
    }
  }

  return {
    workerId,
    claimed: jobs.length,
    results,
  };
}
