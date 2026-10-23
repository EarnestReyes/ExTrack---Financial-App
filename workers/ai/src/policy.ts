import { supportMessages } from '../../../functions/src/utils/validation';
import { ApiError } from './types';

export const MODEL = 'gemini-3.8-flash';
export type Operation = 'supportChat' | 'explainInsights';
export interface ProviderInput { instruction: string; contents: { role: string; parts: { text: string }[] }[] }
const SUPPORT = 'You are friendly ExTrack app support. Explain only the selected app topic. ' +
  'Home, Activity, Add, Insights and Profile are the main sections. Transaction entry uses title, amount, category and Income/Expense. ' +
  'Tap a transaction to edit/delete. Confirmed loan payments cannot be edited. Loan payment confirmation records an expense only after paying; it never transfers money. ' +
  'Statement imports are preview-only; saving is disabled pending verification. Charts and summaries are computed by trusted local code. ' +
  'You have no financial records, balances, tools or accounts. Never invent figures/features, give personal financial advice, request private data, or claim to perform actions.';
const EXPLANATION = 'Explain these qualitative labels from ExTrack local deterministic summaries briefly. ' +
  'Do not calculate or invent numbers, infer identities, give personal advice, or claim bank verification. ' +
  'Surplus means recorded income exceeds expenses, not verified savings. Savings activity means categorized expenses, not bank savings. ' +
  'Loan attention means due/overdue unconfirmed installments. Refer to verified on-screen figures and manual confirmation; never imply a payment occurred.';

/** Reuse conversation validation but never forward arbitrary text/history to Gemini. */
export function providerInput(operation: Operation, raw: unknown): ProviderInput {
  const fail = () => { throw new ApiError(400, 'invalid-argument', 'Confirm sharing and send only the supported request fields, without private information.'); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail();
  const data = raw as Record<string, unknown>;
  const keys = operation === 'supportChat' ? ['consent', 'policyVersion', 'messages'] : ['consent', 'policyVersion', 'summary'];
  if (data.consent !== true || data.policyVersion !== 'free-tier-v1' || Object.keys(data).some(key => !keys.includes(key))) return fail();
  if (operation === 'supportChat') {
    let messages;
    try { messages = supportMessages({ messages: data.messages }); } catch { return fail(); }
    if (messages.some(message => /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\d[ -]?){10,}|(?:password|api[_ -]?key|my name is)\s*[:=]/i.test(message.text))) return fail();
    const question = messages[messages.length - 1].text;
    const topics: [RegExp, string][] = [[/loan|installment|payment/i, 'loans and manual payment confirmation'], [/statement|document|import|csv|pdf/i, 'statement preview'], [/analytic|insight|balance|saving|spend/i, 'local analytics and recorded summaries'], [/profile|password|photo|biometric|theme|setting/i, 'profile and settings'], [/transaction|income|expense|categor|delete|edit|add/i, 'transaction entry and management']];
    const topic = topics.find(([pattern]) => pattern.test(question))?.[1] ?? 'app navigation and general help';
    return { instruction: SUPPORT, contents: [{ role: 'user', parts: [{ text: 'Explain ExTrack topic: ' + topic }] }] };
  }
  const choices: Record<string, string[]> = { cashFlow: ['surplus', 'deficit', 'balanced'], spendingPattern: ['concentrated', 'spread', 'none'], savingsActivity: ['recorded', 'none'], loanAttention: ['needed', 'none'] };
  if (!data.summary || typeof data.summary !== 'object' || Array.isArray(data.summary)) return fail();
  const summary = data.summary as Record<string, unknown>;
  if (Object.keys(summary).length !== 4 || Object.entries(choices).some(([key, values]) => typeof summary[key] !== 'string' || !values.includes(summary[key] as string))) return fail();
  const minimal = Object.fromEntries(Object.keys(choices).map(key => [key, summary[key]]));
  return { instruction: EXPLANATION, contents: [{ role: 'user', parts: [{ text: JSON.stringify(minimal) }] }] };
}
