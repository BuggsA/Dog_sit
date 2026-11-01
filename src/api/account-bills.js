// GET /api/account/bills → the client's bills (newest unpaid first)
import { json } from "../util.js";
import { billsFor } from "../bills.js";

export const onRequestGet = async ({ env, email }) => json({ bills: await billsFor(env, email) });
