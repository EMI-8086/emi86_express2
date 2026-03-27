require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// mismas credenciales del archivo .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan las credenciales de Supabase en el archivo .env");
  process.exit(1);
}

// inicializa el cliente 
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;