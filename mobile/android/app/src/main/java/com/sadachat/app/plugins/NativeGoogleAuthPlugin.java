package com.sadachat.app.plugins;

import android.app.Activity;
import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {
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

        GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestIdToken(webClientId)
                .build();
        GoogleSignIn.getClient(activity, options).signOut()
                .addOnCompleteListener(activity, ignored -> {
                    try {
                        Intent chooser = GoogleSignIn.getClient(activity, options).getSignInIntent();
                        startActivityForResult(call, chooser, "googleSignInResult");
                    } catch (Exception error) {
                        call.reject("Could not open Google account chooser: " + error.getMessage(), error);
                    }
                });
    }

    @ActivityCallback
    private void googleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Google account selection was cancelled or could not be opened");
            return;
        }
        try {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());
            GoogleSignInAccount account = task.getResult(ApiException.class);
            String idToken = account.getIdToken();
            if (idToken == null || idToken.isEmpty()) {
                call.reject("Google did not return an ID token. Check the Web OAuth client ID and Android SHA-1.");
                return;
            }
            JSObject response = new JSObject();
            response.put("idToken", idToken);
            call.resolve(response);
        } catch (ApiException error) {
            call.reject("Google sign-in failed (" + error.getStatusCode() + "): " + error.getMessage(), error);
        } catch (Exception error) {
            call.reject("Google sign-in could not be completed: " + error.getMessage(), error);
        }
    }
}
