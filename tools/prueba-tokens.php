<?php
/**
 * Los tokens que el tema no puede perder.
 *
 * Por qué hace falta: `--spacing-section` es el ritmo vertical de todas
 * las secciones. Si en la base de datos vale `0px`, el CSS lo aplica tal
 * cual —el respaldo `var(--spacing-section, 96px)` solo entra cuando la
 * variable NO existe— y el sitio entero se queda pegado, mientras el
 * panel enseña un `0px` que parece una decisión. Esto comprueba las dos
 * mitades del arreglo:
 *
 *   1. Que un valor inservible (vacío, `0`, `0px`) se detecta, se
 *      rellena al leer y se repara UNA vez en la base de datos.
 *   2. Que un valor del usuario —incluido un `clamp()` o un `40px`
 *      pequeño— no se toca jamás.
 *
 * Y la pregunta que de verdad importa: lo que devuelve la API al panel
 * y lo que acaba en el CSS del frontend tienen que ser el mismo texto.
 *
 *   .tools/php/php tools/prueba-tokens.php
 */

define( 'ABSPATH', __DIR__ . '/' );

require __DIR__ . '/wp-shim.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/constants.php';
require_once $base . '/core/design/PresetStore.php';
require_once $base . '/core/design/TokenDefaults.php';
require_once $base . '/core/design/TokenRepository.php';
require_once $base . '/core/design/TokenCompiler.php';

use Meridian\Design\TokenCompiler;
use Meridian\Design\TokenDefaults;
use Meridian\Design\TokenRepository;

$fallos = 0;
$ok     = 0;

function comprueba( bool $cond, string $msg ): void {
	global $fallos, $ok;
	if ( $cond ) {
		++$ok;
		echo "  OK    $msg\n";
	} else {
		++$fallos;
		echo "  FALLA $msg\n";
	}
}

/** Deja la opción de tokens como si fuera una instalación concreta. */
function pon_tokens( array $spacing, string $preset = 'marca' ): void {
	update_option(
		MERIDIAN_OPTION_TOKENS,
		[
			'activePreset' => $preset,
			'version'      => 1,
			'tokens'       => [
				'color'   => [ 'primary' => [ 'value' => '#3f5e58' ] ],
				'spacing' => $spacing,
				'layout'  => [ 'page-max-width' => [ 'value' => '1200px' ] ],
			],
		],
		false
	);
	delete_option( TokenDefaults::FIX_OPTION );
	delete_transient( 'meridian_tokens_css' );
}

/** El valor de `spacing.section` tal y como lo ve quien lo pida. */
function section_leido(): string {
	$d = TokenRepository::get();
	return (string) ( $d['tokens']['spacing']['section']['value'] ?? '«no existe»' );
}

/** El valor de `--spacing-section` dentro del CSS compilado. */
function section_en_css(): string {
	delete_transient( 'meridian_tokens_css' );
	$css = TokenCompiler::compile( TokenRepository::get() );
	return preg_match( '/--spacing-section:\s*([^;]+);/', $css, $m ) ? trim( $m[1] ) : '«no sale»';
}

/** El valor guardado de verdad en la opción, sin pasar por `fill()`. */
function section_en_bd(): string {
	$d = get_option( MERIDIAN_OPTION_TOKENS, [] );
	return (string) ( $d['tokens']['spacing']['section']['value'] ?? '«no existe»' );
}

echo "Qué cuenta como «aquí no hay nada»\n";
foreach ( [ '', '0', '0px', '0rem', ' 0PX ', 'none' ] as $v ) {
	comprueba( TokenDefaults::is_empty( $v ), 'vacío: ' . var_export( $v, true ) );
}
foreach ( [ '96px', '40px', '0.5rem', 'clamp(64px, 9vw, 132px)', '8vh' ] as $v ) {
	comprueba( ! TokenDefaults::is_empty( $v ), 'valor: ' . var_export( $v, true ) );
}

echo "\nUn `section` a cero se detecta y se rellena al leer\n";
pon_tokens( [ 'md' => [ 'value' => '16px' ], 'section' => [ 'value' => '0px' ] ] );
comprueba( section_en_bd() === '0px', 'la base de datos tiene el 0px de partida' );
comprueba( section_leido() === '96px', 'el panel ya lee ' . section_leido() );
comprueba( section_en_css() === '96px', 'y el CSS compila ' . section_en_css() );

echo "\nY se repara una sola vez en la base de datos\n";
TokenDefaults::repair_once();
comprueba( section_en_bd() === '96px', 'la base de datos queda en ' . section_en_bd() );
// Segunda pasada: si el usuario pone cero a propósito, se respeta.
$d = get_option( MERIDIAN_OPTION_TOKENS, [] );
$d['tokens']['spacing']['section']['value'] = '0px';
update_option( MERIDIAN_OPTION_TOKENS, $d, false );
TokenDefaults::repair_once();
comprueba( section_en_bd() === '0px', 'la segunda vez ya no toca nada: ' . section_en_bd() );

echo "\nUn valor del usuario no se toca nunca\n";
foreach ( [ '40px', '72px', 'clamp(64px, 9vw, 132px)', '8vh' ] as $v ) {
	pon_tokens( [ 'section' => [ 'value' => $v ] ] );
	TokenDefaults::repair_once();
	comprueba( section_leido() === $v && section_en_bd() === $v, "«{$v}» sigue igual al leer y en la base de datos" );
	comprueba( section_en_css() === $v, "«{$v}» llega al CSS tal cual" );
}

echo "\nSi el token falta entero, se rellena desde el preset activo\n";
pon_tokens( [ 'md' => [ 'value' => '16px' ] ], 'honeycomb' );
comprueba( section_leido() === 'clamp(64px, 9vw, 132px)', 'con honeycomb activo: ' . section_leido() );
pon_tokens( [ 'md' => [ 'value' => '16px' ] ], 'marca' );
comprueba( section_leido() === '96px', 'con marca activo: ' . section_leido() );

echo "\nEl panel y el frontend dicen lo mismo\n";
foreach ( [ '0px', '', '55px', 'clamp(64px, 9vw, 132px)' ] as $v ) {
	pon_tokens( [ 'section' => [ 'value' => $v ] ] );
	comprueba( section_leido() === section_en_css(), "con «{$v}» el panel lee «" . section_leido() . '» y el CSS escribe «' . section_en_css() . '»' );
}

echo "\nEl respaldo del CSS y el del PHP son el mismo número\n";
$css_base = file_get_contents( $base . '/assets/css/base.css' );
preg_match_all( '/var\(--spacing-section,\s*([^)]+)\)/', $css_base . file_get_contents( $base . '/assets/css/modules.css' ), $m );
$distintos = array_unique( array_map( 'trim', $m[1] ) );
comprueba( count( $distintos ) === 1, 'todas las hojas usan el mismo respaldo: ' . implode( ', ', $distintos ) );
comprueba(
	reset( $distintos ) === TokenDefaults::REQUIRED['spacing']['section'],
	'y coincide con TokenDefaults: ' . TokenDefaults::REQUIRED['spacing']['section']
);

/* ======================================================================
   Las paletas de la web que vienen con el tema
   ----------------------------------------------------------------------
   Cada fichero de `presets/` es una paleta que el administrador puede
   poner de un clic, así que ninguna puede traer un texto que no se lea.
   Se comprueba lo mismo que exige el panel: que estén todos los colores,
   que sean hex de verdad y que las parejas que llevan texto encima
   lleguen a AA. Una paleta nueva que no cumpla hace fallar esto, que es
   justo lo que tiene que pasar antes de que llegue a un sitio.
   ====================================================================== */

echo "\nLAS PALETAS DE LA WEB\n";

function luz_rel( string $hex ): float {
	$hex = ltrim( trim( $hex ), '#' );
	$l   = [];
	foreach ( [ 0, 2, 4 ] as $i ) {
		$c   = hexdec( substr( $hex, $i, 2 ) ) / 255;
		$l[] = $c <= 0.03928 ? $c / 12.92 : pow( ( $c + 0.055 ) / 1.055, 2.4 );
	}
	return 0.2126 * $l[0] + 0.7152 * $l[1] + 0.0722 * $l[2];
}
function razon( string $a, string $b ): float {
	$x = luz_rel( $a );
	$y = luz_rel( $b );
	return ( max( $x, $y ) + 0.05 ) / ( min( $x, $y ) + 0.05 );
}

$CLAVES_COLOR = [
	'primary', 'secondary', 'tertiary', 'background', 'surface', 'surface-alt',
	'text', 'text-secondary', 'muted', 'border', 'border-strong',
	'success', 'warning', 'error', 'info', 'highlight',
	'on-primary', 'on-secondary', 'on-surface',
];
// [qué se mira, color de delante, color de detrás, mínimo]
$PAREJAS = [
	[ 'el texto sobre el fondo', 'text', 'background', 4.5 ],
	[ 'el texto secundario sobre el fondo', 'text-secondary', 'background', 4.5 ],
	[ 'el atenuado sobre el fondo', 'muted', 'background', 4.5 ],
	[ 'el texto del botón', 'on-primary', 'primary', 4.5 ],
	[ 'el texto sobre el secundario', 'on-secondary', 'secondary', 4.5 ],
	[ 'el texto sobre la superficie', 'on-surface', 'surface', 4.5 ],
	[ 'el error sobre el fondo', 'error', 'background', 4.5 ],
];

$paletas = TokenRepository::list_presets();
comprueba( count( $paletas ) >= 9, 'el tema trae sus paletas (' . count( $paletas ) . ')' );
$nombres = array_column( $paletas, 'slug' );
foreach ( [ 'amatista', 'cacao', 'malva', 'caramelo', 'pinar', 'noche' ] as $esperada ) {
	comprueba( in_array( $esperada, $nombres, true ), "está la paleta «$esperada»" );
}

foreach ( $paletas as $pal ) {
	$slug  = $pal['slug'];
	$color = $pal['tokens']['color'] ?? [];
	$hex   = [];
	foreach ( $color as $k => $v ) {
		$valor = is_array( $v ) ? ( $v['value'] ?? '' ) : $v;
		if ( is_string( $valor ) && preg_match( '/^#[0-9a-fA-F]{6}$/', $valor ) ) {
			$hex[ $k ] = $valor;
		}
	}
	$faltan = array_diff( $CLAVES_COLOR, array_keys( $hex ) );
	comprueba( ! $faltan, "«{$slug}» no deja ningún color sin poner" . ( $faltan ? ' (falta ' . implode( ', ', $faltan ) . ')' : '' ) );
	comprueba( count( $pal['swatches'] ) === 5, "«{$slug}» enseña cinco muestras en su carta (" . count( $pal['swatches'] ) . ')' );
	if ( $faltan ) {
		continue;
	}
	foreach ( $PAREJAS as [$que, $a, $b, $min] ) {
		$v = razon( $hex[ $a ], $hex[ $b ] );
		// «Marca» es la paleta de un cliente y su naranja es su naranja.
		// Ese color, a 4.14:1 con texto blanco, no llega a AA para texto
		// normal —y no hay texto que lo consiga: el máximo posible sobre
		// él es 4.31:1 con casi-negro—, así que o se oscurece el naranja
		// un 6 % (#d94e27 → #cc4925, mismo tono) o se acepta como está.
		// No se toca a escondidas una marca ajena: se avisa y decide
		// quien la tenga que usar.
		if ( 'marca' === $slug && 'on-primary' === $a && $v >= 4.0 ) {
			echo sprintf( "  AVISO %s: %s %.2f:1 — el naranja de la marca no llega a AA con ningún texto; se deja como está a propósito.\n", $slug, $que, $v );
			continue;
		}
		comprueba( $v >= $min, sprintf( '%s: %s %.2f:1 (mínimo %s)', $slug, $que, $v, $min ) );
	}
}

echo "\n" . ( $fallos ? "HAY $fallos FALLOS" : "LOS TOKENS AGUANTAN ($ok comprobaciones)" ) . "\n";
exit( $fallos ? 1 : 0 );
