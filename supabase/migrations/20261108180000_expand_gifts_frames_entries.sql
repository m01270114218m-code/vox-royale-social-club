-- Expand the live catalog without removing existing admin-managed assets.
-- The UI falls back to the existing 3D renders when a dedicated asset is not uploaded yet.

WITH frame_seed(name,description,price,asset_key,sort_order) AS (
  VALUES
    ('إطار الفارس 7','إطار فضي كلاسيكي',700,'frame-7',7),
    ('إطار اللؤلؤ','إطار لؤلؤي فاخر',1200,'frame-8',8),
    ('إطار الياقوت','إطار ياقوت ملكي',1800,'frame-9',9),
    ('إطار الزمرد','إطار زمرد لامع',2500,'frame-10',10),
    ('إطار الشمس المتحرك','إطار متحرك بلمعة ذهبية',3500,'frame-11-animated',11),
    ('إطار القمر المتحرك','إطار متحرك بهالة فضية',4500,'frame-12-animated',12),
    ('إطار النجوم المتحرك','إطار متحرك بنجوم مضيئة',6000,'frame-13-animated',13),
    ('إطار الماس المتحرك','إطار متحرك ببريق الماس',8000,'frame-14-animated',14),
    ('إطار التنين المتحرك','إطار متحرك بتأثير التنين',12000,'frame-15-animated',15),
    ('إطار التاج المتحرك','إطار متحرك ملكي',18000,'frame-16-animated',16),
    ('إطار المجرة','إطار مجرة فاخر',22000,'frame-17',17),
    ('إطار النيزك','إطار نيزكي لامع',26000,'frame-18',18),
    ('إطار القصر','إطار قصر ملكي',30000,'frame-19',19),
    ('إطار الأسطورة المتحرك','أندر إطار متحرك',50000,'frame-20-animated',20)
)
INSERT INTO public.store_items(kind,name,description,price,asset_key,sort_order)
SELECT 'frame',name,description,price,asset_key,sort_order
FROM frame_seed s
WHERE NOT EXISTS (SELECT 1 FROM public.store_items i WHERE i.asset_key=s.asset_key);

WITH entry_seed(name,description,price,asset_key,sort_order) AS (
  VALUES
    ('دخولية النجوم','دخولية كلاسيكية بالنجوم',1800,'entry-star',5),
    ('دخولية الماس','دخولية ماسية فاخرة',3200,'entry-diamond',6),
    ('دخولية القصر','دخولية ملكية بالقصر',5000,'entry-castle',7),
    ('دخولية الصاروخ المتحرك','صاروخ متحرك عند دخول الغرفة',7500,'entry-rocket-animated',8),
    ('دخولية التنين المتحرك','تنين متحرك عند دخول الغرفة',12000,'entry-dragon-animated',9),
    ('دخولية الماس المتحرك','بريق ماسي متحرك',18000,'entry-diamond-animated',10)
)
INSERT INTO public.store_items(kind,name,description,price,asset_key,sort_order)
SELECT 'entry',name,description,price,asset_key,sort_order
FROM entry_seed s
WHERE NOT EXISTS (SELECT 1 FROM public.store_items i WHERE i.asset_key=s.asset_key);

WITH gift_seed(name,emoji,price,tier,sort) AS (
  VALUES
    ('وردة','🌹',20,'normal',1),('قلب','💖',30,'normal',2),('تاج','👑',80,'normal',3),('خاتم','💍',120,'normal',4),
    ('سيارة','🏎️',250,'normal',5),('قلعة','🏰',350,'normal',6),('صاروخ','🚀',500,'normal',7),('ماسة','💎',700,'normal',8),
    ('صندوق','🎁',1000,'normal',9),('شمس','☀️',40,'normal',10),('قمر','🌙',50,'normal',11),('نجمة','⭐',60,'normal',12),
    ('لؤلؤة','🫧',90,'normal',13),('ذهب','🪙',150,'normal',14),('كريستال','🔷',180,'normal',15),('طائرة','✈️',300,'normal',16),
    ('يخت','🛥️',450,'normal',17),('حصان','🐎',550,'normal',18),('أسد','🦁',650,'normal',19),('دبدوب','🧸',90,'normal',20),
    ('كيك','🎂',110,'normal',21),('آيس كريم','🍦',70,'normal',22),('قهوة','☕',45,'normal',23),('عطر','🌸',130,'normal',24),
    ('وردة زرقاء','🌺',200,'normal',25),
    ('قلب ناري','🔥',300,'animated',26),('تاج ماسي','👑',800,'animated',27),('صندوق ملكي','🎁',1200,'animated',28),
    ('تنين','🐉',1500,'animated',29),('فينيكس','🪽',1800,'animated',30),('قوس قزح','🌈',2200,'animated',31),('مجرة','🌌',2600,'animated',32),
    ('كوكب','🪐',3000,'animated',33),('نيزك','☄️',3500,'animated',34),('سيارة ذهبية','🏎️',4000,'animated',35),
    ('طائرة خاصة','✈️',4500,'animated',36),('يخت ملكي','🛥️',5000,'animated',37),('قصر','🏰',6000,'animated',38),
    ('مملكة','🏯',7000,'animated',39),('جوهرة','💎',8000,'animated',40),('حورية','🧜‍♀️',9000,'animated',41),
    ('فارس','🛡️',10000,'animated',42),('ملك','🤴',12000,'animated',43),('ملكة','👸',14000,'animated',44),
    ('كنز','💰',16000,'animated',45),('شهاب','🌠',18000,'animated',46),('لؤلؤ فاخر','🤍',20000,'animated',47),
    ('ألماسة نادرة','💎',25000,'animated',48),('تنين ملكي','🐲',30000,'animated',49),('صندوق الأسطورة','🎁',50000,'animated',50)
)
INSERT INTO public.gifts(name,emoji,price,tier,sort,active)
SELECT name,emoji,price,tier,sort,true
FROM gift_seed s
WHERE NOT EXISTS (SELECT 1 FROM public.gifts g WHERE g.name=s.name);

ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
