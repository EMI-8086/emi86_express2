require('dotenv').config();
const express = require('express');
const supabase = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 8006; 

// Middleware para enviar json a otros nodos
app.use(express.json());

// Endpoint de prueba para verificar que el nodo está vivo
app.get('/status', (req, res) => {
    res.status(200).json({ 
        success: true, 
        message: `Nodo activo y escuchando en el puerto ${PORT}` 
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Nodo de la Blockchain iniciado en http://localhost:${PORT}`);
});