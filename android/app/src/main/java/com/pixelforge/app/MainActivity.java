package com.pixelforge.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;

public class MainActivity extends Activity {
    private static final String HOST = "pixelforge-brz.pages.dev";
    private static final int REQ_FILE = 1;
    private static final int INK = 0xFF16143A;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private OutputStream out;
    private Uri pendingUri;
    private String pendingName = "";

    // Blob/data downloads (every Download button in the site) do not work inside a WebView,
    // so every <a download> click is read in JS and streamed to Downloads/PixelForge.
    private static final String HOOK =
        "(function(){if(window.__pfHook)return;window.__pfHook=1;" +
        "var orig=HTMLAnchorElement.prototype.click;" +
        "HTMLAnchorElement.prototype.click=function(){var a=this,h=a.href||'';" +
        "if(a.hasAttribute('download')&&(h.indexOf('blob:')===0||h.indexOf('data:')===0)){" +
        "fetch(h).then(function(r){return r.blob();}).then(function(b){" +
        "PFAndroid.begin(a.getAttribute('download')||'download',b.type||'application/octet-stream');" +
        "var CH=786432,i=0;(function next(){if(i>=b.size){PFAndroid.end();return;}" +
        "var fr=new FileReader();fr.onload=function(){PFAndroid.chunk(String(fr.result).split(',')[1]);next();};" +
        "fr.readAsDataURL(b.slice(i,i+CH));i+=CH;})();" +
        "}).catch(function(e){PFAndroid.fail(String(e));});return;}" +
        "return orig.call(this);};})();";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(INK);
        getWindow().setNavigationBarColor(INK);
        getWindow().setBackgroundDrawable(new ColorDrawable(INK));
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        web = new WebView(this);
        web.setBackgroundColor(INK);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        // Cloudflare Access / Google sign-in must run inside the app so the session cookie lands here
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "PFAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                if (scheme.equals("blob") || scheme.equals("data") || scheme.equals("about")) return true;
                String host = u.getHost() == null ? "" : u.getHost();
                // only the TeePublic upload page goes to the browser; everything else (incl. login) stays in the app
                if (!host.endsWith("teepublic.com")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                view.evaluateJavascript(HOOK, null);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(HOOK, null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.loadUrl("https://" + HOST + "/");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private void toast(final String msg) {
        runOnUiThread(new Runnable() {
            @Override public void run() { Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show(); }
        });
    }

    private class Bridge {
        @JavascriptInterface
        public void begin(String name, String mime) {
            try {
                closeQuietly();
                ContentResolver cr = getContentResolver();
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime);
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/PixelForge");
                v.put(MediaStore.Downloads.IS_PENDING, 1);
                pendingUri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                out = cr.openOutputStream(pendingUri);
                pendingName = name;
            } catch (Exception e) {
                out = null;
                toast("Save failed: " + e.getMessage());
            }
        }

        @JavascriptInterface
        public void chunk(String b64) {
            try {
                if (out != null) out.write(Base64.decode(b64, Base64.DEFAULT));
            } catch (Exception e) {
                closeQuietly();
                toast("Save failed: " + e.getMessage());
            }
        }

        @JavascriptInterface
        public void end() {
            try {
                if (out == null) return;
                out.close();
                out = null;
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.IS_PENDING, 0);
                getContentResolver().update(pendingUri, v, null, null);
                toast("Saved to Downloads/PixelForge: " + pendingName);
            } catch (Exception e) {
                toast("Save failed: " + e.getMessage());
            }
        }

        @JavascriptInterface
        public void fail(String msg) { toast("Save failed: " + msg); }
    }

    private void closeQuietly() {
        try { if (out != null) out.close(); } catch (Exception ignored) { }
        out = null;
    }
}
