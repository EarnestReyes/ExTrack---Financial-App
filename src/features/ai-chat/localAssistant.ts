import { validateFinancialContext, type FinancialContext } from './financialContext';

export interface LocalAssistantReply { source: 'local'; facts: string[]; guidance: string; limitation: string; suggestions?: string[] }
/** Pure, bounded local interface. No prompts, history or context leave the device. */
export function answerLocalQuestion(question: string, context: FinancialContext | null): LocalAssistantReply {
  if (!question.trim() || question.length > 2000) throw new Error('Use a question of 1 to 2,000 characters.');
  if (context) validateFinancialContext(context);
  const money = (n: number | null) => n === null ? 'unavailable' : 'PHP ' + (n / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const facts: string[] = [];
  let guidance: string;
  if (/loan|installment|obligation|payment/i.test(question)) {
    facts.push(context ? `Unpaid installments due as of ${context.period.end}: ${money(context.dueUnpaidLoanCents)}.` : 'Loan totals are unavailable.');
    guidance = 'Review due dates and confirm only payments actually made. Due obligations are shown separately, not deducted from cash flow again. ExTrack does not transfer money.';
  } else if (/budget|afford|remaining/i.test(question)) {
    facts.push('No verified budget limit or budget-remaining calculation is available.');
    guidance = 'Start with recorded income and essential expenses, choose a realistic spending limit, and review it regularly. A recorded surplus is not permission to spend or a guarantee of affordability.';
  } else if (/saving/i.test(question)) {
    facts.push('Savings rate and bank savings are not verified.');
    guidance = 'A surplus is recorded income less expenses. Savings-category expenses do not establish actual savings. Consider setting aside an affordable amount after reviewing essentials and due obligations.';
  } else if (/categor|spend|spent|expense|income|cash.?flow|net|month|summary/i.test(question)) {
    if (context) {
      facts.push(`Period: ${context.period.start} to ${context.period.end}.`, `Recorded income: ${money(context.recordedIncomeCents)}.`, `Recorded expenses: ${money(context.recordedExpenseCents)}.`, `Income less expenses: ${money(context.cashFlow.currentNetCents)}.`);
      if (/categor|spend|spent/i.test(question)) {
        facts.push(...context.categories.map(c => `${c.code}: ${money(c.cents)}.`));
        if (!context.categories.length) facts.push('No allowlisted spending categories are available.');
        if (context.quality.categoriesOmitted) facts.push('Some categories are omitted; this list is not total spending.');
      }
      if (/compar|last month|prior|change/i.test(question)) facts.push(`Equal-day current net: ${money(context.cashFlow.comparableCurrentNetCents)}; prior net: ${money(context.cashFlow.priorNetCents)}.`);
    } else facts.push('Local financial totals are unavailable; no amounts were guessed.');
    guidance = 'Review Insights and your recorded entries before making decisions. Transfers and opening balances are excluded from income and expenses.';
  } else {
    facts.push('This assistant supports local monthly totals, spending categories, budgeting basics, savings education and due loan obligations.');
    guidance = 'Try “Summarize this month” or “Show my spending categories”. For a follow-up, name the topic again; this local assistant does not infer conversational context.';
  }
  return { source: 'local', facts, guidance, limitation: 'Calculated from a fresh local snapshot when available, not Gemini. Records may be incomplete or unsynced; refund treatment is unverified.' + (context?.quality.reviewRequired ? ' Some records require review and were excluded.' : '') };
}

export function formatLocalReply(reply: LocalAssistantReply) {
  return 'ON-DEVICE FACTS\n' + reply.facts.join('\n') + '\n\nGENERAL EDUCATION\n' + reply.guidance + '\n\nLIMITATIONS\n' + reply.limitation;
}

type Topic = 'income' | 'expenses' | 'categories' | 'cashflow' | 'budget' | 'savings' | 'loans' | 'summary';
export interface ConversationState {
  topic?: Topic; category?: string; period: 'current' | 'prior'; asOf?: string; updatedAt: number;
  recent: { question: string; topic?: Topic; period: 'current' | 'prior'; kind: 'fact' | 'hypothetical' | 'clarification' }[];
}
export const newConversation = (): ConversationState => ({ period: 'current', updatedAt: 0, recent: [] });

/** Deterministic session references only; no inference beyond supported intents. */
export function converseLocal(question: string, snapshots: { current: FinancialContext | null; prior: FinancialContext | null }, previous = newConversation(), now = Date.now()): { reply: LocalAssistantReply; state: ConversationState } {
  if (!question.trim() || question.length > 2000) throw new Error('Use a question of 1 to 2,000 characters.');
  if (snapshots.current) validateFinancialContext(snapshots.current);
  if (snapshots.prior) validateFinancialContext(snapshots.prior);
  const fresh = now - previous.updatedAt < 15 * 60000 && previous.asOf === snapshots.current?.period.end;
  const state: ConversationState = fresh ? { ...previous, recent: [...previous.recent] } : newConversation();
  const q = question.toLowerCase();
  const categoryNames = ['Food', 'Transportation', 'Bills', 'Shopping', 'Entertainment'];
  const mentioned = categoryNames.filter(name => new RegExp('\\b' + name.toLowerCase() + '\\b').test(q));
  const explicitTopic: Topic | undefined = /loan|installment|obligation|payment/.test(q) ? 'loans' : /budget|afford/.test(q) ? 'budget' : /saving/.test(q) ? 'savings' : /categor|which one|highest|biggest/.test(q) || mentioned.length ? 'categories' : /cash.?flow|\bnet\b/.test(q) ? 'cashflow' : /summary|income.*expense|expense.*income/.test(q) ? 'summary' : /income/.test(q) ? 'income' : /expense|spend|spent/.test(q) ? 'expenses' : /compar|change/.test(q) ? 'cashflow' : undefined;
  const reference = /\b(that|it|those|one)\b|what about|how about|last month|this month|reduce|cut/.test(q);
  const topic = explicitTopic ?? (reference ? state.topic : undefined);
  const period = /last month|previous month/.test(q) ? 'prior' : /this month|current month/.test(q) ? 'current' : state.period;
  const context = snapshots[period];
  const money = (n: number) => 'PHP ' + (n / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const facts: string[] = [];
  let guidance = '', kind: 'fact' | 'hypothetical' | 'clarification' = 'fact';
  const clarified = (): boolean => kind === 'clarification';
  let category = mentioned[0] ?? (reference ? state.category : undefined);
  const clarify = (text: string) => { facts.push(text); kind = 'clarification'; };
  if (mentioned.length > 1) clarify('Which category should we discuss first? Please name one.');
  else if (/which one/.test(q) && !state.topic) clarify('Which topic or category list do you mean?');
  else if (/^(that|it|those|tell me about that)[?.!\s]*$/.test(q) && (topic === 'summary' || topic === 'categories' && !category || /compar|change/i.test(state.recent[state.recent.length - 1]?.question ?? ''))) clarify('Which figure or spending category do you mean?');
  else if (/what about|how about/.test(q) && !explicitTopic && !/last month|this month|previous month|current month|\bthat\b|\bit\b/.test(q)) clarify('Please name an available category, income, expenses or cash flow.');
  else if (!topic) clarify('Do you mean income, expenses, a spending category, cash flow, budgeting or loans? Please name the topic again.');
  else if (/next month|last year|yesterday|last week|\b20\d{2}\b/.test(q)) clarify('I can discuss this month or last month. Which period do you mean?');
  else if (!context || context.quality.ledgerUnavailable) facts.push('Local financial totals are unavailable; no amounts were guessed. Try again after reviewing your records.');
  else if (/reduce|cut|less by/.test(q)) {
    const numbers = [...q.matchAll(/(?:php\s*|₱\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)/g)];
    const raw = numbers[0]?.[1]?.replace(/,/g, '');
    const cents = raw && /^\d+(?:\.\d{1,2})?$/.test(raw) ? Math.round(Number(raw) * 100) : NaN;
    const recorded = context.categories.find(item => item.code === category);
    if (!category || !recorded) clarify('Which recorded category would you reduce? I need an available category and a PHP amount.');
    else if (numbers.length !== 1 || /%|percent|-\s*\d/.test(q) || !Number.isSafeInteger(cents) || cents <= 0 || cents > recorded.cents) clarify('Specify one positive PHP reduction, with at most two decimals, no greater than the recorded category expense.');
    else {
      kind = 'hypothetical';
      facts.push(`Hypothetical ${category} reduction: ${money(cents)}.`, `Scenario category expense: ${money(recorded.cents - cents)}.`);
      if (context.recordedExpenseCents !== null) facts.push(`Scenario total expenses: ${money(context.recordedExpenseCents - cents)}.`);
      if (context.cashFlow.currentNetCents !== null && Number.isSafeInteger(context.cashFlow.currentNetCents + cents)) facts.push(`Scenario net cash flow: ${money(context.cashFlow.currentNetCents + cents)}.`);
      facts.push('This is a what-if scenario, not actual savings or a change to your records.');
    }
  } else if (/which one|highest|biggest/.test(q)) {
    const largest = Math.max(...context.categories.map(item => item.cents));
    const leaders = context.categories.filter(item => item.cents === largest);
    if (leaders.length !== 1) clarify(leaders.length ? 'Several available categories are tied. Which category do you mean?' : 'No available category totals can answer that question.');
    else { category = leaders[0].code; facts.push(`Highest available category, ${category}: ${money(leaders[0].cents)}.`); }
  } else if (category && topic === 'categories') {
    const item = context.categories.find(item => item.code === category);
    facts.push(item ? `${category} recorded spending: ${money(item.cents)}.` : `${category} has no available category total; I will not assume zero.`);
  } else if (topic === 'income' || topic === 'expenses') {
    const value = topic === 'income' ? context.recordedIncomeCents : context.recordedExpenseCents;
    facts.push(`Recorded ${topic}: ${value === null ? 'unavailable' : money(value)}.`);
    if (/compar|change/.test(q)) {
      const other = snapshots[period === 'current' ? 'prior' : 'current'];
      const otherValue = topic === 'income' ? other?.recordedIncomeCents : other?.recordedExpenseCents;
      facts.push(other ? `Other period ${other.period.start} to ${other.period.end}: ${otherValue === null || otherValue === undefined ? 'unavailable' : money(otherValue)}.` : 'Other period totals are unavailable.');
      facts.push('These periods may have different coverage; no like-for-like spending change is inferred.');
    }
    guidance = topic === 'expenses' ? 'Would you like the spending categories?' : 'Would you like to compare income and expenses?';
  } else if (topic === 'cashflow') {
    if (/compar|change|last month/.test(q) && snapshots.current) {
      const c = snapshots.current;
      facts.push(`Equal-day current net: ${c.cashFlow.comparableCurrentNetCents === null ? 'unavailable' : money(c.cashFlow.comparableCurrentNetCents)}.`, `Equal-day prior net: ${c.cashFlow.priorNetCents === null ? 'unavailable' : money(c.cashFlow.priorNetCents)}.`, `Comparison: ${c.period.start} to ${c.period.comparisonCurrentEnd}, versus ${c.period.priorStart} to ${c.period.priorEnd}.`);
    } else facts.push(`Recorded net cash flow: ${context.cashFlow.currentNetCents === null ? 'unavailable' : money(context.cashFlow.currentNetCents)}.`);
  } else if (topic === 'categories') {
    facts.push(...context.categories.map(item => `${item.code}: ${money(item.cents)}.`));
    if (!facts.length) facts.push('No available category totals.');
    guidance = 'Would you like to look at the highest available category?';
  } else {
    const base = answerLocalQuestion(topic === 'summary' ? 'monthly summary' : topic, context);
    facts.push(...base.facts); guidance = base.guidance;
  }
  if (context && !clarified()) {
    facts.push(`Period: ${context.period.start} to ${context.period.end}${context.period.partial ? ' (month in progress)' : ''}.`);
    if (topic === 'categories' && context.quality.categoriesOmitted) facts.push('Only allowlisted categories are shown; others are omitted.');
  }
  if (!clarified() && topic) { state.topic = kind === 'hypothetical' ? 'categories' : topic; state.category = topic === 'categories' || kind === 'hypothetical' ? category : undefined; state.period = period; }
  state.updatedAt = now; state.asOf = snapshots.current?.period.end;
  state.recent = [...state.recent.slice(-5), { question: question.slice(0, 200), topic, period, kind }];
  return { state, reply: { source: 'local', facts, guidance, suggestions: clarified() ? ['Show my expenses', 'Show spending categories'] : topic === 'categories' ? ['Which one?', 'What about food?', 'How about last month?'] : ['Show spending categories', 'Show my cash flow'], limitation: 'Deterministic on-device guidance, not Gemini. Records may be incomplete or unsynced; refund treatment is unverified. Each reply uses a fresh snapshot.' + (context?.quality.reviewRequired ? ' Some records require review and were excluded.' : '') } };
}
