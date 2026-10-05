<?php
/**
 * Duplicar una pagina y guardar plantillas, por el lado del servidor.
 *
 * Por que hace falta: las dos cosas escriben en la base de datos y
 * ninguna tenia prueba. «Duplicar» perdia la pagina padre por el
 * camino —la copia de una subpagina aparecia en la raiz— y las
 * plantillas solo sabian guardar un bloque suelto, asi que una pagina
 * entera no cabia en ellas.
 *
 * Lo que se comprueba:
 *
 *   1. Que la copia es una copia: mismo contenido, mismos textos, mismo
 *      SEO y los mismos ajustes, pero con identificadores nuevos en
 *      todos los bloques. Si se repitieran, el CSS de un bloque pintaria
 *      en las dos paginas.
 *   2. Que la copia conserva la pagina padre y nace como borrador, y que
 *      la original no se toca.
 *   3. Que una plantilla puede ser una pagina entera: se guarda con sus
 *      secciones, se lee con ellas y dice de que clase es.
 *   4. Que una plantilla de seccion sigue funcionando igual que siempre
 *      y no se contamina con el campo nuevo.
 *   5. Que una plantilla de pagina no se inventa un bloque suelto: ese
 *      campo llega vacio, no con un parrafo fantasma dentro.
 *
 *   .tools/php/php tools/prueba-plantillas.php
 */

define( 'ABSPATH', __DIR__ . '/' );

/* ------------------------------------------------------------------ */
/* Un WordPress de mentira con memoria: entradas y sus metadatos        */

$GLOBALS['krg_posts']    = [];
$GLOBALS['krg_meta']     = [];
$GLOBALS['krg_sig_post'] = 100;

function krg_post_obj( array $fila ): WP_Post {
	return new WP_Post( $fila );
}

function wp_insert_post( $args = [], $wp_error = false ) {
	$id  = ++$GLOBALS['krg_sig_post'];
	$row = [
		'ID'            => $id,
		'post_type'     => $args['post_type'] ?? 'post',
		'post_status'   => $args['post_status'] ?? 'draft',
		'post_title'    => $args['post_title'] ?? '',
		'post_name'     => $args['post_name'] ?? sanitize_title( $args['post_title'] ?? '' ),
		'post_parent'   => (int) ( $args['post_parent'] ?? 0 ),
		'post_content'  => $args['post_content'] ?? '',
		'post_password' => '',
		'post_modified' => '2026-10-05 12:00:00',
		'post_date'     => '2026-10-05 12:00:00',
	];
	$GLOBALS['krg_posts'][ $id ] = $row;
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
	return isset( $GLOBALS['krg_posts'][ $id ] ) ? krg_post_obj( $GLOBALS['krg_posts'][ $id ] ) : null;
}

function get_post_field( $campo, $id ) {
	$id = (int) $id;
	return $GLOBALS['krg_posts'][ $id ][ $campo ] ?? '';
}

function get_posts( $args = [] ) {
	$tipo = $args['post_type'] ?? 'post';
	$out  = [];
	foreach ( $GLOBALS['krg_posts'] as $row ) {
		if ( $row['post_type'] === $tipo ) {
			$out[] = krg_post_obj( $row );
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
	return true;
}

function delete_post_meta( $id, $clave, $valor = '' ) {
	unset( $GLOBALS['krg_meta'][ (int) $id ][ $clave ] );
	return true;
}

function wp_delete_post( $id, $forzar = false ) {
	unset( $GLOBALS['krg_posts'][ (int) $id ], $GLOBALS['krg_meta'][ (int) $id ] );
	return true;
}

function clean_post_cache( $id ) {}
function update_meta_cache( $tipo, $ids ) {
	return true; }
function wp_list_pluck( $lista, $campo ) {
	return array_map( fn( $x ) => is_object( $x ) ? $x->$campo : $x[ $campo ], $lista ); }
function current_user_can( $cap ) {
	return true; }
function get_current_user_id() {
	return 7; }
function get_user_by( $campo, $valor ) {
	return (object) [ 'display_name' => 'Ana' ]; }
function current_time( $tipo = 'mysql' ) {
	return gmdate( 'Y-m-d H:i:s', time() ); }
function is_wp_error( $x ) {
	return false; }

require __DIR__ . '/wp-shim.php';
require_once dirname( __DIR__ ) . '/krg-cms/core/constants.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/components/Catalog.php';
require_once $base . '/core/components/BrandCatalog.php';
require_once $base . '/core/components/Registry.php';
require_once $base . '/core/security/Sanitizer.php';
require_once $base . '/core/style/BoxStyles.php';
require_once $base . '/core/security/UrlValidator.php';
require_once $base . '/core/design/TokenCompiler.php';
require_once $base . '/core/content/Document.php';
require_once $base . '/core/log/Logger.php';

\Meridian\Components\Registry::boot();

/* Un `$wpdb` de mentira: el repositorio de versiones escribe al crear. */
class FakeWpdbPlantillas {
	public $prefix = 'wp_';
	public $filas  = [];
	private $sig   = 1;

	public function prepare( $sql, ...$args ) {
		foreach ( $args as $a ) {
			$sql = preg_replace( '/%[ds]/', is_int( $a ) ? (string) $a : "'" . $a . "'", $sql, 1 );
		}
		return $sql;
	}
	public function get_row( $sql ) {
		return null; }
	public function get_results( $sql ) {
		return []; }
	public function get_col( $sql ) {
		return []; }
	public function get_var( $sql ) {
		return 0; }
	public function query( $sql ) {
		return 0; }
	public function insert( $t, $d ) {
		$d['id']       = $this->sig++;
		$this->filas[] = $d;
		return 1; }
	public function update( $t, $d, $w ) {
		return 1; }
	public function delete( $t, $w ) {
		return 1; }
}
$GLOBALS['wpdb'] = new FakeWpdbPlantillas();

require_once $base . '/core/content/RevisionRepository.php';
require_once $base . '/core/content/PageRepository.php';
require_once $base . '/core/content/GlobalsRepository.php';

/* ------------------------------------------------------------------ */

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

/** Todos los identificadores de un arbol de bloques, en una lista. */
function ids_de( array $nodos ): array {
	$out = [];
	foreach ( $nodos as $n ) {
		$out[] = $n['id'] ?? '';
		if ( ! empty( $n['children'] ) ) {
			$out = array_merge( $out, ids_de( $n['children'] ) );
		}
	}
	return $out;
}

function seccion_de_prueba( string $texto ): array {
	return [
		'id'       => 'n_sec_1',
		'type'     => 'section',
		'name'     => 'Sección de prueba',
		'visible'  => true,
		'props'    => [ 'width' => 'padded' ],
		'styles'   => [
			'desktop' => [ 'padding-top' => '48px' ],
			'tablet'  => [],
			'mobile'  => [],
		],
		'children' => [
			[
				'id'       => 'n_row_1',
				'type'     => 'row',
				'name'     => 'Fila',
				'visible'  => true,
				'props'    => [ 'layout' => '12' ],
				'styles'   => [],
				'children' => [
					[
						'id'       => 'n_col_1',
						'type'     => 'column',
						'name'     => 'Columna',
						'visible'  => true,
						'props'    => [ 'span' => 12 ],
						'styles'   => [],
						'children' => [
							[
								'id'       => 'n_h_1',
								'type'     => 'heading',
								'name'     => 'Título',
								'visible'  => true,
								'props'    => [
									'text' => $texto,
									'tag'  => 'h2',
								],
								'styles'   => [],
								'children' => [],
							],
						],
					],
				],
			],
		],
	];
}

echo "PRUEBA 1 — duplicar una página\n";

$madre = \Meridian\Content\PageRepository::create(
	[
		'title' => 'Servicios',
		'slug'  => 'servicios',
	]
);
$hija  = \Meridian\Content\PageRepository::create(
	[
		'title'    => 'Fontanería',
		'slug'     => 'fontaneria',
		'parentId' => $madre['id'],
		'document' => array_merge(
			\Meridian\Content\Document::empty( 0, 'Fontanería', 'fontaneria' ),
			[
				'sections' => [ seccion_de_prueba( 'Arreglamos lo que gotea' ) ],
				'seo'      => [
					'title'       => 'Fontanería en el barrio',
					'description' => 'Urgencias y reformas.',
					'robots'      => 'index,follow',
				],
				'settings' => [
					'showHeader' => true,
					'showFooter' => false,
					'layout'     => 'default',
				],
			]
		),
	]
);

ok( (int) $hija['parentId'] === (int) $madre['id'], 'la página de partida cuelga de su madre' );

$copia = \Meridian\Content\PageRepository::duplicate( (int) $hija['id'] );

ok( (int) $copia['id'] !== (int) $hija['id'], 'la copia es otra página, no la misma' );
ok( 'Fontanería (copia)' === $copia['title'], "la copia se llama «{$copia['title']}»" );
ok( (int) $copia['parentId'] === (int) $madre['id'], 'la copia conserva la página padre' );
ok( 'draft' === ( $copia['status'] ?? '' ), 'la copia nace como borrador, no publicada' );
ok( $copia['slug'] !== $hija['slug'] && '' !== $copia['slug'], "la copia tiene su propio slug («{$copia['slug']}»)" );

$ids_orig  = ids_de( $hija['sections'] );
$ids_copia = ids_de( $copia['sections'] );
ok( count( $ids_copia ) === count( $ids_orig ) && count( $ids_orig ) === 4, 'la copia trae los mismos cuatro bloques' );
ok( ! array_intersect( $ids_orig, $ids_copia ), 'ningún bloque repite identificador: el CSS de uno no pinta en la otra' );
ok( ! array_filter( $ids_copia, fn( $x ) => '' === $x ), 'todos los bloques de la copia tienen identificador' );

$titulo_copia = $copia['sections'][0]['children'][0]['children'][0]['children'][0]['props']['text'] ?? '';
ok( 'Arreglamos lo que gotea' === $titulo_copia, 'los textos llegan enteros a la copia' );
ok(
	( $copia['sections'][0]['styles']['desktop']['padding-top'] ?? '' ) === '48px',
	'los estilos de caja llegan a la copia'
);
ok( ( $copia['seo']['description'] ?? '' ) === 'Urgencias y reformas.', 'el SEO viaja con la copia' );
ok( false === ( $copia['settings']['showFooter'] ?? true ), 'los ajustes de la página viajan con la copia' );

$otra_vez = \Meridian\Content\PageRepository::get( (int) $hija['id'] );
ok(
	( $otra_vez['sections'][0]['children'][0]['children'][0]['children'][0]['props']['text'] ?? '' ) === 'Arreglamos lo que gotea'
	&& ids_de( $otra_vez['sections'] ) === $ids_orig,
	'la página original se queda exactamente como estaba'
);

echo "\nPRUEBA 2 — una plantilla puede ser una página entera\n";

$sections = [ seccion_de_prueba( 'Primera' ), seccion_de_prueba( 'Segunda' ) ];
$tpl      = \Meridian\Content\GlobalsRepository::save(
	'meridian_template',
	[
		'name'     => 'Página de servicios',
		'sections' => $sections,
	]
);

ok( 'page' === ( $tpl['kind'] ?? '' ), 'la plantilla sabe que es una página entera' );
ok( count( $tpl['sections'] ?? [] ) === 2, 'guarda sus dos secciones' );
// Ojo: `?? ` no sirve para distinguir un nulo de un campo que no está.
ok( array_key_exists( 'node', $tpl ) && null === $tpl['node'], 'y no se inventa un bloque suelto que nadie podría insertar' );
ok(
	'section' === ( $tpl['sections'][0]['type'] ?? '' )
	&& 'heading' === ( $tpl['sections'][0]['children'][0]['children'][0]['children'][0]['type'] ?? '' ),
	'las secciones llegan enteras, con sus hijos'
);
ok(
	'Segunda' === ( $tpl['sections'][1]['children'][0]['children'][0]['children'][0]['props']['text'] ?? '' ),
	'y en el mismo orden en el que se guardaron'
);

$leida = \Meridian\Content\GlobalsRepository::get( (int) $tpl['id'] );
ok( count( $leida['sections'] ?? [] ) === 2, 'al volver a leerla siguen estando las dos secciones' );

$lista = \Meridian\Content\GlobalsRepository::list( 'meridian_template' );
$en_la_lista = null;
foreach ( $lista as $x ) {
	if ( (int) $x['id'] === (int) $tpl['id'] ) {
		$en_la_lista = $x;
	}
}
ok( $en_la_lista && count( $en_la_lista['sections'] ) === 2, 'la lista la devuelve con sus secciones: el constructor puede ponerla sin pedir nada más' );

echo "\nPRUEBA 3 — la plantilla de una sección sigue siendo lo que era\n";

$suelta = \Meridian\Content\GlobalsRepository::save(
	'meridian_template',
	[
		'name' => 'Cabecera de campaña',
		'node' => seccion_de_prueba( 'Sólo una sección' ),
	]
);
ok( 'node' === ( $suelta['kind'] ?? '' ), 'sigue siendo una plantilla de bloque' );
ok( 'section' === ( $suelta['node']['type'] ?? '' ), 'con su bloque dentro' );
ok( [] === ( $suelta['sections'] ?? null ), 'y sin secciones de más' );

/* Y el saneador sigue mandando: lo que no existe no se guarda. */
$sucia = \Meridian\Content\GlobalsRepository::save(
	'meridian_template',
	[
		'name'     => 'Con basura',
		'sections' => [
			array_merge(
				seccion_de_prueba( 'Buena' ),
				[ 'props' => [ 'width' => 'padded<script>alert(1)</script>' ] ]
			),
		],
	]
);
$ancho = $sucia['sections'][0]['props']['width'] ?? '';
ok( false === strpos( $ancho, '<script' ), "el saneador limpia lo que entra (ancho: {$ancho})" );

echo "\n$hechas comprobaciones, $fallos " . ( 1 === $fallos ? 'fallo' : 'fallos' ) . "\n";
echo $fallos ? "HAY FALLOS\n" : "DUPLICAR Y GUARDAR PLANTILLAS VA ($hechas comprobaciones)\n";
exit( $fallos ? 1 : 0 );
