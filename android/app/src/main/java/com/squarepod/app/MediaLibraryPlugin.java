package com.squarepod.app;

import android.Manifest;
import android.content.ContentUris;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Size;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

@CapacitorPlugin(
    name = "MediaLibrary",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_MEDIA_IMAGES }, alias = "images"),
        @Permission(strings = { Manifest.permission.READ_MEDIA_VIDEO }, alias = "videos"),
        @Permission(strings = { Manifest.permission.READ_EXTERNAL_STORAGE }, alias = "storage")
    }
)
public class MediaLibraryPlugin extends Plugin {
    @PluginMethod
    public void scanMedia(PluginCall call) {
        if (!hasMediaPermission()) {
            requestPermissionForAliases(permissionAliases(), call, "scanMediaPermissionCallback");
            return;
        }

        call.resolve(scanPayload());
    }

    @PermissionCallback
    private void scanMediaPermissionCallback(PluginCall call) {
        if (!hasMediaPermission()) {
            call.reject("Media library permission denied.");
            return;
        }

        call.resolve(scanPayload());
    }

    private boolean hasMediaPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return getPermissionState("images") == PermissionState.GRANTED
                && getPermissionState("videos") == PermissionState.GRANTED;
        }
        return getPermissionState("storage") == PermissionState.GRANTED;
    }

    private String[] permissionAliases() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return new String[] { "images", "videos" };
        }
        return new String[] { "storage" };
    }

    private JSObject scanPayload() {
        JSObject payload = new JSObject();
        payload.put("photos", scanImages());
        payload.put("videos", scanVideos());
        return payload;
    }

    private JSArray scanImages() {
        JSArray items = new JSArray();
        String[] projection = {
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
            MediaStore.Images.Media.MIME_TYPE,
            MediaStore.Images.Media.WIDTH,
            MediaStore.Images.Media.HEIGHT,
            MediaStore.Images.Media.DATE_TAKEN,
            MediaStore.Images.Media.DATE_ADDED,
        };

        try (Cursor cursor = getContext().getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            null,
            null,
            MediaStore.Images.Media.DATE_TAKEN + " DESC, " + MediaStore.Images.Media.DATE_ADDED + " DESC"
        )) {
            if (cursor == null) return items;
            while (cursor.moveToNext()) {
                long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
                Uri uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                JSObject item = new JSObject();
                item.put("id", "photo_" + id);
                item.put("uri", uri.toString());
                item.put("title", stringColumn(cursor, MediaStore.Images.Media.DISPLAY_NAME, "Photo"));
                item.put("kind", "photo");
                item.put("bucket", stringColumn(cursor, MediaStore.Images.Media.BUCKET_DISPLAY_NAME, ""));
                item.put("mimeType", stringColumn(cursor, MediaStore.Images.Media.MIME_TYPE, ""));
                item.put("width", intColumn(cursor, MediaStore.Images.Media.WIDTH));
                item.put("height", intColumn(cursor, MediaStore.Images.Media.HEIGHT));
                item.put("dateTaken", longColumn(cursor, MediaStore.Images.Media.DATE_TAKEN));
                item.put("dateAdded", longColumn(cursor, MediaStore.Images.Media.DATE_ADDED));
                String thumbnailUri = cacheImageThumbnail(id, uri);
                if (thumbnailUri != null) {
                    item.put("thumbnailUri", thumbnailUri);
                }
                items.put(item);
            }
        } catch (Exception ignored) {
            return items;
        }

        return items;
    }

    private JSArray scanVideos() {
        JSArray items = new JSArray();
        String[] projection = {
            MediaStore.Video.Media._ID,
            MediaStore.Video.Media.DISPLAY_NAME,
            MediaStore.Video.Media.BUCKET_DISPLAY_NAME,
            MediaStore.Video.Media.MIME_TYPE,
            MediaStore.Video.Media.WIDTH,
            MediaStore.Video.Media.HEIGHT,
            MediaStore.Video.Media.DURATION,
            MediaStore.Video.Media.DATE_TAKEN,
            MediaStore.Video.Media.DATE_ADDED,
        };

        try (Cursor cursor = getContext().getContentResolver().query(
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
            projection,
            null,
            null,
            MediaStore.Video.Media.DATE_TAKEN + " DESC, " + MediaStore.Video.Media.DATE_ADDED + " DESC"
        )) {
            if (cursor == null) return items;
            while (cursor.moveToNext()) {
                long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID));
                Uri uri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id);
                JSObject item = new JSObject();
                item.put("id", "video_" + id);
                item.put("uri", uri.toString());
                item.put("title", stringColumn(cursor, MediaStore.Video.Media.DISPLAY_NAME, "Video"));
                item.put("kind", "video");
                item.put("bucket", stringColumn(cursor, MediaStore.Video.Media.BUCKET_DISPLAY_NAME, ""));
                item.put("mimeType", stringColumn(cursor, MediaStore.Video.Media.MIME_TYPE, ""));
                item.put("width", intColumn(cursor, MediaStore.Video.Media.WIDTH));
                item.put("height", intColumn(cursor, MediaStore.Video.Media.HEIGHT));
                item.put("duration", longColumn(cursor, MediaStore.Video.Media.DURATION));
                item.put("dateTaken", longColumn(cursor, MediaStore.Video.Media.DATE_TAKEN));
                item.put("dateAdded", longColumn(cursor, MediaStore.Video.Media.DATE_ADDED));
                String thumbnailUri = cacheVideoThumbnail(id, uri);
                if (thumbnailUri != null) {
                    item.put("thumbnailUri", thumbnailUri);
                }
                items.put(item);
            }
        } catch (Exception ignored) {
            return items;
        }

        return items;
    }

    private String cacheImageThumbnail(long imageId, Uri imageUri) {
        File thumbnailDir = new File(getContext().getCacheDir(), "media_photo_thumbnails");
        if (!thumbnailDir.exists() && !thumbnailDir.mkdirs()) return null;

        File thumbnailFile = new File(thumbnailDir, "photo_" + imageId + ".jpg");
        if (thumbnailFile.exists() && thumbnailFile.length() > 0) {
            return Uri.fromFile(thumbnailFile).toString();
        }

        Bitmap bitmap = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                bitmap = getContext().getContentResolver().loadThumbnail(imageUri, new Size(384, 384), null);
            } else {
                bitmap = MediaStore.Images.Thumbnails.getThumbnail(
                    getContext().getContentResolver(),
                    imageId,
                    MediaStore.Images.Thumbnails.MINI_KIND,
                    null
                );
            }

            if (bitmap == null) return null;

            try (FileOutputStream output = new FileOutputStream(thumbnailFile)) {
                bitmap.compress(Bitmap.CompressFormat.JPEG, 82, output);
            }

            return Uri.fromFile(thumbnailFile).toString();
        } catch (IOException | RuntimeException error) {
            return null;
        } finally {
            if (bitmap != null && !bitmap.isRecycled()) {
                bitmap.recycle();
            }
        }
    }

    private String stringColumn(Cursor cursor, String column, String fallback) {
        int index = cursor.getColumnIndex(column);
        if (index < 0 || cursor.isNull(index)) return fallback;
        String value = cursor.getString(index);
        return value == null || value.isEmpty() ? fallback : value;
    }

    private int intColumn(Cursor cursor, String column) {
        int index = cursor.getColumnIndex(column);
        return index < 0 || cursor.isNull(index) ? 0 : cursor.getInt(index);
    }

    private long longColumn(Cursor cursor, String column) {
        int index = cursor.getColumnIndex(column);
        return index < 0 || cursor.isNull(index) ? 0 : cursor.getLong(index);
    }

    private String cacheVideoThumbnail(long videoId, Uri videoUri) {
        File thumbnailDir = new File(getContext().getCacheDir(), "media_video_thumbnails");
        if (!thumbnailDir.exists() && !thumbnailDir.mkdirs()) return null;

        File thumbnailFile = new File(thumbnailDir, "video_" + videoId + ".jpg");
        if (thumbnailFile.exists() && thumbnailFile.length() > 0) {
            return Uri.fromFile(thumbnailFile).toString();
        }

        Bitmap bitmap = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                bitmap = getContext().getContentResolver().loadThumbnail(videoUri, new Size(512, 512), null);
            } else {
                bitmap = MediaStore.Video.Thumbnails.getThumbnail(
                    getContext().getContentResolver(),
                    videoId,
                    MediaStore.Video.Thumbnails.MINI_KIND,
                    null
                );
            }

            if (bitmap == null) return null;

            try (FileOutputStream output = new FileOutputStream(thumbnailFile)) {
                bitmap.compress(Bitmap.CompressFormat.JPEG, 82, output);
            }

            return Uri.fromFile(thumbnailFile).toString();
        } catch (IOException | RuntimeException error) {
            return null;
        } finally {
            if (bitmap != null && !bitmap.isRecycled()) {
                bitmap.recycle();
            }
        }
    }
}
