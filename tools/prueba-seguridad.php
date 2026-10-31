<?php
/**
 * Los cierres de seguridad: SSRF del expansor de mapas, cabeceras de
 * correo y freno de los formularios publicos.
 *
 * Por que hace falta: son tres defensas que no se ven. Nadie abre la
 * web y nota que el servidor ya no sigue una redireccion hacia dentro
 * de la red, ni que la cabecera Reply-To no se puede partir. Justo por
 * eso se rompen sin que nadie se entere: no hay pantalla que mirar. La
 * unica forma de que sigan ahi dentro de seis meses es que un banco
 * falle en rojo el dia que alguien las deshaga.
 *
 * Lo que se comprueba, con un WordPress de mentira con memoria y con
 * un cliente HTTP fingido que apunta cada peticion que se le pide:
 *
 *   1. Que `UrlValidator::maps()` sigue aceptando lo de siempre: una
 *      URL de Google, un iframe pegado entero, y nada mas.
 *   2. Que el expansor de enlaces cortos comprueba CADA salto antes de
 *      pedirlo. Que la primera URL sea de goo.gl no da derecho a que
 *      la segunda sea 127.0.0.1 ni 169.254.169.254: esas no se piden.
 *      Se comprueba contra el registro de peticiones, no de palabra.
 *   3. Que todas las peticiones van con `sslverify` en true: sin eso,
 *      quien este en medio de la red dicta la redireccion.
 *   4. Que la cabecera `Reply-To` no se puede partir con un salto de
 *      linea para colar un Bcc ajeno.
 *   5. Que el freno cuenta de verdad: tope por cliente, techo por IP
 *      aunque cambie el navegador, cubo propio para cada formulario, y
 *      que quedarse sin IP ya no es barra libre.
 *   6. Que los dos formularios estan conectados al guardia y que nadie
 *      ha vuelto a escribir la cabecera a mano.
 *
 *   .tools/php/php tools/prueba-seguridad.php
 */

define( 'ABSPATH', __DIR__ . '/' );

/* ------------------------------------------------------------------ */
/* WordPress de mentira: transitorios con memoria y un cliente HTTP     */
/* que no sale a la red pero apunta todo lo que le piden.               */

$GLOBALS['krg_tr'] = [];

function get_transient( $k ) {
	$x = $GLOBALS['krg_tr'][$k] ?? null;
	if ( ! is_array( $x ) ) {
		return false;
	}
	if ( $x['exp'] && $x['exp'] < time() ) {
		unset( $GLOBALS['krg_tr'][$k] );
		return false;
	}
	return $x['v'];
}

function set_transient( $k, $v, $t = 0 ) {
	$GLOBALS['krg_tr'][$k] = [ 'v' => $v, 'exp' => $t ? time() + $t : 0 ];
	return true;
}

function delete_transient( $k ) {
	unset( $GLOBALS['krg_tr'][$k] );
	return true;
}

/** Correr el reloj hacia atras para no esperar de verdad los segundos. */
function envejecer( int $seg = 30 ): void {
	foreach ( $GLOBALS['krg_tr'] as $k => $x ) {
		if ( is_array( $x['v'] ) && isset( $x['v']['t'] ) ) {
			$GLOBALS['krg_tr'][$k]['v']['t'] = (int) $x['v']['t'] - $seg;
		}
	}
}

$GLOBALS['krg_http_rutas'] = [];
$GLOBALS['krg_http_log']   = [];
$GLOBALS['krg_http_args']  = [];

function wp_remote_get( $url, $args = [] ) {
	$GLOBALS['krg_http_log'][]  = $url;
	$GLOBALS['krg_http_args'][] = $args;
	$r = $GLOBALS['krg_http_rutas'][ $url ] ?? null;
	if ( null === $r ) {
		return [ 'code' => 404, 'headers' => [] ];
	}
	return [
		'code'    => (int) ( $r['code'] ?? 200 ),
		'headers' => isset( $r['location'] ) ? [ 'location' => $r['location'] ] : [],
	];
}

function wp_remote_retrieve_response_code( $r ) {
	return is_array( $r ) ? (int) ( $r['code'] ?? 0 ) : 0;
}

function wp_remote_retrieve_header( $r, $h ) {
	return is_array( $r ) ? (string) ( $r['headers'][ strtolower( $h ) ] ?? '' ) : '';
}

function is_wp_error( $t ) {
	return $t instanceof WP_Error;
}

class WP_Error {
	public $msg;
	public function __construct( $code = '', $msg = '', $data = [] ) {
		$this->msg = $msg;
	}
}

require __DIR__ . '/wp-shim.php';
require_once dirname( __DIR__ ) . '/krg-cms/core/constants.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/security/UrlValidator.php';
require_once $base . '/core/forms/FormGuard.php';

use Meridian\Forms\FormGuard;
use Meridian\Security\UrlValidator;

$fallos = 0;
$hechas = 0;

function ok( bool $cond, string $msg ): void {
	global $fallos, $hechas;
	++$hechas;
	echo '  ' . ( $cond ? 'OK   ' : 'FALLA' ) . " $msg\n";
	if ( ! $cond ) {
		++$fallos;
	}
}

/** ¿Se pidió alguna vez esta URL? */
function se_pidio( string $url ): bool {
	return in_array( $url, $GLOBALS['krg_http_log'], true );
}

/** Empezar a contar peticiones de cero. */
function http_reset( array $rutas ): void {
	$GLOBALS['krg_http_rutas'] = $rutas;
	$GLOBALS['krg_http_log']   = [];
	$GLOBALS['krg_http_args']  = [];
}

/* ================================================================== */
echo "\nPRUEBA 1 · lo de siempre sigue funcionando\n";

http_reset( [] );

$plano = UrlValidator::maps( 'https://www.google.com/maps/place/Chía,+Cundinamarca' );
ok( str_contains( $plano, 'google.com/maps/place' ), 'una URL de Google Maps pasa entera' );

$pegado = UrlValidator::maps(
	'<iframe src="https://www.google.com/maps/embed?pb=!1m18!2sChia" width="600" height="450" style="border:0"></iframe>'
);
ok( 'https://www.google.com/maps/embed?pb=!1m18!2sChia' === $pegado,
	'de un iframe pegado entero se saca el src y se tira el resto' );

ok( '' === UrlValidator::maps( '<iframe src="javascript:alert(1)"></iframe>' ),
	'un src con javascript: no entra' );

ok( '' === UrlValidator::maps( 'https://evil.example/maps/place/x' ),
	'otro dominio con /maps en la ruta no es Google' );

ok( '' === UrlValidator::maps( 'https://ejemplo.test/?x=google./maps' ),
	'ni un dominio que lleve «google.» escrito en la query' );

ok( 0 === count( $GLOBALS['krg_http_log'] ),
	'y nada de esto ha salido a la red: sólo los enlaces cortos se piden' );

/* ================================================================== */
echo "\nPRUEBA 2 · el enlace corto se expande cuando toca\n";

http_reset(
	[
		'https://maps.app.goo.gl/bien' => [ 'code' => 302, 'location' => 'https://www.google.com/maps/place/Chia' ],
	]
);

$exp = UrlValidator::maps( 'https://maps.app.goo.gl/bien' );
ok( 'https://www.google.com/maps/place/Chia' === $exp,
	'un goo.gl que lleva a un mapa de Google se sigue y se queda el destino' );
ok( [ 'https://maps.app.goo.gl/bien' ] === $GLOBALS['krg_http_log'],
	'con una sola petición, la del enlace corto' );

$args = $GLOBALS['krg_http_args'][0] ?? [];
ok( true === ( $args['sslverify'] ?? null ),
	'y con el certificado verificado: sin eso, el de en medio dicta la redirección' );
ok( true === ( $args['reject_unsafe_urls'] ?? null ),
	'y con reject_unsafe_urls, que descarta direcciones privadas y puertos raros' );
ok( 0 === ( $args['redirection'] ?? -1 ),
	'las redirecciones las sigue este código a mano, no la librería' );

/* ================================================================== */
echo "\nPRUEBA 3 · la SSRF: el salto se comprueba ANTES de pedirlo\n";

$dentro = [
	'http://127.0.0.1:8080/wp-admin/'               => 'la máquina misma',
	'https://169.254.169.254/latest/meta-data/'     => 'los metadatos de la nube',
	'http://192.168.1.1/'                           => 'el router de la oficina',
	'https://evil.example/maps/place/x'             => 'un dominio cualquiera',
	'http://maps.app.goo.gl/sin-tls'                => 'el mismo sitio pero sin TLS',
];

foreach ( $dentro as $destino => $que_es ) {
	http_reset(
		[
			'https://maps.app.goo.gl/trampa' => [ 'code' => 302, 'location' => $destino ],
			$destino                         => [ 'code' => 200 ],
		]
	);
	$r = UrlValidator::maps( 'https://maps.app.goo.gl/trampa' );
	ok( ! se_pidio( $destino ), "no se pide $que_es aunque el salto apunte ahí" );
	ok( 'https://maps.app.goo.gl/trampa' === $r,
		'· y la URL se queda como estaba, sin inventarse un destino' );
}

/* ------------------------------------------------------------------ */
echo "\nPRUEBA 4 · la cadena de saltos, hasta el final\n";

http_reset(
	[
		'https://maps.app.goo.gl/largo' => [ 'code' => 301, 'location' => 'https://maps.app.goo.gl/paso2' ],
		'https://maps.app.goo.gl/paso2' => [ 'code' => 302, 'location' => 'https://maps.google.es/maps?q=Chia' ],
	]
);
ok( 'https://maps.google.es/maps?q=Chia' === UrlValidator::maps( 'https://maps.app.goo.gl/largo' ),
	'dos saltos dentro de la lista blanca sí se siguen' );

http_reset(
	[
		'https://maps.app.goo.gl/dos' => [ 'code' => 302, 'location' => 'https://maps.app.goo.gl/tres' ],
		'https://maps.app.goo.gl/tres' => [ 'code' => 302, 'location' => 'http://10.0.0.5/' ],
		'http://10.0.0.5/'             => [ 'code' => 200 ],
	]
);
UrlValidator::maps( 'https://maps.app.goo.gl/dos' );
ok( ! se_pidio( 'http://10.0.0.5/' ),
	'y si el desvío hacia dentro aparece en el segundo salto, tampoco cuela' );

http_reset(
	[
		'https://goo.gl/rel' => [ 'code' => 302, 'location' => '/seguir' ],
		'https://goo.gl/seguir' => [ 'code' => 302, 'location' => 'https://www.google.com/maps/place/Chia' ],
	]
);
ok( 'https://www.google.com/maps/place/Chia' === UrlValidator::maps( 'https://goo.gl/rel' ),
	'una redirección relativa se resuelve contra el anfitrión de verdad' );
ok( se_pidio( 'https://goo.gl/seguir' ) && ! se_pidio( 'https://maps.app.goo.gl/seguir' ),
	'· contra goo.gl, no contra el dominio que estaba escrito a mano antes' );

http_reset(
	[
		'https://goo.gl/bucle' => [ 'code' => 302, 'location' => 'https://goo.gl/bucle' ],
	]
);
UrlValidator::maps( 'https://goo.gl/bucle' );
ok( count( $GLOBALS['krg_http_log'] ) <= 6,
	'un bucle de redirecciones se corta a los seis saltos' );

http_reset(
	[
		'https://maps.app.goo.gl/consent' => [ 'code' => 302, 'location' => 'https://consent.google.com/m?continue=x' ],
		'https://consent.google.com/m?continue=x' => [ 'code' => 200 ],
	]
);
UrlValidator::maps( 'https://maps.app.goo.gl/consent' );
ok( ! se_pidio( 'https://consent.google.com/m?continue=x' ),
	'un subdominio de Google que no es el de mapas tampoco se sigue' );

/* ================================================================== */
echo "\nPRUEBA 5 · la cabecera Reply-To no se parte\n";

ok( 'Reply-To: "Ana Gómez" <ana@ejemplo.test>' === FormGuard::reply_to( 'Ana Gómez', 'ana@ejemplo.test' ),
	'un nombre normal va entre comillas y con el correo entre ángulos' );

$inyectado = FormGuard::reply_to( "Ana\r\nBcc: ladron@evil.test", 'ana@ejemplo.test' );
ok( ! str_contains( $inyectado, "\n" ) && ! str_contains( $inyectado, "\r" ),
	'un salto de línea en el nombre no sobrevive' );
ok( ! str_contains( strtolower( $inyectado ), 'bcc:' ),
	'· así que no hay forma de colar un Bcc ajeno' );

ok( '' === FormGuard::reply_to( 'Ana', 'esto-no-es-un-correo' ),
	'si el correo no vale, no hay cabecera en absoluto' );

ok( 'Reply-To: ana@ejemplo.test' === FormGuard::reply_to( '   ', 'ana@ejemplo.test' ),
	'sin nombre, la cabecera sale igual pero sin comillas vacías' );

$angulos = FormGuard::reply_to( 'Ana "la jefa" <otro@evil.test>', 'ana@ejemplo.test' );
ok( ! str_contains( $angulos, 'otro@evil.test' ) && ! str_contains( $angulos, '"la jefa"' ),
	'comillas y ángulos dentro del nombre se quitan: un solo destinatario' );
ok( 1 === substr_count( $angulos, '@' ),
	'· y una sola arroba en toda la cabecera' );

$largo = FormGuard::reply_to( str_repeat( 'Ñ', 300 ), 'ana@ejemplo.test' );
ok( mb_strlen( $largo ) < 120 && ! str_contains( $largo, "\n" ),
	'un nombre de 300 letras se recorta: una cabecera no es un campo libre' );

ok( str_contains( FormGuard::reply_to( 'José Muñoz', 'j@ejemplo.test' ), 'José Muñoz' ),
	'y los acentos y la eñe se respetan, que para eso están' );

/* ================================================================== */
echo "\nPRUEBA 6 · el freno cuenta de verdad\n";

$_SERVER['REMOTE_ADDR']    = '203.0.113.9';
$_SERVER['HTTP_USER_AGENT'] = 'navegador/1';

ok( FormGuard::permite( 'p1' ), 'el primer envío pasa' );
ok( ! FormGuard::permite( 'p1' ), 'el segundo pegado al primero no: hay un mínimo entre envíos' );

envejecer();
ok( FormGuard::permite( 'p1' ), 'pasados unos segundos, sí' );

$pasan = 0;
for ( $i = 0; $i < 20; $i++ ) {
	envejecer();
	if ( FormGuard::permite( 'p2' ) ) {
		++$pasan;
	}
}
ok( FormGuard::TOPE_CLIENTE === $pasan,
	'de veinte intentos espaciados pasan ' . FormGuard::TOPE_CLIENTE . ', que es el tope por cliente' );

ok( FormGuard::permite( 'otro-formulario' ),
	'y el otro formulario tiene su propio cupo: uno no gasta el del otro' );

/* El techo por IP: cambiar de navegador no multiplica el cupo. */
$pasan = 0;
for ( $i = 0; $i < 50; $i++ ) {
	$_SERVER['HTTP_USER_AGENT'] = 'navegador/' . $i;
	if ( FormGuard::permite( 'techo' ) ) {
		++$pasan;
	}
}
ok( FormGuard::TOPE_IP === $pasan,
	'cincuenta navegadores distintos desde la misma IP pasan ' . FormGuard::TOPE_IP . ' veces, no cincuenta' );

/* La cabecera que se inventa el que llama no mueve el cubo. */
$_SERVER['HTTP_USER_AGENT']      = 'navegador/1';
$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.' . wp_rand( 1, 250 );
ok( ! FormGuard::permite( 'techo' ),
	'y escribirse un X-Forwarded-For no abre un cubo nuevo: esa cabecera no se lee' );
unset( $_SERVER['HTTP_X_FORWARDED_FOR'] );

/* Sin IP ya no es barra libre. */
unset( $_SERVER['REMOTE_ADDR'] );
$pasan = 0;
for ( $i = 0; $i < 80; $i++ ) {
	if ( FormGuard::permite( 'sin-ip' ) ) {
		++$pasan;
	}
}
ok( FormGuard::TOPE_SIN_IP === $pasan,
	'sin IP que contar hay un cubo común de ' . FormGuard::TOPE_SIN_IP . ': antes aquí se pasaba siempre' );

$_SERVER['REMOTE_ADDR'] = '203.0.113.9';

/* ================================================================== */
echo "\nPRUEBA 7 · los dos formularios están conectados al guardia\n";

$contacto = (string) file_get_contents( $base . '/core/forms/Contact.php' );
$reserva  = (string) file_get_contents( $base . '/core/forms/Booking.php' );
$url_php  = (string) file_get_contents( $base . '/core/security/UrlValidator.php' );
$devenv   = (string) file_get_contents( dirname( __DIR__ ) . '/tools/devenv.sh' );

ok( str_contains( $contacto, 'FormGuard::permite' ),
	'contacto pasa por el freno: antes no tenía ninguno' );
ok( str_contains( $contacto, 'FormGuard::reply_to' ) && ! str_contains( $contacto, "'Reply-To: ' . \$name" ),
	'y la cabecera de contacto ya no se arma a mano' );
ok( str_contains( $reserva, 'FormGuard::reply_to' ) && ! str_contains( $reserva, "'Reply-To: ' . \$r['nombre']" ),
	'ni la de la reserva' );
ok( str_contains( $reserva, 'FormGuard::permite' ),
	'y el freno de la reserva es el mismo guardia, no una copia' );

ok( ! preg_match( "/'sslverify'\s*=>\s*false/", $url_php ),
	'no queda ni un sslverify en false en el validador de URLs' );
ok( str_contains( $url_php, "'reject_unsafe_urls' => true" ),
	'y sí está el cierre de WordPress contra direcciones privadas' );

ok( str_contains( $devenv, '--ignore-scripts' ),
	'el entorno de desarrollo instala sin ejecutar scripts de paquetes' );
ok( (bool) preg_match( '/@sparticuz\/chromium@\$\{CHROMIUM_PKG_VER\}/', $devenv )
	&& (bool) preg_match( '/playwright-core@\$\{PLAYWRIGHT_VER\}/', $devenv ),
	'y con las versiones clavadas, no con la última que haya ese día' );

echo "\n$hechas comprobaciones, $fallos " . ( 1 === $fallos ? 'fallo' : 'fallos' ) . "\n";
echo $fallos ? "HAY FALLOS\n" : "LOS CIERRES DE SEGURIDAD AGUANTAN ($hechas comprobaciones)\n";
exit( $fallos ? 1 : 0 );
