package com.example.transaction.controller;

import com.example.transaction.client.AccountClient;
import com.example.transaction.model.Transaction;
import com.example.transaction.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/transactions")
public class TransactionController {

    @Autowired
    private TransactionRepository repo;

    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    @Autowired
    private AccountClient accountClient;

    @PostMapping("/deposit")
    public ResponseEntity<?> deposit(@RequestBody Transaction tx, HttpServletRequest request) {
        try {
            // Validate amount is positive
            if (tx.getAmount() <= 0) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Deposit amount must be positive. Received: " + tx.getAmount());
            }

            // Get authenticated username and JWT token
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String username = authentication.getName();
            String jwtToken = extractJwtFromRequest(request);

            // Fetch account to verify ownership
            AccountClient.Account account = accountClient.getAccount(tx.getAccountId(), jwtToken);

            if (account == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Account not found");
            }

            // Update account balance
            double newBalance = account.getBalance() + tx.getAmount();
            accountClient.updateAccountBalance(account.getId(), newBalance, jwtToken);

            // Save transaction
            tx.setType("DEPOSIT");
            Transaction saved = repo.save(tx);

            kafkaTemplate.send("transactions",
                    "User " + username + " deposited " + tx.getAmount() + " to account " + tx.getAccountId());

            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Deposit failed: " + e.getMessage());
        }
    }

    @PostMapping("/withdraw")
    public ResponseEntity<?> withdraw(@RequestBody Transaction tx, HttpServletRequest request) {
        try {
            // Validate amount is positive
            if (tx.getAmount() <= 0) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Withdrawal amount must be positive. Received: " + tx.getAmount());
            }

            // Get authenticated username and JWT token
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String username = authentication.getName();
            String jwtToken = extractJwtFromRequest(request);

            // Fetch account to verify ownership and balance
            AccountClient.Account account = accountClient.getAccount(tx.getAccountId(), jwtToken);

            if (account == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Account not found");
            }

            // Check if sufficient balance
            if (account.getBalance() < tx.getAmount()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Insufficient balance. Current balance: " + account.getBalance());
            }

            // Update account balance
            double newBalance = account.getBalance() - tx.getAmount();
            accountClient.updateAccountBalance(account.getId(), newBalance, jwtToken);

            // Save transaction
            tx.setType("WITHDRAW");
            Transaction saved = repo.save(tx);

            kafkaTemplate.send("transactions",
                    "User " + username + " withdrew " + tx.getAmount() + " from account " + tx.getAccountId());

            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Withdrawal failed: " + e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<?> all(HttpServletRequest request) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String username = authentication.getName();
            String jwtToken = extractJwtFromRequest(request);

            // Fetch all accounts belonging to the authenticated user
            List<AccountClient.Account> userAccounts = getUserAccounts(jwtToken);

            if (userAccounts.isEmpty()) {
                return ResponseEntity.ok(Collections.emptyList());
            }

            // Get account IDs
            List<Long> userAccountIds = userAccounts.stream()
                    .map(AccountClient.Account::getId)
                    .collect(Collectors.toList());

            // Filter transactions to only show user's account transactions
            List<Transaction> allTransactions = repo.findAll();
            List<Transaction> userTransactions = allTransactions.stream()
                    .filter(tx -> userAccountIds.contains(tx.getAccountId()))
                    .collect(Collectors.toList());

            kafkaTemplate.send("transactions",
                    "User " + username + " listing their " + userTransactions.size() + " transactions");

            return ResponseEntity.ok(userTransactions);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to fetch transactions: " + e.getMessage());
        }
    }

    // Helper method to fetch all user accounts
    private List<AccountClient.Account> getUserAccounts(String jwtToken) {
        try {
            AccountClient.Account[] accounts = accountClient.getAllAccounts(jwtToken);
            return accounts != null ? Arrays.asList(accounts) : Collections.emptyList();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    // Helper method to extract JWT token from request
    private String extractJwtFromRequest(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        throw new RuntimeException("No JWT token found in request");
    }
}
