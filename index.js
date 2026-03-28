require('dotenv').config();
const express = require('express');
const axios = require('axios');
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

app.post('/transaction/broadcast', (req, res) => {
    const nuevaTransaccion = req.body;
    nodoAcademico.createNewTransaction(nuevaTransaccion);
    
    res.status(200).json({ 
        success: true,
        message: 'Transacción recibida de otro nodo y sincronizada exitosamente.' 
    });
});

// recibe un bloque minado por otro nodo
app.post('/receive-new-block', (req, res) => {
    const newBlock = req.body.newBlock;
    
    // Obtiene el último bloque
    const lastBlock = nodoAcademico.getLastBlock();

    const correctHash = lastBlock.hash_actual === newBlock.hash_anterior;
    const correctIndex = lastBlock.index + 1 === newBlock.index;

    if (correctHash && correctIndex) {
        nodoAcademico.chain.push(newBlock);
        nodoAcademico.pendingTransactions = []; 
        
        res.status(200).json({ 
            success: true, 
            message: 'Bloque recibido, validado y añadido a la cadena local.',
            newBlock: newBlock
        });
    } else {
        res.status(400).json({ 
            success: false, 
            message: 'Bloque rechazado. El hash o el índice no son válidos.',
            newBlock: newBlock
        });
    }
});

app.post('/transactions', async (req, res) => {
    const nuevaTransaccion = req.body;
    nodoAcademico.createNewTransaction(nuevaTransaccion);
    // propagar a los demás nodos registrados 
    const promesasPropagacion = [];
    
    nodoAcademico.networkNodes.forEach(nodoUrl => {
        // hace un POST al endpoint de cada compañero
        const requestPromise = axios.post(`${nodoUrl}/transaction/broadcast`, nuevaTransaccion);
        promesasPropagacion.push(requestPromise);
    });

    try {
        await Promise.allSettled(promesasPropagacion);
    } catch (error) {
        console.error("Error al propagar a algunos nodos:", error);
    }

    res.status(201).json({
        success: true,
        message: "Transacción creada localmente y propagada a toda la red.",
        transaccionesPendientes: nodoAcademico.pendingTransactions
    });
});
// transacciones pendientes(temporal)
app.get('/transactions/pending', (req, res) => {
    res.status(200).json({
        nodoActivo: `Puerto ${PORT}`,
        pendientes: nodoAcademico.pendingTransactions
    });
});
// Endpoint para la red
app.get('/chain', (req, res) => {
    res.status(200).json({
        chain: nodoAcademico.chain,
        length: nodoAcademico.chain.length
    });
});

app.get('/nodes/resolve', async (req, res) => {
    const fetchPromises = [];

    nodoAcademico.networkNodes.forEach(nodoUrl => {
        fetchPromises.push(axios.get(`${nodoUrl}/chain`));
    });

    try {
        const responses = await Promise.allSettled(fetchPromises);
        
        let maxChainLength = nodoAcademico.chain.length;
        let newLongestChain = null;

        // Revisamos las respuestas de los demás nodos
        responses.forEach(response => {
            if (response.status === 'fulfilled') {
                const chainLength = response.value.data.length;
                const chain = response.value.data.chain;

                // Si la cadena del compañero es más larga que la nuestra Y además es válida
                if (chainLength > maxChainLength && nodoAcademico.chainIsValid(chain)) {
                    maxChainLength = chainLength;
                    newLongestChain = chain;
                }
            }
        });

        // Si encontramos una cadena válida más larga, reemplazamos la nuestra
        if (newLongestChain) {
            nodoAcademico.chain = newLongestChain;
            nodoAcademico.pendingTransactions = []; 
            
            res.status(200).json({
                message: 'Conflicto resuelto. Se ha adoptado la cadena válida más larga de la red.',
                chain: nodoAcademico.chain
            });
        } else {
            res.status(200).json({
                message: 'No hubo conflicto. Tu cadena actual ya es la más larga y válida.',
                chain: nodoAcademico.chain
            });
        }
    } catch (error) {
        console.error("Error al resolver el consenso:", error);
        res.status(500).json({ error: "Error al comunicarse con la red para el consenso." });
    }
});

// Registrar manualmente otros nodos de la red
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
    const lastBlock = nodoAcademico.getLastBlock();
    const previousBlockHash = lastBlock.hash_actual;
    // ejecuta Proof of Work para encontrar el nonce
    const nonce = nodoAcademico.proofOfWork(previousBlockHash, currentBlockData);
    // genera el hash final
    const blockHash = nodoAcademico.hashBlock(previousBlockHash, currentBlockData, nonce);
    const newBlock = nodoAcademico.createNewBlock(nonce, previousBlockHash, blockHash, currentBlockData);

    // guarda en supabase
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
    // propaga el bloque a la red
    const blockPromises = [];
    nodoAcademico.networkNodes.forEach(nodoUrl => {
        // se envia el bloque nuevo a todos
        const requestPromise = axios.post(`${nodoUrl}/receive-new-block`, { newBlock: newBlock });
        blockPromises.push(requestPromise);
    });

    try {
        await Promise.allSettled(blockPromises);
    } catch (err) {
        console.error("Error al propagar el bloque:", err);
    }

    res.status(200).json({
        success: true,
        message: "Bloque minado, guardado en Supabase y propagado a la red exitosamente",
        block: newBlock,
        db_record: data
    });
});


// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Nodo de la Blockchain iniciado en http://localhost:${PORT}`);
});