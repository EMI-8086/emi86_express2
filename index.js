require('dotenv').config();
const express = require('express');
const axios = require('axios');
const supabase = require('./src/config/db');
const Blockchain = require('./src/models/Blockchain');

const app = express();
const PORT = process.env.PORT || 8006;
const nodoAcademico = new Blockchain();

const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

// Configuración para la documentación
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API de Blockchain Grados Académicos',
            version: '1.0.0',
            description: 'Documentación del nodo para la red blockchain distribuida de grados académicos.',
            contact: {
                name: "asdf"
            }
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Servidor Local (Nodo)'
            }
        ]
    },
    apis: ['./index.js'],
};
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use(express.json());

/**
 * @swagger
 * /status:
 *   get:
 *     summary: Verifica el estado del nodo
 *     description: Retorna un mensaje confirmando que el servidor está activo y escuchando peticiones.
 *     responses:
 *       200:
 *         description: El nodo está activo.
 */
app.get('/status', (req, res) => {
    res.status(200).json({
        success: true,
        message: `Nodo activo y escuchando en el puerto ${PORT}`
    });
});

/**
 * @swagger
 * /transaction/broadcast:
 *   post:
 *     summary: Recibe una transacción propagada por otro nodo
 *     description: Guarda una transacción entrante en la lista local de transacciones pendientes. A diferencia de /transactions, esta ruta no vuelve a propagar los datos para evitar ciclos infinitos en la red.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               persona_id:
 *                 type: string
 *               institucion_id:
 *                 type: string
 *               titulo_obtenido:
 *                 type: string
 *               fecha_fin:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Transacción recibida de otro nodo y sincronizada exitosamente.
 */
app.post('/transaction/broadcast', (req, res) => {
    const nuevaTransaccion = req.body;
    nodoAcademico.createNewTransaction(nuevaTransaccion);

    res.status(200).json({
        success: true,
        message: 'Transacción recibida de otro nodo y sincronizada exitosamente.'
    });
});

/**
 * @swagger
 * /receive-new-block:
 *   post:
 *     summary: Recibe y valida un bloque minado por otro nodo
 *     description: Al recibir un nuevo bloque, valida que el hash anterior coincida y que el índice sea el correcto antes de añadirlo a la cadena local.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newBlock:
 *                 type: object
 *                 description: Objeto que contiene toda la estructura del bloque recién minado.
 *     responses:
 *       200:
 *         description: Bloque recibido, validado y añadido a la cadena local.
 *       400:
 *         description: Bloque rechazado. El hash o el índice no son válidos.
 */
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

/**
 * @swagger
 * /transactions:
 *   post:
 *     summary: Crea una nueva transacción académica
 *     description: Recibe los datos de un nuevo grado académico, lo guarda en la lista de pendientes local y lo propaga a la red.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               persona_id:
 *                 type: string
 *                 example: "uuid-de-la-persona"
 *               institucion_id:
 *                 type: string
 *                 example: "uuid-de-la-institucion"
 *               titulo_obtenido:
 *                 type: string
 *                 example: "Ingeniero en Sistemas"
 *               fecha_fin:
 *                 type: string
 *                 format: date
 *                 example: "2026-06-01"
 *     responses:
 *       201:
 *         description: Transacción recibida y propagada exitosamente.
 */
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

/**
 * @swagger
 * /chain:
 *   get:
 *     summary: Obtiene la cadena de bloques local completa
 *     description: Devuelve la lista completa de bloques minados en este nodo y la longitud actual de la cadena. Es utilizado por otros nodos durante la fase de consenso para sincronizarse y resolver conflictos.
 *     responses:
 *       200:
 *         description: Retorna la cadena de bloques y su longitud exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chain:
 *                   type: array
 *                   description: Arreglo que contiene todos los bloques almacenados en la red local.
 *                 length:
 *                   type: integer
 *                   description: Número total de bloques en la cadena.
 */
app.get('/chain', (req, res) => {
    res.status(200).json({
        chain: nodoAcademico.chain,
        length: nodoAcademico.chain.length
    });
});

/**
 * @swagger
 * /nodes/resolve:
 *   get:
 *     summary: Algoritmo de Consenso (Resolución de conflictos)
 *     description: Consulta las cadenas de todos los nodos registrados en la red. Si encuentra una cadena válida que sea más larga que la local, la adopta para mantener el consenso.
 *     responses:
 *       200:
 *         description: Devuelve el resultado del consenso (si hubo conflicto resuelto o si la cadena actual ya era la correcta).
 *       500:
 *         description: Error al comunicarse con la red para el consenso.
 */
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

/**
 * @swagger
 * /nodes/register:
 *   post:
 *     summary: Registra un nuevo nodo en la red
 *     description: Recibe la URL de otro nodo compañero y lo guarda en la lista de nodos conocidos para la futura propagación de transacciones y bloques.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newNodeUrl:
 *                 type: string
 *                 example: "http://localhost:8007"
 *     responses:
 *       201:
 *         description: Nodo registrado exitosamente para formar la red.
 *       400:
 *         description: Debes proporcionar la URL del nodo en el campo 'newNodeUrl'.
 */
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

/**
 * @swagger
 * /mine:
 *   post:
 *     summary: Mina un nuevo bloque en la red
 *     description: Ejecuta el Proof of Work para las transacciones pendientes, crea un nuevo bloque, lo guarda en Supabase y lo propaga.
 *     responses:
 *       200:
 *         description: Bloque minado, guardado y propagado con éxito.
 *       400:
 *         description: No hay transacciones pendientes para minar.
 *       500:
 *         description: Error al guardar en la base de datos.
 */
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