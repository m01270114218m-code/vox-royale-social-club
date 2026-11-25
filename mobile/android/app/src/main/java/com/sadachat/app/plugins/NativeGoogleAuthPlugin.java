package com.sadachat.app.plugins;

import android.app.Activity;
import android.os.Bundle;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {
    private CredentialManager credentialManager;

    @Override
    public void load() {
        super.load();
        Activity activity = getActivity();
        if (activity != null) {
            credentialManager = CredentialManager.create(activity);
        }
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        String webClientId = call.getString("webClientId", "").trim();
        if (webClientId.isEmpty()) {
            call.reject("Google Web Client ID is missing");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Android activity is unavailable");
            return;
        }

        if (credentialManager == null) {
            credentialManager = CredentialManager.create(activity);
        }

        // This is the explicit "Sign in with Google" button flow.
        // Google recommends GetSignInWithGoogleOption for a persistent sign-in
        // button because it can present the account chooser even when an
        // existing account needs re-authentication.
        String rawNonce = generateSecureRandomNonce();
        String hashedNonce;
        try {
            hashedNonce = sha256Hex(rawNonce);
        } catch (Exception error) {
            call.reject("Could not prepare secure Google sign-in nonce.", error);
            return;
        }

        GetSignInWithGoogleOption googleOption =
                new GetSignInWithGoogleOption.Builder(webClientId)
                        .setNonce(hashedNonce)
                        .build();

        GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(googleOption)
                .build();

        credentialManager.getCredentialAsync(
                activity,
                request,
                null,
                ContextCompat.getMainExecutor(activity),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        try {
                            Credential credential = response.getCredential();

                            if (!(credential instanceof CustomCredential)) {
                                call.reject("Google returned an unsupported credential type.");
                                return;
                            }

                            CustomCredential customCredential = (CustomCredential) credential;
                            if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                                    .equals(customCredential.getType())) {
                                call.reject("Google returned an unsupported credential type.");
                                return;
                            }

                            GoogleIdTokenCredential googleCredential =
                                    GoogleIdTokenCredential.createFrom(customCredential.getData());

                            String idToken = googleCredential.getIdToken();
                            if (idToken == null || idToken.isEmpty()) {
                                call.reject("Google did not return an ID token. Check the Web OAuth Client ID and Android SHA-1.");
                                return;
                            }

                            JSObject result = new JSObject();
                            result.put("idToken", idToken);
                            result.put("nonce", rawNonce);
                            call.resolve(result);
                        } catch (Exception error) {
                            call.reject("Google sign-in could not be completed: " + safeMessage(error), error);
                        }
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException error) {
                        if (error instanceof GetCredentialCancellationException) {
                            call.reject("Google account selection was cancelled.");
                        } else if (error instanceof NoCredentialException) {
                            call.reject("No Google account is available on this device. Add a Google account and try again.");
                        } else {
                            call.reject("Google sign-in failed: " + safeMessage(error), error);
                        }
                    }
                }
        );
    }

    @PluginMethod
    public void clearCredentialState(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }

        if (credentialManager == null) {
            credentialManager = CredentialManager.create(activity);
        }

        credentialManager.clearCredentialStateAsync(
                new androidx.credentials.ClearCredentialStateRequest(),
                null,
                ContextCompat.getMainExecutor(activity),
                new androidx.credentials.CredentialManagerCallback<Void, androidx.credentials.exceptions.ClearCredentialException>() {
                    @Override
                    public void onResult(Void result) {
                        call.resolve();
                    }

                    @Override
                    public void onError(@NonNull androidx.credentials.exceptions.ClearCredentialException error) {
                        // Clearing provider state is best-effort; Supabase local logout
                        // still completes even if a provider refuses the clear request.
                        call.resolve();
                    }
                }
        );
    }

    private static String generateSecureRandomNonce() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.encodeToString(
                bytes,
                Base64.NO_WRAP | Base64.URL_SAFE | Base64.NO_PADDING
        );
    }

    private static String sha256Hex(String value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder(digest.length * 2);
        for (byte b : digest) {
            out.append(String.format("%02x", b & 0xff));
        }
        return out.toString();
    }

    private static String safeMessage(Throwable error) {
        String message = error == null ? null : error.getMessage();
        return message == null || message.trim().isEmpty()
                ? error.getClass().getSimpleName()
                : message;
    }
}
