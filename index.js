require('dotenv').config();
const express = require('express');
const supabase = require('./src/config/db');
const Blockchain = require('./src/models/Blockchain');

const app = express();
const PORT = process.env.PORT || 8006;
const nodoAcademico = new Blockchain();

// Middleware para enviar json a otros nodos
app.use(express.json());

// Endpoint de prueba para verificar que el nodo está vivo
app.get('/status', (req, res) => {
    res.status(200).json({
        success: true,
        message: `Nodo activo y escuchando en el puerto ${PORT}`
    });
});

app.post('/transactions', (req, res) => {
    const nuevaTransaccion = req.body;

    nodoAcademico.createNewTransaction(nuevaTransaccion);

    res.status(201).json({
        success: true,
        message: "Transacción recibida y guardada en la lista de pendientes local.",
        transaccionesPendientes: nodoAcademico.pendingTransactions
    });
});

// Endpoint para la red
app.get('/chain', (req, res) => {
    res.status(200).json({
        chain: nodoAcademico.chain,
        length: nodoAcademico.chain.length
    });
});

// Endpoint para registrar manualmente otros nodos de la red
app.post('/nodes/register', (req, res) => {
    const newNodeUrl = req.body.newNodeUrl;

    if (!newNodeUrl) {
        return res.status(400).json({ error: "Debes proporcionar la URL del nodo" });
    }

    const nodeNotAlreadyPresent = !nodoAcademico.networkNodes.includes(newNodeUrl);
    const notCurrentNode = newNodeUrl !== `http://localhost:${PORT}`;

    if (nodeNotAlreadyPresent && notCurrentNode) {
        nodoAcademico.networkNodes.push(newNodeUrl);
    }

    res.status(201).json({
        success: true,
        message: "Nodo registrado exitosamente para formar la red.",
        nodosRegistrados: nodoAcademico.networkNodes
    });
});

app.post('/mine', async (req, res) => {
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

    // --- GUARDAR EN SUPABASE ---
    const { data, error } = await supabase
        .from('grados')
        .insert([
            {
                persona_id: currentBlockData.persona_id,
                institucion_id: currentBlockData.institucion_id,
                titulo_obtenido: currentBlockData.titulo_obtenido,
                fecha_fin: currentBlockData.fecha_fin,
                hash_actual: blockHash,
                hash_anterior: previousBlockHash,
                nonce: nonce,
                firmado_por: "Nodo de EmiLaBola"
            }
        ])
        .select();

    if (error) {
        console.error("Error al guardar en Supabase:", error);
        return res.status(500).json({
            success: false,
            message: "Bloque minado localmente, pero falló al guardar en Supabase.",
            error: error.message
        });
    }

    res.status(200).json({
        success: true,
        message: "Bloque minado y añadido a la cadena local exitosamente",
        block: newBlock
    });
});


// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Nodo de la Blockchain iniciado en http://localhost:${PORT}`);
});