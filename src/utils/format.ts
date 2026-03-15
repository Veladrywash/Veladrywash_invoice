export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
}

export function formatDateTime(dateIso: string) {
  const d = new Date(dateIso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateOrderId(existingCount = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const seq = String(existingCount + 1).padStart(3, "0");
  return `VDW-${year}-${seq}`;
}
