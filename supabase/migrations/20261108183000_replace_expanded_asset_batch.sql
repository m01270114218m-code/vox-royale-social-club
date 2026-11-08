-- Replace only the batch introduced by 20261108180000; preserve the older catalog.
update public.store_items set sort_order=sort_order where asset_key in (
  'frame-7','frame-8','frame-9','frame-10','frame-11-animated','frame-12-animated','frame-13-animated','frame-14-animated','frame-15-animated','frame-16-animated','frame-17','frame-18','frame-19','frame-20-animated',
  'entry-star','entry-diamond','entry-castle','entry-rocket-animated','entry-dragon-animated','entry-diamond-animated'
);
delete from public.store_items where asset_key in (
  'frame-7','frame-8','frame-9','frame-10','frame-11-animated','frame-12-animated','frame-13-animated','frame-14-animated','frame-15-animated','frame-16-animated','frame-17','frame-18','frame-19','frame-20-animated',
  'entry-star','entry-diamond','entry-castle','entry-rocket-animated','entry-dragon-animated','entry-diamond-animated'
);

insert into public.store_items(kind,name,description,price,asset_key,sort_order) values
('frame','إطار الياقوت الملكي','إطار فاخر جديد لصورة الحساب',1800,'frame-new-1',101),
('frame','إطار الفارس الأزرق','إطار معدني مميز لصورة الحساب',2600,'frame-new-2',102),
('frame','إطار اللؤلؤ الملكي','إطار لؤلؤي فاخر لصورة الحساب',3400,'frame-new-3',103),
('frame','إطار النخبة','إطار ذهبي أنيق لصورة الحساب',4800,'frame-new-4',104),
('frame','إطار المجرة','إطار كوني لامع لصورة الحساب',6500,'frame-new-5',105),
('frame','إطار التنين المتوهج','إطار متحرك حول الصورة',9000,'frame-new-animated-1',111),
('frame','إطار النيون الملكي','إطار متحرك بإضاءة نيون',11000,'frame-new-animated-2',112),
('frame','إطار المجرات','إطار متحرك بتأثير كوني',14000,'frame-new-animated-3',113),
('frame','إطار العنقاء','إطار متحرك بتأثير ناري',18000,'frame-new-animated-4',114),
('frame','إطار الأسطورة','أندر إطار متحرك في المجموعة',25000,'frame-new-animated-5',115)
on conflict do nothing;

insert into public.gifts(name,emoji,price,tier,sort,active) values
('هدية الياقوت','💠',180,'normal',101,true),
('هدية الفارس','🛡️',260,'normal',102,true),
('هدية اللؤلؤ','🤍',360,'normal',103,true),
('هدية التاج','👑',550,'normal',104,true),
('هدية الصندوق','🎁',800,'normal',105,true),
('هدية العنقاء','🔥',1800,'animated',111,true),
('هدية المجرة','🌌',2800,'animated',112,true),
('هدية التنين','🐉',4200,'animated',113,true),
('هدية النيزك','☄️',6000,'animated',114,true),
('هدية المملكة','🏰',9000,'animated',115,true)
on conflict do nothing;

insert into public.store_items(kind,name,description,price,asset_key,sort_order) values
('entry','دخولية البوابة الملكية','تظهر لجميع الموجودين عند دخول المستخدم',2200,'entry-new-static-1',201),
('entry','دخولية القلعة السماوية','تظهر لجميع الموجودين عند دخول المستخدم',3200,'entry-new-static-2',202),
('entry','دخولية المدار','تظهر لجميع الموجودين عند دخول المستخدم',4200,'entry-new-static-3',203),
('entry','دخولية الحديقة الملكية','تظهر لجميع الموجودين عند دخول المستخدم',5200,'entry-new-static-4',204),
('entry','دخولية البوابة الماسية','تظهر لجميع الموجودين عند دخول المستخدم',6500,'entry-new-static-5',205),
('entry','دخولية التنين الناري','تأثير دخول متحرك داخل الغرفة للجميع',10000,'entry-new-animated-1',211),
('entry','دخولية السيارة الملكية','مركبة دخول متحركة داخل الغرفة للجميع',12000,'entry-new-animated-2',212),
('entry','دخولية البوابة الكونية','بوابة متحركة داخل الغرفة للجميع',15000,'entry-new-animated-3',213),
('entry','دخولية العنقاء','عنقاء متحركة داخل الغرفة للجميع',19000,'entry-new-animated-4',214),
('entry','دخولية الصحن المضيء','تأثير فضائي متحرك داخل الغرفة للجميع',24000,'entry-new-animated-5',215)
on conflict do nothing;

-- The old gift batch is deactivated without touching the original catalog.
update public.gifts set active=false
where name in ('وردة','قلب','تاج','خاتم','سيارة','قلعة','صاروخ','ماسة','صندوق','شمس','قمر','نجمة','لؤلؤة','ذهب','كريستال','طائرة','يخت','حصان','أسد','دبدوب','كيك','آيس كريم','قهوة','عطر','وردة زرقاء','قلب ناري','تاج ماسي','صندوق ملكي','تنين','فينيكس','قوس قزح','مجرة','كوكب','نيزك','سيارة ذهبية','طائرة خاصة','يخت ملكي','قصر','مملكة','جوهرة','حورية','فارس','ملك','ملكة','كنز','شهاب','لؤلؤ فاخر','ألماسة نادرة','تنين ملكي','صندوق الأسطورة');
