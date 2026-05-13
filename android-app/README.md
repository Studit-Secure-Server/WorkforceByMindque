# Workforce By Mindque Android APK

This is a simple Android WebView wrapper for:

`https://workforce.mindqueindia.com/`

## Build APK

Open this `android-app` folder in Android Studio, let Gradle sync, then use:

`Build > Build Bundle(s) / APK(s) > Build APK(s)`

The debug APK will be generated at:

`app/build/outputs/apk/debug/app-debug.apk`

## Command Line

After installing Android Studio / Android SDK:

```sh
cd android-app
./gradlew assembleDebug
```

## Notes

- Package name: `com.mindqueindia.workforce`
- App name: `Workforce By Mindque`
- Permissions: Internet, Camera, Location
