# Mantem a ponte JavaScript <-> Java (window.Android.*)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
