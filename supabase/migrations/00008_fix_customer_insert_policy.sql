DROP POLICY IF EXISTS "Public can insert customer during booking" ON customers;
CREATE POLICY "Public can insert customer during booking" ON customers FOR INSERT WITH CHECK (true);