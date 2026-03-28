const sha256 = require('crypto-js/sha256');

class Blockchain {
    constructor() {
        this.chain = []; 
        this.pendingTransactions = []; 
        this.networkNodes = []; 
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
            datos_grado: degreeData,
            nonce: nonce,
            hash_actual: hash,
            hash_anterior: previousBlockHash,
        };

        this.pendingTransactions = [];
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

    chainIsValid(blockchain) {
        let validChain = true;

        for (let i = 1; i < blockchain.length; i++) {
            const currentBlock = blockchain[i];
            const prevBlock = blockchain[i - 1];

            //Validar que los hashes coincidan
            if (currentBlock.hash_anterior !== prevBlock.hash_actual) {
                validChain = false;
            }
            //Validar que el hash actual sea correcto recalculándolo
            const recalculatedHash = this.hashBlock(prevBlock.hash_actual, currentBlock.datos_grado, currentBlock.nonce);
            if (recalculatedHash !== currentBlock.hash_actual) {
                validChain = false;
            }
        }

        // Validar que el bloque génesis sea correcto
        const genesisBlock = blockchain[0];
        if (genesisBlock.nonce !== 0 || genesisBlock.hash_anterior !== '0' || genesisBlock.hash_actual !== '0') {
            validChain = false;
        }

        return validChain;
    }
}

module.exports = Blockchain;