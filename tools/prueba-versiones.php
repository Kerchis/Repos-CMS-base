<?php
/**
 * El historial de versiones, por el lado del servidor.
 *
 * Por que hace falta: `RevisionRepository` es lo unico que separa a una
 * persona de perder una tarde de trabajo, y no tenia ni una prueba. Toca
 * la base de datos, asi que aqui se le pone un `$wpdb` de mentira que
 * apunta lo que se le pide: cuantas filas inserta, cuales actualiza y
 * que consultas lanza.
 *
 * Lo que se comprueba:
 *
 *   1. Que el guardado automatico NO llena la tabla: dos guardados
 *      seguidos con el mismo contenido no escriben nada, y dos del mismo
 *      minuto actualizan la misma fila en vez de crear otra. Sin eso, en
 *      una tarde de trabajo las cincuenta versiones que se guardan son
 *      los ultimos cinco minutos y no queda nada de la manana.
 *   2. Que un guardado a mano o una publicacion si crean su version.
 *   3. Que la lista dice de cada version cuando fue, de donde salio,
 *      quien la hizo y **cuanto ocupaba la pagina**, que es lo que
 *      permite distinguir «la de antes de borrarlo todo».
 *   4. Que se puede leer una version suelta para enseñar que cambiaria
 *      antes de restaurar, y que al leerla pasa por el saneador.
 *
 *   .tools/php/php tools/prueba-versiones.php
 */

define( 'ABSPATH', __DIR__ . '/' );

require __DIR__ . '/wp-shim.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/components/Catalog.php';
require_once $base . '/core/components/BrandCatalog.php';
require_once $base . '/core/components/Registry.php';
require_once $base . '/core/security/Sanitizer.php';
require_once $base . '/core/style/BoxStyles.php';
require_once $base . '/core/security/UrlValidator.php';
require_once $base . '/core/design/TokenCompiler.php';
require_once $base . '/core/content/Document.php';

\Meridian\Components\Registry::boot();

if ( ! function_exists( 'get_current_user_id' ) ) {
	function get_current_user_id() {
		return 7;
	}
}
if ( ! function_exists( 'current_time' ) ) {
	function current_time( $tipo = 'mysql' ) {
		global $reloj;
		return gmdate( 'Y-m-d H:i:s', $reloj );
	}
}
if ( ! function_exists( 'get_user_by' ) ) {
	function get_user_by( $campo, $valor ) {
		return (object) [ 'display_name' => 7 === (int) $valor ? 'Ana' : '' ];
	}
}

/**
 * Un `$wpdb` de mentira con memoria.
 *
 * No simula SQL: reconoce las cuatro consultas que hace el repositorio y
 * contesta con lo que tiene guardado. Es justo lo necesario para que las
 * reglas del repositorio —cuando inserta y cuando actualiza— se puedan
 * comprobar sin una base de datos.
 */
class FakeWpdb {
	public $prefix = 'wp_';
	public $filas  = [];
	public $log    = [];
	private $sig   = 1;

	public function prepare( $sql, ...$args ) {
		foreach ( $args as $a ) {
			$sql = preg_replace( '/%[ds]/', is_int( $a ) ? (string) $a : "'" . $a . "'", $sql, 1 );
		}
		return $sql;
	}

	public function get_row( $sql ) {
		if ( false !== strpos( $sql, "origin = 'autosave'" ) ) {
			$ultimas = array_values( array_filter( $this->filas, fn( $f ) => 'autosave' === $f['origin'] ) );
			return $ultimas ? (object) end( $ultimas ) : null;
		}
		if ( preg_match( '/id = (\d+)/', $sql, $m ) ) {
			foreach ( $this->filas as $f ) {
				if ( (int) $f['id'] === (int) $m[1] ) {
					return (object) $f;
				}
			}
		}
		return null;
	}

	public function get_results( $sql ) {
		$out = array_reverse( $this->filas );
		return array_map( fn( $f ) => (object) $f, $out );
	}

	public function get_col( $sql ) {
		return [];
	}

	public function insert( $tabla, $datos ) {
		$datos['id']   = $this->sig++;
		$this->filas[] = $datos;
		$this->log[]   = 'insert';
		return 1;
	}

	public function update( $tabla, $datos, $donde ) {
		foreach ( $this->filas as $i => $f ) {
			if ( (int) $f['id'] === (int) $donde['id'] ) {
				$this->filas[ $i ] = array_merge( $f, $datos );
			}
		}
		$this->log[] = 'update';
		return 1;
	}

	public function query( $sql ) {
		return 0;
	}
}

global $wpdb, $reloj;
// El repositorio compara la fecha guardada con `time()` de verdad, asi
// que el reloj de mentira tiene que andar cerca del de verdad; para
// simular «esto se guardo hace un rato» se envejecen las filas.
$reloj = time();
$wpdb  = new FakeWpdb();

require_once $base . '/core/content/RevisionRepository.php';

use Meridian\Content\RevisionRepository;

$fallos = 0;
$ok     = 0;
function comprueba( bool $cond, string $msg ): void {
	global $fallos, $ok;
	echo '  ' . ( $cond ? 'OK    ' : 'FALLA ' ) . $msg . "\n";
	$cond ? $ok++ : $fallos++;
}

/** Un documento con el numero de bloques que se pida. */
/** Hace como si las versiones guardadas fuesen de hace tantos segundos. */
function envejecer( int $segundos ): void {
	global $wpdb;
	foreach ( $wpdb->filas as $i => $f ) {
		$wpdb->filas[ $i ]['created_at'] = gmdate( 'Y-m-d H:i:s', strtotime( $f['created_at'] ) - $segundos );
	}
}

function doc_con( int $parrafos, string $titulo = 'Inicio' ): array {
	$hijos = [];
	for ( $i = 0; $i < $parrafos; $i++ ) {
		$hijos[] = [
			'id'       => 'p' . $i,
			'type'     => 'paragraph',
			'name'     => 'Párrafo',
			'props'    => [ 'text' => 'Texto ' . $i ],
			'styles'   => [],
			'children' => [],
		];
	}
	return [
		'id'       => 1,
		'title'    => $titulo,
		'slug'     => 'inicio',
		'status'   => 'draft',
		'seo'      => [],
		'settings' => [],
		'sections' => [
			[
				'id'       => 'sec1',
				'type'     => 'section',
				'name'     => 'Sección',
				'props'    => [],
				'styles'   => [],
				'children' => [
					[
						'id'       => 'row1',
						'type'     => 'row',
						'name'     => 'Fila',
						'props'    => [],
						'styles'   => [],
						'children' => [
							[
								'id'       => 'col1',
								'type'     => 'column',
								'name'     => 'Columna',
								'props'    => [ 'span' => 12 ],
								'styles'   => [],
								'children' => $hijos,
							],
						],
					],
				],
			],
		],
	];
}

echo "\n--- El guardado automático no llena la tabla\n";
RevisionRepository::add( 1, 'page', doc_con( 2 ), 'autosave' );
comprueba( 1 === count( $wpdb->filas ), 'el primer guardado automático crea su versión' );

RevisionRepository::add( 1, 'page', doc_con( 2 ), 'autosave' );
comprueba( 1 === count( $wpdb->filas ), 'repetir el mismo contenido no escribe nada' );

// Veinte segundos despues: sigue siendo el mismo rato.
envejecer( 20 );
RevisionRepository::add( 1, 'page', doc_con( 3 ), 'autosave' );
comprueba( 1 === count( $wpdb->filas ), 'otro cambio del mismo minuto actualiza la versión, no crea otra' );
comprueba( in_array( 'update', $wpdb->log, true ), 'y lo hace con un UPDATE' );

// Dos minutos despues: ya es otro momento y toca version nueva.
envejecer( 120 );
RevisionRepository::add( 1, 'page', doc_con( 4 ), 'autosave' );
comprueba( 2 === count( $wpdb->filas ), 'pasado el minuto sí se guarda una versión nueva' );

echo "\n--- Lo que se hace a mano siempre deja huella\n";
RevisionRepository::add( 1, 'page', doc_con( 4 ), 'manual' );
comprueba( 3 === count( $wpdb->filas ), 'un guardado a mano crea su versión aunque no haya cambiado nada' );
RevisionRepository::add( 1, 'page', doc_con( 9, 'Inicio nuevo' ), 'publish' );
comprueba( 4 === count( $wpdb->filas ), 'y publicar, otra' );

echo "\n--- La lista se puede leer\n";
$lista = RevisionRepository::list( 1 );
comprueba( 4 === count( $lista ), 'devuelve las cuatro versiones' );
comprueba( 'publish' === $lista[0]['origin'], 'la más reciente va la primera (' . $lista[0]['origin'] . ')' );
comprueba( 'Ana' === $lista[0]['author'], 'con el nombre de quien la hizo (' . $lista[0]['author'] . ')' );
comprueba( 'Inicio nuevo' === $lista[0]['title'], 'y el título que tenía la página entonces' );
// Sección + fila + columna + nueve párrafos.
comprueba( 12 === $lista[0]['blocks'], 'cuenta los bloques de dentro: ' . $lista[0]['blocks'] . ' (esperados 12)' );
comprueba( 1 === $lista[0]['sections'], 'y las secciones: ' . $lista[0]['sections'] );
comprueba( 7 === $lista[1]['blocks'], 'la anterior tenía menos: ' . $lista[1]['blocks'] . ' (esperados 7)' );
comprueba( ! isset( $lista[0]['snapshot'] ), 'la lista no arrastra los documentos enteros' );

echo "\n--- Y una versión suelta se puede leer entera\n";
$ultimaId = (int) $wpdb->filas[ count( $wpdb->filas ) - 1 ]['id'];
$doc = RevisionRepository::get( 1, $ultimaId );
comprueba( is_array( $doc ) && isset( $doc['sections'] ), 'devuelve el documento' );
$col = $doc['sections'][0]['children'][0]['children'][0] ?? [];
comprueba( 9 === count( $col['children'] ?? [] ), 'con sus nueve párrafos dentro' );
comprueba( 'Texto 0' === ( $col['children'][0]['props']['text'] ?? '' ), 'y el texto intacto' );

$paso = false;
try {
	RevisionRepository::get( 1, 999 );
} catch ( \RuntimeException $e ) {
	$paso = 'not_found' === $e->getMessage();
}
comprueba( $paso, 'y una versión que no existe avisa en vez de devolver basura' );

// Lo que se lee pasa por el saneador: una versión vieja con un bloque que
// ya no existe no puede colarse tal cual en el editor.
$wpdb->insert(
	'wp_meridian_revisions',
	[
		'post_id'  => 1,
		'origin'   => 'manual',
		'snapshot' => wp_json_encode(
			[
				'id'       => 1,
				'title'    => 'Vieja',
				'sections' => [
					[
						'id'       => 'x1',
						'type'     => 'bloque-que-ya-no-existe',
						'props'    => [],
						'children' => [],
					],
				],
			]
		),
		'author_id' => 7,
		'checksum'  => 'z',
		'created_at' => '2026-10-01 09:00:00',
	]
);
$nuevaId = (int) $wpdb->filas[ count( $wpdb->filas ) - 1 ]['id'];
$viejo   = RevisionRepository::get( 1, $nuevaId );
// El saneador no borra un bloque desconocido —la web simplemente no lo
// pinta—, pero sí le pone todos los campos que el editor espera: lo que
// se comprueba es que la versión pasa por él y no llega cruda.
comprueba(
	isset( $viejo['sections'][0]['visible'], $viejo['sections'][0]['hiddenOn'] ),
	'lo leído viene saneado, con todos sus campos puestos'
);

echo "\n";
if ( $fallos ) {
	echo "HAY {$fallos} FALLOS ({$ok} comprobaciones correctas)\n";
	exit( 1 );
}
echo "EL HISTORIAL DE VERSIONES AGUANTA ({$ok} comprobaciones)\n";
