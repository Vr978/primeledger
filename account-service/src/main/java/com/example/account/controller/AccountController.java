package com.example.account.controller;

import com.example.account.dto.CreateAccountRequest;
import com.example.account.model.Account;
import com.example.account.model.User;
import com.example.account.repository.AccountRepository;
import com.example.account.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/accounts")
public class AccountController {

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody CreateAccountRequest request) {
        User user = getAuthenticatedUser();

        Account.AccountType type;
        try {
            type = Account.AccountType.valueOf(request.getAccountType().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid account type. Use SAVINGS or CHECKING.");
        }

        Account account = new Account();
        account.setOwnerName(request.getOwnerName());
        account.setAccountType(type);
        account.setBalance(BigDecimal.ZERO);
        account.setUserId(user.getId());

        Account saved = accountRepository.save(account);
        return ResponseEntity.ok(saved);
    }

    @GetMapping
    public ResponseEntity<?> all() {
        User user = getAuthenticatedUser();
        List<Account> userAccounts = accountRepository.findByUserId(user.getId());
        return ResponseEntity.ok(userAccounts);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> one(@PathVariable Long id) {
        User user = getAuthenticatedUser();
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        if (!user.getId().equals(account.getUserId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("You don't have permission to access this account");
        }
        return ResponseEntity.ok(account);
    }

    @GetMapping("/by-number/{accountNumber}")
    public ResponseEntity<?> findByNumber(@PathVariable String accountNumber) {
        Account account = accountRepository.findByAccountNumber(accountNumber)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        // Return full account info (needed for transfers)
        return ResponseEntity.ok(account);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateAccount(@PathVariable Long id, @RequestBody Map<String, String> updates) {
        User user = getAuthenticatedUser();
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        if (!user.getId().equals(account.getUserId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("You don't have permission to update this account");
        }

        // Only allow updating ownerName
        if (updates.containsKey("ownerName")) {
            account.setOwnerName(updates.get("ownerName"));
        }

        Account saved = accountRepository.save(account);
        return ResponseEntity.ok(saved);
    }

    // Internal endpoint for transaction-service to update balance
    @PutMapping("/{id}/balance")
    public ResponseEntity<?> updateBalance(@PathVariable Long id, @RequestBody BalanceUpdateRequest request,
                                           @RequestHeader(value = "X-System-Call", required = false) String systemCall) {
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        // If it's a system call (inter-service transfer), skip ownership check
        if (!"true".equals(systemCall)) {
            User user = getAuthenticatedUser();
            if (!user.getId().equals(account.getUserId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body("You don't have permission to update this account");
            }
        }

        account.setBalance(request.getNewBalance());
        Account saved = accountRepository.save(account);
        return ResponseEntity.ok(saved);
    }

    // Admin endpoint - get all users and their accounts
    @GetMapping("/admin/overview")
    public ResponseEntity<?> adminOverview() {
        User user = getAuthenticatedUser();
        if (!"ADMIN".equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin access required");
        }

        List<User> allUsers = userRepository.findAll();
        List<Account> allAccounts = accountRepository.findAll();

        Map<String, Object> overview = new HashMap<>();
        overview.put("totalUsers", allUsers.size());
        overview.put("totalAccounts", allAccounts.size());
        overview.put("users", allUsers.stream().map(u -> {
            Map<String, Object> userMap = new HashMap<>();
            userMap.put("id", u.getId());
            userMap.put("name", u.getName());
            userMap.put("email", u.getEmail());
            userMap.put("emailVerified", u.getEmailVerified());
            userMap.put("createdAt", u.getCreatedAt());
            return userMap;
        }).toList());

        return ResponseEntity.ok(overview);
    }

    private User getAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public static class BalanceUpdateRequest {
        private BigDecimal newBalance;
        public BigDecimal getNewBalance() { return newBalance; }
        public void setNewBalance(BigDecimal newBalance) { this.newBalance = newBalance; }
    }
}
