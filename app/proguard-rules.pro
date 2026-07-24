# A ponte JS↔nativo é resolvida por reflexão pelo WebView: os métodos
# anotados com @JavascriptInterface NUNCA podem ser renomeados/removidos.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class br.org.iasd.av.NativeBridge { *; }
