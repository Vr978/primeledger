package com.example.account.controller;

import com.example.account.dto.AuthResponse;
import com.example.account.dto.LoginRequest;
import com.example.account.dto.RefreshTokenRequest;
import com.example.account.dto.RegisterRequest;
import com.example.account.model.RefreshToken;
import com.example.account.model.User;
import com.example.account.repository.UserRepository;
import com.example.account.security.JwtUtil;
import com.example.account.service.RefreshTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody RegisterRequest request) {
        try {
            // Check if username already exists
            if (userRepository.existsByUsername(request.getUsername())) {
                return ResponseEntity.badRequest()
                        .body(new AuthResponse(null, null, null, "Username already exists"));
            }

            // Check if email already exists
            if (userRepository.existsByEmail(request.getEmail())) {
                return ResponseEntity.badRequest()
                        .body(new AuthResponse(null, null, null, "Email already registered"));
            }

            // Create new user
            User user = new User();
            user.setUsername(request.getUsername());
            user.setPassword(passwordEncoder.encode(request.getPassword()));
            user.setEmail(request.getEmail());
            user.setRole("USER");

            User savedUser = userRepository.save(user);

            // Generate access token
            UserDetails userDetails = userDetailsService.loadUserByUsername(savedUser.getUsername());
            String accessToken = jwtUtil.generateToken(userDetails);

            // Generate refresh token
            RefreshToken refreshToken = refreshTokenService.createRefreshToken(savedUser.getId());

            return ResponseEntity.ok(
                    new AuthResponse(accessToken, refreshToken.getToken(),
                            savedUser.getUsername(),
                            "User registered successfully. You can now create accounts."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new AuthResponse(null, null, null, "Registration failed: " + e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody LoginRequest request) {
        try {
            // Authenticate user
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsername(),
                            request.getPassword()));

            // Load user details
            UserDetails userDetails = userDetailsService.loadUserByUsername(request.getUsername());
            User user = userRepository.findByUsername(request.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // Generate new access token
            String accessToken = jwtUtil.generateToken(userDetails);

            // Generate new refresh token
            RefreshToken refreshToken = refreshTokenService.createRefreshToken(user.getId());

            return ResponseEntity.ok(
                    new AuthResponse(accessToken, refreshToken.getToken(),
                            userDetails.getUsername(), "Login successful"));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthResponse(null, null, null, "Invalid username or password"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new AuthResponse(null, null, null, "Login failed: " + e.getMessage()));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody RefreshTokenRequest request) {
        try {
            String requestRefreshToken = request.getRefreshToken();

            // Find and validate refresh token
            RefreshToken refreshToken = refreshTokenService.findByToken(requestRefreshToken)
                    .orElseThrow(() -> new RuntimeException("Refresh token not found"));

            // Verify it's not expired or revoked
            refreshTokenService.verifyExpiration(refreshToken);

            // Get user and generate new access token
            User user = userRepository.findById(refreshToken.getUserId())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
            String newAccessToken = jwtUtil.generateToken(userDetails);

            return ResponseEntity.ok(
                    new AuthResponse(newAccessToken, requestRefreshToken,
                            user.getUsername(), "Token refreshed successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthResponse(null, null, null, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new AuthResponse(null, null, null, "Token refresh failed: " + e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestBody RefreshTokenRequest request) {
        try {
            // Revoke the refresh token
            refreshTokenService.revokeToken(request.getRefreshToken());

            return ResponseEntity.ok()
                    .body(new AuthResponse(null, null, null,
                            "Logged out successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new AuthResponse(null, null, null,
                            "Logout failed: " + e.getMessage()));
        }
    }

    @PostMapping("/logout-all")
    public ResponseEntity<?> logoutFromAllDevices() {
        try {
            // Get authenticated user
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String username = authentication.getName();

            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // Revoke all refresh tokens for this user
            refreshTokenService.revokeAllUserTokens(user.getId());

            return ResponseEntity.ok()
                    .body(new AuthResponse(null, null, null,
                            "Logged out from all devices successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new AuthResponse(null, null, null,
                            "Logout failed: " + e.getMessage()));
        }
    }
}
