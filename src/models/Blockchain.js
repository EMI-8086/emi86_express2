const sha256 = require('crypto-js/sha256');

class Blockchain {
    constructor() {
        this.chain = []; 
        this.pendingTransactions = []; 
        this.networkNodes = []; 
        
        // Crear el primer bloque de la red con hash
        this.createNewBlock(0, '0', '0', {}); 
    }

    createNewTransaction(transactionData) {
        this.pendingTransactions.push(transactionData);
        return this.pendingTransactions;
    }

    // Método para crear el bloque y añadirlo a la cadena local
    createNewBlock(nonce, previousBlockHash, hash, degreeData) {
        const newBlock = {
            index: this.chain.length + 1,
            timestamp: Date.now(),
            datos_grado: degreeData, // Los datos de la transacción
            nonce: nonce,
            hash_actual: hash,
            hash_anterior: previousBlockHash,
        };

        this.pendingTransactions = []; // limpia las transacciones pendientes
        this.chain.push(newBlock);
        return newBlock;
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    // Generar el Hash 
    hashBlock(previousBlockHash, currentBlockData, nonce) {
        const dataAsString = `${currentBlockData.persona_id}${currentBlockData.institucion_id}${currentBlockData.titulo_obtenido}${currentBlockData.fecha_fin}${previousBlockHash}${nonce}`;
        return sha256(dataAsString).toString();
    }

    //buscar el nonce correcto
    proofOfWork(previousBlockHash, currentBlockData) {
        let nonce = 0;
        let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        
        while (hash.substring(0, 3) !== '000') {
            nonce++;
            hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        }
        
        return nonce;
    }
}

module.exports = Blockchain;