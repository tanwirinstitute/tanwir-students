// Server-side financial-aid approval relay.
//
// Shared by:
//   - netlify/functions/approve-financial-aid.mts  (production)
//   - vite.config.js dev middleware                (local `npm run dev`)
//
// It creates a real discount code via the discount API, then hands that code to
// the emailer. All four env vars below are secrets / internal origins and must
// NEVER be given a VITE_ prefix — that would bundle them into the browser build.

// Free-text course string (as it arrives in a scholarship application's `course`
// field) -> program code expected by POST /api/discount-codes. Matched on a
// lowercase substring so minor wording differences still resolve.
const PROGRAM_CODE_RULES = [
  { keyword: 'associate', code: 'AP' }, // Associates Program
  { keyword: 'prophetic', code: 'PG' }, // Prophetic Guidance
  { keyword: 'taqwa', code: 'TT' }, //     Taqwa for Teens
  { keyword: 'teen', code: 'TT' }, //      Taqwa for Teens (alt wording)
  { keyword: 'advanced', code: 'AS' }, //  Advanced Studies
];

export function programCodeForCourse(course) {
  const haystack = String(course || '').toLowerCase();
  for (const { keyword, code } of PROGRAM_CODE_RULES) {
    if (haystack.includes(keyword)) return code;
  }
  return null;
}

const VALID_DISCOUNTS = [25, 50, 75, 100];

// Accepts a number, "75", or "75%". Returns one of 25/50/75/100, else null.
export function normalizeDiscountPercentage(value) {
  const n = typeof value === 'string' ? parseInt(value.replace('%', ''), 10) : value;
  return VALID_DISCOUNTS.includes(n) ? n : null;
}

/**
 * @param {{ course: string, discountPercentage: number|string, recipientEmail: string, studentName: string, comments?: string }} params
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<{ code: string }>}
 */
export async function approveFinancialAid(params, env) {
  const { DISCOUNT_API_URL, SYNC_API_TOKEN, MAIL_API_URL, MAIL_API_TOKEN } = env;

  if (!DISCOUNT_API_URL || !SYNC_API_TOKEN || !MAIL_API_URL || !MAIL_API_TOKEN) {
    throw new Error(
      'Financial aid relay is not configured (need DISCOUNT_API_URL, SYNC_API_TOKEN, MAIL_API_URL, MAIL_API_TOKEN).',
    );
  }

  const { course, discountPercentage, recipientEmail, studentName, comments } = params || {};

  if (!recipientEmail || !studentName) {
    throw new Error('recipientEmail and studentName are required.');
  }

  const programCode = programCodeForCourse(course);
  if (!programCode) {
    throw new Error(
      `No program code mapping for course "${course ?? ''}". Add it to netlify/functions/lib/financialAid.mjs before approving.`,
    );
  }

  const discountPct = normalizeDiscountPercentage(discountPercentage);
  if (!discountPct) {
    throw new Error(
      `discountPercentage must resolve to one of ${VALID_DISCOUNTS.join(', ')} (got ${discountPercentage}).`,
    );
  }

  // 1. Create the discount code (the API generates the code itself).
  const codeRes = await fetch(`${DISCOUNT_API_URL}/api/discount-codes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SYNC_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ programCode, discountPercentage: discountPct }),
  });
  if (!codeRes.ok) {
    throw new Error(`discount-codes failed (${codeRes.status}): ${await codeRes.text()}`);
  }
  const { code } = await codeRes.json();
  if (!code) {
    throw new Error('discount-codes returned no code.');
  }

  // 2. Send the approval email carrying that code.
  const emailRes = await fetch(`${MAIL_API_URL}/api/send-financial-aid-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MAIL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipientEmail,
      studentName,
      discountPercentage: discountPct,
      discountCode: code,
      programName: course,
      additionalDetails: comments || `This scholarship is for the ${course} course.`,
    }),
  });
  if (!emailRes.ok) {
    throw new Error(`send-financial-aid-email failed (${emailRes.status}): ${await emailRes.text()}`);
  }

  return { code };
}
