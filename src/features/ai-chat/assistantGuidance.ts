/** Suggested local questions. The local assistant reads only an aggregate on-device snapshot. */
export const assistantGuidance = [
  { title: 'Understand spending', question: 'Show my monthly income, expenses and spending categories', answer: 'Insights summarizes recorded income and expenses. Transfers and opening balances are not spending; missing entries can change the picture.' },
  { title: 'Plan a budget', question: 'How can I start a budget?', answer: 'Review recorded income and essential expenses first. Choose a realistic limit and review it regularly. This is general education; ExTrack has not calculated a personal budget or an amount remaining for you.' },
  { title: 'Build savings', question: 'What does my savings activity mean?', answer: 'A surplus means recorded income exceeds recorded expenses. It is not verified bank savings. A Savings category records categorized expenses; it does not establish a savings rate or account balance.' },
  { title: 'Understand loan payments', question: 'How do loan payments affect cash flow?', answer: 'Confirmed payments are recorded as expenses. A scheduled obligation is not another expense until confirmed; counting both would double-count it. Review on-screen due dates and confirm only payments you actually made. ExTrack does not transfer money.' },
] as const;
