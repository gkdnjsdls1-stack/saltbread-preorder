-- 샘플 데이터. 가격과 하루 한도는 전부 임시 숫자이므로
-- 실제 값은 사장님 관리 화면(/admin/products)에서 바꾼다.

insert into products (name, price, default_daily_limit, sort_order)
select * from (values
  ('오리지널 소금빵',   3500, 40, 1),
  ('애플뵈르 소금빵',   4500, 20, 2),
  ('앙뵈르 소금빵',     4500, 20, 3),
  ('소금빵 비스켓',     3000, 15, 4),
  ('클래식 르뱅 쿠키',  4000, 15, 5)
) as v (name, price, default_daily_limit, sort_order)
where not exists (select 1 from products);
