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

const Blockchain = require('./src/models/Blockchain');
const nodoAcademico = new Blockchain(); 

app.post('/transactions', (req, res) => {
    const nuevaTransaccion = req.body;

    nodoAcademico.createNewTransaction(nuevaTransaccion);

    res.status(201).json({
        success: true,
        message: "Transacción recibida y guardada en la lista de pendientes local.",
        transaccionesPendientes: nodoAcademico.pendingTransactions
    });
});

app.post('/mine', (req, res) => {
    if (nodoAcademico.pendingTransactions.length === 0) {
        return res.status(400).json({ error: "No hay transacciones pendientes para minar." });
    }

    const currentBlockData = nodoAcademico.pendingTransactions[0];
    // obtiene el hash del bloque anterior
    const lastBlock = nodoAcademico.getLastBlock();
    const previousBlockHash = lastBlock.hash_actual;
    // ejecuta Proof of Work para encontrar el nonce
    const nonce = nodoAcademico.proofOfWork(previousBlockHash, currentBlockData);
    // genera el hash final
    const blockHash = nodoAcademico.hashBlock(previousBlockHash, currentBlockData, nonce);
    // crear el bloque en mi cadena local
    const newBlock = nodoAcademico.createNewBlock(nonce, previousBlockHash, blockHash, currentBlockData);

    res.status(200).json({
        success: true,
        message: "Bloque minado y añadido a la cadena local exitosamente",
        block: newBlock
    });
});