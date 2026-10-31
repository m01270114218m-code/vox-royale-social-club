# بناء تطبيق أندرويد (APK)

يتطلب جهاز كمبيوتر عليه Node.js وAndroid Studio.

1. `bun install` (أو `npm install`)
2. `npm i @capacitor/core @capacitor/cli @capacitor/android`
3. `npx cap add android`
4. `npx cap sync android`
5. `npx cap open android` ثم من Android Studio: Build → Build APK.

الملف `capacitor.config.json` يوجّه التطبيق إلى النسخة المنشورة؛ بعد النشر غيّر `server.url` إلى رابطك النهائي.
