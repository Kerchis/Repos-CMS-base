<?php
/**
 * La revision de antes de publicar.
 *
 * Por que hace falta: avisa, no bloquea, y eso significa que nadie se
 * va a enterar si un dia deja de avisar. Un revisor silencioso es peor
 * que ninguno, porque da por buena una pagina que no ha mirado.
 *
 * Lo que se comprueba, documento a documento:
 *
 *   1. Titulares: ninguno de primer nivel avisa, dos avisan, uno solo
 *      no dice nada.
 *   2. Fotos sin texto alternativo: el del bloque vale, y si el bloque
 *      no tiene ese campo, vale el de la Biblioteca de WordPress, que
 *      es de donde lo saca el tema al pintar.
 *   3. Fotos que pesan de mas, con el peso de verdad del adjunto.
 *   4. Contraste: el color escrito en el inspector se compara con el
 *      color de texto de la paleta, resolviendo tokens, y por debajo
 *      de 4.5:1 avisa.
 *   5. Secciones vacias —que en la web ocupan cero— y botones que no
 *      llevan a ninguna parte.
 *   6. SEO: sin descripcion, descripcion larga, `noindex`, sin foto
 *      para compartir y la direccion sin tocar.
 *   7. Y que una pagina bien hecha sale limpia: ni un aviso.
 *
 *   .tools/php/php tools/prueba-revision.php
 */

define( 'ABSPATH', __DIR__ . '/' );

/* Un WordPress de mentira: adjuntos con su texto alternativo y su peso. */
$GLOBALS['krg_alt']  = [];
$GLOBALS['krg_peso'] = [];

function get_post_meta( $id, $clave = '', $uno = false ) {
	if ( '_wp_attachment_image_alt' === $clave ) {
		return $GLOBALS['krg_alt'][ (int) $id ] ?? '';
	}
	return $uno ? '' : [];
}
function wp_get_attachment_metadata( $id, $raw = false ) {
	$peso = $GLOBALS['krg_peso'][ (int) $id ] ?? 0;
	return $peso ? [ 'filesize' => $peso ] : [];
}
function get_attached_file( $id, $unfiltered = false ) {
	return ''; }
function size_format( $bytes, $dec = 0 ) {
	return round( $bytes / 1024 ) . ' KB'; }
function number_format_i18n( $n, $dec = 0 ) {
	return number_format( (float) $n, (int) $dec, ',', '.' ); }

require __DIR__ . '/wp-shim.php';
require_once dirname( __DIR__ ) . '/krg-cms/core/constants.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/components/Catalog.php';
require_once $base . '/core/components/BrandCatalog.php';
require_once $base . '/core/components/Registry.php';
require_once $base . '/core/security/Sanitizer.php';
require_once $base . '/core/style/BoxStyles.php';
require_once $base . '/core/security/UrlValidator.php';
require_once $base . '/core/design/TokenDefaults.php';
require_once $base . '/core/design/TokenRepository.php';
require_once $base . '/core/design/Contrast.php';
require_once $base . '/core/design/TokenCompiler.php';
require_once $base . '/core/content/Document.php';
require_once $base . '/core/content/PageReview.php';

\Meridian\Components\Registry::boot();

/* La paleta de la marca, como la que trae el tema. */
$GLOBALS['krg_options']['meridian_tokens'] = [
	'tokens' => [
		'color' => [
			'text'       => '#000000',
			'background' => '#FEF6E7',
			'primary'    => '#3F5E58',
			'surface'    => '#F7EAD1',
		],
	],
];

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

function nodo( string $id, string $type, array $props = [], array $children = [], array $styles = [] ): array {
	return [
		'id'       => $id,
		'type'     => $type,
		'name'     => '',
		'visible'  => true,
		'source'   => 'local',
		'props'    => $props,
		'styles'   => $styles,
		'children' => $children,
	];
}

function seccion( string $id, array $dentro, array $styles = [] ): array {
	return nodo(
		$id,
		'section',
		[ 'width' => 'padded' ],
		[ nodo( $id . '-row', 'row', [ 'layout' => '12' ], [ nodo( $id . '-col', 'column', [ 'span' => 12 ], $dentro ) ] ) ],
		$styles
	);
}

function documento( array $sections, array $seo = [], string $slug = 'nuestra-miel' ): array {
	return [
		'id'       => 1,
		'title'    => 'Página',
		'slug'     => $slug,
		'status'   => 'draft',
		'seo'      => array_merge(
			[
				'title'       => 'Miel de azahar del valle',
				'description' => 'Miel cruda de azahar recogida en primavera, filtrada en frío y envasada en el día.',
				'robots'      => 'index,follow',
				'ogImageId'   => 12,
			],
			$seo
		),
		'settings' => [],
		'sections' => $sections,
	];
}

/** Los códigos de los hallazgos, para poder buscarlos. */
function codigos( array $r ): array {
	return array_map( fn( $x ) => $x['code'], $r['items'] );
}
function de_codigo( array $r, string $code ): array {
	return array_values( array_filter( $r['items'], fn( $x ) => $x['code'] === $code ) );
}

echo "PRUEBA 1 — una página bien hecha no molesta\n";

$GLOBALS['krg_alt'][77] = 'Un tarro de miel sobre la mesa';

$buena = documento(
	[
		seccion(
			'sec1',
			[
				nodo( 'h1', 'heading', [
					'text' => 'Miel de azahar',
					'tag'  => 'h1',
				] ),
				nodo( 'img1', 'image', [
					'imageId' => 77,
					'alt'     => 'Un tarro de miel sobre la mesa',
				] ),
				nodo( 'b1', 'button', [
					'text' => 'Comprar',
					'url'  => '/tienda',
				] ),
			]
		),
	]
);
$r = \Meridian\Content\PageReview::run( $buena );
ok( 0 === count( $r['items'] ), 'ni un aviso ni una pista: ' . ( $r['items'] ? $r['items'][0]['title'] : 'limpia' ) );
ok( 0 === $r['counts']['aviso'] && 0 === $r['counts']['pista'], 'y el recuento también viene a cero' );

echo "\nPRUEBA 2 — titulares de primer nivel\n";

$sin_h1 = documento( [ seccion( 'sec1', [ nodo( 'h2', 'heading', [
	'text' => 'Algo',
	'tag'  => 'h2',
] ) ] ) ] );
$r      = \Meridian\Content\PageReview::run( $sin_h1 );
ok( in_array( 'h1', codigos( $r ), true ), 'sin ningún H1 avisa' );
ok( 'aviso' === de_codigo( $r, 'h1' )[0]['level'], 'y lo marca como aviso, no como pista' );

$dos_h1 = documento(
	[
		seccion( 'sec1', [ nodo( 'ha', 'heading', [
			'text' => 'Uno',
			'tag'  => 'h1',
		] ) ] ),
		seccion( 'sec2', [ nodo( 'hb', 'heading', [
			'text' => 'Dos',
			'tag'  => 'h1',
		] ) ] ),
	]
);
$r      = \Meridian\Content\PageReview::run( $dos_h1 );
$h1     = de_codigo( $r, 'h1' );
ok( 1 === count( $h1 ), 'con dos H1 avisa una vez, por el segundo' );
ok( 'hb' === $h1[0]['nodeId'], 'y señala al segundo, que es el que sobra' );

$oculto = documento(
	[
		seccion( 'sec1', [ nodo( 'ha', 'heading', [
			'text' => 'Uno',
			'tag'  => 'h1',
		] ) ] ),
		array_merge(
			seccion( 'sec2', [ nodo( 'hb', 'heading', [
				'text' => 'Dos',
				'tag'  => 'h1',
			] ) ] ),
			[ 'visible' => false ]
		),
	]
);
$r      = \Meridian\Content\PageReview::run( $oculto );
ok( ! in_array( 'h1', codigos( $r ), true ), 'un H1 dentro de una sección oculta no cuenta: no se pinta' );

echo "\nPRUEBA 3 — fotos sin texto alternativo\n";

$GLOBALS['krg_alt'][88] = '';
$sin_alt                = documento(
	[
		seccion(
			'sec1',
			[
				nodo( 'h1', 'heading', [
					'text' => 'T',
					'tag'  => 'h1',
				] ),
				nodo( 'img2', 'image', [
					'imageId' => 88,
					'alt'     => '',
				] ),
			]
		),
	]
);
$r                      = \Meridian\Content\PageReview::run( $sin_alt );
ok( 1 === count( de_codigo( $r, 'alt' ) ), 'una foto sin texto alternativo avisa' );
ok( 'img2' === de_codigo( $r, 'alt' )[0]['nodeId'], 'y señala al bloque de la foto' );

$GLOBALS['krg_alt'][88] = 'Puesto en la Biblioteca';
$r                      = \Meridian\Content\PageReview::run( $sin_alt );
ok( 0 === count( de_codigo( $r, 'alt' ) ),
	'si el texto está en la Biblioteca de WordPress ya no avisa: es de donde lo saca el tema' );

/* Un módulo con fotos dentro de un repetidor: la galería del carril. */
$GLOBALS['krg_alt'][91] = '';
$con_repe               = documento(
	[
		seccion(
			'sec1',
			[
				nodo( 'h1', 'heading', [
					'text' => 'T',
					'tag'  => 'h1',
				] ),
				nodo( 'rail', 'product-rail', [
					'items' => [
						[
							'imageId' => 91,
							'title'   => 'Tarro',
						],
					],
				] ),
			]
		),
	]
);
$r                      = \Meridian\Content\PageReview::run( $con_repe );
ok( 1 === count( de_codigo( $r, 'alt' ) ), 'también mira las fotos de dentro de las listas repetidas' );

echo "\nPRUEBA 4 — fotos que pesan de más\n";

$GLOBALS['krg_alt'][88]  = 'Con texto';
$GLOBALS['krg_peso'][88] = 1200000;
$r                       = \Meridian\Content\PageReview::run( $sin_alt );
$peso                    = de_codigo( $r, 'peso' );
ok( 1 === count( $peso ) && 'aviso' === $peso[0]['level'], 'una foto de más de medio mega avisa' );
ok( false !== strpos( $peso[0]['title'], 'KB' ), "y dice cuánto pesa: «{$peso[0]['title']}»" );

$GLOBALS['krg_peso'][88] = 350000;
$r                       = \Meridian\Content\PageReview::run( $sin_alt );
ok( 'pista' === de_codigo( $r, 'peso' )[0]['level'], 'una de 350 KB es sólo una pista' );

$GLOBALS['krg_peso'][88] = 90000;
$r                       = \Meridian\Content\PageReview::run( $sin_alt );
ok( 0 === count( de_codigo( $r, 'peso' ) ), 'y una ligera no dice nada' );

echo "\nPRUEBA 5 — contraste\n";

ok( round( \Meridian\Design\Contrast::ratio( '#000000', '#ffffff' ), 1 ) === 21.0,
	'blanco sobre negro da 21:1, que es el máximo' );
ok( 0.0 === \Meridian\Design\Contrast::ratio( 'no-es-un-color', '#fff' ),
	'y lo que no es un color devuelve cero, no un uno que parezca medido' );
ok( '#3F5E58' === \Meridian\Design\Contrast::resolve_hex( 'var(--color-primary)' ),
	'un color escrito como token se resuelve contra la paleta' );

$malo = documento(
	[
		seccion(
			'sec1',
			[ nodo( 'h1', 'heading', [
				'text' => 'T',
				'tag'  => 'h1',
			] ) ],
			[ 'desktop' => [ 'background-color' => '#3F5E58' ] ]
		),
	]
);
$r    = \Meridian\Content\PageReview::run( $malo );
$con  = de_codigo( $r, 'contraste' );
ok( 1 === count( $con ), 'texto negro sobre el verde de la marca avisa' );
ok( 'sec1' === $con[0]['nodeId'], 'y señala a la sección que lleva ese fondo' );

$bien = documento(
	[
		seccion(
			'sec1',
			[ nodo( 'h1', 'heading', [
				'text' => 'T',
				'tag'  => 'h1',
			] ) ],
			[ 'desktop' => [ 'background-color' => 'var(--color-background)' ] ]
		),
	]
);
$r    = \Meridian\Content\PageReview::run( $bien );
ok( 0 === count( de_codigo( $r, 'contraste' ) ), 'y sobre el crema de la marca no dice nada' );

echo "\nPRUEBA 6 — lo que no se verá y lo que no lleva a ninguna parte\n";

$vacia = documento(
	[
		seccion( 'sec1', [ nodo( 'h1', 'heading', [
			'text' => 'T',
			'tag'  => 'h1',
		] ) ] ),
		seccion( 'sec2', [] ),
	]
);
$r     = \Meridian\Content\PageReview::run( $vacia );
ok( 1 === count( de_codigo( $r, 'vacia' ) ), 'una sección vacía avisa de que en la web ocupa cero' );
ok( 'sec2' === de_codigo( $r, 'vacia' )[0]['nodeId'], 'y dice cuál' );

$boton = documento(
	[
		seccion(
			'sec1',
			[
				nodo( 'h1', 'heading', [
					'text' => 'T',
					'tag'  => 'h1',
				] ),
				nodo( 'b2', 'button', [
					'text' => 'Pulsa',
					'url'  => '#',
				] ),
			]
		),
	]
);
$r     = \Meridian\Content\PageReview::run( $boton );
ok( 1 === count( de_codigo( $r, 'enlace' ) ), 'un botón sin destino avisa' );

$grupo = documento(
	[
		seccion(
			'sec1',
			[
				nodo( 'h1', 'heading', [
					'text' => 'T',
					'tag'  => 'h1',
				] ),
				nodo( 'bg', 'button-group', [
					'buttons' => [
						[
							'text' => 'Uno',
							'url'  => '/uno',
						],
						[
							'text' => 'Dos',
							'url'  => '',
						],
					],
				] ),
			]
		),
	]
);
$r     = \Meridian\Content\PageReview::run( $grupo );
ok( 1 === count( de_codigo( $r, 'enlace' ) ),
	'y en un grupo de botones también, aunque su lista no se llame «items»' );

echo "\nPRUEBA 7 — lo que mira un buscador\n";

$base_sec = [
	seccion( 'sec1', [ nodo( 'h1', 'heading', [
		'text' => 'T',
		'tag'  => 'h1',
	] ) ] ),
];

$r = \Meridian\Content\PageReview::run( documento( $base_sec, [ 'description' => '' ] ) );
ok( 1 === count( de_codigo( $r, 'seo' ) ) && 'aviso' === de_codigo( $r, 'seo' )[0]['level'],
	'sin descripción para buscadores, avisa' );

$r = \Meridian\Content\PageReview::run( documento( $base_sec, [ 'description' => str_repeat( 'a', 200 ) ] ) );
ok( 1 === count( de_codigo( $r, 'seo' ) ) && 'pista' === de_codigo( $r, 'seo' )[0]['level'],
	'una descripción de 200 caracteres es una pista, no un aviso' );

$r = \Meridian\Content\PageReview::run( documento( $base_sec, [ 'robots' => 'noindex,follow' ] ) );
$noindex = array_values( array_filter( de_codigo( $r, 'seo' ), fn( $x ) => 'aviso' === $x['level'] ) );
ok( 1 === count( $noindex ), 'el «noindex» avisa de que la página no saldrá en buscadores' );

$r = \Meridian\Content\PageReview::run( documento( $base_sec, [ 'ogImageId' => 0 ] ) );
ok( 1 === count( de_codigo( $r, 'seo' ) ), 'sin foto para compartir, una pista' );

$r = \Meridian\Content\PageReview::run( documento( $base_sec, [], 'pagina-2' ) );
ok( 1 === count( de_codigo( $r, 'seo' ) ), 'la dirección sin tocar («pagina-2») también se avisa' );

echo "\n$hechas comprobaciones, $fallos " . ( 1 === $fallos ? 'fallo' : 'fallos' ) . "\n";
echo $fallos ? "HAY FALLOS\n" : "LA REVISIÓN DE ANTES DE PUBLICAR VA ($hechas comprobaciones)\n";
exit( $fallos ? 1 : 0 );
