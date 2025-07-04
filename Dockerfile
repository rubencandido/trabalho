# Usa uma imagem base com Node.js
FROM node:20

# Define diretório de trabalho dentro do container
WORKDIR /app

# Copia os ficheiros para dentro do container
COPY package*.json ./
RUN npm install

COPY . .

# Expõe a porta onde o app vai correr
EXPOSE 3000

# Comando para arrancar o servidor
CMD ["node", "index.js"]
