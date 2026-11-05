# VOX ROYALE ADMIN CONTROL CENTER

لوحة تحكم ويب خارجية مستقلة عن تطبيق Android. لا توجد لوحة إدارة داخل تطبيق المستخدم.

## البناء المحلي
من جذر المستودع:
```bash
npm install
npm run admin:build
```
الناتج في `admin-app/dist`.

## Supabase
اللوحة تستخدم مشروع Supabase المشار إليه في `admin-app/.env.production` باستخدام Project URL وPublishable key فقط. لا تضع `service_role` أو `sb_secret` في المتصفح.

تسجيل الدخول يتطلب حساب Supabase Auth ودوراً مصرحاً به في `public.admin_roles`. عمليات الإدارة تخضع لسياسات RLS؛ وجود شاشة أو زر لا يعني أن العملية مسموحة. المحفظة وأدوار المشرفين للعرض فقط في النسخة الحالية. لا تعتبر آلية تفعيل أول مشرف جاهزة قبل اختبار RPC `claim_first_admin` وسياسات الجدول.

## النشر
ملف GitHub Actions في `.github/workflows/admin-console.yml` يحاول بناء اللوحة ونشرها إلى GitHub Pages عند الدفع إلى فرع `external-admin-console`. يلزم تفعيل GitHub Pages لمصدر GitHub Actions في إعدادات المستودع. لم يتم تأكيد نشر حي حتى الآن.
