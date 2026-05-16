# IntertelTV

Plataforma IPTV privada para clientes de red ISP.

## Características
- Autenticación simple.
- Gestión de fuentes M3U múltiples.
- Parser de EPG (XMLTV).
- Sistema de favoritos por usuario.
- Panel de administración.
- Reproductor premium con HLS.js.

## Instalación

### Requisitos
- Node.js 18+
- PM2
- Nginx

### Pasos
1. Clonar el repositorio.
2. Instalar dependencias del backend:
   ```bash
   cd backend
   npm install
   ```
3. Instalar dependencias del frontend y compilar:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
4. Iniciar con PM2:
   ```bash
   pm2 start ecosystem.config.js
   ```
5. Configurar Nginx usando el archivo `nginx.conf` proporcionado.

## Credenciales por defecto
- **Admin**: `admin` / `intertel2024`
