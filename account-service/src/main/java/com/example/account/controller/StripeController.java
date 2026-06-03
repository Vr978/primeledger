package com.example.account.controller;

import com.example.account.model.Account;
import com.example.account.model.User;
import com.example.account.repository.AccountRepository;
import com.example.account.repository.UserRepository;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import javax.annotation.PostConstruct;
import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/payments")
public class StripeController {

    @Value("${stripe.secret-key:sk_test_placeholder}")
    private String stripeSecretKey;

    @Value("${stripe.webhook-secret:whsec_placeholder}")
    private String webhookSecret;

    @Value("${stripe.success-url:http://localhost:3000/?deposit=success}")
    private String successUrl;

    @Value("${stripe.cancel-url:http://localhost:3000/?deposit=cancelled}")
    private String cancelUrl;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void init() {
        Stripe.apiKey = stripeSecretKey;
    }

    /**
     * Creates a Stripe Checkout Session for depositing money into the wallet.
     * Frontend redirects user to the returned URL.
     */
    @PostMapping("/create-checkout-session")
    public ResponseEntity<?> createCheckoutSession(@RequestBody Map<String, Object> request) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String email = auth.getName();

            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // Get amount in cents (Stripe uses smallest currency unit)
            double amount = Double.parseDouble(request.get("amount").toString());
            long amountCents = (long) (amount * 100);

            if (amountCents < 50) {
                return ResponseEntity.badRequest().body(Map.of("error", "Minimum deposit is $0.50"));
            }

            // Get user's account ID for metadata
            Account wallet = accountRepository.findByUserId(user.getId()).stream()
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Wallet not found"));

            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(successUrl + "&session_id={CHECKOUT_SESSION_ID}")
                    .setCancelUrl(cancelUrl)
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setQuantity(1L)
                            .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                    .setCurrency("usd")
                                    .setUnitAmount(amountCents)
                                    .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                            .setName("Wallet Deposit")
                                            .setDescription("Add $" + String.format("%.2f", amount) + " to your PrimeLedger wallet")
                                            .build())
                                    .build())
                            .build())
                    .putMetadata("userId", user.getId().toString())
                    .putMetadata("accountId", wallet.getId().toString())
                    .putMetadata("amount", String.valueOf(amount))
                    .build();

            Session session = Session.create(params);

            return ResponseEntity.ok(Map.of("url", session.getUrl(), "sessionId", session.getId()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to create checkout session: " + e.getMessage()));
        }
    }

    /**
     * Verify a completed Stripe session and credit the wallet.
     * Called by frontend when returning from Stripe checkout.
     */
    @PostMapping("/verify-session")
    public ResponseEntity<?> verifySession(@RequestBody Map<String, String> request) {
        try {
            String sessionId = request.get("sessionId");
            if (sessionId == null || sessionId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Session ID required"));
            }

            Session session = Session.retrieve(sessionId);

            if ("complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())) {
                String accountIdStr = session.getMetadata().get("accountId");
                String amountStr = session.getMetadata().get("amount");

                if (accountIdStr != null && amountStr != null) {
                    Long accountId = Long.parseLong(accountIdStr);
                    BigDecimal amount = new BigDecimal(amountStr);

                    Account account = accountRepository.findById(accountId).orElse(null);
                    if (account != null) {
                        account.setBalance(account.getBalance().add(amount));
                        accountRepository.save(account);

                        // Also record the deposit transaction directly in the transaction table
                        // (same database, shared by both services)
                        jdbcTemplate.update(
                            "INSERT INTO transaction (account_id, amount, type, category, description, created_at) VALUES (?, ?, 'DEPOSIT', 'OTHER', ?, NOW())",
                            accountId, amount, "Stripe deposit"
                        );

                        return ResponseEntity.ok(Map.of(
                                "message", "Deposit successful",
                                "amount", amount,
                                "newBalance", account.getBalance()
                        ));
                    }
                }
            }

            return ResponseEntity.badRequest().body(Map.of("error", "Payment not completed"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Stripe webhook - called by Stripe when payment is completed.
     * Credits the wallet after successful payment.
     */
    @PostMapping("/webhook")
    public ResponseEntity<?> handleWebhook(@RequestBody String payload,
                                           @RequestHeader("Stripe-Signature") String sigHeader) {
        try {
            Event event;
            try {
                event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
            } catch (SignatureVerificationException e) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
            }

            if ("checkout.session.completed".equals(event.getType())) {
                Session session = (Session) event.getDataObjectDeserializer()
                        .getObject().orElse(null);

                if (session != null) {
                    String accountIdStr = session.getMetadata().get("accountId");
                    String amountStr = session.getMetadata().get("amount");

                    if (accountIdStr != null && amountStr != null) {
                        Long accountId = Long.parseLong(accountIdStr);
                        BigDecimal amount = new BigDecimal(amountStr);

                        Account account = accountRepository.findById(accountId).orElse(null);
                        if (account != null) {
                            account.setBalance(account.getBalance().add(amount));
                            accountRepository.save(account);

                            jdbcTemplate.update(
                                "INSERT INTO transaction (account_id, amount, type, category, description, created_at) VALUES (?, ?, 'DEPOSIT', 'OTHER', ?, NOW())",
                                accountId, amount, "Stripe deposit"
                            );
                        }
                    }
                }
            }

            return ResponseEntity.ok(Map.of("received", true));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Simulated deposit - for when Stripe keys aren't configured (demo/development).
     * Falls back to direct balance credit.
     */
    @PostMapping("/deposit-direct")
    public ResponseEntity<?> depositDirect(@RequestBody Map<String, Object> request) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String email = auth.getName();

            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            double amount = Double.parseDouble(request.get("amount").toString());
            if (amount <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Amount must be positive"));
            }

            Account wallet = accountRepository.findByUserId(user.getId()).stream()
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Wallet not found"));

            wallet.setBalance(wallet.getBalance().add(BigDecimal.valueOf(amount)));
            accountRepository.save(wallet);

            // Record transaction
            jdbcTemplate.update(
                "INSERT INTO transaction (account_id, amount, type, category, description, created_at) VALUES (?, ?, 'DEPOSIT', 'OTHER', ?, NOW())",
                wallet.getId(), BigDecimal.valueOf(amount), "Direct deposit"
            );

            return ResponseEntity.ok(Map.of(
                    "message", "Deposit successful",
                    "newBalance", wallet.getBalance(),
                    "amount", amount
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
