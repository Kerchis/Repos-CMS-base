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
	return $d;
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

/* ---------------------------------------------------------------- */
/* Carga de las clases que hacen falta                               */
/* ---------------------------------------------------------------- */

$base = dirname( __DIR__ ) . '/krg-cms';
foreach (
	[
		'/core/render/RenderContext.php',
		'/core/design/Contrast.php',
		'/core/design/TokenCompiler.php',
		'/core/render/ComponentRenders.php',
		'/core/render/BrandRenders.php',
	] as $f
) {
	if ( file_exists( $base . $f ) ) {
		require_once $base . $f;
	}
}

use Meridian\Render\ComponentRenders;
use Meridian\Render\RenderContext;

$ctx            = new RenderContext();
$ctx->isPreview = false;

// Con KRG_CANVAS=1 el banco de pruebas rinde como el lienzo del
// constructor: las secciones vacias si se imprimen.
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
			. $sec( 't3c-oculta', [ 'width' => 'full', 'minHeight' => 'screen' ], [ $oculto ], $m_oculto );
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
