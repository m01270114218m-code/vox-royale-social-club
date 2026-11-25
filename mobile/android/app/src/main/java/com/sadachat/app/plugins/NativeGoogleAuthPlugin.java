package com.sadachat.app.plugins;

import android.app.Activity;
import android.os.Bundle;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.security.SecureRandom;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {
    private final Executor executor = Executors.newSingleThreadExecutor();
    private CredentialManager credentialManager;

    @Override
    public void load() {
        credentialManager = CredentialManager.create(getContext());
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        final String webClientId = call.getString("webClientId", "").trim();
        if (webClientId.isEmpty()) {
            call.reject("Google Web Client ID is missing");
            return;
        }

        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Android activity is unavailable");
            return;
        }

        // Always show the account chooser; do not silently auto-select a previously authorized account.
        requestCredential(call, activity, webClientId, false);
    }

    private void requestCredential(
            final PluginCall call,
            final Activity activity,
            final String webClientId,
            final boolean authorizedOnly
    ) {
        final String nonce = generateNonce();

        final GetGoogleIdOption option = new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(webClientId)
                .setAutoSelectEnabled(false)
                .setNonce(nonce)
                .build();

        final GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(option)
                .build();

        credentialManager.getCredentialAsync(
                activity,
                request,
                null,
                executor,
                new androidx.credentials.CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(@NonNull GetCredentialResponse result) {
                        handleCredential(call, result, nonce);
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException error) {
                        if (authorizedOnly && error instanceof NoCredentialException) {
                            requestCredential(call, activity, webClientId, false);
                        } else {
                            call.reject("Google sign-in failed: " + error.getMessage());
                        }
                    }
                }
        );
    }

    private void handleCredential(PluginCall call, GetCredentialResponse result, String nonce) {
        try {
            Credential credential = result.getCredential();

            if (!(credential instanceof CustomCredential)) {
                call.reject("Google credential was not returned");
                return;
            }

            CustomCredential customCredential = (CustomCredential) credential;
            if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(customCredential.getType())) {
                call.reject("Unexpected Google credential type");
                return;
            }

            Bundle data = customCredential.getData();
            GoogleIdTokenCredential googleCredential = GoogleIdTokenCredential.createFrom(data);

            JSObject response = new JSObject();
            response.put("idToken", googleCredential.getIdToken());
            response.put("nonce", nonce);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Google sign-in could not be completed", error);
        }
    }

    private static String generateNonce() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }
}
