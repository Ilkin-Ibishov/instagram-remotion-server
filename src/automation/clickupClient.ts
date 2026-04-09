/*
 * Minimal ClickUp client helpers for auditing and updating tasks.
 * Usage: provide `CLICKUP_TOKEN` in environment before running scripts that use this client.
 */

const API_BASE = process.env.CLICKUP_API_BASE || 'https://api.clickup.com/api/v2';

function getAuthHeaders() {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) {
    throw new Error('CLICKUP_TOKEN environment variable is required to call ClickUp API');
  }
  return {
    Authorization: token,
    'Content-Type': 'application/json',
  };
}

export type ClickUpTask = {
  id: string;
  name?: string;
  status?: { status?: string };
  description?: string | null;
  tags?: Array<{ name?: string }> | string[];
};

async function fetchJson(url: string, opts: any = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
  if (!res.ok) {
    const err = new Error(`ClickUp API error ${res.status}: ${res.statusText}`);
    // @ts-ignore
    err.status = res.status;
    // @ts-ignore
    err.body = body;
    throw err;
  }
  return body;
}

export async function fetchTasksInList(listId: string) {
  const url = `${API_BASE}/list/${listId}/task?include_closed=true&subtasks=true`;
  return await fetchJson(url, { headers: getAuthHeaders() });
}

export async function fetchTaskById(taskId: string) {
  const url = `${API_BASE}/task/${taskId}`;
  return await fetchJson(url, { headers: getAuthHeaders() });
}

export async function addComment(taskId: string, comment: string) {
  const url = `${API_BASE}/task/${taskId}/comment`;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchJson(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ comment_text: comment }),
      });
    } catch (err: any) {
      const status = err && err.status ? err.status : null;
      if (status && status >= 500 && attempt < maxAttempts) {
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
}

export async function setTaskStatus(taskId: string, status: string) {
  const url = `${API_BASE}/task/${taskId}`;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchJson(url, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
    } catch (err: any) {
      const statusCode = err && err.status ? err.status : null;
      if (statusCode && statusCode >= 500 && attempt < maxAttempts) {
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
}

export async function addCommentAndMaybeClose(taskId: string, comment: string, complete: boolean = false) {
  await addComment(taskId, comment);
  if (complete) {
    try {
      await setTaskStatus(taskId, 'complete');
    } catch (err) {
      // best-effort: if 'complete' status doesn't exist, don't fail the whole operation
      // client code can inspect the error if needed
      console.warn('Could not set status to complete for task', taskId, err);
    }
  }
}

export default {
  fetchTasksInList,
  fetchTaskById,
  addComment,
  setTaskStatus,
  addCommentAndMaybeClose,
};
