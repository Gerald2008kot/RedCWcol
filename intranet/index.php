<?php
require_once __DIR__ . '/includes/security.php';
$usuario = requerirLogin();
$db      = getDB();
$pageTitle = 'Dashboard';

// ── Stats ──────────────────────────────────────────────────────
$totalArchivos  = $db->query("SELECT COUNT(*) FROM archivos WHERE activo=1")->fetchColumn();
$totalUsuarios  = $db->query("SELECT COUNT(*) FROM usuarios WHERE activo=1")->fetchColumn();
$totalMensajes  = $db->query("SELECT COUNT(*) FROM mensajes WHERE destinatario_id IS NULL")->fetchColumn();
$totalDescargas = $db->query("SELECT COALESCE(SUM(descargas),0) FROM archivos WHERE activo=1")->fetchColumn();

// Mensajes privados NO leídos del usuario actual
$sinLeer = $db->prepare("SELECT COUNT(*) FROM mensajes WHERE destinatario_id=? AND leido=0");
$sinLeer->execute([$usuario['id']]);
$totalSinLeer = (int)$sinLeer->fetchColumn();

// Archivos por tipo (para mini-gráfica)
$porTipo = $db->query("
    SELECT extension, COUNT(*) as total FROM archivos
    WHERE activo=1 GROUP BY extension ORDER BY total DESC LIMIT 5
")->fetchAll();

// Audios recientes — DB + archivos copiados manualmente en uploads/musica/
$audiosRecientes = $db->query("
    SELECT ar.*, u.nombre, u.apellido FROM archivos ar
    JOIN usuarios u ON u.id = ar.subido_por
    WHERE ar.activo=1 AND ar.extension IN ('mp3','wav','ogg','m4a','aac')
    ORDER BY ar.created_at DESC LIMIT 10
")->fetchAll();

// Agregar archivos copiados manualmente que no están en DB
$enDbAudio = [];
foreach ($audiosRecientes as $a) $enDbAudio[$a['nombre_disco']] = true;

$dirMusica = UPLOAD_DIR . 'musica/';
if (is_dir($dirMusica)) {
    foreach (scandir($dirMusica) as $archivo) {
        if (count($audiosRecientes) >= 10) break;
        if ($archivo === '.' || $archivo === '..') continue;
        if (!is_file($dirMusica . $archivo)) continue;
        $ext = strtolower(pathinfo($archivo, PATHINFO_EXTENSION));
        if (!in_array($ext, ['mp3','wav','ogg','m4a','aac'])) continue;
        if (isset($enDbAudio[$archivo])) continue;
        $titulo = preg_replace('/^\d{8}_\d{6}_[a-f0-9]+_/', '', pathinfo($archivo, PATHINFO_FILENAME));
        $titulo = trim(str_replace('_', ' ', $titulo)) ?: $archivo;
        $audiosRecientes[] = [
            'id'           => 0,
            'titulo'       => $titulo,
            'nombre_disco' => $archivo,
            'carpeta'      => 'musica',
            'extension'    => $ext,
            'tamano'       => (int)filesize($dirMusica . $archivo),
            'nombre'       => '—',
            'apellido'     => '',
            'created_at'   => date('Y-m-d H:i:s', filemtime($dirMusica . $archivo)),
            '_manual'      => true,
        ];
    }
}
$audiosRecientes = array_slice($audiosRecientes, 0, 5);

// Archivos recientes
$recientes = $db->query("
    SELECT ar.*, u.nombre, u.apellido FROM archivos ar
    JOIN usuarios u ON u.id = ar.subido_por
    WHERE ar.activo=1
    ORDER BY ar.created_at DESC LIMIT 6
")->fetchAll();

// Anuncios
$anuncios = $db->query("
    SELECT a.*, u.nombre, u.apellido FROM anuncios a
    JOIN usuarios u ON u.id = a.autor_id
    WHERE a.activo=1 ORDER BY a.fijado DESC, a.created_at DESC LIMIT 5
")->fetchAll();

// Feed de actividad reciente (últimas acciones en el sistema)
$actividad = $db->query("
    SELECT 'archivo' as tipo, titulo as detalle, created_at,
           (SELECT nombre||' '||apellido FROM usuarios WHERE id=subido_por) as actor
    FROM archivos WHERE activo=1
    UNION ALL
    SELECT 'mensaje', SUBSTR(contenido,1,60), created_at,
           (SELECT nombre||' '||apellido FROM usuarios WHERE id=usuario_id)
    FROM mensajes WHERE destinatario_id IS NULL
    ORDER BY created_at DESC LIMIT 8
")->fetchAll();

// Usuarios más activos (más archivos subidos)
$masActivos = $db->query("
    SELECT u.nombre, u.apellido, u.departamento, u.rol,
           COUNT(a.id) as archivos_subidos
    FROM usuarios u
    LEFT JOIN archivos a ON a.subido_por=u.id AND a.activo=1
    WHERE u.activo=1
    GROUP BY u.id ORDER BY archivos_subidos DESC LIMIT 5
")->fetchAll();

// ── Funciones helper ───────────────────────────────────────────
function iconoExt(string $ext): string {
    $ext  = strtolower($ext);
    $mapa = [
        'pdf'  => '<i class="fa-solid fa-file-pdf file-icon pdf"></i>',
        'doc'  => '<i class="fa-solid fa-file-word file-icon word"></i>',
        'docx' => '<i class="fa-solid fa-file-word file-icon word"></i>',
        'xls'  => '<i class="fa-solid fa-file-excel file-icon excel"></i>',
        'xlsx' => '<i class="fa-solid fa-file-excel file-icon excel"></i>',
        'ppt'  => '<i class="fa-solid fa-file-powerpoint file-icon ppt"></i>',
        'pptx' => '<i class="fa-solid fa-file-powerpoint file-icon ppt"></i>',
        'png'  => '<i class="fa-solid fa-file-image file-icon img"></i>',
        'jpg'  => '<i class="fa-solid fa-file-image file-icon img"></i>',
        'jpeg' => '<i class="fa-solid fa-file-image file-icon img"></i>',
        'gif'  => '<i class="fa-solid fa-file-image file-icon img"></i>',
        'webp' => '<i class="fa-solid fa-file-image file-icon img"></i>',
        'zip'  => '<i class="fa-solid fa-file-zipper file-icon zip"></i>',
        'rar'  => '<i class="fa-solid fa-file-zipper file-icon zip"></i>',
        'txt'  => '<i class="fa-solid fa-file-lines file-icon txt"></i>',
        'mp3'  => '<i class="fa-solid fa-file-audio file-icon audio"></i>',
        'wav'  => '<i class="fa-solid fa-file-audio file-icon audio"></i>',
        'ogg'  => '<i class="fa-solid fa-file-audio file-icon audio"></i>',
        'm4a'  => '<i class="fa-solid fa-file-audio file-icon audio"></i>',
        'aac'  => '<i class="fa-solid fa-file-audio file-icon audio"></i>',
        'mp4'  => '<i class="fa-solid fa-file-video file-icon video"></i>',
        'webm' => '<i class="fa-solid fa-file-video file-icon video"></i>',
    ];
    return isset($mapa[$ext]) ? $mapa[$ext] : '<i class="fa-solid fa-file file-icon other"></i>';
}

require_once __DIR__ . '/includes/header.php';
?>

<div class="container-fluid px-3 px-md-4">

  <!-- ── Bienvenida ──────────────────────────────────────────── -->
  <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
    <div>
      <h4 class="mb-0 fw-bold">Bienvenido, <?php echo xss($usuario['nombre']); ?> &#128075;</h4>
      <small class="text-muted">
        <?php echo date('l, d \d\e F \d\e Y'); ?> &middot;
        <?php echo xss($usuario['departamento'] ?: 'Sin departamento'); ?>
      </small>
    </div>
    <div class="d-flex align-items-center gap-2">
      <!-- Botón modo oscuro/claro -->
      <button class="btn btn-intra-outline btn-sm" id="themeToggle" title="Cambiar tema">
        <i class="fa-solid fa-circle-half-stroke"></i>
      </button>
      <span class="rol-badge rol-<?php echo xss($usuario['rol']); ?>">
        <?php echo xss(ucfirst($usuario['rol'])); ?>
      </span>
    </div>
  </div>

  <!-- ── Stats clickeables → redirigen a cada sección ───────── -->
  <div class="row g-3 mb-4" id="seccion-stats">
    <div class="col-6 col-md-3">
      <a href="biblioteca.php" class="stat-card stat-card-link text-decoration-none">
        <div class="stat-icon teal"><i class="fa-solid fa-folder-open"></i></div>
        <div>
          <div class="stat-value"><?php echo $totalArchivos; ?></div>
          <div class="stat-label">Archivos</div>
          <div class="stat-hint">Ver biblioteca &rarr;</div>
        </div>
      </a>
    </div>
    <div class="col-6 col-md-3">
      <?php if (esAdmin()): ?>
      <a href="admin/usuarios.php" class="stat-card stat-card-link text-decoration-none">
      <?php else: ?>
      <div class="stat-card">
      <?php endif; ?>
        <div class="stat-icon blue"><i class="fa-solid fa-users"></i></div>
        <div>
          <div class="stat-value"><?php echo $totalUsuarios; ?></div>
          <div class="stat-label">Usuarios activos</div>
          <?php if (esAdmin()): ?><div class="stat-hint">Ver usuarios &rarr;</div><?php endif; ?>
        </div>
      <?php echo esAdmin() ? '</a>' : '</div>'; ?>
    </div>
    <div class="col-6 col-md-3">
      <a href="chat.php" class="stat-card stat-card-link text-decoration-none">
        <div class="stat-icon amber">
          <i class="fa-solid fa-comments"></i>
          <?php if ($totalSinLeer > 0): ?>
          <span class="notif-dot"><?php echo $totalSinLeer; ?></span>
          <?php endif; ?>
        </div>
        <div>
          <div class="stat-value"><?php echo $totalMensajes; ?></div>
          <div class="stat-label">
            Mensajes públicos
            <?php if ($totalSinLeer > 0): ?>
            <span style="color:var(--warning);font-weight:700"> · <?php echo $totalSinLeer; ?> sin leer</span>
            <?php endif; ?>
          </div>
          <div class="stat-hint">Ir al chat &rarr;</div>
        </div>
      </a>
    </div>
    <div class="col-6 col-md-3">
      <a href="#seccion-actividad" class="stat-card stat-card-link text-decoration-none scroll-to">
        <div class="stat-icon green"><i class="fa-solid fa-download"></i></div>
        <div>
          <div class="stat-value"><?php echo $totalDescargas; ?></div>
          <div class="stat-label">Descargas totales</div>
          <div class="stat-hint">Ver actividad &rarr;</div>
        </div>
      </a>
    </div>
  </div>

  <div class="row g-4">

    <!-- ── Columna izquierda ─────────────────────────────────── -->
    <div class="col-lg-8">

      <!-- Accesos rápidos -->
      <div class="intra-card mb-4">
        <div class="card-header"><i class="fa-solid fa-grip"></i> Accesos Rápidos</div>
        <div class="card-body">
          <div class="tile-grid">
            <a href="biblioteca.php" class="tile"><i class="fa-solid fa-folder-open"></i><span>Biblioteca</span></a>
            <a href="chat.php" class="tile">
              <i class="fa-solid fa-comments"></i><span>Chat</span>
              <?php if ($totalSinLeer > 0): ?>
              <span class="tile-badge"><?php echo $totalSinLeer; ?></span>
              <?php endif; ?>
            </a>
            <?php if (puedeSubir()): ?>
            <a href="upload.php" class="tile"><i class="fa-solid fa-cloud-arrow-up"></i><span>Subir</span></a>
            <?php endif; ?>
            <a href="#seccion-audio" class="tile scroll-to"><i class="fa-solid fa-music"></i><span>Audio</span></a>
            <?php if (esAdmin()): ?>
            <a href="admin/usuarios.php" class="tile"><i class="fa-solid fa-users-gear"></i><span>Usuarios</span></a>
            <a href="admin/panel.php"    class="tile"><i class="fa-solid fa-chart-line"></i><span>Admin</span></a>
            <a href="admin/anuncios.php" class="tile"><i class="fa-solid fa-bullhorn"></i><span>Anuncios</span></a>
            <?php endif; ?>
            <a href="mailto:<?php echo xss(SOPORTE_EMAIL); ?>" class="tile">
              <i class="fa-solid fa-headset"></i><span>Soporte</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Archivos recientes -->
      <div class="intra-card mb-4">
        <div class="card-header">
          <i class="fa-solid fa-clock-rotate-left"></i> Archivos Recientes
          <a href="biblioteca.php" class="btn btn-intra-outline btn-sm ms-auto" style="font-size:.75rem">Ver todos</a>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="intra-table">
              <thead><tr>
                <th>Tipo</th><th>Título</th><th>Subido por</th><th>Depto.</th><th>Fecha</th><th></th>
              </tr></thead>
              <tbody>
              <?php foreach ($recientes as $f): ?>
              <tr>
                <td><?php echo iconoExt($f['extension']); ?></td>
                <td><span style="font-weight:500"><?php echo xss($f['titulo']); ?></span></td>
                <td style="font-size:.82rem"><?php echo xss($f['nombre'] . ' ' . $f['apellido']); ?></td>
                <td><span class="badge-dept"><?php echo xss($f['departamento'] ?: '—'); ?></span></td>
                <td style="font-size:.75rem;color:var(--text-muted)"><?php echo xss(substr($f['created_at'], 0, 10)); ?></td>
                <td>
                  <a href="biblioteca.php?ver=<?php echo $f['id']; ?>" class="btn btn-sm btn-intra-outline">
                    <i class="fa-solid fa-eye"></i>
                  </a>
                </td>
              </tr>
              <?php endforeach; ?>
              <?php if (!$recientes): ?>
              <tr><td colspan="6" class="text-center text-muted py-3">Sin archivos aún.</td></tr>
              <?php endif; ?>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ── NUEVO: Reproductor de Audio ─────────────────────── -->
      <div class="intra-card mb-4" id="seccion-audio">
        <div class="card-header">
          <i class="fa-solid fa-music" style="color:var(--accent)"></i> Audios Recientes
          <a href="biblioteca.php?ext=mp3" class="btn btn-intra-outline btn-sm ms-auto" style="font-size:.75rem">Ver todos</a>
        </div>
        <div class="card-body">
          <?php if (!$audiosRecientes): ?>
          <p class="text-center text-muted py-2 mb-0" style="font-size:.85rem">
            <i class="fa-solid fa-music-slash me-1"></i>
            No hay audios subidos aún.
            <?php if (puedeSubir()): ?>
            <a href="upload.php">Subir uno</a>
            <?php endif; ?>
          </p>
          <?php else: ?>
          <!-- Reproductor principal -->
          <div class="audio-player-main mb-3" id="audioPlayerWrap" style="display:none">
            <div class="d-flex align-items-center gap-3 mb-2">
              <div class="audio-thumb"><i class="fa-solid fa-music"></i></div>
              <div class="flex-fill">
                <div class="fw-600" id="audioTitle" style="font-size:.9rem"></div>
                <div style="font-size:.75rem;color:var(--text-muted)" id="audioAuthor"></div>
              </div>
            </div>
            <audio id="audioPlayer" controls style="width:100%;border-radius:var(--radius-sm)">
              Tu navegador no soporta audio HTML5.
            </audio>
          </div>
          <!-- Lista de audios -->
          <div class="d-flex flex-column gap-2">
            <?php foreach ($audiosRecientes as $audio):
              $aCarpeta = !empty($audio['carpeta']) ? $audio['carpeta'] : 'musica';
              $url = BASE_URL . '/uploads/' . $aCarpeta . '/' . rawurlencode($audio['nombre_disco']);
              // Fallback a raíz si no existe en subcarpeta
              if (!file_exists(UPLOAD_DIR . $aCarpeta . '/' . $audio['nombre_disco']) &&
                   file_exists(UPLOAD_DIR . $audio['nombre_disco'])) {
                  $url = BASE_URL . '/uploads/' . rawurlencode($audio['nombre_disco']);
              }
            ?>
            <div class="audio-item d-flex align-items-center gap-3"
                 data-src="<?php echo xss($url); ?>"
                 data-title="<?php echo xss($audio['titulo']); ?>"
                 data-author="<?php echo xss($audio['nombre'] . ' ' . $audio['apellido']); ?>">
              <button class="btn-play-audio" title="Reproducir">
                <i class="fa-solid fa-circle-play"></i>
              </button>
              <div class="flex-fill">
                <div style="font-size:.85rem;font-weight:600"><?php echo xss($audio['titulo']); ?></div>
                <div style="font-size:.72rem;color:var(--text-muted)">
                  <?php echo xss($audio['nombre'] . ' ' . $audio['apellido']); ?> &middot;
                  <?php echo xss(strtoupper($audio['extension'])); ?> &middot;
                  <?php echo xss(substr($audio['created_at'], 0, 10)); ?>
                </div>
              </div>
              <a href="biblioteca.php?descargar=<?php echo $audio['id']; ?>"
                 class="btn btn-sm btn-intra-outline" title="Descargar">
                <i class="fa-solid fa-download"></i>
              </a>
            </div>
            <?php endforeach; ?>
          </div>
          <?php endif; ?>
        </div>
      </div>

      <!-- ── NUEVO: Feed de actividad ────────────────────────── -->
      <div class="intra-card" id="seccion-actividad">
        <div class="card-header">
          <i class="fa-solid fa-bolt" style="color:var(--warning)"></i> Actividad Reciente
        </div>
        <div class="card-body p-0">
          <?php foreach ($actividad as $act): ?>
          <div class="actividad-item d-flex align-items-center gap-3 px-3 py-2"
               style="border-bottom:1px solid var(--border)">
            <div class="act-icon <?php echo $act['tipo'] === 'archivo' ? 'teal' : 'amber'; ?>">
              <i class="fa-solid fa-<?php echo $act['tipo'] === 'archivo' ? 'file-arrow-up' : 'comment'; ?>"></i>
            </div>
            <div class="flex-fill">
              <span style="font-size:.82rem">
                <strong><?php echo xss($act['actor']); ?></strong>
                <?php echo $act['tipo'] === 'archivo' ? 'subió' : 'escribió en el muro'; ?>
              </span>
              <div style="font-size:.75rem;color:var(--text-muted)"><?php echo xss($act['detalle']); ?></div>
            </div>
            <small style="font-size:.68rem;color:var(--text-dim);white-space:nowrap">
              <?php echo xss(substr($act['created_at'], 11, 5)); ?>
            </small>
          </div>
          <?php endforeach; ?>
          <?php if (!$actividad): ?>
          <p class="text-center py-3 text-muted mb-0">Sin actividad reciente.</p>
          <?php endif; ?>
        </div>
      </div>
    </div>

    <!-- ── Columna derecha ───────────────────────────────────── -->
    <div class="col-lg-4 d-flex flex-column gap-4">

      <!-- Anuncios -->
      <div class="intra-card">
        <div class="card-header">
          <i class="fa-solid fa-bullhorn"></i> Anuncios
          <?php if (esAdmin()): ?>
          <a href="admin/anuncios.php" class="btn btn-intra-outline btn-sm ms-auto" style="font-size:.75rem">Gestionar</a>
          <?php endif; ?>
        </div>
        <div class="card-body d-flex flex-column gap-3">
          <?php if (!$anuncios): ?>
          <p class="text-muted text-center mb-0" style="font-size:.85rem">Sin anuncios.</p>
          <?php endif; ?>
          <?php foreach ($anuncios as $a): ?>
          <div class="anuncio-card <?php echo $a['fijado'] ? 'fijado' : ''; ?>">
            <?php if ($a['fijado']): ?>
            <span style="font-size:.65rem;color:var(--warning);font-weight:700">
              <i class="fa-solid fa-thumbtack me-1"></i>FIJADO
            </span>
            <?php endif; ?>
            <div class="fw-600 mb-1" style="font-size:.88rem"><?php echo xss($a['titulo']); ?></div>
            <p style="font-size:.8rem;color:var(--text-muted);margin:0">
              <?php echo xss(mb_substr($a['contenido'], 0, 120)); ?>...
            </p>
            <small style="color:var(--text-dim)">
              <?php echo xss($a['nombre']); ?> &middot; <?php echo xss(substr($a['created_at'], 0, 10)); ?>
            </small>
          </div>
          <?php endforeach; ?>
        </div>
      </div>

      <!-- ── NUEVO: Usuarios más activos ─────────────────────── -->
      <div class="intra-card">
        <div class="card-header"><i class="fa-solid fa-trophy" style="color:var(--warning)"></i> Top Colaboradores</div>
        <div class="card-body p-0">
          <?php foreach ($masActivos as $i => $u): ?>
          <div class="d-flex align-items-center gap-3 px-3 py-2"
               style="border-bottom:1px solid var(--border)">
            <div class="top-rank rank-<?php echo $i + 1; ?>"><?php echo $i + 1; ?></div>
            <div class="flex-fill">
              <div style="font-size:.85rem;font-weight:600">
                <?php echo xss($u['nombre'] . ' ' . $u['apellido']); ?>
              </div>
              <div style="font-size:.72rem;color:var(--text-muted)">
                <?php echo xss($u['departamento'] ?: '—'); ?>
              </div>
            </div>
            <div style="font-size:.78rem;text-align:right">
              <div style="color:var(--accent);font-weight:700"><?php echo $u['archivos_subidos']; ?></div>
              <div style="color:var(--text-dim);font-size:.68rem">archivos</div>
            </div>
          </div>
          <?php endforeach; ?>
        </div>
      </div>

      <!-- ── NUEVO: Mini stats por tipo de archivo ───────────── -->
      <div class="intra-card">
        <div class="card-header"><i class="fa-solid fa-chart-pie"></i> Tipos de Archivos</div>
        <div class="card-body">
          <?php if (!$porTipo): ?>
          <p class="text-center text-muted mb-0" style="font-size:.85rem">Sin datos.</p>
          <?php else: ?>
          <?php foreach ($porTipo as $t):
            $pct = $totalArchivos > 0 ? round(($t['total'] / $totalArchivos) * 100) : 0;
          ?>
          <div class="mb-2">
            <div class="d-flex justify-content-between mb-1">
              <span style="font-size:.78rem;font-weight:600">.<?php echo xss(strtoupper($t['extension'])); ?></span>
              <span style="font-size:.75rem;color:var(--text-muted)"><?php echo $t['total']; ?> (<?php echo $pct; ?>%)</span>
            </div>
            <div class="mini-bar">
              <div class="mini-bar-fill" style="width:<?php echo $pct; ?>%"></div>
            </div>
          </div>
          <?php endforeach; ?>
          <?php endif; ?>
        </div>
      </div>

    </div>
  </div>
</div>

<style>
/* ── Stats clickeables ─────────────────────────────────────── */
.stat-card-link { display:flex; cursor:pointer; }
.stat-card-link:hover { border-color:var(--accent); transform:translateY(-3px); }
.stat-hint { font-size:.65rem; color:var(--accent); margin-top:.3rem; font-weight:600; letter-spacing:.3px; }

/* Punto de notificación en ícono */
.stat-icon { position:relative; }
.notif-dot {
  position:absolute; top:-4px; right:-4px;
  background:var(--danger); color:#fff;
  font-size:.55rem; font-weight:700;
  width:16px; height:16px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
}
.tile { position:relative; }
.tile-badge {
  position:absolute; top:6px; right:6px;
  background:var(--danger); color:#fff;
  font-size:.55rem; font-weight:700;
  width:16px; height:16px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
}

/* ── Reproductor audio ─────────────────────────────────────── */
.audio-player-main {
  background:var(--bg-card2);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:1rem;
}
.audio-thumb {
  width:44px; height:44px;
  background:linear-gradient(135deg,var(--primary),var(--accent));
  border-radius:10px;
  display:flex; align-items:center; justify-content:center;
  font-size:1.2rem; color:#fff;
  flex-shrink:0;
}
audio { height:36px; }
audio::-webkit-media-controls-panel { background:var(--bg-card2); }

.audio-item {
  padding:.5rem .75rem;
  border:1px solid var(--border);
  border-radius:var(--radius-sm);
  background:var(--bg-card2);
  transition:border-color .2s;
  cursor:pointer;
}
.audio-item:hover, .audio-item.playing { border-color:var(--accent); }
.audio-item.playing { background:var(--accent-soft); }

.btn-play-audio {
  background:none; border:none; padding:0;
  color:var(--accent); font-size:1.6rem;
  cursor:pointer; line-height:1;
  transition:transform .15s, color .15s;
}
.btn-play-audio:hover { transform:scale(1.15); color:var(--primary-light); }

/* ── Actividad ─────────────────────────────────────────────── */
.actividad-item:last-child { border-bottom:none !important; }
.act-icon {
  width:32px; height:32px; border-radius:8px;
  display:flex; align-items:center; justify-content:center;
  font-size:.85rem; flex-shrink:0;
}
.act-icon.teal  { background:rgba(13,110,110,.25); color:var(--accent); }
.act-icon.amber { background:rgba(240,165,0,.2);   color:#ffc040; }

/* ── Top colaboradores ─────────────────────────────────────── */
.top-rank {
  width:28px; height:28px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:.75rem; font-weight:700; flex-shrink:0;
}
.rank-1 { background:rgba(255,215,0,.2); color:#ffd700; border:1px solid rgba(255,215,0,.4); }
.rank-2 { background:rgba(192,192,192,.2); color:#c0c0c0; border:1px solid rgba(192,192,192,.3); }
.rank-3 { background:rgba(205,127,50,.2); color:#cd7f32; border:1px solid rgba(205,127,50,.3); }
.rank-4, .rank-5 { background:var(--accent-soft); color:var(--accent); border:1px solid var(--border); }

/* ── Barras de tipos de archivo ────────────────────────────── */
.mini-bar { height:5px; background:rgba(255,255,255,.06); border-radius:3px; overflow:hidden; }
.mini-bar-fill { height:100%; background:linear-gradient(90deg,var(--primary),var(--accent)); border-radius:3px; transition:width .6s ease; }

/* ── Íconos audio/video ────────────────────────────────────── */
.file-icon.audio { color:#a855f7; }
.file-icon.video { color:#ec4899; }
</style>

<script>
// ── Scroll suave a secciones ────────────────────────────────
document.querySelectorAll('.scroll-to').forEach(function(el) {
  el.addEventListener('click', function(e) {
    var href = el.getAttribute('href');
    if (href && href.startsWith('#')) {
      e.preventDefault();
      var target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Highlight breve
        target.style.transition = 'box-shadow .3s';
        target.style.boxShadow  = '0 0 0 2px var(--accent)';
        setTimeout(function() { target.style.boxShadow = ''; }, 1500);
      }
    }
  });
});

// ── Reproductor de audio ────────────────────────────────────
(function() {
  var player  = document.getElementById('audioPlayer');
  var wrap    = document.getElementById('audioPlayerWrap');
  var titleEl = document.getElementById('audioTitle');
  var authEl  = document.getElementById('audioAuthor');
  if (!player) return;

  document.querySelectorAll('.audio-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      if (e.target.closest('a')) return; // no interferir con descarga
      var src    = item.dataset.src;
      var title  = item.dataset.title;
      var author = item.dataset.author;

      // Marcar como playing
      document.querySelectorAll('.audio-item').forEach(function(i) { i.classList.remove('playing'); });
      item.classList.add('playing');

      // Cambiar icono play
      var icon = item.querySelector('.btn-play-audio i');
      if (icon) icon.className = 'fa-solid fa-circle-pause';

      // Actualizar player
      titleEl.textContent  = title;
      authEl.textContent   = author;
      player.src           = src;
      wrap.style.display   = 'block';
      wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      player.play();
    });

    // Botón play individual
    var btn = item.querySelector('.btn-play-audio');
    if (btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        item.click();
      });
    }
  });

  // Al terminar un audio restaurar iconos
  player.addEventListener('ended', function() {
    document.querySelectorAll('.audio-item').forEach(function(i) {
      i.classList.remove('playing');
      var icon = i.querySelector('.btn-play-audio i');
      if (icon) icon.className = 'fa-solid fa-circle-play';
    });
  });
})();

// ── Tema claro/oscuro ───────────────────────────────────────
(function() {
  var btn  = document.getElementById('themeToggle');
  var body = document.body;
  var saved = localStorage.getItem('intra_theme');
  if (saved === 'light') body.classList.add('theme-light');

  if (btn) btn.addEventListener('click', function() {
    body.classList.toggle('theme-light');
    localStorage.setItem('intra_theme', body.classList.contains('theme-light') ? 'light' : 'dark');
  });
})();
</script>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
