<?php
/**
 * Buscar y reemplazar por todo el sitio.
 *
 * Por que hace falta: cambia el telefono, cambia la direccion, o el
 * dominio de pruebas se queda escrito en veinte botones. Hacerlo a mano
 * es abrir pagina por pagina y mirar bloque por bloque, que es justo
 * donde se cuelan los olvidos. Y hacerlo mal es peor: un reemplazo que
 * entra en los colores o en los identificadores deja el sitio roto sin
 * que nadie lo vea hasta el dia siguiente.
 *
 * Lo que se comprueba, con un WordPress de mentira con memoria:
 *
 *   1. Que encuentra el texto en todas las paginas, baje donde baje:
 *      en un parrafo, dentro de una lista repetida, en el titulo y en
 *      los campos de SEO.
 *   2. Que cada hallazgo dice donde esta —pagina, bloque, campo— y
 *      enseña un trozo de texto alrededor para reconocerlo.
 *   3. Que distingue mayusculas si se le pide, y que «palabra entera»
 *      no se lleva por delante las palabras que la contienen.
 *   4. Que reemplaza solo en las paginas marcadas y cuenta cuantas
 *      veces; las que no se marcan se quedan exactamente igual.
 *   5. Que no toca lo que no es texto: colores, medidas, identificadores
 *      ni la direccion de la pagina.
 *   6. Que lo escrito es el borrador, que queda version en el historial
 *      para poder deshacerlo, y que la cabecera y el pie entran solo si
 *      se piden.
 *
 *   .tools/php/php tools/prueba-buscar.php
 */

define( 'ABSPATH', __DIR__ . '/' );

/* ------------------------------------------------------------------ */
/* WordPress de mentira: entradas, metadatos y opciones                 */

$GLOBALS['krg_posts']    = [];
$GLOBALS['krg_meta']     = [];
$GLOBALS['krg_opt']      = [];
$GLOBALS['krg_sig_post'] = 100;

function wp_insert_post( $args = [], $wp_error = false ) {
	$id   = ++$GLOBALS['krg_sig_post'];
	$slug = $args['post_name'] ?? sanitize_title( $args['post_title'] ?? '' );
	// WordPress no repite slugs: el segundo lleva sufijo.
	$usados = array_column( $GLOBALS['krg_posts'], 'post_name' );
	if ( $slug && in_array( $slug, $usados, true ) ) {
		$n = 2;
		while ( in_array( $slug . '-' . $n, $usados, true ) ) {
			++$n;
		}
		$slug .= '-' . $n;
	}
	$GLOBALS['krg_posts'][ $id ] = [
		'ID'            => $id,
		'post_type'     => $args['post_type'] ?? 'post',
		'post_status'   => $args['post_status'] ?? 'draft',
		'post_title'    => $args['post_title'] ?? '',
		'post_name'     => $slug,
		'post_parent'   => (int) ( $args['post_parent'] ?? 0 ),
		'post_content'  => $args['post_content'] ?? '',
		'post_password' => '',
		'post_modified' => '2026-10-05 12:00:00',
		'post_date'     => '2026-10-05 12:00:00',
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
	return $GLOBALS['krg_posts'][ (int) $id ][ $campo ] ?? ''; }
function get_posts( $args = [] ) {
	$tipo = $args['post_type'] ?? 'post';
	$out  = [];
	foreach ( $GLOBALS['krg_posts'] as $row ) {
		if ( $row['post_type'] === $tipo ) {
			$out[] = new WP_Post( $row );
		}
	}
	return $out;
}
function get_post_meta( $id, $clave = '', $uno = false ) {
	$v = $GLOBALS['krg_meta'][ (int) $id ][ $clave ] ?? '';
	return $uno ? $v : ( '' === $v ? [] : [ $v ] );
}
function update_post_meta( $id, $clave, $valor ) {
	$GLOBALS['krg_meta'][ (int) $id ][ $clave ] = $valor;
	return true; }
function delete_post_meta( $id, $clave, $valor = '' ) {
	unset( $GLOBALS['krg_meta'][ (int) $id ][ $clave ] );
	return true; }
function wp_delete_post( $id, $forzar = false ) {
	unset( $GLOBALS['krg_posts'][ (int) $id ] );
	return true; }
function get_option( $k, $def = false ) {
	return $GLOBALS['krg_opt'][ $k ] ?? $def; }
function update_option( $k, $v, $auto = null ) {
	$GLOBALS['krg_opt'][ $k ] = $v;
	return true; }
function delete_option( $k ) {
	unset( $GLOBALS['krg_opt'][ $k ] );
	return true; }
function home_url( $p = '' ) {
	return 'https://destino.test/' . ltrim( (string) $p, '/' ); }
function get_permalink( $p = null ) {
	$id = (int) ( is_object( $p ) ? $p->ID : $p );
	$s  = $GLOBALS['krg_posts'][ $id ]['post_name'] ?? '';
	return 'https://destino.test/' . $s . '/'; }
function get_bloginfo( $x = 'name' ) {
	return 'Destino'; }
function clean_post_cache( $id ) {}
function update_meta_cache( $t, $ids ) {
	return true; }
function wp_list_pluck( $l, $c ) {
	return array_map( fn( $x ) => is_object( $x ) ? $x->$c : $x[ $c ], $l ); }
function current_user_can( $c ) {
	return true; }
function get_current_user_id() {
	return 7; }
function get_user_by( $c, $v ) {
	return (object) [ 'display_name' => 'Ana' ]; }
function current_time( $t = 'mysql' ) {
	return gmdate( 'Y-m-d H:i:s', time() ); }
function is_wp_error( $x ) {
	return $x instanceof WP_Error; }
function wp_cache_flush() {
	return true; }
function _n( $uno, $varios, $n, $dom = '' ) {
	return 1 === (int) $n ? $uno : $varios; }

/** Un `WP_Query` que ve las entradas de mentira de este banco. */
class WP_Query {
	public $posts = [];
	public function __construct( $args = [] ) {
		$tipo = $args['post_type'] ?? 'post';
		foreach ( $GLOBALS['krg_posts'] as $row ) {
			if ( $row['post_type'] === $tipo ) {
				$this->posts[] = new WP_Post( $row );
			}
		}
	}
	public function have_posts() {
		return false; }
	public function the_post() {}
}

class WP_Error {
	public $msg;
	public function __construct( $code = '', $msg = '', $data = [] ) {
		$this->msg = $msg; }
	public function get_error_message() {
		return $this->msg; }
}

require __DIR__ . '/wp-shim.php';
require_once dirname( __DIR__ ) . '/krg-cms/core/constants.php';

$base = dirname( __DIR__ ) . '/krg-cms';
foreach (
	[
		'/core/components/Catalog.php',
		'/core/components/BrandCatalog.php',
		'/core/components/Registry.php',
		'/core/security/Sanitizer.php',
		'/core/security/UrlValidator.php',
		'/core/style/BoxStyles.php',
		'/core/design/TokenDefaults.php',
		'/core/design/TokenRepository.php',
		'/core/design/TokenCompiler.php',
		'/core/content/Document.php',
		'/core/log/Logger.php',
		'/core/cache/DocumentCache.php',
		'/core/navigation/Menus.php',
	] as $f
) {
	require_once $base . $f;
}
\Meridian\Components\Registry::boot();

class FakeWpdbBuscar {
	public $prefix   = 'wp_';
	public $postmeta = 'wp_postmeta';
	private $sig     = 1;
	public function prepare( $sql, ...$a ) {
		foreach ( $a as $x ) {
			$sql = preg_replace( '/%[ds]/', is_int( $x ) ? (string) $x : "'" . $x . "'", $sql, 1 );
		}
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
$GLOBALS['wpdb'] = new FakeWpdbBuscar();

require_once $base . '/core/content/RevisionRepository.php';
require_once $base . '/core/content/PageRepository.php';
require_once $base . '/core/content/GlobalsRepository.php';
require_once $base . '/core/content/DesignKit.php';
require_once $base . '/core/content/Search.php';

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

use Meridian\Content\Search;
use Meridian\Content\PageRepository;

function nodo( string $id, string $type, array $props = [], array $children = [] ): array {
	return [
		'id'       => $id,
		'type'     => $type,
		'name'     => $type,
		'visible'  => true,
		'source'   => 'local',
		'globalId' => 0,
		'props'    => $props,
		'styles'   => [],
		'children' => $children,
	];
}
function seccion( string $id, array $dentro ): array {
	return nodo( $id, 'section', [ 'width' => 'padded' ], [ nodo( $id . '-r', 'row', [], [ nodo( $id . '-c', 'column', [ 'span' => 12 ], $dentro ) ] ) ] );
}
function crear( string $titulo, string $slug, array $dentro, array $seo = [] ): int {
	$p = PageRepository::create( [ 'title' => $titulo, 'slug' => $slug ] );
	$doc             = PageRepository::get( (int) $p['id'], 'draft' );
	$doc['sections'] = [ seccion( 'sec-' . $slug, $dentro ) ];
	$doc['seo']      = $seo;
	PageRepository::save_draft( (int) $p['id'], $doc );
	return (int) $p['id'];
}
/** El texto de un campo de un bloque, tal y como ha quedado guardado. */
function valor( int $id, string $nodeId, string $campo ) {
	$doc   = PageRepository::get( $id, 'draft' );
	$fuera = null;
	$ver   = function ( array $nodos ) use ( &$ver, $nodeId, $campo, &$fuera ) {
		foreach ( $nodos as $n ) {
			if ( ( $n['id'] ?? '' ) === $nodeId ) {
				$fuera = $n['props'][ $campo ] ?? null;
			}
			if ( ! empty( $n['children'] ) ) {
				$ver( $n['children'] );
			}
		}
	};
	$ver( $doc['sections'] ?? [] );
	return $fuera;
}

/* ------------------------------------------------------------------ */
/* Un sitio con tres paginas y el telefono viejo por todas partes       */

$inicio = crear(
	'Inicio',
	'inicio',
	[
		nodo( 'p1', 'paragraph', [ 'text' => 'Llámanos al 555 12 34 56 y te lo guardamos.' ] ),
		nodo( 'b1', 'button', [ 'text' => 'Llamar al 555 12 34 56', 'url' => 'tel:+34555123456' ] ),
		nodo(
			'l1',
			'feature-grid',
			[
				'items' => [
					[ 'title' => 'Pedidos', 'text' => 'Al 555 12 34 56, de 9 a 14.' ],
					[ 'title' => 'Visitas', 'text' => 'Con cita previa.' ],
				],
			]
		),
	],
	[ 'title' => 'Miel del valle', 'description' => 'Pide por teléfono al 555 12 34 56.' ]
);
$contacto = crear(
	'Contacto',
	'contacto',
	[
		nodo( 'p2', 'paragraph', [ 'text' => 'Teléfono: 555 12 34 56. Correo: hola@ejemplo.test' ] ),
		nodo( 'h2', 'heading', [ 'text' => 'Dónde estamos', 'tag' => 'h2' ] ),
	]
);
$carta = crear(
	'Carta',
	'carta',
	[
		nodo( 'p3', 'paragraph', [ 'text' => 'Tarros de 500 g y de 250 g.' ] ),
		nodo( 'c1', 'cta', [ 'title' => 'Reserva tu tarro', 'bgColor' => '#3F5E58', 'minHeight' => '420px' ] ),
	]
);

echo "PRUEBA 1 — encontrar\n";

$r = Search::buscar( '555 12 34 56' );
ok( 2 === count( $r['paginas'] ), 'sale en dos páginas de las tres' );
ok( 5 === $r['total'], "y cinco veces en total ({$r['total']})" );
$inicio_hits = $r['paginas'][0]['hallazgos'];
$campos      = array_column( $inicio_hits, 'campo' );
ok( in_array( 'text', $campos, true ), 'en el texto de un párrafo' );
ok( in_array( 'items.0.text', $campos, true ), 'dentro de una lista repetida, con la ruta del campo' );
ok( in_array( 'Descripción SEO', $campos, true ), 'y en los campos de SEO, que nadie mira nunca' );
$uno = $inicio_hits[0];
ok( '' !== $uno['nodeId'] || 'seo' === $uno['tipo'], 'cada hallazgo sabe de qué bloque es' );

$titulos = Search::buscar( 'Carta' );
ok( 1 === count( $titulos['paginas'] ) && 'Carta' === $titulos['paginas'][0]['title'],
	'el título de la página también cuenta' );

echo "\nPRUEBA 2 — con su contexto\n";

$ctx = null;
foreach ( $inicio_hits as $h ) {
	if ( 'p1' === $h['nodeId'] ) {
		$ctx = $h;
	}
}
ok( $ctx && str_contains( $ctx['contexto'], 'Llámanos al 555 12 34 56' ),
	'se ve la frase entera alrededor: «' . ( $ctx['contexto'] ?? '' ) . '»' );
ok( $ctx && 'paragraph' === $ctx['tipo'], 'y de qué clase de bloque es' );

$largo = crear(
	'Larga',
	'larga',
	[ nodo( 'p9', 'paragraph', [ 'text' => str_repeat( 'palabra de relleno ', 20 ) . 'AGUJA' . str_repeat( ' más relleno', 20 ) ] ) ]
);
$aguja = Search::buscar( 'AGUJA' );
$trozo = $aguja['paginas'][0]['hallazgos'][0]['contexto'];
ok( mb_strlen( $trozo ) < 140, "un texto largo se recorta (" . mb_strlen( $trozo ) . " caracteres)" );
ok( str_starts_with( $trozo, '…' ) && str_contains( $trozo, 'AGUJA' ), 'y se ve que viene de más atrás' );

echo "\nPRUEBA 3 — mayúsculas y palabras enteras\n";

ok( 1 === count( Search::buscar( 'aguja' )['paginas'] ), 'por defecto da igual cómo se escriba' );
ok( 0 === count( Search::buscar( 'aguja', [ 'sensible' => true ] )['paginas'] ),
	'y si se pide distinguir mayúsculas, se distinguen' );

$miel = crear(
	'Mieles',
	'mieles',
	[ nodo( 'p10', 'paragraph', [ 'text' => 'La miel y la mielada no son lo mismo.' ] ) ]
);
function veces_en( array $r, string $nodeId ): int {
	foreach ( $r['paginas'] as $p ) {
		foreach ( $p['hallazgos'] as $h ) {
			if ( $nodeId === $h['nodeId'] ) {
				return (int) $h['veces'];
			}
		}
	}
	return 0;
}
ok( 2 === veces_en( Search::buscar( 'miel' ), 'p10' ),
	'«miel» aparece dos veces en la frase si vale cualquier trozo' );
ok( 1 === veces_en( Search::buscar( 'miel', [ 'entera' => true ] ), 'p10' ),
	'y una sola como palabra entera: «mielada» no cuenta' );

echo "\nPRUEBA 4 — reemplazar donde se diga\n";

$inf = Search::reemplazar( '555 12 34 56', '600 98 76 54', [ 'paginas' => [ $inicio ] ] );
ok( 1 === $inf['paginas'], 'sólo entra en la página marcada' );
ok( 4 === $inf['cambios'], "y cambia las cuatro veces que salía allí ({$inf['cambios']})" );
ok( str_contains( (string) valor( $inicio, 'p1', 'text' ), '600 98 76 54' ), 'el párrafo queda con el teléfono nuevo' );
ok( str_contains( (string) valor( $inicio, 'b1', 'text' ), '600 98 76 54' ), 'el botón también' );
$lista = valor( $inicio, 'l1', 'items' );
ok( str_contains( (string) ( $lista[0]['text'] ?? '' ), '600 98 76 54' ), 'y lo de dentro de la lista repetida' );
ok( str_contains( (string) valor( $contacto, 'p2', 'text' ), '555 12 34 56' ),
	'la página que no se marcó se queda exactamente igual' );
ok( str_contains( (string) ( PageRepository::get( $inicio, 'draft' )['seo']['description'] ?? '' ), '600 98 76 54' ),
	'el SEO de la marcada sí cambia' );

$nada = Search::reemplazar( '555 12 34 56', '600 98 76 54', [ 'paginas' => [] ] );
ok( 0 === $nada['cambios'], 'sin páginas marcadas no se toca nada' );
$vacio = Search::reemplazar( '', 'algo', [ 'paginas' => [ $contacto ] ] );
ok( 0 === $vacio['cambios'] && $vacio['avisos'], 'y buscar la cadena vacía se rechaza en vez de arrasar' );

echo "\nPRUEBA 5 — lo que no se toca\n";

/* El registro manda: en un «cta» el fondo es un campo de color y el
   alto un número, así que ni se buscan ni se cambian por mucho que
   lleven letras dentro. */
$ajustes = crear(
	'Ajustes',
	'ajustes',
	[
		nodo(
			'c2',
			'statement-cta',
			[
				'title'   => 'Reserva en verde',
				'bgColor' => '#3F5E58',
				'bgFit'   => 'cover',
			]
		),
	]
);
ok( 0 === count( Search::buscar( '3F5E58' )['paginas'] ), 'un color ni siquiera sale en la búsqueda' );
$inf2 = Search::reemplazar( '3F5E58', 'ROTO', [ 'paginas' => [ $ajustes ] ] );
ok( 0 === $inf2['cambios'], 'y no se reemplaza' );
ok( str_contains( wp_json_encode( valor( $ajustes, 'c2', 'bgColor' ) ), '3F5E58' ), 'sigue siendo el mismo color' );

$inf3 = Search::reemplazar( 'cover', 'contain', [ 'paginas' => [ $ajustes ] ] );
ok( 0 === $inf3['cambios'] && 'cover' === valor( $ajustes, 'c2', 'bgFit' ),
	'un ajuste de una lista desplegable tampoco: «cover» es una opción, no una palabra' );
ok( 'Reserva en verde' === valor( $ajustes, 'c2', 'title' ), 'y el texto de al lado se queda intacto' );
$inf3b = Search::reemplazar( 'verde', 'ámbar', [ 'paginas' => [ $ajustes ] ] );
ok( 1 === $inf3b['cambios'] && 'Reserva en ámbar' === valor( $ajustes, 'c2', 'title' ),
	'pero el texto de verdad sí se cambia' );

$inf4 = Search::reemplazar( 'carta', 'postre', [ 'paginas' => [ $carta ] ] );
ok( 'carta' === PageRepository::get( $carta, 'draft' )['slug'],
	'y la dirección de la página no se toca: romper enlaces de fuera sin avisar, nunca' );

echo "\nPRUEBA 6 — el borrador, el historial y el chrome\n";

$doc_pub = PageRepository::get( $inicio, 'published' );
ok( ! $doc_pub || ! str_contains( wp_json_encode( $doc_pub ), '600 98 76 54' ),
	'lo publicado se queda como estaba: hay que publicar a mano' );
ok( (bool) array_filter( $inf['avisos'], fn( $a ) => str_contains( $a, 'publicar' ) ),
	'y el informe lo dice con todas las letras' );

\Meridian\Navigation\Menus::save_header(
	wp_parse_args(
		[ 'ctaText' => 'Llama al 555 12 34 56', 'ctaUrl' => 'tel:+34555123456' ],
		\Meridian\Navigation\Menus::header()
	)
);
$sin = Search::buscar( '555 12 34 56' );
$con = Search::buscar( '555 12 34 56', [ 'chrome' => true ] );
ok( [] === $sin['chrome'], 'la cabecera no se mira si no se pide' );
ok( count( $con['chrome'] ) >= 1, 'y se mira si se pide' );
ok( 'Cabecera' === ( $con['chrome'][0]['donde'] ?? '' ), 'diciendo que es de la cabecera' );

$inf5 = Search::reemplazar( '555 12 34 56', '600 98 76 54', [ 'paginas' => [], 'chrome' => true ] );
ok( $inf5['chrome'] >= 1, 'y se reemplaza ahí también' );
ok( str_contains( (string) ( \Meridian\Navigation\Menus::header()['ctaText'] ?? '' ), '600 98 76 54' ),
	'el botón de la cabecera queda con el teléfono nuevo' );

echo "\n$hechas comprobaciones, $fallos " . ( 1 === $fallos ? 'fallo' : 'fallos' ) . "\n";
echo $fallos ? "HAY FALLOS\n" : "BUSCAR Y REEMPLAZAR VA ($hechas comprobaciones)\n";
exit( $fallos ? 1 : 0 );
