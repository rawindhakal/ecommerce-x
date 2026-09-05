export function formatNpr(amount: number | string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
