package com.example.dailyexpense;

public class Expense {
    private String date;
    private String category;
    private double amount;
    private String description;

    public Expense(String date, String category, double amount, String description) {
        this.date = date;
        this.category = category;
        this.amount = amount;
        this.description = description;
    }

    // Getters
    public String getDate() { return date; }
    public String getCategory() { return category; }
    public double getAmount() { return amount; }
    public String getDescription() { return description; }

    // For file storage (used in DailyExpenseBackend.java)
    public String toFileString() {
        return date + "|" + category + "|" + amount + "|" + description;
    }

    public static Expense fromFileString(String line) {
        String[] parts = line.split("\\|");
        return new Expense(parts[0], parts[1], Double.parseDouble(parts[2]), parts[3]);
    }
}


      