import { approveFinancialAid } from "./lib/financialAid.mjs";

// Browser (admin clicks "Approve")
//   -> this function (holds SYNC_API_TOKEN / MAIL_API_TOKEN, never shipped to the client)
//       -> POST {DISCOUNT_API_URL}/api/discount-codes   -> { code }
//       -> POST {MAIL_API_URL}/api/send-financial-aid-email  (uses that code)
//   -> browser gets back { success, code }
//
// Reached at /api/approve-financial-aid via the redirect in netlify.toml.

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, message: "Invalid JSON body" }, 400);
  }

  try {
    const { code } = await approveFinancialAid(body as never, process.env);
    return json({ success: true, code });
  } catch (error) {
    console.error("approve-financial-aid failed:", error);
    return json({ success: false, message: (error as Error).message }, 502);
  }
};
