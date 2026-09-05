import {
  fetchCreditScoreMetricsFromFirestore,
  saveCreditScoreToFirestore,
  getCurrentUser,
} from "../database";

export interface ComputedCreditData {
  score: number;
  tier: "Excellent" | "Good" | "Fair" | "Poor";
  paymentHistoryCount: number;
  activeLoansCount: number;
  creditUtilizationPct: number;
}

const getScoreTier = (score: number): ComputedCreditData["tier"] => {
  if (score >= 800) return "Excellent";
  if (score >= 700) return "Good";
  if (score >= 550) return "Fair";
  return "Poor";
};

export const calculateCreditScoreFromDB = async (): Promise<ComputedCreditData> => {
  try {
    // 1. Fetch aggregated stats directly from database asynchronously
    const metrics = await fetchCreditScoreMetricsFromFirestore();

    const activeLoansCount = Number(metrics?.activeLoansCount) || 0;
    const completedLoansCount = Number(metrics?.completedLoansCount) || 0;
    const paymentHistoryCount = Number(metrics?.paymentHistoryCount) || 0;
    const totalLoanAmount = Number(metrics?.totalLoanAmount) || 0;
    const totalMonthlyPayments = Number(metrics?.totalMonthlyPayments) || 0;

    // 2. Compute Credit Utilization
    let creditUtilizationPct = 0;
    if (totalLoanAmount > 0) {
      creditUtilizationPct = Math.min(
        Math.round((totalMonthlyPayments / totalLoanAmount) * 100),
        100
      );
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

    // Utilization Penalty
    if (creditUtilizationPct > 30) {
      calculatedScore -= 40;
    }

    // 4. Clamp score strictly within 300 to 850 bounds
    const finalScore = Math.max(300, Math.min(850, Math.round(calculatedScore)));
    const tier = getScoreTier(finalScore);

    // 5. Persist snapshot asynchronously (non-blocking)
    getCurrentUser()
      .then((user) => {
        if (user?.uid) {
          return saveCreditScoreToFirestore(    
            user.uid,
            finalScore,
            tier,
            paymentHistoryBonus,
            creditUtilizationPct
          );
        }
      })
      .catch((err) => console.warn("Failed to persist credit score log:", err));

    return {
      score: finalScore,
      tier,
      paymentHistoryCount,
      activeLoansCount,
      creditUtilizationPct,
    };
  } catch (error) {
    console.error("Error calculating credit score:", error);

    return {
      score: 300,
      tier: "Poor",
      paymentHistoryCount: 0,
      activeLoansCount: 0,
      creditUtilizationPct: 0,
    };
  }
};