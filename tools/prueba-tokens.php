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

echo "\n" . ( $fallos ? "HAY $fallos FALLOS" : "LOS TOKENS AGUANTAN ($ok comprobaciones)" ) . "\n";
exit( $fallos ? 1 : 0 );
