package com.example.dailyexpense;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;

import java.io.*;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class LoginController {

    private final String USERS_FILE;
    private final ObjectMapper objectMapper = new ObjectMapper();
    // Map of username -> {password, email, resetCode}
    private Map<String, Map<String, String>> users = new HashMap<>();

    public LoginController() {
        String homeDir = System.getProperty("user.home");
        USERS_FILE = homeDir + File.separator + "expense_users.json";
        loadUsers();
    }

    // ── REGISTER ──────────────────────────────────────────────
    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody Map<String, String> payload) {
        Map<String, Object> res = new HashMap<>();
        String username = payload.getOrDefault("username", "").trim();
        String password = payload.getOrDefault("password", "").trim();
        String email    = payload.getOrDefault("email",    "").trim();

        if (username.isEmpty() || password.isEmpty() || email.isEmpty()) {
            res.put("success", false);
            res.put("message", "Username, password and email are required.");
            return res;
        }
        if (users.containsKey(username)) {
            res.put("success", false);
            res.put("message", "Username already exists. Please choose another.");
            return res;
        }

        Map<String, String> userData = new HashMap<>();
        userData.put("password", password);
        userData.put("email",    email);
        userData.put("resetCode", "");
        users.put(username, userData);
        saveUsers();

        res.put("success", true);
        res.put("message", "Account created successfully! Please log in.");
        return res;
    }

    // ── LOGIN ─────────────────────────────────────────────────
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> payload) {
        Map<String, Object> res = new HashMap<>();
        String username = payload.getOrDefault("username", "").trim();
        String password = payload.getOrDefault("password", "").trim();

        if (!users.containsKey(username)) {
            res.put("success", false);
            res.put("message", "User not found. Please register first.");
            return res;
        }
        String stored = users.get(username).get("password");
        if (!stored.equals(password)) {
            res.put("success", false);
            res.put("message", "Incorrect password. Please try again.");
            return res;
        }

        res.put("success",  true);
        res.put("message",  "Login successful!");
        res.put("username", username);
        return res;
    }

    // ── FORGOT PASSWORD – generate reset code ─────────────────
    @PostMapping("/forgot-password")
    public Map<String, Object> forgotPassword(@RequestBody Map<String, String> payload) {
        Map<String, Object> res = new HashMap<>();
        String username = payload.getOrDefault("username", "").trim();
        String email    = payload.getOrDefault("email",    "").trim();

        if (!users.containsKey(username)) {
            res.put("success", false);
            res.put("message", "Username not found.");
            return res;
        }
        String storedEmail = users.get(username).get("email");
        if (!storedEmail.equalsIgnoreCase(email)) {
            res.put("success", false);
            res.put("message", "Email does not match our records.");
            return res;
        }

        // Generate a simple 6-digit code (in production, email this)
        String code = String.valueOf(100000 + new Random().nextInt(900000));
        users.get(username).put("resetCode", code);
        saveUsers();

        // In a real app you'd email the code; here we return it so you can test
        res.put("success",   true);
        res.put("message",   "Reset code generated! (In production this would be emailed.)");
        res.put("resetCode", code);   // ← remove this line in production
        return res;
    }

    // ── RESET PASSWORD ────────────────────────────────────────
    @PostMapping("/reset-password")
    public Map<String, Object> resetPassword(@RequestBody Map<String, String> payload) {
        Map<String, Object> res = new HashMap<>();
        String username    = payload.getOrDefault("username",    "").trim();
        String code        = payload.getOrDefault("resetCode",   "").trim();
        String newPassword = payload.getOrDefault("newPassword", "").trim();

        if (!users.containsKey(username)) {
            res.put("success", false);
            res.put("message", "Username not found.");
            return res;
        }
        String stored = users.get(username).get("resetCode");
        if (stored == null || stored.isEmpty() || !stored.equals(code)) {
            res.put("success", false);
            res.put("message", "Invalid or expired reset code.");
            return res;
        }
        if (newPassword.length() < 4) {
            res.put("success", false);
            res.put("message", "New password must be at least 4 characters.");
            return res;
        }

        users.get(username).put("password",  newPassword);
        users.get(username).put("resetCode", "");   // invalidate code
        saveUsers();

        res.put("success", true);
        res.put("message", "Password reset successfully! Please log in.");
        return res;
    }

    // ── PERSISTENCE ───────────────────────────────────────────
    private void saveUsers() {
        try {
            objectMapper.writerWithDefaultPrettyPrinter()
                    .writeValue(new File(USERS_FILE), users);
        } catch (IOException e) {
            System.err.println("Error saving users: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private void loadUsers() {
        File file = new File(USERS_FILE);
        if (!file.exists()) return;
        try {
            users = objectMapper.readValue(file,
                    new TypeReference<Map<String, Map<String, String>>>() {});
            System.out.println("Loaded " + users.size() + " user(s).");
        } catch (IOException e) {
            System.err.println("Error loading users: " + e.getMessage());
        }
    }
}