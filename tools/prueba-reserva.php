<?php
/**
 * Reserva de mesa: las reglas, el destino y lo que se guarda.
 *
 * Por que hace falta: una reserva es un compromiso con una persona que
 * se presenta a las nueve en la puerta. Si el selector ofrece una hora
 * a la que el cocinero ya se ha ido, o si el aviso se va a un numero
 * que ha escrito el visitante en vez del que puso el restaurante, el
 * fallo no se ve en una captura: se ve con la mesa vacia o con la gente
 * en la calle.
 *
 * Lo que se comprueba, con un WordPress de mentira con memoria:
 *
 *   1. Que las reglas del bloque se leen bien: turnos, dias de la
 *      semana, salto entre huecos, antelacion minima, dias cerrados y
 *      tope de comensales.
 *   2. Que las horas que se ofrecen son las que existen: del primer
 *      pase al ultimo, sin colarse una que ya ha pasado ni repetir las
 *      de dos turnos que se tocan.
 *   3. Que el servidor vuelve a comprobarlo todo: fecha imposible, dia
 *      cerrado, hora que no esta en la lista, demasiada gente, telefono
 *      que no lo es. El navegador propone; el servidor dispone.
 *   4. Que el destino sale del bloque guardado y nunca del envio: el
 *      numero de WhatsApp y el correo no viajan en la pagina ni se
 *      aceptan desde el formulario.
 *   5. Que el enlace de WhatsApp se construye como manda el formato
 *      oficial, con el numero en internacional y el texto codificado.
 *   6. Que la reserva queda apuntada, se puede confirmar, cancelar y
 *      borrar, y que la lista separa las proximas de las pasadas.
 *   7. Que el bloque se pinta entero sin JavaScript: campos nativos de
 *      fecha y hora, campo trampa, nonce y el selector plegado.
 *
 *   .tools/php/php tools/prueba-reserva.php
 */

define( 'ABSPATH', __DIR__ . '/' );

/* ------------------------------------------------------------------ */
/* WordPress de mentira: entradas, metadatos, opciones y correo         */

$GLOBALS['krg_posts']    = [];
$GLOBALS['krg_meta']     = [];
$GLOBALS['krg_opt']      = [ 'admin_email' => 'cocina@restaurante.test' ];
$GLOBALS['krg_sig_post'] = 300;
$GLOBALS['krg_correos']  = [];

function wp_insert_post( $args = [], $wp_error = false ) {
	$id = ++$GLOBALS['krg_sig_post'];
	$GLOBALS['krg_posts'][ $id ] = [
		'ID'            => $id,
		'post_type'     => $args['post_type'] ?? 'post',
		'post_status'   => $args['post_status'] ?? 'draft',
		'post_title'    => $args['post_title'] ?? '',
		'post_name'     => $args['post_name'] ?? sanitize_title( $args['post_title'] ?? '' ),
		'post_parent'   => (int) ( $args['post_parent'] ?? 0 ),
		'post_content'  => $args['post_content'] ?? '',
		'post_password' => '',
		'post_date'     => '2026-10-08 10:00:00',
		'post_modified' => '2026-10-08 10:00:00',
	];
	return $id;
}
function wp_update_post( $args = [], $wp_error = false ) {
	$id = (int) ( $args['ID'] ?? 0 );
	if ( ! isset( $GLOBALS['krg_posts'][ $id ] ) ) {
		return 0;
	}
	foreach ( $args as $k => $v ) {
		if ( 'ID' !== $k ) {
			$GLOBALS['krg_posts'][ $id ][ $k ] = $v;
		}
	}
	return $id;
}
function get_post( $id = null ) {
	$id = (int) ( is_object( $id ) ? $id->ID : $id );
	return isset( $GLOBALS['krg_posts'][ $id ] ) ? new WP_Post( $GLOBALS['krg_posts'][ $id ] ) : null;
}
function get_post_field( $campo, $id ) {
	return $GLOBALS['krg_posts'][ (int) $id ][ $campo ] ?? '';
}
/** Como el de verdad en lo que usa el almacen: tipo y orden por metadato. */
function get_posts( $args = [] ) {
	$tipo = $args['post_type'] ?? 'post';
	$out  = [];
	foreach ( $GLOBALS['krg_posts'] as $row ) {
		if ( $row['post_type'] === $tipo ) {
			$out[] = $row;
		}
	}
	$clave = $args['meta_key'] ?? '';
	if ( $clave ) {
		usort(
			$out,
			static function ( $a, $b ) use ( $clave ) {
				$x = (string) ( $GLOBALS['krg_meta'][ $a['ID'] ][ $clave ] ?? '' );
				$y = (string) ( $GLOBALS['krg_meta'][ $b['ID'] ][ $clave ] ?? '' );
				return $x === $y ? ( $a['ID'] <=> $b['ID'] ) : strcmp( $x, $y );
			}
		);
	}
	return array_map( static fn( $r ) => new WP_Post( $r ), $out );
}
function get_post_meta( $id, $clave = '', $uno = false ) {
	$v = $GLOBALS['krg_meta'][ (int) $id ][ $clave ] ?? '';
	return $uno ? $v : ( '' === $v ? [] : [ $v ] );
}
function update_post_meta( $id, $clave, $valor ) {
	$GLOBALS['krg_meta'][ (int) $id ][ $clave ] = $valor;
	return true;
}
function delete_post_meta( $id, $clave, $valor = '' ) {
	unset( $GLOBALS['krg_meta'][ (int) $id ][ $clave ] );
	return true;
}
function wp_delete_post( $id, $forzar = false ) {
	$habia = isset( $GLOBALS['krg_posts'][ (int) $id ] );
	unset( $GLOBALS['krg_posts'][ (int) $id ] );
	return $habia;
}
function get_option( $k, $def = false ) {
	return $GLOBALS['krg_opt'][ $k ] ?? $def;
}
function update_option( $k, $v, $auto = null ) {
	$GLOBALS['krg_opt'][ $k ] = $v;
	return true;
}
function delete_option( $k ) {
	unset( $GLOBALS['krg_opt'][ $k ] );
	return true;
}
function home_url( $p = '' ) {
	return 'https://restaurante.test/' . ltrim( (string) $p, '/' );
}
function get_permalink( $p = null ) {
	return 'https://restaurante.test/reservas/';
}
function get_bloginfo( $x = 'name' ) {
	return 'El Rincón';
}
function clean_post_cache( $id ) {}
function update_meta_cache( $t, $ids ) {
	return true;
}
function wp_list_pluck( $l, $c ) {
	return array_map( fn( $x ) => is_object( $x ) ? $x->$c : $x[ $c ], $l );
}
function current_user_can( $c ) {
	return true;
}
function get_current_user_id() {
	return 3;
}
function get_user_by( $c, $v ) {
	return (object) [ 'display_name' => 'Ana' ];
}
function current_time( $t = 'mysql' ) {
	return gmdate( 'Y-m-d H:i:s', time() );
}
function is_wp_error( $x ) {
	return $x instanceof WP_Error;
}
function wp_cache_flush() {
	return true;
}
function _n( $uno, $varios, $n, $dom = '' ) {
	return 1 === (int) $n ? $uno : $varios;
}
function wp_mail( $to, $asunto, $cuerpo, $cabeceras = [] ) {
	$GLOBALS['krg_correos'][] = [
		'to'        => $to,
		'asunto'    => $asunto,
		'cuerpo'    => $cuerpo,
		'cabeceras' => $cabeceras,
	];
	return true;
}
/* La zona horaria del sitio: fija, para que el banco no dependa de
   donde se ejecute. */
function wp_timezone() {
	return new DateTimeZone( 'Europe/Madrid' );
}
function current_datetime() {
	return new DateTimeImmutable( 'now', wp_timezone() );
}
function wp_date( $formato, $marca = null, $tz = null ) {
	$d = new DateTimeImmutable( '@' . ( null === $marca ? time() : $marca ) );
	return $d->setTimezone( wp_timezone() )->format( $formato );
}

class WP_Query {
	public $posts = [];
	public function __construct( $args = [] ) {}
	public function have_posts() {
		return false;
	}
	public function the_post() {}
}

class WP_Error {
	public $msg;
	public function __construct( $code = '', $msg = '', $data = [] ) {
		$this->msg = $msg;
	}
	public function get_error_message() {
		return $this->msg;
	}
}

require __DIR__ . '/wp-shim.php';
require_once dirname( __DIR__ ) . '/krg-cms/core/constants.php';

$base = dirname( __DIR__ ) . '/krg-cms';
foreach (
	[
		'/core/render/RenderContext.php',
		'/core/design/Contrast.php',
		'/core/design/PresetStore.php',
		'/core/design/TokenDefaults.php',
		'/core/design/TokenRepository.php',
		'/core/design/TokenCompiler.php',
		'/core/design/FontCatalog.php',
		'/core/security/UrlValidator.php',
		'/core/security/Sanitizer.php',
		'/core/components/Catalog.php',
		'/core/components/BrandCatalog.php',
		'/core/components/Registry.php',
		'/core/media/Images.php',
		'/core/media/Formats.php',
		'/core/log/Logger.php',
		'/core/forms/Booking.php',
		'/core/forms/BookingStore.php',
		'/core/render/ComponentRenders.php',
		'/core/render/BrandRenders.php',
		'/core/render/NodeRenderer.php',
		'/core/style/Breakpoints.php',
		'/core/style/BoxStyles.php',
		'/core/style/DocumentCssCompiler.php',
		'/core/cache/DocumentCache.php',
	] as $f
) {
	require_once $base . $f;
}

class FakeWpdbReserva {
	public $prefix   = 'wp_';
	public $postmeta = 'wp_postmeta';
	public function prepare( $sql, ...$a ) {
		return $sql; }
	public function get_row( $s ) {
		return null; }
	public function get_results( $s ) {
		return []; }
	public function get_col( $s ) {
		return []; }
	public function get_var( $s ) {
		return 0; }
	public function query( $s ) {
		return 0; }
	public function insert( $t, $d ) {
		return 1; }
	public function update( $t, $d, $w ) {
		return 1; }
	public function delete( $t, $w = null, $f = null ) {
		return 0; }
}
$GLOBALS['wpdb'] = new FakeWpdbReserva();

require_once $base . '/core/content/Document.php';
require_once $base . '/core/content/RevisionRepository.php';
require_once $base . '/core/content/PageRepository.php';

\Meridian\Components\Registry::boot();

use Meridian\Forms\Booking;
use Meridian\Forms\BookingStore;
use Meridian\Render\RenderContext;
use Meridian\Security\Sanitizer;

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

/** Un turno de los que escribe el panel. */
function turno( string $nombre, string $ini, string $fin, array $dias ): array {
	$t = [
		'label' => $nombre,
		'start' => $ini,
		'end'   => $fin,
	];
	foreach ( Booking::DIAS as $clave ) {
		$t[ $clave ] = false;
	}
	foreach ( $dias as $d ) {
		$t[ Booking::DIAS[ $d ] ] = true;
	}
	return $t;
}

/* ------------------------------------------------------------------ */
echo "\nPRUEBA 1 — leer las reglas del bloque\n";

$props = [
	'turnos'    => [
		turno( 'Comida', '13:00', '15:30', [ 2, 3, 4, 5, 6, 7 ] ),
		turno( 'Cena', '20:00', '22:30', [ 4, 5, 6 ] ),
	],
	'slot'      => 30,
	'lead'      => 120,
	'days'      => 20,
	'closed'    => '2026-11-01, 02/11/2026',
	'maxGuests' => 8,
	'guests'    => 2,
	'destino'   => 'ambos',
	'whatsapp'  => '+57 300 123 4567',
	'email'     => 'reservas@restaurante.test',
];
$cfg = Booking::config( $props );
ok( 2 === count( $cfg['turnos'] ), 'los dos turnos se leen' );
ok( [ 2, 3, 4, 5, 6, 7 ] === $cfg['turnos'][0]['dias'], 'el turno de comida trabaja de martes a domingo' );
ok( [ 4, 5, 6 ] === $cfg['turnos'][1]['dias'], 'y el de cena sólo de jueves a sábado' );
ok( 30 === $cfg['slot'] && 120 === $cfg['lead'] && 20 === $cfg['days'], 'salto, antelación y días vista' );
ok( [ '2026-11-01', '2026-11-02' ] === $cfg['cerrados'], 'los días cerrados valen escritos de las dos maneras' );
ok( '573001234567' === $cfg['whatsapp'], 'el número queda en internacional y sólo con dígitos' );

$raro = Booking::config( [ 'slot' => 7, 'days' => 9999, 'maxGuests' => 0, 'guests' => 40 ] );
ok( 30 === $raro['slot'], 'un salto que no existe cae a media hora' );
ok( 365 === $raro['days'], 'los días vista se topan en un año' );
ok( 12 === $raro['maxGuests'] && $raro['guests'] <= $raro['maxGuests'], 'el tope de comensales nunca queda por debajo del de partida' );
ok( 2 === count( $raro['turnos'] ), 'sin turnos escritos se parte de comida y cena' );

$sin_dias = Booking::config( [ 'turnos' => [ [ 'label' => 'Todo el día', 'start' => '12:00', 'end' => '23:00' ] ] ] );
ok( [ 1, 2, 3, 4, 5, 6, 7 ] === $sin_dias['turnos'][0]['dias'], 'un turno sin días marcados vale todos los días' );

$roto = Booking::config( [ 'turnos' => [ turno( 'Al revés', '22:00', '13:00', [ 1 ] ), turno( 'Bien', '13:00', '14:00', [ 1 ] ) ] ] );
ok( 1 === count( $roto['turnos'] ) && 'Bien' === $roto['turnos'][0]['label'], 'un turno que acaba antes de empezar se descarta' );

ok( '09:05' === Booking::hora( '9:05' ), 'una hora corta se escribe con el cero delante' );
ok( '' === Booking::hora( '25:00' ) && '' === Booking::hora( 'a las ocho' ), 'lo que no es una hora no pasa' );

/* ------------------------------------------------------------------ */
echo "\nPRUEBA 2 — las horas que se ofrecen\n";

// 2026-10-15 es jueves; 2026-10-12, lunes; 2026-10-13, martes.
$lejos = (int) strtotime( '2026-10-01 10:00:00 Europe/Madrid' );
$h_jue = Booking::huecos( $cfg, '2026-10-15', $lejos );
ok( '13:00' === $h_jue[0], 'el primer hueco es el primer pase' );
ok( in_array( '15:30', $h_jue, true ), 'la última hora del turno también se puede pedir' );
ok( ! in_array( '16:00', $h_jue, true ), 'y ni una más' );
ok( in_array( '20:00', $h_jue, true ) && in_array( '22:30', $h_jue, true ), 'la cena del jueves sale entera' );
ok( 12 === count( $h_jue ), 'doce huecos en total: seis de comida y seis de cena' );
ok( $h_jue === array_values( array_unique( $h_jue ) ), 'sin repetir ninguno' );

$h_mar = Booking::huecos( $cfg, '2026-10-13', $lejos );
ok( ! in_array( '20:00', $h_mar, true ), 'el martes no hay cena, porque ese turno no trabaja' );
ok( [] === Booking::huecos( $cfg, '2026-10-12', $lejos ), 'el lunes está cerrado entero' );
ok( [] === Booking::huecos( $cfg, '2026-11-01', $lejos ), 'y un día marcado como cerrado tampoco tiene horas' );

// La antelación mínima: a las 19:00 del jueves ya no se pide la mesa de las 20:00.
$esa_tarde = (int) strtotime( '2026-10-15 19:00:00 Europe/Madrid' );
$h_tarde   = Booking::huecos( $cfg, '2026-10-15', $esa_tarde );
ok( ! in_array( '20:00', $h_tarde, true ), 'con dos horas de antelación, las 20:00 ya no se ofrecen a las 19:00' );
ok( in_array( '21:30', $h_tarde, true ), 'pero las 21:30 sí' );

$sin_espera = Booking::config( array_merge( $props, [ 'lead' => 0 ] ) );
ok( in_array( '20:00', Booking::huecos( $sin_espera, '2026-10-15', $esa_tarde ), true ),
	'sin antelación exigida, la mesa de dentro de una hora se puede pedir' );

$cada_hora = Booking::config( array_merge( $props, [ 'slot' => 60 ] ) );
$h_hora    = Booking::huecos( $cada_hora, '2026-10-15', $lejos );
ok( in_array( '14:00', $h_hora, true ) && ! in_array( '13:30', $h_hora, true ), 'con salto de una hora no hay medias' );

$dias = Booking::dias_abiertos( $cfg, $lejos );
ok( ! in_array( '2026-10-05', $dias, true ), 'la lista de días saltó el lunes' );
ok( in_array( '2026-10-15', $dias, true ), 'y trae los jueves' );
ok( count( $dias ) <= $cfg['days'], 'y nunca más días de los configurados' );

/* ------------------------------------------------------------------ */
echo "\nPRUEBA 3 — el servidor vuelve a comprobarlo todo\n";

$bien = [
	'name'       => 'Ana Gómez',
	'phone'      => '300 123 4567',
	'email'      => 'ana@correo.test',
	'fecha'      => '2026-10-15',
	'hora'       => '21:30',
	'comensales' => '4',
	'message'    => 'Una trona, por favor',
];
$r = Booking::revisar( $bien, $cfg, $lejos );
ok( ! empty( $r['ok'] ), 'una reserva correcta pasa' );
ok( 4 === $r['datos']['comensales'] && '21:30' === $r['datos']['hora'], 'y los datos salen ya en limpio' );

$casos = [
	[ [ 'name' => '' ], 'sin nombre no hay reserva' ],
	[ [ 'phone' => '12' ], 'sin un teléfono de verdad tampoco' ],
	[ [ 'email' => 'esto-no-es-un-correo' ], 'un correo mal escrito se avisa' ],
	[ [ 'fecha' => '2026-02-30' ], 'el 30 de febrero no existe' ],
	[ [ 'fecha' => '2026-10-12' ], 'el lunes está cerrado' ],
	[ [ 'fecha' => '2026-11-01' ], 'y un día marcado como cerrado, también' ],
	[ [ 'hora' => '17:15' ], 'una hora que no está en la lista no vale' ],
	[ [ 'comensales' => '20' ], 'más gente de la que cabe, tampoco' ],
	[ [ 'comensales' => '0' ], 'ni una mesa para nadie' ],
	[ [ 'fecha' => '2027-06-01' ], 'ni un día más allá de lo que se abre' ],
];
foreach ( $casos as [ $cambio, $msg ] ) {
	$malo = Booking::revisar( array_merge( $bien, $cambio ), $cfg, $lejos );
	ok( empty( $malo['ok'] ) && ! empty( $malo['error'] ), $msg );
}
$sin_correo = Booking::revisar( array_merge( $bien, [ 'email' => '' ] ), $cfg, $lejos );
ok( ! empty( $sin_correo['ok'] ), 'el correo es opcional: sin él la reserva sigue valiendo' );

$pasada = Booking::revisar( $bien, $cfg, (int) strtotime( '2026-10-15 22:00:00 Europe/Madrid' ) );
ok( empty( $pasada['ok'] ), 'y una hora que ya pasó se rechaza aunque la pidan a mano' );

$sin_nota = Booking::revisar( $bien, Booking::config( array_merge( $props, [ 'showMessage' => false ] ) ), $lejos );
ok( '' === $sin_nota['datos']['mensaje'], 'si el bloque no pide nota, no se guarda ninguna' );

/* ------------------------------------------------------------------ */
echo "\nPRUEBA 4 — el destino lo pone el bloque, no el envío\n";

$pagina = \Meridian\Content\PageRepository::create( [ 'title' => 'Reservas', 'slug' => 'reservas' ] );
$pid    = (int) $pagina['id'];
$doc    = \Meridian\Content\PageRepository::get( $pid, 'draft' );
$doc['sections'] = [
	[
		'id'       => 's1',
		'type'     => 'section',
		'props'    => [ 'width' => 'padded' ],
		'children' => [
			[
				'id'       => 'r1',
				'type'     => 'row',
				'props'    => [],
				'children' => [
					[
						'id'       => 'c1',
						'type'     => 'column',
						'props'    => [ 'span' => 12 ],
						'children' => [
							[
								'id'       => 'bk1',
								'type'     => 'booking-form',
								'props'    => $props,
								'children' => [],
							],
						],
					],
				],
			],
		],
	],
];
\Meridian\Content\PageRepository::save_draft( $pid, $doc );
// Publicar de verdad arrastra el renderizador entero; aquí basta con
// dejar escrito lo publicado, que es lo que lee el manejador.
\Meridian\Content\PageRepository::write_meta( $pid, MERIDIAN_META_PUBLISHED, \Meridian\Content\PageRepository::get( $pid, 'draft' ) );

$leidas = Booking::props_de_nodo( $pid, 'bk1' );
ok( is_array( $leidas ), 'el bloque se encuentra en la página publicada' );
ok( '573001234567' === Booking::config( $leidas )['whatsapp'], 'y trae el número que puso el restaurante' );
ok( null === Booking::props_de_nodo( $pid, 'noexiste' ), 'un identificador inventado no devuelve nada' );
ok( null === Booking::props_de_nodo( $pid, 'c1' ), 'y una columna con ese id tampoco: sólo vale un bloque de reserva' );

$solo_wa = Booking::config( array_merge( $props, [ 'destino' => 'whatsapp' ] ) );
ok( 'whatsapp' === $solo_wa['destino'], 'el destino «sólo WhatsApp» se respeta' );
$wa_sin_numero = Booking::config( array_merge( $props, [ 'destino' => 'whatsapp', 'whatsapp' => '' ] ) );
ok( 'correo' === $wa_sin_numero['destino'], 'pero sin número se cae al correo en vez de perder la reserva' );
$numero_malo = Booking::config( array_merge( $props, [ 'whatsapp' => '12' ] ) );
ok( '' === $numero_malo['whatsapp'] && 'correo' === $numero_malo['destino'], 'un número que no lo es se descarta' );

$js = Booking::para_js( $cfg );
ok( ! array_key_exists( 'whatsapp', $js ) && ! array_key_exists( 'email', $js ),
	'lo que se manda al navegador no lleva ni el número ni el correo de destino' );
ok( isset( $js['turnos'] ) && isset( $js['slot'] ), 'sólo las reglas para pintar el selector' );

/* ------------------------------------------------------------------ */
echo "\nPRUEBA 5 — el enlace de WhatsApp\n";

$texto  = Booking::texto( $r['datos'] );
$enlace = Booking::enlace_whatsapp( $cfg['whatsapp'], $texto );
ok( str_starts_with( $enlace, 'https://wa.me/573001234567?text=' ), 'el enlace es el oficial, con el número delante' );
ok( ! str_contains( $enlace, ' ' ) && ! str_contains( $enlace, "\n" ), 'el texto va codificado, sin espacios ni saltos sueltos' );
ok( str_contains( rawurldecode( $enlace ), 'Ana Gómez' ), 'y al descodificarlo aparece el nombre' );
ok( str_contains( rawurldecode( $enlace ), '21:30' ), 'con la hora' );
ok( str_contains( rawurldecode( $enlace ), '4 personas' ), 'y cuántos son' );
ok( str_contains( rawurldecode( $enlace ), 'Una trona' ), 'la nota del cliente viaja en el mensaje' );
ok( '' === Booking::enlace_whatsapp( 'pues llámame', $texto ), 'sin un número de verdad no hay enlace' );
ok( str_contains( Booking::texto( array_merge( $r['datos'], [ 'comensales' => 1 ] ) ), '1 persona' ),
	'una sola persona se dice en singular' );

/* ------------------------------------------------------------------ */
echo "\nPRUEBA 6 — lo que queda apuntado\n";

$id1 = BookingStore::add( $r['datos'], $pid );
ok( $id1 > 0, 'la reserva se guarda' );
$id2 = BookingStore::add(
	array_merge( $r['datos'], [ 'nombre' => 'Luis', 'fecha' => '2020-01-02', 'hora' => '14:00' ] ),
	$pid
);
$id3 = BookingStore::add(
	array_merge( $r['datos'], [ 'nombre' => 'Marta', 'fecha' => '2099-12-31', 'hora' => '13:00' ] ),
	$pid
);

$proximas = BookingStore::lista( [ 'cuales' => 'proximas' ] );
$nombres  = array_column( $proximas['reservas'], 'nombre' );
ok( in_array( 'Marta', $nombres, true ), 'las próximas incluyen la de dentro de unos años' );
ok( ! in_array( 'Luis', $nombres, true ), 'y dejan fuera la de 2020' );
ok( in_array( 'Luis', array_column( BookingStore::lista( [ 'cuales' => 'pasadas' ] )['reservas'], 'nombre' ), true ),
	'que sí sale en las pasadas' );
ok( 3 === BookingStore::lista( [ 'cuales' => 'todas' ] )['total'], 'y en «todas» están las tres' );

$orden = array_column( BookingStore::lista( [ 'cuales' => 'todas' ] )['reservas'], 'cuando' );
$ordenado = $orden;
sort( $ordenado );
ok( $orden === $ordenado, 'la lista sale ordenada por día y hora' );

ok( 'nueva' === $proximas['reservas'][0]['estado'], 'una reserva recién llegada está sin confirmar' );
ok( BookingStore::nuevas() >= 1, 'y cuenta para el aviso del menú' );
$cambiada = BookingStore::set_estado( $id1, 'confirmada' );
ok( 'confirmada' === ( $cambiada['estado'] ?? '' ), 'se puede confirmar' );
ok( null === BookingStore::set_estado( $id1, 'inventado' ), 'pero no a un estado que no existe' );
BookingStore::set_estado( $id3, 'cancelada' );
ok( ! in_array( 'Marta', array_column( BookingStore::lista( [ 'cuales' => 'proximas' ] )['reservas'], 'nombre' ), true ),
	'una cancelada desaparece de las próximas' );
ok( in_array( 'Marta', array_column( BookingStore::lista( [ 'cuales' => 'canceladas' ] )['reservas'], 'nombre' ), true ),
	'y aparece en las canceladas' );
ok( BookingStore::borrar( $id2 ), 'se puede borrar' );
ok( 2 === BookingStore::lista( [ 'cuales' => 'todas' ] )['total'], 'y deja de estar en la lista' );
ok( ! BookingStore::borrar( $pid ), 'borrar no se lleva por delante nada que no sea una reserva' );

$ficha = BookingStore::lista( [ 'cuales' => 'todas' ] )['reservas'][0];
foreach ( [ 'nombre', 'telefono', 'fecha', 'hora', 'comensales', 'estado' ] as $campo ) {
	ok( array_key_exists( $campo, $ficha ), "la ficha guarda «{$campo}»" );
}

/* ------------------------------------------------------------------ */
echo "\nPRUEBA 7 — el bloque pintado, también sin JavaScript\n";

$nodo = Sanitizer::node(
	[
		'id'    => 'bk9',
		'type'  => 'booking-form',
		'props' => array_merge( $props, [ 'consent' => 'Acepto la <a href="/privacidad/">política</a>' ] ),
	],
	0
);
$ctx = new RenderContext();
$ctx->postId = $pid;
$html = \Meridian\Render\NodeRenderer::render( $nodo, $ctx );

ok( str_contains( $html, 'js-krg-booking' ), 'el formulario se pinta' );
ok( str_contains( $html, 'name="krg_nonce"' ), 'con su nonce' );
ok( str_contains( $html, 'name="website"' ), 'y con el campo trampa para los robots' );
ok( str_contains( $html, 'name="pageId" value="' . $pid . '"' ), 'dice de qué página es' );
ok( str_contains( $html, 'name="nodeId" value="bk9"' ), 'y qué bloque, para que el servidor lea sus reglas' );
ok( str_contains( $html, 'type="date" name="fecha"' ), 'el campo de día nativo está ahí: sin guion también se reserva' );
ok( str_contains( $html, 'type="time" name="hora"' ), 'el de hora, también' );
ok( str_contains( $html, 'name="comensales"' ) && str_contains( $html, 'max="8"' ), 'y el de comensales, con su tope' );
ok( str_contains( $html, 'step="1800"' ), 'el campo de hora salta de media en media hora' );
ok( str_contains( $html, 'class="m-bk-pick" hidden' ), 'el selector nace plegado y lo abre el guion' );
ok( str_contains( $html, 'role="radiogroup"' ), 'los días y las horas son un grupo de opciones de verdad' );
ok( str_contains( $html, 'aria-live="polite"' ), 'y el resumen se lee en voz alta al cambiarlo' );
ok( str_contains( $html, '<a href="/privacidad/"' ), 'el texto legal conserva su enlace' );
ok( ! str_contains( $html, '573001234567' ) && ! str_contains( $html, '300 123 4567' ),
	'el número de WhatsApp no sale en la página' );
ok( ! str_contains( $html, 'reservas@restaurante.test' ), 'ni el correo de destino' );
ok( ! str_contains( strtolower( $html ), 'text-transform' ), 'y nada de mayúsculas forzadas' );

$ficha_reg = \Meridian\Components\Registry::get( 'booking-form' );
ok( is_array( $ficha_reg ), 'el bloque está en el registro' );
$claves = array_column( $ficha_reg['fields'] ?? [], 'key' );
foreach ( [ 'destino', 'whatsapp', 'email', 'turnos', 'slot', 'lead', 'days', 'closed', 'maxGuests' ] as $k ) {
	ok( in_array( $k, $claves, true ), "y se puede configurar «{$k}» desde el panel" );
}
$guardadas = Sanitizer::props( [ 'whatsapp' => '+57 300 123 4567', 'destino' => 'whatsapp' ], $ficha_reg );
ok( '+57 300 123 4567' === $guardadas['whatsapp'], 'el número sobrevive al guardado' );
ok( 'whatsapp' === $guardadas['destino'], 'y el destino elegido, también' );
ok( 'correo' === Sanitizer::props( [ 'destino' => 'por paloma' ], $ficha_reg )['destino'],
	'un destino inventado cae en el primero de la lista' );

/* ====================================================================
 * Cómo se lee la hora: 24 h o a. m./p. m.
 *
 * El valor que viaja y se compara es siempre «HH:MM» de 24 horas. Lo
 * que cambia es la etiqueta, y de serie la decide el propio WordPress
 * (Ajustes → General), que a su vez la hereda del idioma: es-CO trae
 * «g:i a» y es-ES, «H:i». Así no hay que configurar lo mismo dos veces.
 * ==================================================================== */
echo "\nCómo se lee la hora\n";

$GLOBALS['krg_opt']['time_format'] = 'H:i';
ok( '24' === Booking::reloj(), 'un sitio con «H:i» se lee en 24 horas' );
ok( '20:30' === Booking::hora_texto( '20:30' ), 'y la cena es «20:30»' );

$GLOBALS['krg_opt']['time_format'] = 'g:i a';
ok( '12' === Booking::reloj(), 'un sitio con «g:i a» —es-CO de fábrica— se lee en a. m./p. m.' );
ok( '8:30 p. m.' === Booking::hora_texto( '20:30' ), 'la misma cena es «8:30 p. m.»' );
ok( '1:00 p. m.' === Booking::hora_texto( '13:00' ), 'la una de la tarde, «1:00 p. m.»' );
ok( '12:00 p. m.' === Booking::hora_texto( '12:00' ), 'el mediodía es p. m., no 0' );
ok( '12:15 a. m.' === Booking::hora_texto( '00:15' ), 'y pasada la medianoche, «12:15 a. m.»' );
ok( '9:05 a. m.' === Booking::hora_texto( '09:05' ), 'los minutos llevan su cero: «9:05 a. m.»' );

ok( '20:30' === Booking::hora_texto( '20:30', '24' ), 'el bloque puede forzar 24 horas' );
$GLOBALS['krg_opt']['time_format'] = 'H:i';
ok( '8:30 p. m.' === Booking::hora_texto( '20:30', '12' ), 'y puede forzar a. m./p. m.' );
ok( 'ni hora' === Booking::hora_texto( 'ni hora', '12' ), 'lo que no es una hora se devuelve tal cual' );

$cfg_reloj = Booking::config( [ 'clock' => '12' ] );
ok( '12' === ( $cfg_reloj['reloj'] ?? '' ), 'la configuración recoge el reloj del bloque' );
ok( 'auto' === Booking::config( [ 'clock' => 'reloj de sol' ] )['reloj'], 'y un valor inventado cae en «auto»' );

$js = Booking::para_js( $cfg_reloj );
ok( '12' === ( $js['reloj'] ?? '' ), 'el guion lo recibe ya resuelto, sin tener que mirar nada' );
ok( ! empty( $js['am'] ) && ! empty( $js['pm'] ), 'con las dos palabras puestas por el idioma, no escritas en el guion' );
$huecos_reloj = Booking::huecos( Booking::config( [] ), '2026-10-16', strtotime( '2026-10-15 10:00:00 UTC' ) );
ok( in_array( '20:30', $huecos_reloj, true ), 'y los huecos siguen siendo «HH:MM»: lo que cambia es la etiqueta, no el dato' );

$texto_12 = Booking::texto(
	[
		'nombre'     => 'Ana',
		'telefono'   => '+57 300 111 2233',
		'email'      => '',
		'fecha'      => '2026-10-16',
		'hora'       => '20:30',
		'comensales' => 2,
		'mensaje'    => '',
	],
	'12'
);
ok( str_contains( $texto_12, '8:30 p. m.' ), 'el mensaje que le llega al restaurante también se lee en claro' );

ok( in_array( 'clock', array_column( $ficha_reg['fields'] ?? [], 'key' ), true ),
	'y se elige desde el panel, como todo lo demás' );

echo "\n$hechas comprobaciones, $fallos " . ( 1 === $fallos ? 'fallo' : 'fallos' ) . "\n";
echo $fallos ? "HAY FALLOS\n" : "LA RESERVA VA ($hechas comprobaciones)\n";
exit( $fallos ? 1 : 0 );
