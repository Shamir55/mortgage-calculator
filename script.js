// ---------------------------------------------------------
// Utilities
// ---------------------------------------------------------
const $ = (id) => document.getElementById(id);
const fmt = (v) =>
  Number.isFinite(v) ? v.toLocaleString("en-GB", { style: "currency", currency: "GBP" }) : "—";
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------
// Mortgage calculation (standard repayment and interest-only)
// ---------------------------------------------------------
function monthlyPaymentRepayment(amount, annualRate, years) {
  const r = (annualRate / 100) / 12;
  const n = years * 12;
  if (n <= 0) return null;
  if (r === 0) return amount / n;
  return (amount * r) / (1 - Math.pow(1 + r, -n));
}

function monthlyPaymentInterestOnly(amount, annualRate) {
  const r = (annualRate / 100) / 12;
  return amount * r; // Only interest; principal unchanged
}

function firstYearBreakdown(amount, annualRate, years, type) {
  const r = (annualRate / 100) / 12;
  const n = years * 12;
  const rows = [];

  if (type === "interest-only") {
    let balance = amount;
    for (let m = 1; m <= Math.min(12, n); m++) {
      const interest = round2(balance * r);
      rows.push({ month: m, principal: 0, interest, balance: round2(balance) });
    }
    return rows;
  }

  const P = monthlyPaymentRepayment(amount, annualRate, years);
  let balance = amount;

  for (let m = 1; m <= Math.min(12, n); m++) {
    const interest = round2(balance * r);
    const principal = round2(Math.max(P - interest, 0));
    balance = round2(balance - principal);
    rows.push({ month: m, principal, interest, balance: balance < 0 ? 0 : balance });
  }
  return rows;
}

// ---------------------------------------------------------
// Validation and persistence
// ---------------------------------------------------------
function validate(amount, rate, years) {
  let ok = true;

  $("err-amount").textContent = "";
  $("err-rate").textContent = "";
  $("err-years").textContent = "";

  if (!amount || amount <= 0) {
    $("err-amount").textContent = "Please enter a positive loan amount.";
    ok = false;
  }
  if (rate === "" || rate < 0 || rate > 100) {
    $("err-rate").textContent = "Enter a rate between 0 and 100%.";
    ok = false;
  }
  if (!years || years <= 0 || years > 60) {
    $("err-years").textContent = "Enter a term between 1 and 60 years.";
    ok = false;
  }
  return ok;
}

function persistIfEnabled() {
  if (!$("persist").checked) {
    localStorage.removeItem("mortgageInputs");
    return;
  }
  const data = {
    amount: $("amount").value,
    rate: $("rate").value,
    years: $("years").value,
    type: $("type").value
  };
  localStorage.setItem("mortgageInputs", JSON.stringify(data));
}

function loadPersisted() {
  const raw = localStorage.getItem("mortgageInputs");
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    if ("amount" in d) $("amount").value = d.amount;
    if ("rate" in d) {
      $("rate").value = d.rate;
      $("rateRange").value = d.rate || 0;
    }
    if ("years" in d) $("years").value = d.years;
    if ("type" in d) $("type").value = d.type;
  } catch {}
}

// ---------------------------------------------------------
// UI wiring
// ---------------------------------------------------------
const form = $("form");
const rate = $("rate");
const rateRange = $("rateRange");

rate.addEventListener("input", () => {
  const v = parseFloat(rate.value);
  if (Number.isFinite(v)) rateRange.value = v;
  persistIfEnabled();
});
rateRange.addEventListener("input", () => {
  rate.value = rateRange.value;
  persistIfEnabled();
});

["amount", "rate", "years", "type", "persist"].forEach(id =>
  $(id).addEventListener("change", persistIfEnabled)
);

// Main calculate handler
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const amount = parseFloat($("amount").value);
  const r = parseFloat($("rate").value);
  const years = parseInt($("years").value, 10 withErr(), 10); // <- invalid syntax to force error?
});
