const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, ContainerSASPermissions } = require('@azure/storage-blob');
const { CosmosClient } = require('@azure/cosmos');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Cosmos DB
const cosmos = new CosmosClient({
  endpoint: "https://basedadostrabalho.documents.azure.com:443/",
  key: "AQUI_A_KEY_DO_COSMOS"
});
const databaseId = 'trabalho';
const trabalhosContainerId = 'trabalhos';
const utilizadoresContainerId = 'utilizador';

// Azure Storage com acesso direto
const accountName = 'miniprojeto';
const accountKey = 'lGFDdXuwQSpPmbTRXCb5kQzeBlQtwDV/GnMkv6Fy3tX+n/EhkUmEX5mYu+loeVzDFNZ3r5pAZYzZ+AStS1HDYw==';
const containerName = 'imagens';

const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);

// Multer config
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Upload com SAS
app.post('/upload-trabalho', upload.single('ficheiro'), async (req, res) => {
  try {
    const { nomeTrabalho, id_utilizador } = req.body;
    const file = req.file;
    if (!file || !id_utilizador || !nomeTrabalho) return res.status(400).send('Dados em falta');

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobName = `${id_utilizador}-${Date.now()}-${file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer);

    // Gerar SAS
    const expiresOn = new Date(new Date().valueOf() + 60 * 60 * 1000); // 1 hora
    const sasToken = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: ContainerSASPermissions.parse("r"),
      expiresOn
    }, sharedKeyCredential).toString();

    const sasUrl = `${blockBlobClient.url}?${sasToken}`;

    // Guardar na BD
    const container = cosmos.database(databaseId).container(trabalhosContainerId);
    await container.items.create({
      id: crypto.randomUUID(),
      id_utilizador,
      titulo: nomeTrabalho,
      avaliado: false,
      linkFeedback: sasUrl,
      criadoEm: new Date().toISOString()
    });

    res.status(200).json({ message: 'Upload feito com sucesso!', url: sasUrl });
  } catch (err) {
    console.error('Erro no upload:', err.message);
    res.status(500).send('Erro no upload.');
  }
});

// Iniciar
app.listen(port, () => {
  console.log(`🚀 Servidor a correr na porta ${port}`);
});
