import type { ApiError, CompleteResponse, InitResponse, SubmissionInput } from "@/lib/submission";

export type UploadStage = "starting" | "uploading" | "finishing";

/** An error the user can fix (bad field) vs. one worth retrying (network, 5xx). */
export class SubmitError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly field?: ApiError["field"],
  ) {
    super(message);
  }
}

/**
 * init → PUT photo straight to Supabase Storage → complete. Every step is
 * idempotent on input.id, so a failed attempt can simply be run again.
 * Resolves only once the server has confirmed the submission.
 */
export async function uploadSubmission(
  input: SubmissionInput,
  photo: Blob,
  thumb: Blob | null = null,
  onStage: (stage: UploadStage) => void = () => {},
): Promise<{ code: string }> {
  onStage("starting");
  const init = await postJson<InitResponse>("/api/submissions/init", input);

  if (init.upload) {
    onStage("uploading");
    let res: Response;
    try {
      res = await putJpeg(init.upload.signedUrl, photo);
    } catch {
      throw new SubmitError("Lost signal while uploading the photo.", true);
    }
    if (!res.ok)
      throw new SubmitError(
        `Photo upload failed (${res.status}).`,
        res.status >= 500 || res.status === 408 || res.status === 429,
      );

    // Best effort: judges fall back to the full photo if the thumbnail is missing.
    if (thumb && init.upload.thumbSignedUrl) {
      await putJpeg(init.upload.thumbSignedUrl, thumb).catch(() => {});
    }

    onStage("finishing");
  }

  const done = await postJson<CompleteResponse>("/api/submissions/complete", {
    id: input.id,
    deviceId: input.deviceId,
  });
  return { code: done.code };
}

function putJpeg(signedUrl: string, body: Blob): Promise<Response> {
  return fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=3600" },
    body,
  });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SubmitError("No signal right now.", true);
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiError>) | null;
  if (!res.ok || !data) {
    const retryable = res.status >= 500 || res.status === 409 || res.status === 429 || !data;
    throw new SubmitError(data?.error ?? `Request failed (${res.status}).`, retryable, data?.field);
  }
  return data;
}
