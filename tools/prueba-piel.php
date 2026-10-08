<?php
/**
 * La piel del CMS: los temas del panel.
 *
 * Por que hace falta: la cara del gestor y la paleta de la web que se
 * construye con el son dos cosas distintas, y la unica forma de que no
 * se mezclen es comprobarlo. Ademas, el valor de fabrica vive escrito
 * en dos sitios —el `:root` de admin.css y `Skin::temas()`— y si se
 * desincronizan, una instalacion nueva se ve de un color y el panel
 * dice otro.
 *
 * Lo que se comprueba:
 *
 *   1. Los tres temas estan completos: ninguna clave del esquema se
 *      queda sin color y ningun color esta mal escrito.
 *   2. Contraste: cada pareja que importa llega a AA (4.5:1 para texto,
 *      3:1 para interfaz). Si alguien anade un tema flojo, falla aqui.
 *   3. De fabrica es Bronce, y `admin.css` dice exactamente lo mismo.
 *   4. Elegir tema, retocar un color encima, y que al cambiar de tema
 *      no queden manchas del anterior.
 *   5. Solo se guardan claves conocidas y hex validos; lo que iguala al
 *      tema no se guarda (no se arrastra basura).
 *   6. `css()` emite siempre el juego completo, y esa es la unica via
 *      por la que la piel llega a ningun sitio: no toca los tokens del
 *      sitio publico ni los lee.
 *
 *   .tools/php/php tools/prueba-piel.php
 */

define( 'ABSPATH', __DIR__ . '/' );

/* ------------------------------------------------------------------ */
/* WordPress de mentira: solo opciones.                                 */

$GLOBALS['krg_opt'] = [];

function get_option( $k, $def = false ) {
	return array_key_exists( $k, $GLOBALS['krg_opt'] ) ? $GLOBALS['krg_opt'][ $k ] : $def;
}
function update_option( $k, $v, $auto = null ) {
	$GLOBALS['krg_opt'][ $k ] = $v;
	return true;
}
function delete_option( $k ) {
	unset( $GLOBALS['krg_opt'][ $k ] );
	return true;
}
function sanitize_hex_color( $color ) {
	$color = trim( (string) $color );
	return preg_match( '/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/', $color ) ? $color : null;
}
function __( $t, $d = null ) {
	return $t; }
function esc_html__( $t, $d = null ) {
	return $t; }
function get_template_directory() {
	return dirname( __DIR__ ) . '/krg-cms'; }
function get_template_directory_uri() {
	return 'https://ejemplo.test/wp-content/themes/krg-cms'; }

require_once __DIR__ . '/../krg-cms/core/constants.php';
require_once __DIR__ . '/../krg-cms/core/admin/Skin.php';

use Meridian\Admin\Skin;

/* ------------------------------------------------------------------ */

$fallos = 0;
$hechas = 0;
function ok( bool $cond, string $msg ): void {
	global $fallos, $hechas;
	++$hechas;
	echo $cond ? "  OK    $msg\n" : "  FALLA $msg\n";
	if ( ! $cond ) {
		++$fallos;
	}
}

/** Luminancia relativa segun WCAG. */
function luz( string $hex ): float {
	$hex = ltrim( $hex, '#' );
	$c   = [];
	for ( $i = 0; $i < 3; $i++ ) {
		$n   = hexdec( substr( $hex, $i * 2, 2 ) ) / 255;
		$c[] = $n <= 0.03928 ? $n / 12.92 : pow( ( $n + 0.055 ) / 1.055, 2.4 );
	}
	return 0.2126 * $c[0] + 0.7152 * $c[1] + 0.0722 * $c[2];
}

/** Contraste entre dos colores, de 1 a 21. */
function contraste( string $a, string $b ): float {
	$x = luz( $a );
	$y = luz( $b );
	return ( max( $x, $y ) + 0.05 ) / ( min( $x, $y ) + 0.05 );
}

echo "\nPRUEBA 1 — los temas están completos\n";

$schema = Skin::schema();
$temas  = Skin::temas();
ok( count( $temas ) >= 3, 'hay al menos tres temas (' . implode( ', ', array_keys( $temas ) ) . ')' );
ok( isset( $temas['bronce'], $temas['oceano'], $temas['bosque'] ), 'Bronce, Océano y Bosque' );

foreach ( $temas as $slug => $tema ) {
	ok( ! empty( $tema['nombre'] ), "«$slug» tiene nombre para enseñar" );
	ok( ! empty( $tema['nota'] ), "«$slug» explica en una línea de qué va" );
	$faltan = array_diff( array_keys( $schema ), array_keys( $tema['colores'] ) );
	ok( ! $faltan, "«$slug» no deja ninguna clave sin color" . ( $faltan ? ' (falta ' . implode( ', ', $faltan ) . ')' : '' ) );
	$sobran = array_diff( array_keys( $tema['colores'] ), array_keys( $schema ) );
	ok( ! $sobran, "«$slug» no inventa claves fuera del esquema" );
	$malos = [];
	foreach ( $tema['colores'] as $k => $hex ) {
		if ( ! preg_match( '/^#[0-9a-f]{6}$/', $hex ) ) {
			$malos[] = $k;
		}
	}
	ok( ! $malos, "«$slug» escribe los colores en hex de seis cifras y minúsculas" );
}

echo "\nPRUEBA 2 — todo se lee: contraste AA en los tres temas\n";

// [etiqueta, clave del frente, clave del fondo, mínimo]
$pares = [
	[ 'el texto sobre el fondo', 'ink', 'paper', 4.5 ],
	[ 'el texto sobre las tarjetas', 'ink', 'card', 4.5 ],
	[ 'el texto secundario sobre el fondo', 'muted', 'paper', 4.5 ],
	[ 'el texto secundario sobre las tarjetas', 'muted', 'card', 4.5 ],
	[ 'la barra lateral', 'card', 'sidebar', 4.5 ],
	[ 'el realce', 'ink', 'accent', 4.5 ],
	[ 'el tinte suave', 'ink', 'accentSoft', 4.5 ],
	[ 'el verde de correcto', 'ok', 'paper', 4.5 ],
	[ 'el ámbar de aviso', 'warn', 'paper', 4.5 ],
	[ 'el rojo de peligro', 'danger', 'paper', 4.5 ],
	[ 'el borde del campo', 'lineStrong', 'card', 1.4 ],
	[ 'el botón contra el fondo', 'action', 'paper', 3.0 ],
];
foreach ( $temas as $slug => $tema ) {
	$c = $tema['colores'];
	foreach ( $pares as [$que, $a, $b, $min] ) {
		$v = contraste( $c[ $a ], $c[ $b ] );
		ok( $v >= $min, sprintf( '%s: %s %.2f:1 (mínimo %s)', $slug, $que, $v, $min ) );
	}
	// El texto de los botones es blanco puro en todos los temas.
	$v = contraste( '#ffffff', $c['action'] );
	ok( $v >= 4.5, sprintf( '%s: el texto del botón %.2f:1', $slug, $v ) );
	$v = contraste( '#ffffff', $c['actionDeep'] );
	ok( $v >= 4.5, sprintf( '%s: el texto del botón al pasar el ratón %.2f:1', $slug, $v ) );
}

echo "\nPRUEBA 3 — de fábrica es Bronce, y el CSS dice lo mismo\n";

ok( 'bronce' === Skin::TEMA_POR_DEFECTO, 'la constante dice bronce' );
ok( 'bronce' === Skin::tema(), 'sin nada guardado, el tema activo es bronce' );
ok( Skin::defaults() === $temas['bronce']['colores'], 'y los valores de fábrica son los suyos' );

$css = file_get_contents( __DIR__ . '/../krg-cms/admin/assets/css/admin.css' );
preg_match( '/:root\s*\{(.*?)\}/s', $css, $m );
$raiz = $m[1] ?? '';
ok( '' !== $raiz, 'admin.css tiene su bloque :root' );
$desincronizados = [];
foreach ( $temas['bronce']['colores'] as $clave => $hex ) {
	$var = $schema[ $clave ][0];
	if ( ! preg_match( '/' . preg_quote( $var, '/' ) . '\s*:\s*([^;]+);/', $raiz, $mm ) ) {
		$desincronizados[] = "$var (no está)";
		continue;
	}
	if ( strtolower( trim( $mm[1] ) ) !== $hex ) {
		$desincronizados[] = "$var dice " . trim( $mm[1] ) . " y el tema $hex";
	}
}
ok( ! $desincronizados, 'admin.css y el tema Bronce dicen lo mismo' . ( $desincronizados ? ': ' . implode( '; ', $desincronizados ) : '' ) );

echo "\nPRUEBA 4 — elegir tema y retocar encima\n";

Skin::save( [ 'theme' => 'oceano' ] );
ok( 'oceano' === Skin::tema(), 'se puede cambiar de tema' );
ok( '#002b4c' === Skin::get()['sidebar'], 'y la barra lateral pasa al azul del océano' );
ok( Skin::defaults() === $temas['oceano']['colores'], '«de fábrica» pasa a ser el tema elegido, no el primero' );

Skin::save( [ 'colors' => [ 'action' => '#AA3311' ] ] );
ok( '#aa3311' === Skin::get()['action'], 'encima del tema se puede retocar un color suelto' );
ok( '#002b4c' === Skin::get()['sidebar'], 'y el resto del tema sigue en su sitio' );
ok( [ 'action' => '#aa3311' ] === Skin::overrides(), 'solo se guarda lo retocado, no los diecisiete colores' );

Skin::save( [ 'theme' => 'bosque' ] );
ok( '#3f5e58' === Skin::get()['action'], 'al cambiar de tema, el retoque del anterior no mancha el nuevo' );
ok( [] === Skin::overrides(), 'los retoques se van con el tema que los recibió' );

Skin::save( [ 'theme' => 'no-existe' ] );
ok( 'bosque' === Skin::tema(), 'un tema inventado no se guarda ni rompe nada' );

Skin::reset();
ok( 'bronce' === Skin::tema() && [] === Skin::overrides(), 'restablecer devuelve a Bronce limpio' );

echo "\nPRUEBA 5 — lo que entra está saneado\n";

Skin::save(
	[
		'colors' => [
			'action'   => '#123456',
			'ink'      => 'rojo brillante',
			'inventada' => '#ffffff',
			'paper'    => '#FAEFD8',
		],
	]
);
$guardado = Skin::overrides();
ok( isset( $guardado['action'] ) && '#123456' === $guardado['action'], 'un hex válido entra' );
ok( ! isset( $guardado['ink'] ), 'un color que no es un color se descarta' );
ok( ! isset( $guardado['inventada'] ), 'una clave que no existe se descarta' );
ok( ! isset( $guardado['paper'] ), 'y lo que es igual al tema no se guarda: no se arrastra basura' );
ok( '#1d1d1b' === Skin::get()['ink'], 'el color rechazado se queda en el del tema' );

Skin::save( [ 'colors' => [ 'action' => '#9F6637' ] ] );
ok( [] === Skin::overrides(), 'volver al valor del tema a mano borra el retoque' );

echo "\nPRUEBA 6 — la piel no se mezcla con la paleta del sitio\n";

Skin::save( [ 'theme' => 'oceano' ] );
$css_piel = Skin::css();
ok( str_starts_with( $css_piel, ':root{' ), 'css() emite un bloque :root' );
$cuantas = substr_count( $css_piel, ':' ) - 1;
ok( $cuantas === count( $schema ), "emite SIEMPRE el juego completo ($cuantas de " . count( $schema ) . ')' );
ok( str_contains( $css_piel, '--m-brown:#002b4c' ), 'con el color del tema activo' );
foreach ( $schema as $clave => $row ) {
	if ( ! str_contains( $css_piel, $row[0] . ':' ) ) {
		ok( false, "falta la variable {$row[0]}" );
	}
}
ok( ! str_contains( $css_piel, '--color-' ), 'ninguna variable del sitio público se cuela en la piel' );
ok( ! str_contains( $css_piel, '--krg-' ), 'ni ningún otro espacio de nombres' );

$fuente = file_get_contents( __DIR__ . '/../krg-cms/core/admin/Skin.php' );
ok( ! str_contains( $fuente, 'TokenRepository::save' ) && ! str_contains( $fuente, 'TokenRepository::update' ),
	'la piel nunca escribe en los tokens del sitio' );
ok( 1 === substr_count( $fuente, 'TokenRepository::get' ),
	'solo los lee en un sitio: el puente opcional «usar la paleta del sitio»' );

$assets = file_get_contents( __DIR__ . '/../krg-cms/core/admin/Assets.php' );
ok( str_contains( $assets, 'Skin::css()' ), 'y el CSS de la piel se encola desde el admin' );
$publico = file_get_contents( __DIR__ . '/../krg-cms/core/PublicAssets.php' );
ok( ! str_contains( $publico, 'Skin' ), 'el sitio público no sabe ni que la piel existe' );

echo "\n$hechas comprobaciones, $fallos " . ( 1 === $fallos ? 'fallo' : 'fallos' ) . "\n";
echo $fallos ? "HAY FALLOS\n" : "LA PIEL DEL CMS VA ($hechas comprobaciones)\n";
exit( $fallos ? 1 : 0 );
