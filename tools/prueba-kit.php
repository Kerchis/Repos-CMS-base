<?php
/**
 * Llevarse el diseno de un sitio a otro.
 *
 * Por que hace falta: copiar el JSON es lo facil. Lo dificil es que al
 * llegar al otro sitio los enlaces sigan llevando a alguna parte. Los
 * identificadores de pagina no coinciden entre dos instalaciones, asi
 * que un boton que apuntaba a la pagina 42 del origen apuntaria aqui a
 * cualquier cosa, y un menu con `pageId` tambien. Eso es justo lo que
 * nadie mira hasta que un cliente pulsa el boton.
 *
 * Lo que se comprueba, con un WordPress de mentira con memoria:
 *
 *   1. Exportar: el paquete trae lo que se le pide y nada mas —solo la
 *      paleta y el chrome, o tambien la biblioteca y las paginas— y se
 *      lleva la libreta de direcciones (que identificador tenia cada
 *      pagina y con que slug).
 *   2. Mirar un paquete antes de importarlo sin tocar nada.
 *   3. Importar en un sitio limpio: las paginas entran, los enlaces del
 *      origen se reconectan **por slug** a las de aqui, los menus
 *      apuntan al identificador nuevo y las instancias de componentes
 *      globales al global nuevo.
 *   4. Lo de fuera no se toca y lo que no existe aqui se deja como
 *      estaba y se cuenta en el informe. Jamas se apunta a la pagina
 *      equivocada.
 *   5. Los tres modos para una pagina que ya existe: crear otra,
 *      reemplazarla o saltarla.
 *   6. Elegir partes al importar, y que un archivo que no es un paquete
 *      se rechace.
 *
 *   .tools/php/php tools/prueba-kit.php
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

class FakeWpdbKit {
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
$GLOBALS['wpdb'] = new FakeWpdbKit();

require_once $base . '/core/content/RevisionRepository.php';
require_once $base . '/core/content/PageRepository.php';
require_once $base . '/core/content/GlobalsRepository.php';
require_once $base . '/core/content/DesignKit.php';

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

/* ------------------------------------------------------------------ */
/* Un paquete como el que saldria de otro sitio                         */

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
function pagina_pack( string $slug, string $titulo, array $dentro ): array {
	return [
		'version'  => 1,
		'title'    => $titulo,
		'slug'     => $slug,
		'status'   => 'publish',
		'seo'      => [ 'description' => 'Algo' ],
		'settings' => [],
		'sections' => [ seccion( 'sec-' . $slug, $dentro ) ],
	];
}

function paquete(): array {
	$instancia          = nodo( 'inst1', 'cta', [ 'title' => 'Global' ] );
	$instancia['source']   = 'global';
	$instancia['globalId'] = 9;

	return [
		'krg'          => 2,
		'exportedAt'   => '2026-10-01T10:00:00+00:00',
		'origen'       => [
			'home'   => 'https://origen.test/',
			'nombre' => 'Origen',
		],
		'tokens'       => [
			'tokens' => [
				'color' => [ 'primary' => '#3F5E58' ],
			],
		],
		'menus'        => [
			[
				'slug'  => 'header',
				'name'  => 'Principal',
				'items' => [
					[
						'id'     => 'm1',
						'label'  => 'Contacto',
						'type'   => 'internal',
						'pageId' => 42,
						'url'    => '',
					],
					[
						'id'     => 'm2',
						'label'  => 'Ya no existe',
						'type'   => 'internal',
						'pageId' => 99,
						'url'    => '',
					],
				],
			],
		],
		'header'       => [
			'ctaText' => 'Reservar',
			'ctaUrl'  => 'https://origen.test/contacto/',
		],
		'footer'       => [
			'sections' => [ seccion( 'pie', [ nodo( 'pb', 'button', [
				'text' => 'Escríbenos',
				'url'  => '/contacto',
			] ) ] ) ],
		],
		'globals'      => [
			[
				'id'       => 9,
				'name'     => 'Bloque de marca',
				'kind'     => 'node',
				'node'     => nodo( 'g1', 'cta', [
					'title' => 'Global',
					'url'   => 'https://origen.test/inicio/',
				] ),
				'sections' => [],
			],
		],
		'templates'    => [
			[
				'id'       => 5,
				'name'     => 'Cabecera de campaña',
				'kind'     => 'node',
				'node'     => nodo( 't1', 'heading', [
					'text' => 'Hola',
					'tag'  => 'h2',
				] ),
				'sections' => [],
			],
		],
		'pages'        => [
			pagina_pack(
				'inicio',
				'Inicio',
				[
					nodo( 'b-int', 'button', [
						'text' => 'Contacto',
						'url'  => 'https://origen.test/contacto/',
					] ),
					nodo( 'b-rel', 'button', [
						'text' => 'También',
						'url'  => '/contacto',
					] ),
					nodo( 'b-ext', 'button', [
						'text' => 'Fuera',
						'url'  => 'https://otra-web.com/cosas',
					] ),
					nodo( 'b-no', 'button', [
						'text' => 'Perdido',
						'url'  => 'https://origen.test/no-existe/',
					] ),
					nodo( 'img', 'image', [
						'imageId' => 501,
						'alt'     => 'Foto',
					] ),
					$instancia,
				]
			),
			pagina_pack( 'contacto', 'Contacto', [ nodo( 'h', 'heading', [
				'text' => 'Escríbenos',
				'tag'  => 'h1',
			] ) ] ),
		],
		'paginasPorId' => [
			41 => 'inicio',
			42 => 'contacto',
		],
	];
}

/** Busca un bloque por id dentro de un documento. */
function buscar( array $nodes, string $id ): ?array {
	foreach ( $nodes as $n ) {
		if ( ( $n['id'] ?? '' ) === $id ) {
			return $n;
		}
		$hit = buscar( (array) ( $n['children'] ?? [] ), $id );
		if ( $hit ) {
			return $hit;
		}
	}
	return null;
}
/** Como los identificadores se regeneran al importar, se busca por texto. */
function buscar_por_texto( array $nodes, string $texto ): ?array {
	foreach ( $nodes as $n ) {
		if ( ( $n['props']['text'] ?? '' ) === $texto ) {
			return $n;
		}
		$hit = buscar_por_texto( (array) ( $n['children'] ?? [] ), $texto );
		if ( $hit ) {
			return $hit;
		}
	}
	return null;
}
function doc_por_slug( string $slug ): ?array {
	foreach ( \Meridian\Content\PageRepository::list() as $p ) {
		if ( $p['slug'] === $slug ) {
			return \Meridian\Content\PageRepository::get( (int) $p['id'], 'draft' );
		}
	}
	return null;
}

/* ================================================================== */
echo "PRUEBA 1 — mirar el paquete antes de tocarlo\n";

$pack = paquete();
$ver  = \Meridian\Content\DesignKit::inspect( $pack );
ok( 'https://origen.test/' === $ver['origen'], 'dice de qué sitio salió' );
ok( 2 === $ver['paginas'] && 1 === $ver['plantillas'] && 1 === $ver['globales'], 'y cuántas páginas, plantillas y globales trae' );
ok( true === $ver['tokens'] && true === $ver['chrome'], 'y que trae la paleta y el chrome' );
ok( in_array( 'Inicio', $ver['titulos'], true ), 'con los títulos de las páginas, para reconocerlo' );
ok( $ver['imagenes'] >= 1, "y cuenta las fotos que menciona ({$ver['imagenes']})" );
ok( 0 === count( \Meridian\Content\PageRepository::list() ), 'mirar no ha creado nada' );

echo "\nPRUEBA 2 — importar en un sitio limpio\n";

$inf = \Meridian\Content\DesignKit::import( $pack, [] );
ok( 2 === $inf['paginas']['creadas'], "entran las dos páginas ({$inf['paginas']['creadas']})" );
ok( 0 === $inf['paginas']['fallidas'], 'y ninguna se cae por el camino' );
ok( 'puestos' === $inf['tokens'], 'la paleta se pone' );
ok( 1 === $inf['globales']['creados'] && 1 === $inf['plantillas']['creadas'], 'y la biblioteca también' );

$inicio = doc_por_slug( 'inicio' );
ok( null !== $inicio, 'la página «inicio» está aquí' );

$b_int = buscar_por_texto( $inicio['sections'], 'Contacto' );
ok( 'https://destino.test/contacto/' === ( $b_int['props']['url'] ?? '' ),
	"el enlace absoluto al origen se reconecta a la página de aquí ({$b_int['props']['url']})" );

$b_rel = buscar_por_texto( $inicio['sections'], 'También' );
ok( 'https://destino.test/contacto/' === ( $b_rel['props']['url'] ?? '' ),
	'y el enlace relativo, también' );

$b_ext = buscar_por_texto( $inicio['sections'], 'Fuera' );
ok( 'https://otra-web.com/cosas' === ( $b_ext['props']['url'] ?? '' ),
	'un enlace a otra web no se toca' );

$b_no = buscar_por_texto( $inicio['sections'], 'Perdido' );
ok( 'https://origen.test/no-existe/' === ( $b_no['props']['url'] ?? '' ),
	'y uno a una página que aquí no existe se deja como estaba' );
ok( in_array( 'https://origen.test/no-existe/', $inf['enlaces']['sin destino'], true ),
	'pero el informe lo dice, en vez de callárselo' );
ok( $inf['enlaces']['reconectados'] >= 3, "cuenta los que sí ha reconectado ({$inf['enlaces']['reconectados']})" );

$menus = \Meridian\Navigation\Menus::all();
$items = $menus[0]['items'];
$local_contacto = doc_por_slug( 'contacto' )['id'];
ok( (int) $items[0]['pageId'] === (int) $local_contacto,
	"el menú apunta al identificador de aquí ({$items[0]['pageId']} = $local_contacto)" );
ok( 0 === (int) $items[1]['pageId'],
	'y el que apuntaba a una página que no existe se queda sin destino, no apuntando a otra' );

$cab = \Meridian\Navigation\Menus::header();
ok( 'https://destino.test/contacto/' === $cab['ctaUrl'], 'el botón de la cabecera también se reconecta' );
$pie   = \Meridian\Navigation\Menus::footer();
$pie_b = buscar_por_texto( $pie['sections'], 'Escríbenos' );
ok( 'https://destino.test/contacto/' === ( $pie_b['props']['url'] ?? '' ), 'y el del pie' );

$globales = \Meridian\Content\GlobalsRepository::list( 'meridian_global' );
$gid      = (int) $globales[0]['id'];
$inst     = null;
$busca    = function ( array $nodes ) use ( &$busca, &$inst ) {
	foreach ( $nodes as $n ) {
		if ( 'global' === ( $n['source'] ?? '' ) ) {
			$inst = $n;
		}
		$busca( (array) ( $n['children'] ?? [] ) );
	}
};
$busca( $inicio['sections'] );
ok( $inst && (int) $inst['globalId'] === $gid,
	'la instancia del componente global apunta al global de aquí, no al 9 del origen' );

ok( ! empty( $inf['avisos'] ), 'y el informe avisa de lo que el paquete no puede traer: ' . ( $inf['avisos'][0] ?? '' ) );

echo "\nPRUEBA 3 — qué hacer con una página que ya existe\n";

$antes = count( \Meridian\Content\PageRepository::list() );
$inf2  = \Meridian\Content\DesignKit::import( $pack, [ 'modo' => 'saltar' ] );
ok( 2 === $inf2['paginas']['saltadas'] && 0 === $inf2['paginas']['creadas'], 'con «saltar» no se repite ninguna' );
ok( count( \Meridian\Content\PageRepository::list() ) === $antes, 'y no aparece ninguna página nueva' );

$id_antes = doc_por_slug( 'contacto' )['id'];
$pack2    = paquete();
$pack2['pages'][1]['sections'] = [ seccion( 'nueva', [ nodo( 'h2', 'heading', [
	'text' => 'Texto reemplazado',
	'tag'  => 'h1',
] ) ] ) ];
$inf3     = \Meridian\Content\DesignKit::import( $pack2, [ 'modo' => 'reemplazar' ] );
ok( 2 === $inf3['paginas']['reemplazadas'], 'con «reemplazar» se sobreescriben las dos' );
$contacto = doc_por_slug( 'contacto' );
ok( (int) $contacto['id'] === (int) $id_antes, 'la página mantiene su identificador: los enlaces de fuera siguen valiendo' );
ok( null !== buscar_por_texto( $contacto['sections'], 'Texto reemplazado' ), 'y su contenido es el del paquete' );
ok( count( \Meridian\Content\PageRepository::list() ) === $antes, 'sin crear copias por el camino' );

$inf4 = \Meridian\Content\DesignKit::import( $pack, [ 'modo' => 'crear' ] );
ok( 2 === $inf4['paginas']['creadas'], 'y con «crear» entran como páginas nuevas' );
ok( count( \Meridian\Content\PageRepository::list() ) === $antes + 2, 'que son dos más' );

echo "\nPRUEBA 4 — elegir qué parte entra\n";

$GLOBALS['krg_opt']['meridian_tokens'] = [ 'tokens' => [ 'color' => [ 'primary' => '#111111' ] ] ];
$inf5 = \Meridian\Content\DesignKit::import(
	$pack,
	[
		'tokens'     => false,
		'chrome'     => false,
		'biblioteca' => false,
		'paginas'    => true,
		'modo'       => 'saltar',
	]
);
ok( 'omitido' === $inf5['tokens'], 'si se dice que no, la paleta no se toca' );
ok( '#111111' === $GLOBALS['krg_opt']['meridian_tokens']['tokens']['color']['primary'], 'y sigue siendo la de aquí' );
ok( 'omitido' === $inf5['chrome'], 'la cabecera y el pie tampoco' );
ok( 0 === $inf5['globales']['creados'] + $inf5['globales']['actualizados'], 'ni la biblioteca' );

echo "\nPRUEBA 4b — un paquete que sólo trae media paleta\n";

/* El medidor de estilo —«inspirarse en otra web o en una foto»— manda
   un paquete con los colores y nada más. Como `TokenRepository::save()`
   reemplaza el grupo entero, si el importador no fusionara token a
   token, ese paquete dejaría al tema sin tipografías ni medidas. */
$GLOBALS['krg_opt']['meridian_tokens'] = [
	'tokens' => [
		'color'   => [ 'primary' => '#111111', 'muted' => '#777777', 'error' => '#AA0000' ],
		'font'    => [ 'body' => [ 'value' => '"Inter", sans-serif' ] ],
		'spacing' => [ 'section' => [ 'value' => '96px' ] ],
	],
];
$medida = [
	'krg'    => 2,
	'origen' => [ 'home' => 'https://referencia.test/' ],
	'tokens' => [
		'tokens' => [
			'color' => [
				'primary'    => [ 'value' => '#3F5E58' ],
				'background' => [ 'value' => '#FEF6E7' ],
			],
		],
	],
];
$inf_med = \Meridian\Content\DesignKit::import(
	$medida,
	[
		'tokens'     => true,
		'chrome'     => false,
		'biblioteca' => false,
		'paginas'    => false,
	]
);
$tras = $GLOBALS['krg_opt']['meridian_tokens']['tokens'];
ok( 'puestos' === $inf_med['tokens'], 'la paleta medida entra' );
ok( '#3F5E58' === ( $tras['color']['primary']['value'] ?? $tras['color']['primary'] ), 'y pisa lo que trae' );
ok( '#FEF6E7' === ( $tras['color']['background']['value'] ?? '' ), 'incluido lo que aquí no existía' );
ok( '#777777' === ( $tras['color']['muted'] ?? '' ) && '#AA0000' === ( $tras['color']['error'] ?? '' ),
	'sin llevarse por delante los colores que no venían en el paquete' );
ok( '"Inter", sans-serif' === ( $tras['font']['body']['value'] ?? '' ), 'ni las tipografías de aquí' );
ok( '96px' === ( $tras['spacing']['section']['value'] ?? '' ), 'ni las medidas' );
ok( 0 === $inf_med['paginas']['creadas'] + $inf_med['paginas']['reemplazadas'], 'y no se toca ninguna página' );

echo "\nPRUEBA 5 — exportar eligiendo partes\n";

$solo_marca = \Meridian\Content\DesignKit::export(
	[
		'tokens'     => true,
		'chrome'     => true,
		'biblioteca' => false,
		'paginas'    => false,
	]
);
ok( isset( $solo_marca['tokens'] ) && isset( $solo_marca['header'] ), 'el paquete de marca trae paleta y chrome' );
ok( ! isset( $solo_marca['pages'] ) && ! isset( $solo_marca['templates'] ),
	'y ni páginas ni biblioteca: eso es lo que se pidió' );

$todo = \Meridian\Content\DesignKit::export();
ok( isset( $todo['pages'] ) && count( $todo['pages'] ) >= 2, 'el paquete entero sí trae las páginas' );
ok( ! empty( $todo['paginasPorId'] ), 'con la libreta de direcciones para poder reconectar luego' );
ok( 'https://destino.test/' === ( $todo['origen']['home'] ?? '' ), 'y de dónde ha salido' );

$una   = \Meridian\Content\PageRepository::list()[0];
$suelta = \Meridian\Content\DesignKit::export( [ 'pageIds' => [ (int) $una['id'] ] ] );
ok( 1 === count( $suelta['pages'] ), 'se puede exportar una sola página' );

echo "\nPRUEBA 6 — un archivo que no es un paquete\n";

$casco = false;
try {
	\Meridian\Content\DesignKit::import( [ 'cualquier' => 'cosa' ], [] );
} catch ( \Throwable $e ) {
	$casco = true;
}
ok( $casco, 'se rechaza con su error, no se intenta adivinar' );

echo "\n$hechas comprobaciones, $fallos " . ( 1 === $fallos ? 'fallo' : 'fallos' ) . "\n";
echo $fallos ? "HAY FALLOS\n" : "EXPORTAR E IMPORTAR EL DISEÑO VA ($hechas comprobaciones)\n";
exit( $fallos ? 1 : 0 );
