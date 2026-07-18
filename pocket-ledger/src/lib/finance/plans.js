/* Payment-plan math (batch 7). Milestones are kept date-sorted by the
   schema normalizer, so the first unpaid one is always the next due. */
export function planStats(plan) {
  let paidSum = 0;
  let totalSum = 0;
  let paidCount = 0;
  let next = null;
  for (const m of plan.milestones) {
    totalSum += m.amount;
    if (m.paid) {
      paidSum += m.amount;
      paidCount++;
    } else if (!next) {
      next = m;
    }
  }
  return {
    paidSum,
    totalSum,
    paidCount,
    count: plan.milestones.length,
    next,
    endDue: plan.milestones[plan.milestones.length - 1].due,
    done: next === null,
  };
}
