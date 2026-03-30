<?php
require_once __DIR__ . '/includes/security.php';
iniciarSesion();

// Ya logueado → redirigir
if (usuarioActual()) { header('Location: index.php'); exit; }

// ── Cambio rápido de cuenta (sin contraseña) ──────────────────
if (isset($_GET['cambiar']) && $_GET['cambiar']) {
    $token = trim($_GET['cambiar']);
    if (cambiarCuenta($token)) {
        header('Location: index.php'); exit;
    }
    // Token inválido → seguir en login
}

$error   = '';
$cuentas = cuentasRecordadas();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verificarCSRF();
    $email = trim($_POST['email'] ?? '');
    $pass  = $_POST['password'] ?? '';
    $ip    = $_SERVER['REMOTE_ADDR'];

    if (!$email || !$pass) {
        $error = 'Completa todos los campos.';
    } elseif (!verificarRateLimit($ip, $email)) {
        $error = 'Demasiados intentos fallidos. Espera ' . (LOGIN_LOCKOUT_TIME / 60) . ' minutos.';
    } else {
        $db   = getDB();
        $stmt = $db->prepare("SELECT * FROM usuarios WHERE email=? AND activo=1");
        $stmt->execute([strtolower($email)]);
        $user = $stmt->fetch();

        if ($user && password_verify($pass, $user['password'])) {
            limpiarIntentos($ip);
            session_regenerate_id(true);
            $_SESSION['usuario'] = [
                'id'          => (int)$user['id'],
                'nombre'      => $user['nombre'],
                'apellido'    => $user['apellido'],
                'email'       => $user['email'],
                'rol'         => $user['rol'],
                'departamento'=> $user['departamento'],
                'avatar'      => $user['avatar'],
            ];
            $db->prepare("UPDATE usuarios SET ultimo_login=datetime('now','localtime') WHERE id=?")
               ->execute([$user['id']]);

            // Recordar esta cuenta en el dispositivo
            recordarCuenta((int)$user['id']);

            header('Location: index.php'); exit;
        } else {
            registrarIntentoFallido($ip, $email);
            $error = 'Correo o contraseña incorrectos.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Acceso — <?php echo xss(APP_NAME); ?></title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap" rel="stylesheet">
<link href="<?php echo BASE_URL; ?>/assets/style.css" rel="stylesheet">
</head>
<body>
<div class="login-wrap">
  <div class="login-card fade-in">

    <div class="login-logo"><i class="fa-solid fa-building-columns text-white"></i></div>
    <h4 class="text-center fw-bold mb-1"><?php echo xss(APP_NAME); ?></h4>
    <p class="text-center mb-4" style="font-size:.85rem;color:var(--text-muted)"><?php echo xss(APP_SLOGAN); ?></p>

    <?php if ($error): ?>
    <div class="alert alert-intra alert-danger mb-3">
      <i class="fa-solid fa-circle-xmark me-2"></i><?php echo xss($error); ?>
    </div>
    <?php endif; ?>

    <!-- ── Cuentas recordadas ───────────────────────────────── -->
    <?php if ($cuentas): ?>
    <div class="cuentas-guardadas mb-4">
      <div class="cuentas-titulo">
        <i class="fa-solid fa-clock-rotate-left me-1"></i>Cuentas en este dispositivo
      </div>
      <?php foreach ($cuentas as $c):
        $ini = inicialesUsuario($c['nombre'], $c['apellido']);
        $ava = avatarUrl($c['avatar'], $c['nombre'], $c['apellido']);
      ?>
      <a href="login.php?cambiar=<?php echo urlencode($c['token']); ?>"
         class="cuenta-item">
        <div class="cuenta-avatar">
          <?php if ($ava): ?>
          <img src="<?php echo xss($ava); ?>" alt="">
          <?php else: ?>
          <span><?php echo xss($ini); ?></span>
          <?php endif; ?>
        </div>
        <div class="flex-fill">
          <div class="fw-600" style="font-size:.9rem">
            <?php echo xss($c['nombre'] . ' ' . $c['apellido']); ?>
          </div>
          <div style="font-size:.75rem;color:var(--text-muted)"><?php echo xss($c['email']); ?></div>
        </div>
        <div>
          <span class="rol-badge rol-<?php echo xss($c['rol']); ?>">
            <?php echo ucfirst($c['rol']); ?>
          </span>
        </div>
        <i class="fa-solid fa-chevron-right" style="color:var(--accent);font-size:.75rem"></i>
      </a>
      <?php endforeach; ?>
    </div>

    <div class="divider-texto mb-3">
      <span>o inicia sesión con otra cuenta</span>
    </div>
    <?php endif; ?>

    <!-- ── Formulario login ─────────────────────────────────── -->
    <form method="POST" autocomplete="off" novalidate>
      <?php echo csrfInput(); ?>
      <div class="mb-3">
        <label class="form-label"><i class="fa-solid fa-envelope me-1"></i>Correo electrónico</label>
        <input type="email" name="email" class="form-control"
               placeholder="usuario@empresa.com"
               value="<?php echo xss($_POST['email'] ?? ''); ?>"
               required autofocus>
      </div>
      <div class="mb-4">
        <label class="form-label"><i class="fa-solid fa-lock me-1"></i>Contraseña</label>
        <div class="input-group">
          <input type="password" name="password" id="passInput"
                 class="form-control" placeholder="••••••••" required>
          <button type="button" class="btn btn-intra-outline" onclick="togglePass()">
            <i class="fa-solid fa-eye" id="eyeIcon"></i>
          </button>
        </div>
      </div>
      <button type="submit" class="btn btn-intra w-100 py-2">
        <i class="fa-solid fa-right-to-bracket me-2"></i>Iniciar Sesión
      </button>
    </form>

    <hr style="border-color:var(--border);margin:1.5rem 0">
    <div class="text-center" style="font-size:.76rem;color:var(--text-dim)">
      <i class="fa-solid fa-headset me-1"></i>
      <a href="mailto:<?php echo xss(SOPORTE_EMAIL); ?>"><?php echo xss(SOPORTE_EMAIL); ?></a>
      &nbsp;&middot;&nbsp;
      <?php echo xss(SOPORTE_TEL); ?>
      &nbsp;&middot;&nbsp;
      <?php echo xss(SOPORTE_HORARIO); ?>
    </div>
  </div>
</div>

<style>
/* ── Cuentas guardadas ─────────────────────────────────────── */
.cuentas-guardadas {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.cuentas-titulo {
  background: var(--primary-dark);
  padding: .5rem 1rem;
  font-size: .75rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: .4px;
}
.cuenta-item {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .75rem 1rem;
  background: var(--bg-card2);
  border-bottom: 1px solid var(--border);
  text-decoration: none;
  transition: background .15s;
  cursor: pointer;
}
.cuenta-item:last-child { border-bottom: none; }
.cuenta-item:hover { background: var(--accent-soft); }

.cuenta-avatar {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  font-size: .9rem; font-weight: 700; color: #fff;
  flex-shrink: 0; overflow: hidden;
  border: 2px solid var(--border);
}
.cuenta-avatar img { width: 100%; height: 100%; object-fit: cover; }

/* Divider con texto */
.divider-texto {
  display: flex; align-items: center; gap: .75rem;
  color: var(--text-dim); font-size: .75rem;
}
.divider-texto::before,
.divider-texto::after {
  content: ''; flex: 1;
  height: 1px; background: var(--border);
}
</style>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
function togglePass() {
  var i = document.getElementById('passInput');
  var e = document.getElementById('eyeIcon');
  i.type = i.type === 'password' ? 'text' : 'password';
  e.className = i.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
}
</script>
</body>
</html>
