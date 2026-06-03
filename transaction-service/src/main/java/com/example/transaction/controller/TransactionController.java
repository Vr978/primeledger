package com.example.transaction.controller;

import com.example.transaction.service.EventPublisher;
import com.example.transaction.client.AccountClient;
import com.example.transaction.dto.DepositWithdrawRequest;
import com.example.transaction.dto.TransferRequest;
import com.example.transaction.model.Transaction;
import com.example.transaction.model.Transaction.TransactionCategory;
import com.example.transaction.model.Transaction.TransactionType;
import com.example.transaction.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/transactions")
public class TransactionController {

    @Autowired
    private TransactionRepository repo;

    @Autowired(required = false)
    private KafkaTemplate<String, String> kafkaTemplate;

    @Autowired
    private AccountClient accountClient;

    @Autowired
    private EventPublisher eventPublisher;

    @PostMapping("/deposit")
    public ResponseEntity<?> deposit(@Valid @RequestBody DepositWithdrawRequest request, HttpServletRequest httpRequest) {
        String username = getUsername();
        String jwtToken = extractJwt(httpRequest);

        AccountClient.Account account = accountClient.getAccount(request.getAccountId(), jwtToken);
        if (account == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Account not found");
        }

        BigDecimal newBalance = account.getBalance().add(request.getAmount());
        accountClient.updateAccountBalance(account.getId(), newBalance, jwtToken);

        Transaction tx = Transaction.builder()
                .accountId(request.getAccountId())
                .amount(request.getAmount())
                .type(TransactionType.DEPOSIT)
                .category(TransactionCategory.OTHER)
                .description(request.getDescription())
                .build();

        Transaction saved = repo.save(tx);

        eventPublisher.publish(
                String.format("{\"type\":\"DEPOSIT\",\"user\":\"%s\",\"amount\":%s,\"accountId\":%d}",
                        username, request.getAmount(), request.getAccountId()));

        return ResponseEntity.ok(saved);
    }

    @PostMapping("/withdraw")
    public ResponseEntity<?> withdraw(@Valid @RequestBody DepositWithdrawRequest request, HttpServletRequest httpRequest) {
        String username = getUsername();
        String jwtToken = extractJwt(httpRequest);

        AccountClient.Account account = accountClient.getAccount(request.getAccountId(), jwtToken);
        if (account == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Account not found");
        }

        if (account.getBalance().compareTo(request.getAmount()) < 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Insufficient balance. Current: " + account.getBalance());
        }

        BigDecimal newBalance = account.getBalance().subtract(request.getAmount());
        accountClient.updateAccountBalance(account.getId(), newBalance, jwtToken);

        Transaction tx = Transaction.builder()
                .accountId(request.getAccountId())
                .amount(request.getAmount())
                .type(TransactionType.WITHDRAW)
                .category(parseCategory(request.getCategory()))
                .description(request.getDescription())
                .build();

        Transaction saved = repo.save(tx);

        eventPublisher.publish(
                String.format("{\"type\":\"WITHDRAW\",\"user\":\"%s\",\"amount\":%s,\"accountId\":%d}",
                        username, request.getAmount(), request.getAccountId()));

        return ResponseEntity.ok(saved);
    }

    @PostMapping("/transfer")
    public ResponseEntity<?> transfer(@Valid @RequestBody TransferRequest request, HttpServletRequest httpRequest) {
        String username = getUsername();
        String jwtToken = extractJwt(httpRequest);

        // Verify source account ownership
        AccountClient.Account sourceAccount = accountClient.getAccount(request.getFromAccountId(), jwtToken);
        if (sourceAccount == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Source account not found");
        }

        // Check sufficient balance
        if (sourceAccount.getBalance().compareTo(request.getAmount()) < 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Insufficient balance. Current: " + sourceAccount.getBalance());
        }

        // Lookup destination account by account number
        AccountClient.Account destAccount = accountClient.getAccountByNumber(request.getToAccountNumber(), jwtToken);
        if (destAccount == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Destination account not found: " + request.getToAccountNumber());
        }

        // Debit source
        BigDecimal sourceNewBalance = sourceAccount.getBalance().subtract(request.getAmount());
        accountClient.updateAccountBalance(sourceAccount.getId(), sourceNewBalance, jwtToken);

        // Credit destination (using a system-level call)
        BigDecimal destNewBalance = destAccount.getBalance().add(request.getAmount());
        accountClient.updateAccountBalanceSystem(destAccount.getId(), destNewBalance, jwtToken);

        // Record outgoing transaction
        Transaction outTx = Transaction.builder()
                .accountId(request.getFromAccountId())
                .amount(request.getAmount())
                .type(TransactionType.TRANSFER_OUT)
                .category(TransactionCategory.TRANSFER)
                .description(request.getDescription() != null ? request.getDescription() : "Transfer to " + request.getToAccountNumber())
                .counterpartyAccountNumber(request.getToAccountNumber())
                .build();
        repo.save(outTx);

        // Record incoming transaction
        Transaction inTx = Transaction.builder()
                .accountId(destAccount.getId())
                .amount(request.getAmount())
                .type(TransactionType.TRANSFER_IN)
                .category(TransactionCategory.TRANSFER)
                .description("Transfer from " + sourceAccount.getOwnerName())
                .counterpartyAccountNumber(sourceAccount.getAccountNumber())
                .build();
        repo.save(inTx);

        eventPublisher.publish(
                String.format("{\"type\":\"TRANSFER\",\"user\":\"%s\",\"amount\":%s,\"from\":%d,\"to\":\"%s\"}",
                        username, request.getAmount(), request.getFromAccountId(), request.getToAccountNumber()));

        return ResponseEntity.ok(outTx);
    }

    @GetMapping
    public ResponseEntity<?> all(HttpServletRequest httpRequest) {
        String jwtToken = extractJwt(httpRequest);

        List<AccountClient.Account> userAccounts = getUserAccounts(jwtToken);
        if (userAccounts.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        List<Long> userAccountIds = userAccounts.stream()
                .map(AccountClient.Account::getId)
                .collect(Collectors.toList());

        List<Transaction> userTransactions = repo.findByAccountIdInOrderByCreatedAtDesc(userAccountIds);
        return ResponseEntity.ok(userTransactions);
    }

    @GetMapping("/categories")
    public ResponseEntity<?> getCategories() {
        return ResponseEntity.ok(TransactionCategory.values());
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(HttpServletRequest httpRequest) {
        String jwtToken = extractJwt(httpRequest);
        List<AccountClient.Account> userAccounts = getUserAccounts(jwtToken);
        if (userAccounts.isEmpty()) {
            return ResponseEntity.ok(Map.of("weeklyActivity", List.of(), "expenseByCategory", Map.of(), "balanceHistory", List.of()));
        }

        List<Long> accountIds = userAccounts.stream().map(AccountClient.Account::getId).collect(Collectors.toList());
        List<Transaction> allTx = repo.findByAccountIdInOrderByCreatedAtDesc(accountIds);

        // Weekly activity: last 7 days, deposits vs withdrawals per day
        java.time.LocalDate today = java.time.LocalDate.now();
        List<Map<String, Object>> weeklyActivity = new java.util.ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            java.time.LocalDate day = today.minusDays(i);
            java.time.Instant dayStart = day.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
            java.time.Instant dayEnd = day.plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();

            BigDecimal deposits = allTx.stream()
                .filter(tx -> tx.getCreatedAt().isAfter(dayStart) && tx.getCreatedAt().isBefore(dayEnd))
                .filter(tx -> tx.getType() == TransactionType.DEPOSIT || tx.getType() == TransactionType.TRANSFER_IN)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal withdrawals = allTx.stream()
                .filter(tx -> tx.getCreatedAt().isAfter(dayStart) && tx.getCreatedAt().isBefore(dayEnd))
                .filter(tx -> tx.getType() == TransactionType.WITHDRAW || tx.getType() == TransactionType.TRANSFER_OUT)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            weeklyActivity.add(Map.of(
                "day", day.getDayOfWeek().toString().substring(0, 3),
                "deposits", deposits,
                "withdrawals", withdrawals
            ));
        }

        // Expense by category (withdrawals + transfer_out only)
        Map<String, BigDecimal> expenseByCategory = allTx.stream()
            .filter(tx -> tx.getType() == TransactionType.WITHDRAW || tx.getType() == TransactionType.TRANSFER_OUT)
            .collect(Collectors.groupingBy(
                tx -> tx.getCategory().name(),
                Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)
            ));

        // Balance history: daily closing balance for last 30 days (simplified)
        BigDecimal currentBalance = userAccounts.stream()
            .map(AccountClient.Account::getBalance)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Map<String, Object>> balanceHistory = new java.util.ArrayList<>();
        BigDecimal runningBalance = currentBalance;
        for (int i = 0; i < 30; i++) {
            java.time.LocalDate day = today.minusDays(i);
            java.time.Instant dayStart = day.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
            java.time.Instant dayEnd = day.plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();

            // Subtract today's net change to get previous day's balance
            BigDecimal dayNet = allTx.stream()
                .filter(tx -> tx.getCreatedAt().isAfter(dayStart) && tx.getCreatedAt().isBefore(dayEnd))
                .map(tx -> (tx.getType() == TransactionType.DEPOSIT || tx.getType() == TransactionType.TRANSFER_IN)
                    ? tx.getAmount() : tx.getAmount().negate())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            balanceHistory.add(0, Map.of("date", day.toString(), "balance", runningBalance));
            runningBalance = runningBalance.subtract(dayNet);
        }

        return ResponseEntity.ok(Map.of(
            "weeklyActivity", weeklyActivity,
            "expenseByCategory", expenseByCategory,
            "balanceHistory", balanceHistory
        ));
    }

    @GetMapping("/frequent-recipients")
    public ResponseEntity<?> getFrequentRecipients(HttpServletRequest httpRequest) {
        String jwtToken = extractJwt(httpRequest);
        List<AccountClient.Account> userAccounts = getUserAccounts(jwtToken);
        if (userAccounts.isEmpty()) return ResponseEntity.ok(List.of());

        List<Long> accountIds = userAccounts.stream().map(AccountClient.Account::getId).collect(Collectors.toList());
        List<Transaction> transfers = repo.findByAccountIdInOrderByCreatedAtDesc(accountIds).stream()
            .filter(tx -> tx.getType() == TransactionType.TRANSFER_OUT && tx.getCounterpartyAccountNumber() != null)
            .collect(Collectors.toList());

        // Count frequency per recipient
        Map<String, Long> frequency = transfers.stream()
            .collect(Collectors.groupingBy(Transaction::getCounterpartyAccountNumber, Collectors.counting()));

        // Get top 3
        List<Map<String, Object>> top3 = frequency.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .limit(3)
            .map(e -> Map.<String, Object>of("accountNumber", e.getKey(), "count", e.getValue()))
            .collect(Collectors.toList());

        return ResponseEntity.ok(top3);
    }

    private TransactionCategory parseCategory(String category) {
        if (category == null || category.isBlank()) return TransactionCategory.OTHER;
        try {
            return TransactionCategory.valueOf(category.toUpperCase());
        } catch (IllegalArgumentException e) {
            return TransactionCategory.OTHER;
        }
    }

    private String getUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth.getName();
    }

    private List<AccountClient.Account> getUserAccounts(String jwtToken) {
        try {
            AccountClient.Account[] accounts = accountClient.getAllAccounts(jwtToken);
            return accounts != null ? Arrays.asList(accounts) : Collections.emptyList();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String extractJwt(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        throw new RuntimeException("No JWT token found in request");
    }
}
