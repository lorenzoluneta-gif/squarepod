package com.squarepod.app;

import android.graphics.Rect;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import java.util.Collections;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppleMusicAuthPlugin.class);
        registerPlugin(AppleMusicPlayerPlugin.class);
        registerPlugin(DeviceStatusPlugin.class);
        registerPlugin(LocalMusicPlugin.class);
        registerPlugin(MediaLibraryPlugin.class);
        registerPlugin(RadioPlugin.class);
        registerPlugin(ScreenAwakePlugin.class);
        registerPlugin(SpotifyRemotePlugin.class);
        registerPlugin(VoiceMemosPlugin.class);
        registerPlugin(WheelHapticsPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                enableImmersiveFullscreen();
            }
        });
        enableImmersiveFullscreen();
        installSystemGestureExclusion();
    }

    @Override
    public void onResume() {
        super.onResume();
        enableImmersiveFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveFullscreen();
            installSystemGestureExclusion();
        }
    }

    private void installSystemGestureExclusion() {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.Q) return;

        View root = getWindow().getDecorView();
        root.post(() -> {
            Rect fullScreen = new Rect(0, 0, root.getWidth(), root.getHeight());
            root.setSystemGestureExclusionRects(Collections.singletonList(fullScreen));
        });

        root.addOnLayoutChangeListener((view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
            Rect fullScreen = new Rect(0, 0, right - left, bottom - top);
            view.setSystemGestureExclusionRects(Collections.singletonList(fullScreen));
        });
    }

    private void enableImmersiveFullscreen() {
        Window window = getWindow();
        window.setDecorFitsSystemWindows(false);
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        }
    }
}
