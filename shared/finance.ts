export type FinanceCalculation = {
  income: number;
  capital: number;
  expense: number;
  net: number;
  status: "untung" | "rugi";
};

export function calculateFinance(income: number, capital: number, expense: number): FinanceCalculation {
  const net = income - capital - expense;
  return { income, capital, expense, net, status: net >= 0 ? "untung" : "rugi" };
}
