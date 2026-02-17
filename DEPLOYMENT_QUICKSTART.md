# Quick Start - Deployment para Piloto

## 🚀 Pasos Rápidos (15 minutos)

### 1. Preparar Aplicación (5 min)

```bash
# Generar JWT_SECRET
# En PowerShell:
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})

# Agregar a .env.local
JWT_SECRET=el-secreto-generado
NODE_ENV=production

# Build
npm run build
npm start
```

### 2. Instalar Cloudflared (2 min)

```powershell
# Con Chocolatey
choco install cloudflared

# O descargar de:
# https://github.com/cloudflare/cloudflared/releases
```

### 3. Configurar Tunnel (5 min)

```bash
# Login
cloudflared tunnel login

# Crear tunnel
cloudflared tunnel create gss-hub

# Configurar DNS
cloudflared tunnel route dns gss-hub gss.tu-dominio.com
```

### 4. Crear config.yml (2 min)

En `~/.cloudflared/config.yml`:

```yaml
tunnel: gss-hub
credentials-file: C:\Users\TU_USUARIO\.cloudflared\TUNNEL_ID.json

ingress:
  - hostname: gss.tu-dominio.com
    service: http://localhost:3000
  - service: http_status:404
```

### 5. Iniciar (1 min)

```bash
# Terminal 1
npm start

# Terminal 2
cloudflared tunnel run gss-hub
```

## ✅ Verificar

- Abrir: `https://gss.tu-dominio.com`
- Instalar PWA
- Login y crear ticket

## 🎉 Listo!

Tu aplicación está desplegada con HTTPS y lista para el piloto.

---

**Guía completa**: Ver `deployment_guide_cloudflare.md`
