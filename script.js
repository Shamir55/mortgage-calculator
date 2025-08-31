// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const money = (v) => v.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------- Calculations ----------
function monthlyPaymentRepayment(amount, annualRate, years) {
  const r = (annualRate / 100) / 12;
  const n = years * 12;
  if (n <= 0) return null;
  if (r === 0) return amount / n;
  return (amount * r) / (1 - Math.pow(1 + r, -n));
}

function monthlyPaymentInterestOnly(amount, annualRate) {
  const r = (annualRate / 100) / 12;
  return amount * r; // principal unchanged
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
    rows.push({ month: m, principal, interest, balance: Math.max(balance, 0) });
  }
  return rows;
}

// ---------- Validation & persistence ----------
function validate(amount, rate, years) {
  let ok = true;
  $("err-amount").textContent = "";
  $("err-rate").textContent = "";
  $("err-years").textContent = "";

  if (!Number.isFinite(amount) || amount <= 0) {
    $("err-amount").textContent = "Enter a positive loan amount.";
    ok = false;
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    $("err-rate").textContent = "Enter a rate between 0 and 100%.";
    ok = false;
  }
  if (!Number.isFinite(years) || years <= 0 || years > 60) {
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
    if (d.amount) $("amount").value = d.amount;
    if (d.rate) { $("rate").value = d.rate; $("rateRange").value = d.rate; }
    if (d.years) $("years").value = d.years;
    if (d.type) $("type").value = d.type;
  } catch {}
}

// ---------- UI wiring ----------
document.addEventListener("DOMContentLoaded", () => {
  loadPersisted();

  const form = $("form");
  const rate = $("rate");
  const rateRange = $("rateRange");

  // slider ↔ input sync
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

  // Calculate
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const amount = parseFloat($("amount").value);
    const r = parseFloat($("rate").value);
    const years = parseInt($("years").value, 10);
    const type = $("type").value;

    if (!validate(amount, r, years)) {
      $("results").hidden = true;
      $("resultDefault").style.display = "grid";
      return;
    }

    let monthly = 0;
    if (type === "interest-only") monthly = monthlyPaymentInterestOnly(amount, r);
    else monthly = monthlyPaymentRepayment(amount, r, years);

    const totalRepayments = type === "interest-only"
      ? monthly * years * 12 // interest only (principal excluded)
      : monthly * years * 12;

    // In repayment, total interest = total repay - principal.
    // In interest-only (illustrative), interest across full term = monthly * months.
    const totalInterest = type === "interest-only"
      ? totalRepayments
      : totalRepayments - amount;

    $("monthly").textContent = money(round2(monthly));
    $("interest").textContent = money(round2(totalInterest));
    $("total").textContent = type === "interest-only"
      ? money(round2(totalRepayments + amount)) // principal would still be due at end
      : money(round2(totalRepayments));

    // Fill breakdown
    const rows = firstYearBreakdown(amount, r, years, type);
    const tbody = $("table");
    tbody.innerHTML = "";
    rows.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.month}</td>
        <td>${money(row.principal)}</td>
        <td>${money(row.interest)}</td>
        <td>${money(row.balance)}</td>
      `;
      tbody.appendChild(tr);
    });

    $("resultDefault").style.display = "none";
    $("results").hidden = false;
  });

  // Reset
  $("reset").addEventListener("click", () => {
    form.reset();
    $("table").innerHTML = "";
    $("results").hidden = true;
    $("resultDefault").style.display = "grid";
    persistIfEnabled();
  });

  // Excel bulk upload
  $("excelFile").addEventListener("change", (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const tbody = $("bulkTable");
      tbody.innerHTML = "";
      rows.forEach((row, i) => {
        const amount = parseFloat(row.Amount);
        const rate = parseFloat(row.Rate);
        const years = parseInt(row.Years, 10);
        const type = String(row.Type || "repayment").toLowerCase();

        let m = null;
        if (type === "interest-only") m = monthlyPaymentInterestOnly(amount, rate);
        else m = monthlyPaymentRepayment(amount, rate, years);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td>${Number.isFinite(amount) ? money(amount) : "—"}</td>
          <td>${Number.isFinite(rate) ? rate.toFixed(2) : "—"}</td>
          <td>${Number.isFinite(years) ? years : "—"}</td>
          <td>${type}</td>
          <td>${m != null && Number.isFinite(m) ? money(round2(m)) : "Error"}</td>
        `;
        tbody.appendChild(tr);
      });
    };
    reader.readAsArrayBuffer(file);
  });
});
cd ~/Desktop/mortgage-calculator   # change this path if yours is different
ls                                  # should show: index.html style.css script.js

