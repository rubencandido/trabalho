const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Cosmos DB config
const endpoint = "https://basedadostrabalho.documents.azure.com:443/";
const key = "ffN5IHmRT9Nxe2GGslV8GD7A61Joed3IT7p0OwxMYHzbte05YJyIjJA1NYbi8X4xZaBEh1Fx0j6aACDbC1Fh6A==";
const databaseId = 'trabalho';
const utilizadoresContainerId = 'utilizador';
const trabalhosContainerId = 'trabalhos';

const client = new CosmosClient({ endpoint, key });

// Página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota manual para outras páginas
app.get('/pagina.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pagina.html'));
});

app.get('/logout.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'logout.html'));
});

app.get('/submeter.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'submeter.html'));
});

app.get('/avaliacoes.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'avaliacoes.html'));
});

app.get('/criar.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'criar.html'));
});

// Endpoint de login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log("⚠️ [LOGIN RECEBIDO]", username, password);

  try {
    const database = client.database(databaseId);
    const container = database.container(utilizadoresContainerId);

    const query = {
      query: "SELECT * FROM c WHERE c.nome = @username AND c.pass = @password",
      parameters: [
        { name: "@username", value: username },
        { name: "@password", value: password }
      ]
    };

    const { resources } = await container.items.query(query).fetchAll();

    if (resources.length > 0) {
      console.log("✅ Login válido");
      res.json({ success: true });
    } else {
      console.log("❌ Login inválido");
      res.json({ success: false });
    }
  } catch (err) {
    console.error("💥 Erro na BD:", err);
    res.status(500).json({ success: false });
  }
});

// Endpoint para criar utilizador
app.post('/criar-utilizador', async (req, res) => {
  const { nome, email, pass } = req.body;

  try {
    const database = client.database(databaseId);
    const container = database.container(utilizadoresContainerId);

    // Verificar se o utilizador já existe
    const { resources } = await container.items.query({
      query: "SELECT * FROM c WHERE c.nome = @nome",
      parameters: [{ name: "@nome", value: nome }]
    }).fetchAll();

    if (resources.length > 0) {
      return res.json({ success: false, message: "Utilizador já existe" });
    }

    const novo = { nome, email, pass };
    await container.items.create(novo);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erro ao criar utilizador:", err);
    res.status(500).json({ success: false });
  }
});

// Endpoint para obter trabalhos
app.get('/trabalhos', async (req, res) => {
  try {
    const database = client.database(databaseId);
    const container = database.container(trabalhosContainerId);

    const query = {
      query: "SELECT c.titulo, c.avaliado, c.linkFeedback FROM c"
    };

    const { resources } = await container.items.query(query).fetchAll();
    res.json(resources);
  } catch (err) {
    console.error("❌ Erro ao obter trabalhos:", err);
    res.status(500).json({ success: false });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor a correr na porta ${port}`);
});



/*const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

async function uploadImageToBlobStorage(imageBuffer, imageName, mimeType = 'application/octet-stream') {
  const connectionString = process.env.IMG_STORAGE;

  if (!connectionString) {
    console.warn("⚠️ Connection string IMG_STORAGE não encontrada.");
    return null;
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient('imagens');
    await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(imageName);
    await blockBlobClient.uploadData(imageBuffer, {
      blobHTTPHeaders: { blobContentType: mimeType }
    });

    console.log(`✅ Upload concluído: ${blockBlobClient.url}`);
    return blockBlobClient.url;
  } catch (error) {
    console.error("💥 Erro no upload para Blob Storage:", error.message);
    return null;
  }
}
*/

