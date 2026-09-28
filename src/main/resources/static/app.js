const BASE = "http://localhost:8080/api/expenses";

const budgetInput = document.getElementById("budgetInput");
const setBudgetBtn = document.getElementById("setBudgetBtn");
const budgetDisplay = document.getElementById("budgetDisplay");
const remainingDisplay = document.getElementById("remainingDisplay");

const amountInput = document.getElementById("amountInput");
const categoryInput = document.getElementById("categoryInput");
const descInput = document.getElementById("descInput");
const addBtn = document.getElementById("addBtn");

const expenseTableBody = document.querySelector("#expenseTable tbody");
const totalLabel = document.getElementById("totalLabel");

const refreshBtn = document.getElementById("refreshBtn");
const deleteBtn = document.getElementById("deleteBtn");
const clearBtn = document.getElementById("clearBtn");
const summaryBtn = document.getElementById("summaryBtn");
const advisorBtn = document.getElementById("advisorBtn");
const monthlyGraphBtn = document.getElementById("monthlyGraphBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const fileInput = document.getElementById("fileInput");

const modalBackdrop = document.getElementById("modalBackdrop");
const modalBody = document.getElementById("modalBody");
const closeModalBtn = document.getElementById("closeModalBtn");

const pieCanvas = document.getElementById("pieChart");
const legendDiv = document.getElementById("legend");

let expenses = [];
let budget = 0;
let selectedRows = new Set();
let pieChart = null;
let monthlyBarChart = null;

// Category colors matching the design
const categoryColors = {
    "Food": "#ff6b6b",
    "Transportation": "#4ecdc4",
    "Entertainment": "#95e1d3",
    "Shopping": "#f38181",
    "Bills": "#aa96da",
    "Healthcare": "#fcbad3",
    "Education": "#ffffd2",
    "Miscellaneous": "#a8dadc"
};

// Event listeners
setBudgetBtn.addEventListener("click", setBudget);
addBtn.addEventListener("click", addExpense);
refreshBtn.addEventListener("click", loadExpenses);
deleteBtn.addEventListener("click", deleteSelected);
clearBtn.addEventListener("click", clearAll);
summaryBtn.addEventListener("click", showSummary);
advisorBtn.addEventListener("click", showAdvice);
monthlyGraphBtn.addEventListener("click", showMonthlyGraph);
exportBtn.addEventListener("click", exportData);
importBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", importData);
closeModalBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

function showModal(contentHtml) {
  modalBody.innerHTML = contentHtml;
  modalBackdrop.style.display = "flex";
}

function closeModal() {
  modalBackdrop.style.display = "none";
  // Destroy monthly chart if it exists
  if (monthlyBarChart) {
    monthlyBarChart.destroy();
    monthlyBarChart = null;
  }
}

async function setBudget() {
  const val = Number(budgetInput.value);
  if (isNaN(val) || val <= 0) {
    alert("Enter a valid budget (> 0)");
    return;
  }
  try {
    const res = await fetch(`${BASE}/budget`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({budget: val}),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    alert(data.message);
    await loadExpenses();
  } catch (err) {
    alert("Failed to set budget: " + err.message);
  }
}

async function addExpense() {
  const amount = Number(amountInput.value);
  if (isNaN(amount) || amount <= 0) {
    alert("Enter a valid amount (> 0)");
    return;
  }
  const category = categoryInput.value;
  const description = descInput.value || "No description";
  try {
    const res = await fetch(`${BASE}/add?category=${encodeURIComponent(category)}&amount=${amount}&description=${encodeURIComponent(description)}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    alert(data.message);
    amountInput.value = "";
    descInput.value = "";
    await loadExpenses();
  } catch (err) {
    alert("Failed to add expense: " + err.message);
  }
}

async function loadExpenses() {
  try {
    const [listRes, summaryRes] = await Promise.all([
      fetch(`${BASE}/list`),
      fetch(`${BASE}/summary`)
    ]);

    if (!listRes.ok) throw new Error("Failed to load expenses: " + await listRes.text());
    if (!summaryRes.ok) throw new Error("Failed to load summary: " + await summaryRes.text());

    expenses = await listRes.json();
    const summary = await summaryRes.json();

    budget = summary.monthlyBudget || 0;
    budgetDisplay.textContent = `Budget: ₹${budget.toFixed(2)}`;
    const spent = summary.totalExpenses || 0;
    const remaining = summary.remaining || 0;
    remainingDisplay.textContent = `Remaining: ₹${remaining.toFixed(2)}`;

    renderExpenses();
    updateChart(summary.categoryTotals, summary.totalExpenses, remaining);
  } catch (err) {
    console.error("Error loading expenses:", err);
    alert(err.message);
  }
}

function renderExpenses() {
  expenseTableBody.innerHTML = "";
  selectedRows.clear();
  expenses.forEach((expense, i) => {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.addEventListener("click", () => {
      if (selectedRows.has(i)) {
        selectedRows.delete(i);
        tr.classList.remove("selected");
      } else {
        selectedRows.add(i);
        tr.classList.add("selected");
      }
    });
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${expense.date}</td>
      <td>${expense.category}</td>
      <td>₹${expense.amount.toFixed(2)}</td>
      <td>${expense.description}</td>
    `;
    expenseTableBody.appendChild(tr);
  });
  updateTotalLabel();
}

function updateTotalLabel() {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  totalLabel.textContent = `Total Expenses: ₹${total.toFixed(2)}`;
}

async function deleteSelected() {
  if (selectedRows.size === 0) {
    alert("Select rows to delete");
    return;
  }

  if (!confirm(`Delete ${selectedRows.size} selected expense(s)?`)) {
    return;
  }

  try {
    const sortedIndices = Array.from(selectedRows).sort((a, b) => b - a);

    for (const idx of sortedIndices) {
      const res = await fetch(`${BASE}/${idx}`, {method: "DELETE"});
      if (!res.ok) throw new Error(await res.text());
    }

    alert("Deleted selected expenses");
    selectedRows.clear();
    await loadExpenses();
  } catch (err) {
    alert("Error deleting: " + err.message);
  }
}

async function clearAll() {
  if (expenses.length === 0) {
    alert("No expenses to clear");
    return;
  }

  if (!confirm("Clear ALL expenses? This cannot be undone!")) {
    return;
  }

  try {
    const res = await fetch(`${BASE}/clear`, {method: "DELETE"});
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    alert(data.message);
    selectedRows.clear();
    await loadExpenses();
  } catch (err) {
    alert("Error clearing: " + err.message);
  }
}

async function showSummary() {
  try {
    const res = await fetch(`${BASE}/summary`);
    if (!res.ok) throw new Error(await res.text());
    const summary = await res.json();
    const {monthlyBudget, totalExpenses, remaining, usedPercent, categoryTotals} = summary;

    let html = `
      <div style="font-family:sans-serif; font-size:1.1em; min-width:270px;">
        <div style="text-align:center;">
          <b style="font-size:1.3em; color:#444;">EXPENSE SUMMARY</b>
        </div>
        <hr style="margin:12px 0"/>
        <div><b>Budget:</b> ₹${monthlyBudget.toFixed(2)}</div>
        <div><b>Spent:</b> ₹${totalExpenses.toFixed(2)}</div>
        <div><b>Remaining:</b> ₹${remaining.toFixed(2)}</div>
        <div><b>Used:</b> ${usedPercent.toFixed(1)}%</div>
        <br>
        <div style="font-weight:600; font-size:1.1em;">Category Breakdown:</div>
    `;

    for (const category in categoryTotals) {
      const val = categoryTotals[category];
      const valPercent = totalExpenses > 0 ? (val / totalExpenses) * 100 : 0;
      const color = categoryColors[category] || "#999";
      html += `<div style="margin:6px 0;padding:8px;background:${color}22;border-left:4px solid ${color};border-radius:4px;">
        <b>${category}:</b> ₹${val.toFixed(2)} (${valPercent.toFixed(1)}%)
      </div>`;
    }

    html += `</div>`;
    showModal(html);
  } catch (err) {
    alert("Error loading summary: " + err.message);
  }
}

async function showAdvice() {
  try {
    const res = await fetch(`${BASE}/advice`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    let levelColor = "#666";
    if (data.level === "danger") levelColor = "#ff4444";
    else if (data.level === "warning") levelColor = "#ff9800";
    else if (data.level === "success") levelColor = "#4caf50";

    let html = `
      <div style="font-family:sans-serif;">
        <h3 style="color:${levelColor};margin-top:0;">💼 Financial Advisor Report</h3>
        <div style="padding:16px;background:#f5f5f5;border-radius:8px;margin:12px 0;">
          <p style="font-size:1.1em;margin:0;">${data.advice}</p>
        </div>
    `;

    if (data.topCategory) {
      html += `
        <div style="margin-top:16px;">
          <b>Top Spending Category:</b> ${data.topCategory} (₹${data.topCategoryAmount.toFixed(2)})
        </div>
      `;
    }

    html += `
        <div style="margin-top:16px;padding:12px;background:#e3f2fd;border-radius:8px;">
          <b>General Tips:</b>
          <ul style="margin:8px 0;">
            <li>Save at least 20% of income</li>
            <li>Track expenses weekly</li>
            <li>Separate savings and spending accounts</li>
            <li>Review subscriptions regularly</li>
          </ul>
        </div>
      </div>
    `;

    showModal(html);
  } catch (err) {
    alert("Error loading advice: " + err.message);
  }
}

async function showMonthlyGraph() {
  try {
    const res = await fetch(`${BASE}/monthly-stats`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    if (!data.months || data.months.length === 0) {
      alert("No monthly data available. Add some expenses first!");
      return;
    }

    let html = `
      <div style="font-family:sans-serif;">
        <h3 style="margin-top:0;text-align:center;color:#444;">📊 Monthly Expense Trends</h3>
        <div style="background:#f9f9f9;padding:12px;border-radius:8px;margin-bottom:16px;">
          <canvas id="monthlyBarChart" height="300"></canvas>
        </div>
        <div style="margin-top:16px;">
          <h4 style="margin:8px 0;">Monthly Breakdown:</h4>
          <div style="max-height:200px;overflow-y:auto;">
    `;

    for (let i = 0; i < data.months.length; i++) {
      const month = data.months[i];
      const amount = data.amounts[i];
      const count = data.monthlyCount[month] || 0;
      html += `
        <div style="padding:8px;margin:6px 0;background:linear-gradient(90deg,#e3f2fd,#f3e5f5);border-radius:6px;display:flex;justify-content:space-between;">
          <span><b>${month}</b> (${count} expense${count !== 1 ? 's' : ''})</span>
          <span style="font-weight:700;color:#1976d2;">₹${amount.toFixed(2)}</span>
        </div>
      `;
    }

    html += `
          </div>
        </div>
      </div>
    `;

    showModal(html);

    // Wait for modal to render, then create chart
    setTimeout(() => {
      const canvas = document.getElementById("monthlyBarChart");
      if (canvas) {
        createMonthlyBarChart(canvas, data.months, data.amounts);
      }
    }, 100);

  } catch (err) {
    alert("Error loading monthly stats: " + err.message);
  }
}

function createMonthlyBarChart(canvas, months, amounts) {
  const ctx = canvas.getContext('2d');

  if (monthlyBarChart) {
    monthlyBarChart.destroy();
  }

  monthlyBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'Monthly Expenses (₹)',
        data: amounts,
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(54, 162, 235, 0.9)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Total: ₹' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '₹' + value;
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

async function exportData() {
  try {
    const res = await fetch(`${BASE}/export`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], {type: "application/json"});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expense_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    alert("Data exported successfully!");
  } catch (err) {
    alert("Failed to export data: " + err.message);
  }
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    const res = await fetch(`${BASE}/import`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();

    alert(result.message);
    await loadExpenses();

    fileInput.value = "";
  } catch (err) {
    alert("Failed to import data: " + err.message);
    fileInput.value = "";
  }
}

function updateChart(categoryTotals, totalExpenses, remainingBudget) {
  if (!categoryTotals || Object.keys(categoryTotals).length === 0) {
    // Show remaining budget only
    if (remainingBudget > 0) {
      const chartData = {
        labels: ['Remaining Budget'],
        datasets: [{
          data: [remainingBudget],
          backgroundColor: ['#ffcc99'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      };

      renderChart(chartData, {}, remainingBudget, 0);
    } else {
      if (pieChart) {
        pieChart.destroy();
        pieChart = null;
      }
      legendDiv.innerHTML = '<div style="color:#999;text-align:center;">No data to display</div>';
    }
    return;
  }

  // Add remaining budget to the chart
  const labels = [...Object.keys(categoryTotals), 'Remaining Budget'];
  const data = [...Object.values(categoryTotals), remainingBudget];
  const colors = [
    ...Object.keys(categoryTotals).map(label => categoryColors[label] || "#999"),
    '#ffcc99'
  ];

  const chartData = {
    labels: labels,
    datasets: [{
      data: data,
      backgroundColor: colors,
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  renderChart(chartData, categoryTotals, remainingBudget, totalExpenses);
}

function renderChart(chartData, categoryTotals, remainingBudget, totalExpenses) {
  const config = {
    type: 'pie',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ₹${value.toFixed(2)} (${percentage}%)`;
            }
          }
        }
      }
    }
  };

  if (pieChart) {
    pieChart.destroy();
  }

  pieChart = new Chart(pieCanvas, config);

  // Update legend to show percentages relative to budget
  legendDiv.innerHTML = '';

  // Show category expenses as percentages
  for (const category in categoryTotals) {
    const val = categoryTotals[category];
    const budgetPercent = budget > 0 ? (val / budget) * 100 : 0;
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.style.background = categoryColors[category] || "#999";
    tag.style.color = '#fff';
    tag.textContent = `${category} - ${budgetPercent.toFixed(1)}%`;
    legendDiv.appendChild(tag);
  }

  // Show remaining budget percentage
  if (remainingBudget > 0) {
    const remainingPercent = budget > 0 ? (remainingBudget / budget) * 100 : 0;
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.style.background = '#ffcc99';
    tag.style.color = '#333';
    tag.textContent = `Remaining Budget - ${remainingPercent.toFixed(1)}%`;
    legendDiv.appendChild(tag);
  }
}

// Load data on start - THIS IS KEY FOR PERSISTENCE
window.onload = loadExpenses;