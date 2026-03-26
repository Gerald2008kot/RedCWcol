# RedCW — Red Social para Colegios

## Estructura del Proyecto

```
redcw/
├── config.js                  ← ⭐ CONFIGURACIÓN CENTRAL (editar aquí)
├── index.html                 ← Inicio / Feed principal
├── login.html                 ← Login / Registro / Recuperar contraseña
├── news.html                  ← Noticias y Grupos
├── communities.html           ← Comunidades / Foros
├── my-forums.html             ← Mis Foros
├── forum.html                 ← Vista individual de un Foro
├── chats.html                 ← Chats en tiempo real
├── profile.html               ← Perfil de usuario
├── plans.html                 ← Planes (Free, N1, N2, N3)
├── admin.html                 ← Panel de Administrador
├── owner.html                 ← Panel de Propietario
├── help.html                  ← Ayuda
├── reset-password.html        ← Restablecer contraseña
├── manifest.json              ← PWA Manifest
├── sw.js                      ← Service Worker
├── netlify.toml               ← Config despliegue Netlify
├── supabase-schema.sql        ← ⭐ Ejecutar en Supabase SQL Editor
├── css/
│   └── main.css               ← Estilos globales (dark/light, responsive)
├── js/
│   ├── i18n.js                ← Traducciones ES / EN
│   ├── auth.js                ← Autenticación, roles, permisos
│   ├── cloudinary.js          ← Subida de archivos con rotación de cuentas
│   ├── posts.js               ← Feed, publicaciones, likes, comentarios
│   ├── forums.js              ← Foros, grupos de noticias, membresías
│   ├── chat.js                ← Chat en tiempo real (Supabase Realtime)
│   ├── plans.js               ← Planes y flujo de pago (Yape/Plin)
│   ├── admin.js               ← Panel admin/propietario
│   ├── app.js                 ← Shell, dropdown, dark mode, utilidades
│   └── pwa.js                 ← Registro Service Worker
├── partials/
│   └── shell.html             ← Header + Snackbar (cargado dinámicamente)
└── assets/
    ├── qr-yape.png            ← ⭐ REEMPLAZAR con tu QR de Yape
    ├── qr-plin.png            ← ⭐ REEMPLAZAR con tu QR de Plin
    └── icons/
        ├── icon-192.png       ← Ícono PWA (192×192 px)
        └── icon-512.png       ← Ícono PWA (512×512 px)
```

---

## ⚙️ Configuración Inicial

### 1. Supabase — Ejecutar el Schema

1. Ve a tu proyecto Supabase → **SQL Editor**
2. Pega el contenido de `supabase-schema.sql`
3. Ejecuta el script

### 2. Editar `config.js`

```js
// Pagos
payments: {
  yapeNumber: "+51 9XX XXX XXX",   // Tu número Yape real
  plinNumber:  "+51 9XX XXX XXX",  // Tu número Plin real
  yapeQR: "assets/qr-yape.png",   // Reemplaza con tu imagen QR
  plinQR: "assets/qr-plin.png",
},

// Correo de ayuda
contact: {
  helpEmail: "ayuda@tudominio.com",
},

// Precios (modifica cuando quieras)
plans: {
  n1: { price: 9.90 },
  n2: { price: 19.90 },
  n3: { price: 29.90 },
},
```

### 3. Agregar tus QR

Reemplaza los archivos:
- `assets/qr-yape.png` → tu QR de Yape
- `assets/qr-plin.png` → tu QR de Plin

### 4. Agregar íconos PWA

Coloca dos imágenes PNG en `assets/icons/`:
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

---

## ☁️ Cloudinary — Agregar más cuentas

En `config.js`, en cada sección (`images`, `videos`, `audio`), agrega objetos:

```js
images: [
  { cloudName: "db3w5kcfi", uploadPreset: "ml_imagenes" },
  { cloudName: "CUENTA2",   uploadPreset: "PRESET2"     },  // ← nueva cuenta
],
```

La rotación es automática cada 15 días según el día del mes.

---

## 🚀 Despliegue en Netlify

1. Crea una cuenta en [netlify.com](https://netlify.com)
2. Arrastra la carpeta `redcw/` a la zona de deploy
3. O conecta tu repositorio GitHub y Netlify detecta `netlify.toml`

### Supabase — URL de redireccionamiento (para reset de contraseña)

En tu panel Supabase → **Authentication → URL Configuration**:
- Site URL: `https://TU-SITIO.netlify.app`
- Redirect URLs: `https://TU-SITIO.netlify.app/reset-password.html`

---

## 👑 Crear el primer Propietario

1. Regístrate normalmente en la app
2. En Supabase → **Table Editor → profiles**
3. Busca tu usuario y cambia `role` a `propietario`

---

## 🔄 Flujo de Pago (Yape/Plin)

1. Usuario elige plan → ve QR + número
2. Transfiere manualmente desde su app
3. Hace clic en "Enviar Comprobante" → se abre su correo con datos prellenados
4. Tú recibes el correo con la captura
5. En el panel de Propietario → **Comprobantes** → apruebas el pago
6. El plan se activa automáticamente

---

## 📱 PWA — Instalar en móvil

- Chrome (Android): menú → "Agregar a pantalla de inicio"
- Safari (iOS): compartir → "Agregar a pantalla de inicio"

---

## 🗂️ Roles y Permisos

| Rol          | Descripción                                    |
|--------------|------------------------------------------------|
| Usuario      | Acceso básico según su plan                    |
| Encargado    | Puede crear grupos de Noticias y publicar      |
| Administrador| Panel admin, gestión de usuarios               |
| Propietario  | Control total, asignar planes y roles          |
