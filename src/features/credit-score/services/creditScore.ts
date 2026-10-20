import {
fetchCreditScoreMetricsFromFirestore,
getCurrentUser,
saveCreditScoreToFirestore,
} from "../../../database";

export interface ComputedCreditData {
  score: number;
  tier: "Excellent" | "Good" | "Fair" | "Poor";
  paymentHistoryCount: number;
  activeLoansCount: number;
  creditUtilizationPct: number; // Represents Expense-to-Income Percentage
}

const getScoreTier = (score: number): ComputedCreditData["tier"] => {
  if (score >= 800) return "Excellent";
  if (score >= 700) return "Good";
  if (score >= 550) return "Fair";
  return "Poor";
};

export const calculateCreditScoreFromDB = async (): Promise<ComputedCreditData> => {
  try {
    const capturedUser = await getCurrentUser();
    if (!capturedUser) throw new Error("Sign in first.");
    // 1. Fetch aggregated stats directly from database asynchronously
    const metrics = await fetchCreditScoreMetricsFromFirestore();

    const activeLoansCount = Number(metrics?.activeLoansCount) || 0;
    const completedLoansCount = Number(metrics?.completedLoansCount) || 0;
    const paymentHistoryCount = Number(metrics?.paymentHistoryCount) || 0;

    // Metrics mapped to expenses and income
    const totalCurrentBalances = Number(metrics?.totalCurrentBalances) || 0; // Total Expenses
    const totalCreditLimits = Number(metrics?.totalCreditLimits) || 0;     // Total Income

    // 2. Compute Expense Ratio as a Percentage (Total Expenses / Total Income)
    let creditUtilizationPct = 0;
    if (totalCreditLimits > 0) {
      creditUtilizationPct = Math.round((totalCurrentBalances / totalCreditLimits) * 100);
    }

    // 3. Score Calculation (300 to 850 Scale)
    let calculatedScore = 300; // Baseline floor score

    // Payment History Bonus (+15/payment, Max +250)
    const paymentHistoryBonus = Math.min(paymentHistoryCount * 15, 250);
    calculatedScore += paymentHistoryBonus;

    // Completed Loans Bonus (+30/loan, Max +180)
    const completedLoansBonus = Math.min(completedLoansCount * 30, 180);
    calculatedScore += completedLoansBonus;

    // Active Loans Penalty (-20 for each active loan over 2)
    if (activeLoansCount > 2) {
      calculatedScore -= (activeLoansCount - 2) * 20;
    }

    // Expense Ratio Penalty (> 50% expense ratio instead of revolving credit penalty)
    if (creditUtilizationPct > 50) {
      calculatedScore -= 40;
    }

    // 4. Clamp score strictly within 300 to 850 bounds
    const finalScore = Math.max(300, Math.min(850, Math.round(calculatedScore)));
    const tier = getScoreTier(finalScore);

    // Persist only to the originally captured account; database access rechecks it.
    void saveCreditScoreToFirestore(capturedUser.uid, finalScore, tier, paymentHistoryBonus, creditUtilizationPct).catch(() => {});

    return {
      score: finalScore,
      tier,
      paymentHistoryCount,
      activeLoansCount,
      creditUtilizationPct,
    };
  } catch {
    throw new Error("Financial wellness estimate is unavailable until data sync succeeds.");
  }
};
