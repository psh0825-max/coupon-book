# Web calls window.AndroidBridge (MainActivity adds WebAppBridge via addJavascriptInterface);
# keep every @JavascriptInterface method and its exact name. Manifest components are kept by
# AAPT rules; AndroidX and play-services-ads provide their own consumer rules.
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep source locations readable when Play uses the R8 mapping file to deobfuscate crashes.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
