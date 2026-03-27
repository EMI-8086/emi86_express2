class Blockchain {
    constructor() {
        this.chain = []; //cadena de bloques local 
        this.pendingTransactions = []; // transacciones en espera de ser minadas 
        this.networkNodes = []; // URLs de los nodos 
    }

    // guardar la transacción localmente 
    createNewTransaction(transactionData) {
        this.pendingTransactions.push(transactionData);
        return this.pendingTransactions;
    }
}

module.exports = Blockchain;