# تطبيق أندرويد — صدى شات (SadaChat)

مشروع أندرويد حقيقي (Android Studio / Gradle) مبني بـ Capacitor. معرّف التطبيق: `com.sadachat.app`.

## 1) ربط Supabase
1. أنشئ مشروعاً جديداً في Supabase.
2. افتح SQL Editor والصق محتوى الملف `supabase/schema.sql` كاملاً ثم شغّله مرة واحدة.
3. من Authentication ← Providers فعّل Email (وأي طريقة أخرى تريدها).
4. انسخ `.env.example` إلى `.env` وضع رابط المشروع والمفتاح العام (Project Settings ← API).
5. سجّل حساباً من التطبيق، ثم شغّل السطر الأخير في `supabase/schema.sql` ببريدك لتصبح مسؤولاً.

## 2) البناء على GitHub (بدون كمبيوتر)
1. ارفع هذا المجلد إلى مستودع GitHub (الفرع `main`).
2. من Settings ← Secrets and variables ← Actions أضف الأسرار الثلاثة:
   `VITE_SUPABASE_URL` و `VITE_SUPABASE_PUBLISHABLE_KEY` و `VITE_SUPABASE_PROJECT_ID`.
3. افتح تبويب Actions ← Build Android APK ← Run workflow.
4. بعد انتهائه حمّل الملف `sada-chat-apk` من أسفل صفحة التشغيل (Artifacts).

## 3) البناء على جهازك
يلزم Node.js 22 و JDK 21 و Android SDK (يأتيان مع Android Studio):
```bash
bash mobile/build-android.sh
```
الناتج: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`

## نسخة للنشر على Google Play
افتح `mobile/android` في Android Studio ← Build ← Generate Signed Bundle / APK وأنشئ مفتاح توقيع واحفظه جيداً.

## ملاحظات مهمة
- الدخول بالبريد وكلمة السر يعمل مباشرة مع Supabase. زر Google يعتمد على خدمة Lovable ويحتاج إعداداً خاصاً داخل تطبيق الأندرويد، لذلك لا يعمل في الـ APK كما هو.
- فيديو خلفية صفحة الدخول يُحمَّل فقط إذا ضبطت المتغير `SITE_URL` على رابط موقعك المنشور؛ بدونه تظهر صورة ثابتة.
- الصوت الحي بين المستخدمين في الغرف يحتاج خدمة صوت (مثل Agora أو LiveKit) وغير مفعّل بعد.
