<?php
/**
 * Pinta un documento JSON como pagina completa, por el camino de verdad.
 *
 * Es lo que hace WordPress al servir una pagina: saneador → compilador de
 * CSS → renderizador de nodos, con las tres hojas del tema delante. Lo usa
 * tools/prueba-lienzo.mjs para que el iframe del constructor cargue PHP de
 * verdad y se pueda medir `getComputedStyle` en el DOM que ve el usuario.
 *
 *   .tools/php/php tools/render-doc.php documento.json          publico
 *   KRG_CANVAS=1  .tools/php/php tools/render-doc.php doc.json  lienzo
 *   KRG_PREVIEW=1 .tools/php/php tools/render-doc.php doc.json  «Preview»
 */

define( 'ABSPATH', __DIR__ . '/' );
require_once __DIR__ . '/wp-shim.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/constants.php';
foreach (
	[
		'/core/render/RenderContext.php',
		'/core/design/Contrast.php',
		'/core/design/TokenDefaults.php',
		'/core/design/TokenRepository.php',
		'/core/design/TokenCompiler.php',
		'/core/design/PresetStore.php',
		'/core/design/FontCatalog.php',
		'/core/security/UrlValidator.php',
		'/core/content/BlogSettings.php',
		'/core/components/Catalog.php',
		'/core/components/BrandCatalog.php',
		'/core/components/Registry.php',
		'/core/media/Images.php',
		'/core/media/Formats.php',
		'/core/render/ComponentRenders.php',
		'/core/render/BrandRenders.php',
		'/core/render/NodeRenderer.php',
		'/core/security/Sanitizer.php',
		'/core/style/Breakpoints.php',
		'/core/style/BoxStyles.php',
		'/core/style/DocumentCssCompiler.php',
	] as $f
) {
	require_once $base . $f;
}

\Meridian\Components\Registry::boot();

// Entradas de mentira para las rejillas de blog: `KRG_ENTRADAS=3`.
// Sin esto `WP_Query` no devuelve nada y el modulo no pinta tarjetas.
$cuantas = (int) getenv( 'KRG_ENTRADAS' );
if ( $cuantas > 0 ) {
	$GLOBALS['krg_entradas'] = [];
	for ( $i = 1; $i <= $cuantas; $i++ ) {
		$GLOBALS['krg_entradas'][] = new WP_Post(
			[
				'ID'           => 100 + $i,
				'post_title'   => 'Entrada de prueba ' . $i,
				'post_name'    => 'entrada-' . $i,
				'post_excerpt' => 'Un resumen corto de la entrada numero ' . $i . ' para ver como queda la tarjeta.',
				'post_date'    => '3 de octubre de 2026',
				'thumbnail_id' => 500 + $i,
			]
		);
	}
}

// Categorias de mentira para el modulo de categorias: `KRG_CATEGORIAS=4`.
// Sin esto `get_categories()` devuelve una lista vacia y el bloque no
// pinta nada, que es un verde falso de manual: el banco daria por bueno
// un modulo que en una web con categorias podria estar roto.
$cats = (int) getenv( 'KRG_CATEGORIAS' );
if ( $cats > 0 ) {
	$nombres                     = [ 'Recetas', 'Apicultura', 'Temporada', 'Notas del campo', 'Prensa' ];
	$GLOBALS['krg_categorias']   = [];
	for ( $i = 0; $i < $cats; $i++ ) {
		$nombre                      = $nombres[ $i % count( $nombres ) ];
		$GLOBALS['krg_categorias'][] = (object) [
			'term_id' => 10 + $i,
			'name'    => $nombre,
			'slug'    => sanitize_title( $nombre ),
			'count'   => 3 + $i,
		];
	}
}

// Tokens de una instalacion concreta: `KRG_TOKENS=/ruta/tokens.json`.
// Sin esto cada proceso arranca con el preset y no hay forma de probar
// «este sitio tiene elegida esta tipografia».
$tok = getenv( 'KRG_TOKENS' );
if ( $tok && is_readable( $tok ) ) {
	$datos = json_decode( (string) file_get_contents( $tok ), true );
	if ( is_array( $datos ) ) {
		update_option( MERIDIAN_OPTION_TOKENS, $datos['tokens'] ?? $datos, false );
		if ( isset( $datos['header'] ) ) {
			update_option( MERIDIAN_OPTION_HEADER, $datos['header'], false );
		}
		if ( isset( $datos['footer'] ) ) {
			update_option( MERIDIAN_OPTION_FOOTER, $datos['footer'], false );
		}
	}
}

$ctx            = new \Meridian\Render\RenderContext();
$ctx->isPreview = '1' === getenv( 'KRG_PREVIEW' ) || '1' === getenv( 'KRG_CANVAS' );
$ctx->isCanvas  = '1' === getenv( 'KRG_CANVAS' );

$raw = file_get_contents( $argv[1] ?? 'php://stdin' );
$doc = json_decode( (string) $raw, true );
if ( ! is_array( $doc ) ) {
	$doc = [ 'sections' => [] ];
}

// Exactamente lo que hace el guardado antes de tocar la base de datos.
$doc = \Meridian\Security\Sanitizer::document( $doc );
$css = \Meridian\Style\DocumentCssCompiler::compile( $doc );

$html = '';
foreach ( $doc['sections'] as $s ) {
	$html .= \Meridian\Render\NodeRenderer::render( $s, $ctx );
}

// Las tres hojas van incrustadas y en el mismo orden que las encola el
// tema (base → components → modules → CSS del documento). Enlazarlas no
// vale: el iframe del banco se sirve por https y el navegador no deja que
// cargue archivos locales, asi que la cascada de verdad —.m-c-section, las
// reglas de ancho completo, los temas— no llegaria a competir y la prueba
// seria mas facil de lo que es.
$assets = dirname( __DIR__ ) . '/krg-cms/assets/css';
echo '<!doctype html><html lang="es"><head><meta charset="utf-8">';
// Los tokens, primero y en linea, como los encola el tema. Sin ellos
// `--color-background` no existe, el `body` sale transparente y la
// cortina —que busca un color opaco al que agarrarse— no se comporta
// como en el sitio de verdad.
echo '<style id="krg-tokens">' . \Meridian\Design\TokenCompiler::css() . '</style>';
foreach ( [ 'base', 'components', 'modules' ] as $hoja ) {
	echo '<style id="krg-' . $hoja . '">' . file_get_contents( $assets . '/' . $hoja . '.css' ) . '</style>';
}
echo '<style id="krg-doc-css">' . $css . '</style>';
// Las fuentes, por el mismo camino que en WordPress: el tema las encola
// y WordPress las imprime. Sin esto la pagina declara la familia y nadie
// baja el archivo —que es justo el fallo que arreglamos—, asi que el
// banco tiene que ver los <link> de verdad.
\Meridian\Design\FontCatalog::enqueue_used();
foreach ( $GLOBALS['krg_styles'] ?? [] as $id => $hoja ) {
	if ( ! empty( $hoja['src'] ) ) {
		echo '<link rel="stylesheet" id="' . htmlspecialchars( (string) $id ) . '" href="' . htmlspecialchars( (string) $hoja['src'] ) . '">';
	}
	if ( ! empty( $hoja['inline'] ) ) {
		echo '<style id="' . htmlspecialchars( (string) $id ) . '-inline">' . $hoja['inline'] . '</style>';
	}
}
echo '</head><body class="' . ( $ctx->isCanvas ? 'krg-canvas' : '' ) . '">';
echo '<div class="m-page"><main class="m-main">' . $html . '</main></div>';

// El JS publico, incrustado igual que el CSS y por el mismo motivo.
//
// No estaba, y ahi se escondia una clase entera de fallos: `modules.js`
// no solo anima, tambien ESCRIBE estilos en linea y clases sobre las
// secciones (la cortina). El lienzo de WordPress carga este guion
// siempre, asi que una prueba que no lo cargue mide una pagina que no
// existe. Se puede apagar con KRG_SIN_JS=1 para comparar.
if ( '1' !== getenv( 'KRG_SIN_JS' ) ) {
	$js = dirname( __DIR__ ) . '/krg-cms/assets/js';
	foreach ( [ 'public', 'modules' ] as $guion ) {
		echo '<script id="krg-js-' . $guion . '">' . file_get_contents( $js . '/' . $guion . '.js' ) . '</script>';
	}
}
echo '</body></html>';
