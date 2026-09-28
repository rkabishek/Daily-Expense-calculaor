package com.example.dailyexpense;

import org.springframework.web.bind.annotation.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.*;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;

@RestController
@RequestMapping("/api/expenses")
@CrossOrigin(origins = "*")
public class DailyExpenseBackend {

    private List<Expense> expenses = new ArrayList<>();
    private double monthlyBudget = 0;
    private final String DATA_FILE;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DailyExpenseBackend() {
        String homeDir = System.getProperty("user.home");
        DATA_FILE = homeDir + File.separator + "expense_data.json";
        System.out.println("Data file path: " + DATA_FILE);
        loadData();
    }

    @PostMapping("/budget")
    public Map<String, Object> setBudget(@RequestBody Map<String, Double> payload) {
        this.monthlyBudget = payload.getOrDefault("budget", 0.0);
        saveData();
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Budget set to \u20b9" + monthlyBudget);
        response.put("budget", monthlyBudget);
        return response;
    }

    @PostMapping("/add")
    public Map<String, Object> addExpense(@RequestParam String category,
                                          @RequestParam double amount,
                                          @RequestParam String description) {
        String date = new SimpleDateFormat("dd/MM/yyyy").format(new Date());
        if (description == null || description.trim().isEmpty()) {
            description = "No description";
        }
        Expense expense = new Expense(date, category, amount, description);
        expenses.add(expense);
        saveData();

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Expense added successfully!");
        response.put("expense", expense);
        return response;
    }

    @GetMapping("/list")
    public List<Expense> getExpenses() {
        return expenses;
    }

    @DeleteMapping("/{index}")
    public Map<String, Object> deleteExpense(@PathVariable int index) {
        Map<String, Object> response = new HashMap<>();
        if (index >= 0 && index < expenses.size()) {
            Expense removed = expenses.remove(index);
            saveData();
            response.put("message", "Expense deleted!");
            response.put("deleted", removed);
            response.put("success", true);
        } else {
            response.put("message", "Invalid index: " + index + " (list size: " + expenses.size() + ")");
            response.put("success", false);
        }
        return response;
    }

    @DeleteMapping("/clear")
    public Map<String, Object> clearAllExpenses() {
        int count = expenses.size();
        expenses.clear();
        saveData();
        Map<String, Object> response = new HashMap<>();
        response.put("message", "All " + count + " expenses cleared!");
        response.put("deletedCount", count);
        return response;
    }

    @GetMapping("/summary")
    public Map<String, Object> getSummary() {
        Map<String, Object> summary = new HashMap<>();
        summary.put("monthlyBudget", monthlyBudget);
        double total = expenses.stream().mapToDouble(Expense::getAmount).sum();
        summary.put("totalExpenses", total);
        summary.put("remaining", monthlyBudget - total);
        summary.put("usedPercent", monthlyBudget > 0 ? (total / monthlyBudget) * 100 : 0);

        Map<String, Double> categoryTotals = new LinkedHashMap<>();
        for (Expense e : expenses) {
            categoryTotals.put(e.getCategory(),
                    categoryTotals.getOrDefault(e.getCategory(), 0.0) + e.getAmount());
        }
        summary.put("categoryTotals", categoryTotals);
        return summary;
    }

    @GetMapping("/monthly-stats")
    public Map<String, Object> getMonthlyStats() {
        Map<String, Object> response = new HashMap<>();
        SimpleDateFormat dateFormat = new SimpleDateFormat("dd/MM/yyyy");
        SimpleDateFormat monthYearFormat = new SimpleDateFormat("MMM yyyy");

        Map<String, Double> monthlyExpenses = new TreeMap<>();
        Map<String, Integer> monthlyCount = new TreeMap<>();

        for (Expense expense : expenses) {
            try {
                Date date = dateFormat.parse(expense.getDate());
                String monthYear = monthYearFormat.format(date);
                monthlyExpenses.put(monthYear,
                        monthlyExpenses.getOrDefault(monthYear, 0.0) + expense.getAmount());
                monthlyCount.put(monthYear,
                        monthlyCount.getOrDefault(monthYear, 0) + 1);
            } catch (ParseException e) {
                System.err.println("Error parsing date: " + expense.getDate());
            }
        }

        response.put("monthlyExpenses", monthlyExpenses);
        response.put("monthlyCount", monthlyCount);
        response.put("months", new ArrayList<>(monthlyExpenses.keySet()));
        response.put("amounts", new ArrayList<>(monthlyExpenses.values()));
        return response;
    }

    @GetMapping("/advice")
    public Map<String, Object> getAdvice() {
        Map<String, Object> response = new HashMap<>();
        double total = expenses.stream().mapToDouble(Expense::getAmount).sum();

        if (monthlyBudget == 0) {
            response.put("advice", "Set a budget to get personalised advice!");
            response.put("level", "info");
            return response;
        }

        double percent = (total / monthlyBudget) * 100;
        String advice;
        String level;

        if (percent > 100) {
            advice = "\u26a0\ufe0f You have EXCEEDED your budget! Review your spending immediately.";
            level = "danger";
        } else if (percent > 90) {
            advice = "\u26a0\ufe0f WARNING: Over 90% of your budget used. Pause unnecessary purchases.";
            level = "warning";
        } else if (percent > 70) {
            advice = "\u26a0\ufe0f CAUTION: Over 70% spent. Reduce discretionary expenses.";
            level = "warning";
        } else if (percent > 50) {
            advice = "\u2705 Moderate Spending: Halfway through budget. Keep tracking regularly.";
            level = "info";
        } else {
            advice = "\ud83d\udcb0 Great Job! Spending efficiently. Consider saving or investing leftovers.";
            level = "success";
        }

        response.put("advice", advice);
        response.put("level", level);
        response.put("percent", percent);

        Map<String, Double> categoryTotals = new HashMap<>();
        for (Expense e : expenses) {
            categoryTotals.put(e.getCategory(),
                    categoryTotals.getOrDefault(e.getCategory(), 0.0) + e.getAmount());
        }

        if (!categoryTotals.isEmpty()) {
            String topCategory = categoryTotals.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse("");
            response.put("topCategory", topCategory);
            response.put("topCategoryAmount", categoryTotals.get(topCategory));
        }

        return response;
    }

    @GetMapping("/export")
    public Map<String, Object> exportData() {
        Map<String, Object> data = new HashMap<>();
        data.put("monthlyBudget", monthlyBudget);
        data.put("expenses", expenses);
        data.put("exportDate", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()));
        return data;
    }

    @PostMapping("/import")
    public Map<String, Object> importData(@RequestBody Map<String, Object> data) {
        try {
            Object budgetObj = data.get("monthlyBudget");
            if (budgetObj instanceof Number) {
                monthlyBudget = ((Number) budgetObj).doubleValue();
            }
            List<?> expList = (List<?>) data.get("expenses");
            expenses.clear();
            if (expList != null) {
                for (Object obj : expList) {
                    Map<String, Object> e = (Map<String, Object>) obj;
                    Expense expense = new Expense(
                            (String) e.get("date"),
                            (String) e.get("category"),
                            ((Number) e.get("amount")).doubleValue(),
                            (String) e.get("description")
                    );
                    expenses.add(expense);
                }
            }
            saveData();
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Data imported successfully!");
            response.put("expenseCount", expenses.size());
            response.put("success", true);
            return response;
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Error importing data: " + e.getMessage());
            response.put("success", false);
            return response;
        }
    }

    private void saveData() {
        Map<String, Object> data = new HashMap<>();
        data.put("monthlyBudget", monthlyBudget);
        data.put("expenses", expenses);
        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(new File(DATA_FILE), data);
        } catch (IOException e) {
            System.err.println("Error saving data: " + e.getMessage());
        }
    }

    private void loadData() {
        File file = new File(DATA_FILE);
        if (!file.exists()) {
            System.out.println("No existing data file. Starting fresh.");
            return;
        }
        try {
            Map<String, Object> data = objectMapper.readValue(file,
                    new TypeReference<Map<String, Object>>() {});
            Object budgetObj = data.get("monthlyBudget");
            if (budgetObj instanceof Number) {
                monthlyBudget = ((Number) budgetObj).doubleValue();
            }
            List<?> expList = (List<?>) data.get("expenses");
            expenses.clear();
            if (expList != null) {
                for (Object obj : expList) {
                    Map<String, Object> e = (Map<String, Object>) obj;
                    expenses.add(new Expense(
                            (String) e.get("date"),
                            (String) e.get("category"),
                            ((Number) e.get("amount")).doubleValue(),
                            (String) e.get("description")
                    ));
                }
            }
            System.out.println("Loaded " + expenses.size() + " expenses from file.");
        } catch (IOException e) {
            System.err.println("Error loading data: " + e.getMessage());
        }
    }
}