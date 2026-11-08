-- Keep the original gift catalog active; only the later expanded batch is retired.
update public.gifts set active=true
where name in ('وردة','قلب','تاج','خاتم','سيارة','قلعة','صاروخ','ماسة','صندوق');