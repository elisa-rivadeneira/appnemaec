FROM node:18-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache git

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Instalar Expo CLI globalmente
RUN npm install -g @expo/cli

# Copiar el resto del código
COPY . .

# Exponer puerto para desarrollo web
EXPOSE 8081

# Comando por defecto para ejecutar la app en modo web
CMD ["npx", "expo", "start", "--web", "--port", "8081", "--host", "0.0.0.0"]