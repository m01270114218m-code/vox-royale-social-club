# تطبيق لوحة التحكم (VOX Admin) — تطبيق أندرويد منفصل

تطبيق مستقل يفتح لوحة التحكم مباشرة ويتصل بنفس قاعدة البيانات الحقيقية.
الصلاحيات تُتحقق على الخادم: فقط المشرفون يستطيعون الإدارة.

1. من داخل مجلد `admin-app`: `npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/android`
2. `npx cap add android && npx cap sync android`
3. `npx cap open android` ثم Build → Build APK.

بعد النشر غيّر `server.url` إلى `https://رابطك/admin`.
