# VOX Admin — تطبيق أندرويد مستقل للوحة التحكم

هذا التطبيق يغلّف صفحة `admin-panel` نفسها، وهي لوحة إدارة حقيقية متصلة بمشروع Supabase الحالي. لا يحتاج إلى قاعدة بيانات منفصلة.

## البناء

من مجلد `admin-app`:

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
```

ثم من Android Studio اختر **Build APK**.

- صفحة الإدارة المضمّنة: `../admin-panel/index.html`
- مشروع Supabase: `gxkdptwkyhwbxyaspagd`
- يستخدم التطبيق مفتاح Publishable العام فقط؛ لا تضع مفتاح `service_role` في أي تطبيق أو صفحة ويب.
- تسجيل الدخول وصلاحيات المشرف والتحقق من كل عملية تتم عبر Supabase Auth وRPC وRLS.
