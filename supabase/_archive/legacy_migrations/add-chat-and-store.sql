-- ================================================
-- CHAT DIRECTO SOCIO-ENTRENADOR
-- ================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para chat
CREATE INDEX IF NOT EXISTS idx_chat_trainer ON chat_messages(trainer_id);
CREATE INDEX IF NOT EXISTS idx_chat_member ON chat_messages(member_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);

-- RLS para chat
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver mensajes propios" 
  ON chat_messages FOR SELECT 
  TO authenticated 
  USING (
    sender_id = auth.uid() OR 
    trainer_id = auth.uid() OR 
    member_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Enviar mensajes" 
  ON chat_messages FOR INSERT 
  TO authenticated 
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Marcar como leído" 
  ON chat_messages FOR UPDATE 
  TO authenticated 
  USING (trainer_id = auth.uid() OR member_id = auth.uid());

-- ================================================
-- PRODUCTOS DE LA TIENDA
-- ================================================

CREATE TABLE IF NOT EXISTS store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para productos
CREATE INDEX IF NOT EXISTS idx_products_category ON store_products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON store_products(is_active);

-- RLS para productos
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos ven productos activos" 
  ON store_products FOR SELECT 
  TO authenticated 
  USING (is_active = true OR 
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin gestiona productos" 
  ON store_products FOR ALL 
  TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ================================================
-- PRODUCTOS RECOMENDADOS EN DIETAS
-- ================================================

CREATE TABLE IF NOT EXISTS diet_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diet_template_id UUID NOT NULL REFERENCES diet_templates(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  quantity TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_diet_products_diet ON diet_products(diet_template_id);
CREATE INDEX IF NOT EXISTS idx_diet_products_product ON diet_products(product_id);

-- RLS para diet_products
ALTER TABLE diet_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver productos de dietas" 
  ON diet_products FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM diet_templates dt
      WHERE dt.id = diet_template_id 
      AND (dt.trainer_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM member_diets md WHERE md.diet_template_id = dt.id AND md.member_id = auth.uid()) OR
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Trainers y admin gestionan productos de dietas" 
  ON diet_products FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM diet_templates dt
      WHERE dt.id = diet_template_id 
      AND (dt.trainer_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );
