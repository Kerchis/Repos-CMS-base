<?php
/**
 * Ejecuta los renderizadores del tema fuera de WordPress.
 *
 * Por que: hasta ahora el marcado de prueba se escribia a mano en
 * tools/preview.py, asi que se verificaba una imitacion, no el codigo real.
 * Con el PHP que monta tools/devenv.sh si se puede llamar a los
 * renderizadores de verdad y comprobar que clases y estilos emiten.
 *
 * Solo define las funciones de WordPress que tocan los renderizadores de
 * maquetacion y de marca. No es un WordPress: es un banco de pruebas para
 * el marcado. Lo que dependa de la base de datos o de la biblioteca de
 * medios devuelve valores vacios a proposito.
 *
 *   .tools/php/php tools/render.php            lista los casos
 *   .tools/php/php tools/render.php section    imprime el marcado de uno
 */

define( 'ABSPATH', __DIR__ . '/' );

/* ---------------------------------------------------------------- */
/* Minimo de WordPress                                              */
/* ---------------------------------------------------------------- */

function sanitize_html_class( $c, $fallback = '' ) {
	$c = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $c );
	return '' === $c ? $fallback : $c;
}
function sanitize_key( $k ) {
	return strtolower( preg_replace( '/[^a-z0-9_\-]/i', '', (string) $k ) );
}
function sanitize_text_field( $t ) {
	return trim( strip_tags( (string) $t ) );
}
function absint( $n ) {
	return abs( (int) $n );
}
function esc_attr( $t ) {
	return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' );
}
function esc_html( $t ) {
	return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' );
}
function esc_url( $u ) {
	return htmlspecialchars( (string) $u, ENT_QUOTES, 'UTF-8' );
}
function esc_attr__( $t, $d = '' ) {
	return esc_attr( $t );
}
function esc_html__( $t, $d = '' ) {
	return esc_html( $t );
}
function __( $t, $d = '' ) {
	return $t;
}
function _e( $t, $d = '' ) {
	echo $t;
}
function wp_kses_post( $t ) {
	return (string) $t;
}
function wp_parse_args( $a, $b = [] ) {
	return array_merge( (array) $b, (array) $a );
}
function wp_get_attachment_image( ...$a ) {
	return '';
}
function wp_get_attachment_image_url( ...$a ) {
	return '';
}
function wp_get_attachment_image_src( ...$a ) {
	return false;
}
function get_post_meta( ...$a ) {
	return '';
}
function get_bloginfo( $k = 'name' ) {
	return 'Sitio de prueba';
}
function home_url( $p = '/' ) {
	return 'https://ejemplo.test' . $p;
}
function get_permalink( $id = 0 ) {
	return 'https://ejemplo.test/pagina/';
}
function apply_filters( $tag, $value, ...$rest ) {
	return $value;
}
function do_action( ...$a ) {}
function add_action( ...$a ) {}
function add_filter( ...$a ) {}
function get_option( $k, $d = false ) {
	return $GLOBALS['krg_options'][ $k ] ?? $d;
}
function wp_unique_id( $p = '' ) {
	static $i = 0;
	return $p . ( ++$i );
}
function is_user_logged_in() {
	return false;
}
function shortcode_exists( $t ) {
	return false;
}
function do_shortcode( $t ) {
	return (string) $t;
}
function wp_rand( $min = 0, $max = 0 ) {
	return $min;
}
function wp_strip_all_tags( $t, $br = false ) {
	return trim( strip_tags( (string) $t ) );
}
function wp_json_encode( $d, $f = 0 ) {
	return json_encode( $d, $f );
}
function wp_trim_words( $t, $n = 55, $m = null ) {
	return (string) $t;
}
function get_the_ID() {
	return 0;
}
function has_post_thumbnail( ...$a ) {
	return false;
}
function number_format_i18n( $n, $d = 0 ) {
	return number_format( (float) $n, (int) $d );
}
function sanitize_title( $t ) {
	$t = strtolower( trim( strip_tags( (string) $t ) ) );
	$t = strtr( $t, [ 'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'ü' => 'u' ] );
	$t = preg_replace( '/[^a-z0-9]+/', '-', $t );
	return trim( (string) $t, '-' );
}
function sanitize_hex_color( $c ) {
	$c = trim( (string) $c );
	return preg_match( '/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $c ) ? $c : null;
}

/* Consultas: el banco no tiene base de datos, asi que no hay entradas.
   Es justo el caso que interesa medir —una rejilla de blog sin nada que
   mostrar no debe reservar espacio en la web publica. */
class WP_Query {
	public array $posts = [];
	public function __construct( $args = [] ) {}
	public function have_posts() { return false; }
}
function wp_reset_postdata() {}
function get_categories( $a = [] ) { return []; }
function get_category_link( $c ) { return 'https://ejemplo.test/categoria/'; }
function wp_get_post_categories( $id ) { return []; }
function get_the_post_thumbnail( ...$a ) { return ''; }
function get_the_date( $f = '', $p = null ) { return '1 de enero'; }
function get_the_title( $p = null ) { return 'Entrada'; }
function get_the_excerpt( $p = null ) { return ''; }

/* ---------------------------------------------------------------- */
/* Carga de las clases que hacen falta                               */
/* ---------------------------------------------------------------- */

// Lo que falte del minimo de WordPress, con guardas: aqui ya hay media
// docena de funciones definidas arriba y el fichero compartido solo
// rellena los huecos.
require_once __DIR__ . '/wp-shim.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/constants.php';
foreach (
	[
		'/core/render/RenderContext.php',
		'/core/design/Contrast.php',
		'/core/design/TokenRepository.php',
		'/core/design/TokenCompiler.php',
		'/core/security/UrlValidator.php',
		'/core/components/Catalog.php',
		'/core/components/BrandCatalog.php',
		'/core/components/Registry.php',
		'/core/render/ComponentRenders.php',
		'/core/render/BrandRenders.php',
		'/core/render/NodeRenderer.php',
		'/core/security/Sanitizer.php',
		'/core/style/Breakpoints.php',
		'/core/style/DocumentCssCompiler.php',
	] as $f
) {
	if ( file_exists( $base . $f ) ) {
		require_once $base . $f;
	}
}

use Meridian\Render\ComponentRenders;
use Meridian\Render\RenderContext;

\Meridian\Components\Registry::boot();

$ctx            = new RenderContext();
$ctx->isPreview = false;

// Tres contextos, como en el tema:
//   (sin nada)      la web publica
//   KRG_PREVIEW=1   la pestana «Preview»: el borrador, pero sin andamiaje
//   KRG_CANVAS=1    el lienzo del constructor: con andamiaje
if ( '1' === getenv( 'KRG_PREVIEW' ) ) {
	$ctx->isPreview = true;
}
if ( '1' === getenv( 'KRG_CANVAS' ) ) {
	$ctx->isPreview = true;
	$ctx->isCanvas  = true;
}

/** Monta un nodo con lo minimo que esperan los renderizadores. */
function node( string $type, array $props = [], string $id = 'x1' ): array {
	return [
		'id'       => $id,
		'type'     => $type,
		'props'    => $props,
		'children' => [],
	];
}

/* ---------------------------------------------------------------- */
/* Casos                                                             */
/* ---------------------------------------------------------------- */

$panel = function ( $h = 'screen' ) use ( $ctx ) {
	$n = node( 'split-panel', [ 'title' => 'Titular', 'height' => $h ], 'sp1' );
	return \Meridian\Render\BrandRenders::split_panel( $n, $n['props'], '', $ctx );
};

/**
 * Envuelve el marcado de un modulo en la fila y la columna que intercala el
 * constructor, usando los renderizadores de verdad: la fila real es un grid
 * con `align-items:start`, y eso cambia por completo como se estira (o no)
 * lo que lleva dentro.
 */
function fila( string $markup, RenderContext $ctx, int $columnas = 1 ): string {
	$celdas = '';
	for ( $i = 1; $i <= $columnas; $i++ ) {
		$col     = node( 'column', [ 'span' => (int) ( 12 / $columnas ) ], 'c' . $i );
		$celdas .= ComponentRenders::column( $col, $col['props'], 1 === $i ? $markup : '<p>Texto</p>', $ctx );
	}
	$row = node( 'row', [], 'r1' );
	return ComponentRenders::row( $row, $row['props'], $celdas, $ctx );
}

/**
 * Fila y columna reales, con los nodos de los modulos colgando del arbol.
 *
 * `fila()` solo envuelve marcado; esto ademas declara que modulos hay
 * dentro, que es lo que mira el motor para decidir si una seccion esta
 * vacia. Hace falta para medir el caso «el modulo esta puesto pero no
 * pinta nada».
 */
function fila_con_nodos( array $modulos, string $markup, RenderContext $ctx ): string {
	$col             = node( 'column', [ 'span' => 12 ], 'cn1' );
	$col['children'] = $modulos;
	$celda           = ComponentRenders::column( $col, $col['props'], $markup, $ctx );
	$row             = node( 'row', [], 'rn1' );
	$row['children'] = [ $col ];
	return ComponentRenders::row( $row, $row['props'], $celda, $ctx );
}

/**
 * Documento completo por el camino real: saneado, CSS compilado y marcado.
 *
 * Por que: `fila()` y los casos de arriba llaman al renderizador a pelo, asi
 * que no pasan por el saneador ni por DocumentCssCompiler. Los estilos que el
 * usuario pone en el panel (fondo, relleno...) viven justo en ese tramo. Esto
 * monta sección → fila → columna → módulo como lo hace el constructor, pasa el
 * documento por el mismo saneador que la API y devuelve el CSS compilado
 * delante del marcado, para poder medir en el navegador quién gana la cascada.
 */
function documento( array $secciones ): string {
	global $ctx;
	$doc  = \Meridian\Security\Sanitizer::document( [ 'sections' => $secciones ] );
	$css  = \Meridian\Style\DocumentCssCompiler::compile( $doc );
	$html = '';
	foreach ( $doc['sections'] as $s ) {
		$html .= \Meridian\Render\NodeRenderer::render( $s, $ctx );
	}
	return '<style id="krg-doc-css">' . $css . '</style>' . $html;
}

/** Sección → fila → columna → módulos, como los intercala el constructor. */
function arbol( array $sec_props, array $modulos, string $sec_id = 'sec1' ): array {
	$col             = node( 'column', [ 'span' => 12 ], 'col1' );
	$col['children'] = $modulos;
	$row             = node( 'row', [], 'row1' );
	$row['children'] = [ $col ];
	$sec             = node( 'section', $sec_props, $sec_id );
	$sec['children'] = [ $row ];
	return $sec;
}

/** Seccion de mapa tal y como la monta el constructor, con alto propio. */
$mapa_seccion = function () use ( $ctx ) {
	$sec             = node( 'section', [ 'width' => 'full' ], 'mapa' );
	$sec['children'] = [ node( 'map', [], 'm1' ) ];
	return ComponentRenders::section( $sec, $sec['props'], fila( '<div class="m-map" style="--m-map-h:360px"><iframe title="Mapa"></iframe></div>', $ctx ), $ctx );
};

/** Carta de ejemplo para los casos de prueba (contenido ficticio). */
function carta_props(): array {
	return [
		'title'      => 'Nuestra carta',
		'eyebrow'    => 'Cocina del dia',
		'groupMode'  => 'tabs',
		'showAll'    => true,
		'allLabel'   => 'Todo',
		'showImages' => true,
		'imageShape' => 'square',
		'imageSize'  => 96,
		'desktop'    => 2,
		'theme'      => 'light',
		'accent'     => [ 'mode' => 'custom', 'value' => '#c0152f' ],
		'linkText'   => 'Ver el menu de hoy',
		'linkUrl'    => '/carta/',
		'categories' => [
			[ 'label' => 'Pizzas', 'text' => 'Masa madre de 48 horas.' ],
			[ 'label' => 'Pastas' ],
			[ 'label' => 'Postres' ],
			[ 'label' => 'Bebidas' ],
		],
		'items'      => [
			[ 'title' => 'Pizza margarita', 'text' => 'Tomate, mozzarella y albahaca fresca.', 'price' => '$12.00', 'category' => 'Pizzas', 'badge' => '', 'imageId' => 0 ],
			[ 'title' => 'Pasta al pesto', 'text' => 'Albahaca, pinones y parmesano.', 'price' => '$20.00', 'category' => 'Pastas', 'badge' => 'Nuevo', 'imageId' => 0 ],
			[ 'title' => 'Pizza prosciutto', 'text' => 'Jamon curado y rucula.', 'price' => '$14.00', 'category' => 'Pizzas', 'badge' => '', 'imageId' => 0 ],
			[ 'title' => 'Tiramisu', 'text' => 'Receta clasica de la casa.', 'price' => '$6.00', 'category' => 'Postres', 'badge' => '', 'imageId' => 0 ],
			[ 'title' => 'Limonada de la casa', 'text' => 'Hierbabuena y jengibre.', 'price' => '$4.00', 'category' => 'Bebidas', 'badge' => '', 'imageId' => 0 ],
		],
	];
}

/** Pie partido de ejemplo. */
function pie_props( string $side ): array {
	return [
		'mediaSide' => $side,
		'ratio'     => 'half',
		'height'    => 'auto',
		'imageId'   => 7,
		'alt'       => 'Fotografia del local',
		'eyebrow'   => 'Llamanos',
		'phone'     => '01 2345 6789',
		'lines'     => [
			[ 'text' => 'Lunes a viernes: 10:00 - 17:00' ],
			[ 'text' => 'Fin de semana: 10:00 - 15:00' ],
		],
		'social'    => [
			[ 'network' => 'facebook', 'url' => 'https://facebook.com', 'label' => 'Facebook' ],
			[ 'network' => 'instagram', 'url' => 'https://instagram.com', 'label' => 'Instagram' ],
			[ 'network' => 'x', 'url' => 'https://x.com', 'label' => 'X' ],
			[ 'network' => 'whatsapp', 'url' => 'https://wa.me/1', 'label' => 'WhatsApp' ],
		],
		'columns'   => [
			[ 'title' => 'Servicios' ],
			[ 'title' => 'Compania' ],
		],
		'links'     => [
			[ 'label' => 'Asesoria 1 a 1', 'url' => '/asesoria/', 'column' => 'Servicios' ],
			[ 'label' => 'Revision de cuentas', 'url' => '/cuentas/', 'column' => 'Servicios' ],
			[ 'label' => 'Consultoria', 'url' => '/consultoria/', 'column' => 'Servicios' ],
			[ 'label' => 'Sobre nosotros', 'url' => '/nosotros/', 'column' => 'Compania' ],
			[ 'label' => 'El equipo', 'url' => '/equipo/', 'column' => 'Compania' ],
		],
		'legal'     => [
			[ 'label' => 'Terminos y condiciones', 'url' => '/terminos/' ],
			[ 'label' => 'Privacidad', 'url' => '/privacidad/' ],
			[ 'label' => 'Cookies', 'url' => '/cookies/' ],
		],
		'copyright' => '(c) 2026 Nombre del negocio. Todos los derechos reservados.',
		'showRule'  => true,
		'theme'     => 'light',
		'align'     => 'left',
	];
}

$cases = [
	'section-exacto-300px' => function () use ( $ctx, $panel ) {
		$n = node(
			'section',
			[
				'width'          => 'full',
				'minHeight'      => 'custom',
				'minHeightValue' => 300,
				'minHeightUnit'  => 'px',
				'heightMode'     => 'exact',
				'vAlign'         => 'center',
			],
			's1'
		);
		$n['children'] = [ node( 'split-panel', [], 'sp1a' ) ];
		return ComponentRenders::section( $n, $n['props'], fila( $panel( 'screen' ), $ctx ), $ctx );
	},
	'section-minimo-300px' => function () use ( $ctx, $panel ) {
		$n = node(
			'section',
			[
				'width'          => 'full',
				'minHeight'      => 'custom',
				'minHeightValue' => 300,
				'minHeightUnit'  => 'px',
				'heightMode'     => 'min',
			],
			's2'
		);
		$n['children'] = [ node( 'split-panel', [], 'sp2a' ) ];
		return ComponentRenders::section( $n, $n['props'], fila( $panel( 'screen' ), $ctx ), $ctx );
	},
	'section-porcentaje-45' => function () use ( $ctx, $panel ) {
		$n = node(
			'section',
			[
				'width'          => 'full',
				'minHeight'      => 'custom',
				'minHeightValue' => 45,
				'minHeightUnit'  => 'vh',
			],
			's3'
		);
		$n['children'] = [ node( 'text', [], 't3a' ) ];
		return ComponentRenders::section( $n, $n['props'], fila( '<p>contenido</p>', $ctx ), $ctx );
	},
	// Reproduce la pagina del informe: hero con alto a medida, luego una
	// seccion «pantalla menos la cabecera» SIN contenido, y despues el mapa.
	'pagina-con-hueco'     => function () use ( $ctx, $panel ) {
		$hero = node(
			'section',
			[
				'width'          => 'full',
				'minHeight'      => 'custom',
				'minHeightValue' => 90,
				'minHeightUnit'  => 'vh',
				'heightMode'     => 'exact',
				'vAlign'         => 'start',
			],
			'hero'
		);
		$hero['children'] = [ node( 'split-panel', [ 'title' => 'Hero' ], 'sp' ) ];

		$vacia = node(
			'section',
			[
				'width'     => 'full',
				'minHeight' => 'screen-minus-header',
				'vAlign'    => 'center',
			],
			'vacia'
		);

		// Vacia «de verdad»: una fila con dos columnas y ningun modulo.
		$col1               = node( 'column', [], 'c1' );
		$col2               = node( 'column', [], 'c2' );
		$row                = node( 'row', [], 'r1' );
		$row['children']    = [ $col1, $col2 ];
		$vacia2             = node( 'section', [ 'width' => 'full', 'minHeight' => 'tall', 'vAlign' => 'center' ], 'vacia2' );
		$vacia2['children'] = [ $row ];

		$mapa             = node( 'section', [ 'width' => 'full' ], 'mapa' );
		$mapa['children'] = [ node( 'map', [], 'm1' ) ];

		return ComponentRenders::section( $hero, $hero['props'], $panel( 'screen' ), $ctx )
			. ComponentRenders::section( $vacia, $vacia['props'], '', $ctx )
			. ComponentRenders::section( $vacia2, $vacia2['props'], '<div class="m-c-row m-n-r1"><div class="m-c-column m-n-c1"></div><div class="m-c-column m-n-c2"></div></div>', $ctx )
			. ComponentRenders::section( $mapa, $mapa['props'], '<div class="m-map" style="--m-map-h:360px"><iframe title="Mapa"></iframe></div>', $ctx );
	},
	// Pantalla completa CON contenido: no debe cambiar nada.
	'full-con-contenido'   => function () use ( $ctx, $panel ) {
		$n             = node( 'section', [ 'width' => 'full', 'minHeight' => 'screen', 'vAlign' => 'center' ], 'full1' );
		$n['children'] = [ node( 'split-panel', [ 'title' => 'Hola' ], 'sp9' ) ];
		return ComponentRenders::section( $n, $n['props'], $panel( 'auto' ), $ctx );
	},
	// Separador a medida sin contenido: ya tampoco se imprime. Para dejar
	// un hueco a proposito esta el modulo Espaciador, que si es contenido.
	'separador-a-medida'   => function () use ( $ctx ) {
		$n = node(
			'section',
			[
				'width'          => 'full',
				'minHeight'      => 'custom',
				'minHeightValue' => 200,
				'minHeightUnit'  => 'px',
				'heightMode'     => 'min',
			],
			'sep'
		);
		return ComponentRenders::section( $n, $n['props'], '', $ctx );
	},
	/* ---------------------------------------------------------------- */
	/* Matriz del hueco entre el hero y el mapa                          */
	/*                                                                    */
	/* Cada caso es una estructura plausible de la pagina del informe.    */
	/* El medidor dice cual deja franja muerta y de donde sale.           */
	/* ---------------------------------------------------------------- */

	// Hero = panel partido con alto propio; la seccion impone 90% exacto.
	'hueco-a-panel-exacto' => function () use ( $ctx, $panel, $mapa_seccion ) {
		$hero = node(
			'section',
			[
				'width'          => 'full',
				'minHeight'      => 'custom',
				'minHeightValue' => 90,
				'minHeightUnit'  => 'vh',
				'heightMode'     => 'exact',
				'vAlign'         => 'start',
				'curtain'        => 'on',
			],
			'hero'
		);
		$hero['children'] = [ node( 'split-panel', [ 'title' => 'Plantas | Cafe' ], 'sp' ) ];
		return ComponentRenders::section( $hero, $hero['props'], fila( $panel( 'auto' ), $ctx ), $ctx )
			. $mapa_seccion();
	},

	// Hero = panel partido «medio» dentro de una seccion «pantalla menos
	// cabecera»: el minimo de la seccion es mayor que el panel.
	'hueco-b-panel-corto'  => function () use ( $ctx, $panel, $mapa_seccion ) {
		$hero = node(
			'section',
			[
				'width'     => 'full',
				'minHeight' => 'screen-minus-header',
				'vAlign'    => 'start',
				'curtain'   => 'on',
			],
			'hero'
		);
		$hero['children'] = [ node( 'split-panel', [ 'title' => 'Plantas | Cafe' ], 'sp' ) ];
		return ComponentRenders::section( $hero, $hero['props'], fila( $panel( 'medium' ), $ctx ), $ctx )
			. $mapa_seccion();
	},

	// Hero = fila de dos columnas (texto + imagen), sin modulo de sistema.
	'hueco-c-columnas'     => function () use ( $ctx, $mapa_seccion ) {
		$hero = node(
			'section',
			[
				'width'     => 'full',
				'minHeight' => 'screen-minus-header',
				'vAlign'    => 'start',
				'curtain'   => 'on',
			],
			'hero'
		);
		$txt              = node( 'text', [], 't1' );
		$img              = node( 'image', [], 'i1' );
		$c1               = node( 'column', [], 'c1' );
		$c1['children']   = [ $txt ];
		$c2               = node( 'column', [], 'c2' );
		$c2['children']   = [ $img ];
		$row              = node( 'row', [], 'r1' );
		$row['children']  = [ $c1, $c2 ];
		$hero['children'] = [ $row ];
		$markup = fila( '<h1 class="m-role-h1">Plantas | Cafe</h1>', $ctx, 2 );
		return ComponentRenders::section( $hero, $hero['props'], $markup, $ctx ) . $mapa_seccion();
	},

	// El mapa con alto propio dentro de una seccion mas alta que el.
	'hueco-d-mapa-centrado' => function () use ( $ctx, $panel ) {
		$hero = node(
			'section',
			[
				'width'     => 'full',
				'minHeight' => 'screen-minus-header',
				'vAlign'    => 'start',
				'curtain'   => 'on',
			],
			'hero'
		);
		$hero['children'] = [ node( 'split-panel', [ 'title' => 'Plantas | Cafe' ], 'sp' ) ];

		$sec = node(
			'section',
			[
				'width'          => 'full',
				'minHeight'      => 'custom',
				'minHeightValue' => 560,
				'minHeightUnit'  => 'px',
				'heightMode'     => 'min',
				'vAlign'         => 'center',
			],
			'mapa'
		);
		$sec['children'] = [ node( 'map', [], 'm1' ) ];

		return ComponentRenders::section( $hero, $hero['props'], fila( $panel( 'screen' ), $ctx ), $ctx )
			. ComponentRenders::section( $sec, $sec['props'], fila( '<div class="m-map" style="--m-map-h:360px"><iframe title="Mapa"></iframe></div>', $ctx ), $ctx );
	},

	// Garantia de que rellenar nunca recorta: seccion con 300 px de
	// minimo y dentro un panel a pantalla completa. Debe mandar el panel.
	'minimo-no-recorta'    => function () use ( $ctx, $panel ) {
		$n = node(
			'section',
			[
				'width'          => 'full',
				'minHeight'      => 'custom',
				'minHeightValue' => 300,
				'minHeightUnit'  => 'px',
				'heightMode'     => 'min',
				'vAlign'         => 'start',
			],
			'min1'
		);
		$n['children'] = [ node( 'split-panel', [ 'title' => 'Alto' ], 'sp7' ) ];
		return ComponentRenders::section( $n, $n['props'], fila( $panel( 'screen' ), $ctx ), $ctx );
	},

	// «Estirar» a mano, con contenido que no es un modulo de alto propio.
	'estirar-a-mano'       => function () use ( $ctx, $panel ) {
		$n = node(
			'section',
			[
				'width'     => 'full',
				'minHeight' => 'half',
				'vAlign'    => 'stretch',
			],
			'est1'
		);
		$n['children'] = [ node( 'split-panel', [ 'title' => 'Estirado' ], 'sp8' ), node( 'text', [], 't9' ) ];
		return ComponentRenders::section( $n, $n['props'], fila( $panel( 'medium' ), $ctx ), $ctx );
	},

	/* ---------------------------------------------------------------- */
	/* Bateria de secciones vacias (pruebas 1 a 15)                      */
	/*                                                                    */
	/* Una sola pagina con todos los casos, cada seccion con su id, para  */
	/* poder medirlas de una vez. Con KRG_CANVAS=1 se rinde como el       */
	/* lienzo del constructor.                                            */
	/* ---------------------------------------------------------------- */
	'pruebas-vacias'       => function () use ( $ctx ) {
		$sec = function ( string $id, array $props, array $hijos, string $markup ) use ( $ctx ) {
			$n             = node( 'section', $props, $id );
			$n['children'] = $hijos;
			return ComponentRenders::section( $n, $n['props'], $markup, $ctx );
		};

		$titulo  = [ node( 'heading', [], 'h1' ) ];
		$m_tit   = fila( '<h2 class="m-role-h2">Titular de prueba</h2>', $ctx );
		$imagen  = [ node( 'image', [], 'i1' ) ];
		$m_img   = fila( '<figure class="m-figure"><div class="qa-ph" style="aspect-ratio:3/2"></div></figure>', $ctx );
		$mapa    = [ node( 'map', [], 'mp1' ) ];
		$m_mapa  = fila( '<div class="m-map" style="--m-map-h:300px"><iframe title="Mapa"></iframe></div>', $ctx );
		$mixto   = [ node( 'heading', [], 'h2' ), node( 'image', [], 'i2' ) ];
		$m_mixto = fila( '<h2 class="m-role-h2">Texto</h2>', $ctx, 2 );

		// Fila con dos columnas y ningun modulo: andamiaje, no contenido.
		$c1              = node( 'column', [], 'cx1' );
		$c2              = node( 'column', [], 'cx2' );
		$r               = node( 'row', [], 'rx' );
		$r['children']   = [ $c1, $c2 ];
		$m_filavacia     = '<div class="m-c-row m-n-rx m-row"><div class="m-c-column m-n-cx1 m-col"></div><div class="m-c-column m-n-cx2 m-col"></div></div>';

		// Un titular escondido a la vez en escritorio, tableta y movil:
		// se imprime, pero no se ve nunca, asi que no es contenido.
		$oculto          = node( 'heading', [ 'text' => 'No se ve' ], 'ho' );
		$oculto['hiddenOn'] = [ 'desktop' => true, 'tablet' => true, 'mobile' => true ];
		$m_oculto        = fila( '<h2 class="m-role-h2 m-hide-desktop m-hide-tablet m-hide-mobile">No se ve</h2>', $ctx );

		$alto90 = [
			'width'          => 'full',
			'minHeight'      => 'custom',
			'minHeightValue' => 90,
			'minHeightUnit'  => 'vh',
			'heightMode'     => 'exact',
		];
		// Modulos de verdad que, sin datos, no imprimen nada.
		$resenas  = node( 'review-slider', [ 'items' => [] ], 'rv0' );
		$blog     = node( 'blog-grid', [ 'count' => 3 ], 'bg0' );
		$sindatos = node( 'row', [], 'rn1' );
		$sindatos['children'] = [ node( 'column', [ 'span' => 12 ], 'cn1' ) ];
		$sindatos['children'][0]['children'] = [ $resenas, $blog ];
		$m_sindatos = fila_con_nodos(
			[ $resenas, $blog ],
			\Meridian\Render\BrandRenders::review_slider( $resenas, $resenas['props'], '', $ctx )
				. ComponentRenders::blog_grid( $blog, $blog['props'], '', $ctx ),
			$ctx
		);

		$alto400 = [
			'width'          => 'full',
			'minHeight'      => 'custom',
			'minHeightValue' => 400,
			'minHeightUnit'  => 'px',
			'heightMode'     => 'min',
		];

		return
			// 4: con titular.
			$sec( 't4-titulo', [ 'width' => 'full' ], $titulo, $m_tit )
			// 1 + 11 + 12: vacia entre dos secciones con contenido.
			. $sec( 't1-vacia', [ 'width' => 'full' ], [], '' )
			// 7: con mapa.
			. $sec( 't7-mapa', [ 'width' => 'full' ], $mapa, $m_mapa )
			// 2: vacia con 90% de pantalla.
			. $sec( 't2-vacia90', $alto90, [], '' )
			// 8: con contenido y 90% de pantalla.
			. $sec( 't8-contenido90', $alto90 + [ 'vAlign' => 'start' ], $titulo, $m_tit )
			// 3: vacia con altura a medida en pixeles.
			. $sec( 't3-vacia400', $alto400, [], '' )
			// 5: con imagen.
			. $sec( 't5-imagen', [ 'width' => 'full' ], $imagen, $m_img )
			// 3b: vacia con una fila de columnas vacias y alto «alto».
			. $sec( 't3b-filavacia', [ 'width' => 'full', 'minHeight' => 'tall' ], [ $r ], $m_filavacia )
			// 6: texto + imagen.
			. $sec( 't6-mixto', [ 'width' => 'full' ], $mixto, $m_mixto )
			// 3c: solo contenido escondido en los tres tamanos.
			. $sec( 't3c-oculta', [ 'width' => 'full', 'minHeight' => 'screen' ], [ $oculto ], $m_oculto )
			// 9: los modulos estan puestos, pero no tienen datos que pintar
			// (un carrusel sin resenas y una rejilla de blog sin entradas).
			. $sec( 't9-sindatos', [ 'width' => 'full', 'minHeight' => 'tall' ], [ $sindatos ], $m_sindatos );
	},

	// Un bloque apagado con el interruptor de visibilidad. Pasa por el
	// renderizador de nodos de verdad, que es quien decide si se imprime.
	'apagado'              => function () use ( $ctx ) {
		$h            = node( 'heading', [ 'text' => 'Apagado' ], 'hap' );
		$h['visible'] = false;
		$col             = node( 'column', [ 'span' => 12 ], 'cap' );
		$col['children'] = [ $h ];
		$row             = node( 'row', [], 'rap' );
		$row['children'] = [ $col ];
		$sec             = node( 'section', [ 'width' => 'full' ], 'sap' );
		$sec['children'] = [ $row ];
		return \Meridian\Render\NodeRenderer::render( $sec, $ctx );
	},

	// 9 y 10: la misma seccion, con y sin contenido.
	'dinamica-sin'         => function () use ( $ctx ) {
		$n = node( 'section', [ 'width' => 'full', 'minHeight' => 'screen' ], 'din' );
		return ComponentRenders::section( $n, $n['props'], fila( '', $ctx ), $ctx );
	},
	'dinamica-con'         => function () use ( $ctx ) {
		$n             = node( 'section', [ 'width' => 'full', 'minHeight' => 'screen' ], 'din' );
		$n['children'] = [ node( 'heading', [], 'h9' ) ];
		return ComponentRenders::section( $n, $n['props'], fila( '<h2 class="m-role-h2">Ya hay contenido</h2>', $ctx ), $ctx );
	},

	'panel-alto-a-medida'  => function () use ( $ctx ) {
		$n = node(
			'split-panel',
			[
				'title'       => 'Titular',
				'height'      => 'custom',
				'heightValue' => 420,
				'heightUnit'  => 'px',
			],
			'sp2'
		);
		return \Meridian\Render\BrandRenders::split_panel( $n, $n['props'], '', $ctx );
	},

	/* ---------------------------------------------------------------- */
	/* Carta de restaurante y pie partido                                */
	/* ---------------------------------------------------------------- */

	'carta-pestanas'       => function () use ( $ctx ) {
		$n = node( 'menu-list', carta_props(), 'ml1' );
		$s = node( 'section', [ 'width' => 'padded' ], 'sml' );
		$s['children'] = [ $n ];
		return ComponentRenders::section(
			$s,
			$s['props'],
			fila( \Meridian\Render\BrandRenders::menu_list( $n, $n['props'], '', $ctx ), $ctx ),
			$ctx
		);
	},

	'carta-apilada'        => function () use ( $ctx ) {
		$props              = carta_props();
		$props['groupMode'] = 'stacked';
		$props['leader']    = 'dotted';
		$props['showImages'] = false;
		$n = node( 'menu-list', $props, 'ml2' );
		$s = node( 'section', [ 'width' => 'padded' ], 'sml2' );
		$s['children'] = [ $n ];
		return ComponentRenders::section(
			$s,
			$s['props'],
			fila( \Meridian\Render\BrandRenders::menu_list( $n, $n['props'], '', $ctx ), $ctx ),
			$ctx
		);
	},

	'pie-partido-izq'      => function () use ( $ctx ) {
		$n = node( 'footer-split', pie_props( 'left' ), 'fs1' );
		$s = node( 'section', [ 'width' => 'full' ], 'sfs1' );
		$s['children'] = [ $n ];
		return ComponentRenders::section(
			$s,
			$s['props'],
			fila( \Meridian\Render\BrandRenders::footer_split( $n, $n['props'], '', $ctx ), $ctx ),
			$ctx
		);
	},

	'pie-partido-der'      => function () use ( $ctx ) {
		$props              = pie_props( 'right' );
		$props['theme']     = 'forest';
		$props['height']    = 'custom';
		$props['heightValue'] = 520;
		$n = node( 'footer-split', $props, 'fs2' );
		$s = node( 'section', [ 'width' => 'full' ], 'sfs2' );
		$s['children'] = [ $n ];
		return ComponentRenders::section(
			$s,
			$s['props'],
			fila( \Meridian\Render\BrandRenders::footer_split( $n, $n['props'], '', $ctx ), $ctx ),
			$ctx
		);
	},

	/* ---------------------------------------------------------------- */
	/* Estilos del panel: ¿gana lo que el usuario escribe?               */
	/* ---------------------------------------------------------------- */

	'estilos-fondo-cta'    => function () {
		$cta = node(
			'statement-cta',
			[ 'title' => 'Reserva gratis', 'text' => 'Mesa para dos en dos minutos.', 'buttonText' => 'Reservar', 'theme' => 'forest' ],
			'cta1'
		);
		$cta['styles'] = [ 'desktop' => [ 'background' => '#D94E27' ] ];
		return documento( [ arbol( [ 'width' => 'full' ], [ $cta ] ) ] );
	},

	'estilos-fondo-seccion' => function () {
		$cta = node( 'statement-cta', [ 'title' => 'Reserva gratis', 'theme' => 'forest' ], 'cta2' );
		$sec = arbol( [ 'width' => 'full' ], [ $cta ], 'sec2' );
		$sec['styles'] = [ 'desktop' => [ 'background' => '#D94E27' ] ];
		return documento( [ $sec ] );
	},

	'estilos-relleno-carta' => function () {
		$carta           = node( 'menu-list', carta_props(), 'carta1' );
		$carta['styles'] = [ 'desktop' => [ 'padding-top' => '40px', 'padding-bottom' => '40px' ] ];
		return documento( [ arbol( [ 'width' => 'full' ], [ $carta ] ) ] );
	},

	'estilos-relleno-seccion-carta' => function () {
		$carta         = node( 'menu-list', carta_props(), 'carta2' );
		$sec           = arbol( [ 'width' => 'full' ], [ $carta ], 'sec3' );
		$sec['styles'] = [ 'desktop' => [ 'padding-top' => '40px', 'padding-bottom' => '40px' ] ];
		return documento( [ $sec ] );
	},

	'estilos-valign-carta'  => function () {
		$carta = node( 'menu-list', carta_props(), 'carta3' );
		return documento(
			[
				arbol(
					[
						'width'          => 'full',
						'minHeight'      => 'custom',
						'minHeightValue' => 1400,
						'minHeightUnit'  => 'px',
						'heightMode'     => 'min',
						'vAlign'         => 'center',
					],
					[ $carta ],
					'sec4'
				),
			]
		);
	},
	/* ---------------------------------------------------------------- */
	/* Colores propios del bloque, por encima del «Tema»                 */
	/* ---------------------------------------------------------------- */

	'colores-cta-propio'   => function () {
		$cta = node(
			'statement-cta',
			[
				'title'      => 'Reserva gratis',
				'text'       => 'Mesa para dos en dos minutos.',
				'buttonText' => 'Reservar',
				'theme'      => 'forest',
				'bgColor'    => [ 'mode' => 'custom', 'value' => '#D94E27' ],
				'textColor'  => [ 'mode' => 'custom', 'value' => '#FFF9F0' ],
				'padTop'     => 40,
				'padBottom'  => 40,
			],
			'cta3'
		);
		return documento( [ arbol( [ 'width' => 'full' ], [ $cta ] ) ] );
	},

	'colores-cta-tema'     => function () {
		$cta = node( 'statement-cta', [ 'title' => 'Reserva gratis', 'theme' => 'forest' ], 'cta4' );
		return documento( [ arbol( [ 'width' => 'full' ], [ $cta ] ) ] );
	},

	'colores-carta'        => function () {
		$props = array_merge(
			carta_props(),
			[
				'theme'      => 'forest',
				'groupMode'  => 'stacked',
				'bgColor'    => [ 'mode' => 'custom', 'value' => '#101010' ],
				'textColor'  => [ 'mode' => 'custom', 'value' => '#F2F2F2' ],
				'titleColor' => [ 'mode' => 'custom', 'value' => '#FFD166' ],
				'catColor'   => [ 'mode' => 'custom', 'value' => '#06D6A0' ],
				'nameColor'  => [ 'mode' => 'custom', 'value' => '#118AB2' ],
				'descColor'  => [ 'mode' => 'custom', 'value' => '#EF476F' ],
				'priceColor' => [ 'mode' => 'custom', 'value' => '#073B4C' ],
				'badgeColor' => [ 'mode' => 'custom', 'value' => '#8338EC' ],
				'padTop'     => 50,
				'padBottom'  => 70,
			]
		);
		return documento( [ arbol( [ 'width' => 'full' ], [ node( 'menu-list', $props, 'carta4' ) ] ) ] );
	},

	'colores-carta-tema'   => function () {
		return documento( [ arbol( [ 'width' => 'full' ], [ node( 'menu-list', carta_props(), 'carta5' ) ] ) ] );
	},

	'colores-pie-partido'  => function () {
		$props = array_merge(
			pie_props( 'left' ),
			[
				'theme'     => 'dark',
				'bgColor'   => [ 'mode' => 'custom', 'value' => '#2B413D' ],
				'textColor' => [ 'mode' => 'custom', 'value' => '#FEF6E7' ],
			]
		);
		return documento( [ arbol( [ 'width' => 'full' ], [ node( 'footer-split', $props, 'fs3' ) ] ) ] );
	},

	'colores-token'        => function () {
		$cta = node(
			'statement-cta',
			[
				'title'   => 'Con token del sistema',
				'theme'   => 'light',
				'bgColor' => [ 'mode' => 'custom', 'value' => 'var(--color-primary)' ],
			],
			'cta5'
		);
		return documento( [ arbol( [ 'width' => 'full' ], [ $cta ] ) ] );
	},

	'estilos-seccion-cta-relleno' => function () {
		$cta = node( 'statement-cta', [ 'title' => 'Reserva gratis', 'buttonText' => 'Hablemos', 'theme' => 'forest' ], 'ctaX' );
		$sec = arbol( [ 'width' => 'full' ], [ $cta ], 'secX' );
		$sec['styles'] = [
			'desktop' => [
				'padding-top'    => '60px',
				'padding-bottom' => '60px',
				'padding-left'   => '80px',
				'padding-right'  => '80px',
				'margin-top'     => '40px',
				'background'     => '#D94E27',
			],
		];
		return documento( [ $sec ] );
	},

	'colores-rev-propio' => function () {
		$props = [
			'title'     => 'Reseñas',
			'theme'     => 'surface',
			'bgColor'   => [ 'mode' => 'custom', 'value' => '#2B413D' ],
			'textColor' => [ 'mode' => 'custom', 'value' => '#FEF6E7' ],
			'cardColor' => [ 'mode' => 'custom', 'value' => '#D94E27' ],
			'items'     => [
				[ 'text' => 'Una reseña.', 'author' => 'Ana', 'source' => 'Google', 'rating' => 5 ],
				[ 'text' => 'Otra reseña.', 'author' => 'Luis', 'source' => 'Google', 'rating' => 5 ],
			],
		];
		return documento( [ arbol( [ 'width' => 'full' ], [ node( 'review-slider', $props, 'rev1' ) ], 'secRev' ) ] );
	},

	'colores-rev-tema' => function () {
		$props = [
			'title' => 'Reseñas',
			'theme' => 'forest',
			'items' => [
				[ 'text' => 'Una reseña.', 'author' => 'Ana', 'source' => 'Google', 'rating' => 5 ],
			],
		];
		return documento( [ arbol( [ 'width' => 'full' ], [ node( 'review-slider', $props, 'rev2' ) ], 'secRev2' ) ] );
	},

];

$want = $argv[1] ?? '';
if ( '' === $want ) {
	foreach ( array_keys( $cases ) as $k ) {
		echo $k, "\n";
	}
	exit( 0 );
}
if ( ! isset( $cases[ $want ] ) ) {
	fwrite( STDERR, "No existe el caso: {$want}\n" );
	exit( 1 );
}
echo $cases[ $want ](), "\n";
