import { ContactSubmissionRequest } from '@sugarsocietysc/shared';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3001';

async function parseJson(response: Response) {
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = typeof body?.error === 'string'
      ? body.error
      : body?.error
        ? 'Please review the form fields and try again.'
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}

export async function submitContact(input: ContactSubmissionRequest): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  await parseJson(response);
}
