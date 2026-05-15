package com.squarepod.app;

import android.app.Activity;
import android.content.Intent;
import android.text.TextUtils;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.reflect.Method;

@CapacitorPlugin(name = "AppleMusicAuth")
public class AppleMusicAuthPlugin extends Plugin {
    private static final String TAG = "AppleMusicAuth";
    private static final String AUTH_FACTORY_CLASS = "com.apple.android.sdk.authentication.AuthenticationFactory";
    private static final String APPLE_MUSIC_PACKAGE = "com.apple.android.music";

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject response = new JSObject();
        response.put("musicKitAvailable", isMusicKitAvailable());
        response.put("appleMusicInstalled", isAppleMusicInstalled());
        response.put("appleMusicPackage", APPLE_MUSIC_PACKAGE);
        call.resolve(response);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        String developerToken = call.getString("developerToken");
        if (TextUtils.isEmpty(developerToken)) {
            call.reject("Missing Apple Music developer token.");
            return;
        }

        try {
            Object authManager = createAuthenticationManager();
            Object builder = authManager
                .getClass()
                .getMethod("createIntentBuilder", String.class)
                .invoke(authManager, developerToken);

            String startScreenMessage = call.getString(
                "startScreenMessage",
                "Sign in to Apple Music to manage your library in SquarePod."
            );
            invokeOptional(builder, "setStartScreenMessage", new Class<?>[] { String.class }, startScreenMessage);
            invokeOptional(builder, "setHideStartScreen", new Class<?>[] { boolean.class }, true);

            Intent intent = (Intent) builder.getClass().getMethod("build").invoke(builder);
            startActivityForResult(call, intent, "handleAuthResult");
        } catch (ClassNotFoundException error) {
            call.reject("Apple MusicKit Android SDK is missing. Put the official MusicKit AAR files in android/app/libs.");
        } catch (Exception error) {
            call.reject("Unable to start Apple Music sign-in: " + rootMessage(error));
        }
    }

    @ActivityCallback
    private void handleAuthResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        try {
            Log.d(TAG, "handleAuthResult resultCode=" + result.getResultCode() + ", hasData=" + (result.getData() != null));
            Object authManager = createAuthenticationManager();
            Object tokenResult = authManager
                .getClass()
                .getMethod("handleTokenResult", Intent.class)
                .invoke(authManager, result.getData());

            boolean isError = (boolean) tokenResult.getClass().getMethod("isError").invoke(tokenResult);
            if (isError) {
                Object tokenError = tokenResult.getClass().getMethod("getError").invoke(tokenResult);
                call.reject("Apple Music sign-in failed: " + String.valueOf(tokenError));
                return;
            }

            String musicUserToken = (String) tokenResult.getClass().getMethod("getMusicUserToken").invoke(tokenResult);
            if (TextUtils.isEmpty(musicUserToken)) {
                call.reject("Apple Music returned an empty user token.");
                return;
            }

            JSObject response = new JSObject();
            response.put("userToken", musicUserToken);
            call.resolve(response);
        } catch (ClassNotFoundException error) {
            call.reject("Apple MusicKit Android SDK is missing. Put the official MusicKit AAR files in android/app/libs.");
        } catch (Exception error) {
            call.reject("Unable to finish Apple Music sign-in: " + rootMessage(error));
        }
    }

    private Object createAuthenticationManager() throws Exception {
        Class<?> factoryClass = Class.forName(AUTH_FACTORY_CLASS);
        Method method = factoryClass.getMethod("createAuthenticationManager", android.content.Context.class);
        return method.invoke(null, getContext());
    }

    private boolean isMusicKitAvailable() {
        try {
            Class.forName(AUTH_FACTORY_CLASS);
            return true;
        } catch (ClassNotFoundException error) {
            return false;
        }
    }

    private boolean isAppleMusicInstalled() {
        return getContext().getPackageManager().getLaunchIntentForPackage(APPLE_MUSIC_PACKAGE) != null;
    }

    private void invokeOptional(Object target, String methodName, Class<?>[] types, Object... args) {
        try {
            target.getClass().getMethod(methodName, types).invoke(target, args);
        } catch (Exception ignored) {
            // Older SDK builds can omit optional AuthIntentBuilder setters.
        }
    }

    private String rootMessage(Exception error) {
        Throwable root = error;
        while (root.getCause() != null) {
            root = root.getCause();
        }
        return root.getMessage() != null ? root.getMessage() : root.getClass().getSimpleName();
    }
}
