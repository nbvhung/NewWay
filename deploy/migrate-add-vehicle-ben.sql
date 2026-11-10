-- Bên trực tiếp trên XE (A/B). NULL = suy từ chủ vốn (owner_user_id), mặc định A.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ben varchar(1);

-- Xe 15H 40566 thuộc Bên B.
UPDATE vehicles
SET ben = 'B'
WHERE so_xe = '15H 40566';
