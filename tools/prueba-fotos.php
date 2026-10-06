<?php
/**
 * Las fotos: que pesen lo justo y que no muevan la pagina.
 *
 * Por que hace falta: una web de producto es, en bytes, casi solo
 * fotos. Hasta ahora todas salian diciendo lo mismo —«ocupo 1200 px»—
 * daba igual que fueran el fondo de una portada o el icono de 48 px de
 * una marquesina, asi que el navegador se bajaba el archivo grande para
 * las dos. Y las que no tenian metadatos completos salian sin alto ni
 * ancho, que es la receta del salto de maquetacion.
 *
 * Lo que se comprueba, con archivos de verdad en el disco:
 *
 *   1. El `sizes` de cada papel, y el que sale de una fraccion: una
 *      foto en un tercio del ancho no puede pedir el archivo entero.
 *   2. Que la fraccion baja sola por el arbol: una columna de 4 pistas
 *      de 12 estrecha lo que lleva dentro, y una rejilla de tres lo
 *      estrecha otra vez. Sin tocar el modelo de datos.
 *   3. Que `width` y `height` salen siempre, aunque los metadatos del
 *      adjunto vengan a medias, y que el hueco de una foto que falta
 *      guarda la proporcion.
 *   4. Que si la foto tiene version moderna sale dentro de un
 *      `<picture>` con AVIF y WebP delante y el original detras, y que
 *      si no la tiene sale como siempre, sin ruido.
 *   5. Que convertir funciona de verdad: se escriben los archivos, se
 *      apunta en el adjunto, pesan menos y el `srcset` sale ordenado.
 *   6. Que lo que no mejora no se guarda, que lo que ya es moderno no
 *      se toca y que al borrar la foto se van sus versiones.
 *
 *   .tools/php/php tools/prueba-fotos.php
 */

define( 'ABSPATH', __DIR__ . '/' );

/* ------------------------------------------------------------------ */
/* Un WordPress de mentira con biblioteca de verdad                     */

$GLOBALS['krg_meta']    = [];
$GLOBALS['krg_mime']    = [];
$GLOBALS['krg_amet']    = [];
$GLOBALS['krg_archivo'] = [];
$GLOBALS['krg_subidas'] = sys_get_temp_dir() . '/krg-fotos-' . getmypid();

@mkdir( $GLOBALS['krg_subidas'] . '/2026/10', 0777, true );

function wp_get_upload_dir() {
	return [
		'basedir' => $GLOBALS['krg_subidas'],
		'baseurl' => 'https://ejemplo.test/wp-content/uploads',
	];
}
function wp_upload_dir( ...$a ) {
	return wp_get_upload_dir(); }
function get_attached_file( $id, $unfiltered = false ) {
	return $GLOBALS['krg_archivo'][ (int) $id ] ?? ''; }
function get_post_mime_type( $id = 0 ) {
	return $GLOBALS['krg_mime'][ (int) $id ] ?? false; }
function wp_get_attachment_metadata( $id, $unfiltered = false ) {
	return $GLOBALS['krg_amet'][ (int) $id ] ?? false; }
function get_post_meta( $id, $clave = '', $uno = false ) {
	$v = $GLOBALS['krg_meta'][ (int) $id ][ $clave ] ?? '';
	return $uno ? $v : ( '' === $v ? [] : [ $v ] );
}
function update_post_meta( $id, $clave, $valor, $prev = '' ) {
	$GLOBALS['krg_meta'][ (int) $id ][ $clave ] = $valor;
	return true;
}
function delete_post_meta( $id, $clave, $valor = '' ) {
	unset( $GLOBALS['krg_meta'][ (int) $id ][ $clave ] );
	return true;
}
function wp_delete_file( $ruta ) {
	if ( is_file( $ruta ) ) {
		unlink( $ruta );
	}
}
function get_posts( $a = [] ) {
	$fuera = [];
	foreach ( $GLOBALS['krg_mime'] as $id => $mime ) {
		$quiere = (array) ( $a['post_mime_type'] ?? [] );
		if ( ! $quiere || in_array( $mime, $quiere, true ) ) {
			$fuera[] = $id;
		}
	}
	return $fuera;
}
/** Como el de WordPress: con `srcset`, `sizes`, alto y ancho. */
function wp_get_attachment_image( $id, $size = 'thumbnail', $icon = false, $attr = [] ) {
	$id   = (int) $id;
	$meta = wp_get_attachment_metadata( $id );
	if ( ! $meta ) {
		return '';
	}
	$datos = 'full' === $size ? $meta : ( $meta['sizes'][ $size ] ?? null );
	$sin_medidas = ! empty( $GLOBALS['krg_sin_medidas'] );
	$w = $datos['width'] ?? 0;
	$h = $datos['height'] ?? 0;
	$src = 'https://ejemplo.test/wp-content/uploads/' . ( $datos['file'] ?? basename( $meta['file'] ) );
	$out = '';
	foreach ( $attr as $k => $v ) {
		if ( '' === $v || null === $v ) {
			continue;
		}
		$out .= ' ' . $k . '="' . esc_attr( (string) $v ) . '"';
	}
	$medidas = ( $w && $h && ! $sin_medidas ) ? ' width="' . (int) $w . '" height="' . (int) $h . '"' : '';
	return '<img src="' . esc_attr( $src ) . '"' . $medidas . $out . '>';
}
function wp_image_editor_supports( $args = [] ) {
	return false; }

require_once __DIR__ . '/wp-shim.php';

$base = dirname( __DIR__ ) . '/krg-cms';
require_once $base . '/core/constants.php';
foreach (
	[
		'/core/media/Images.php',
		'/core/media/Formats.php',
		'/core/render/RenderContext.php',
		'/core/design/Contrast.php',
		'/core/design/TokenDefaults.php',
		'/core/design/TokenRepository.php',
		'/core/design/TokenCompiler.php',
		'/core/design/PresetStore.php',
		'/core/design/FontCatalog.php',
		'/core/security/UrlValidator.php',
		'/core/content/BlogSettings.php',
		'/core/components/Catalog.php',
		'/core/components/BrandCatalog.php',
		'/core/components/Registry.php',
		'/core/render/ComponentRenders.php',
		'/core/render/BrandRenders.php',
		'/core/render/NodeRenderer.php',
	] as $f
) {
	require_once $base . $f;
}
\Meridian\Components\Registry::boot();

use Meridian\Media\Images;
use Meridian\Media\Formats;
use Meridian\Render\NodeRenderer;
use Meridian\Render\RenderContext;

$fallos = 0;
$hechas = 0;
function ok( bool $cond, string $msg ): void {
	global $fallos, $hechas;
	++$hechas;
	echo '  ' . ( $cond ? 'OK   ' : 'FALLA' ) . ' ' . $msg . "\n";
	if ( ! $cond ) {
		++$fallos;
	}
}

/** Una foto de verdad en el disco, con degradado para que comprima como una foto. */
function foto( string $ruta, int $w, int $h, string $tipo = 'jpeg' ): void {
	$im = imagecreatetruecolor( $w, $h );
	for ( $x = 0; $x < $w; $x += 4 ) {
		for ( $y = 0; $y < $h; $y += 4 ) {
			$c = imagecolorallocate( $im, (int) ( $x * 255 / $w ), (int) ( $y * 255 / $h ), 120 );
			imagefilledrectangle( $im, $x, $y, $x + 3, $y + 3, $c );
		}
	}
	if ( 'png' === $tipo ) {
		imagepng( $im, $ruta );
	} else {
		imagejpeg( $im, $ruta, 92 );
	}
	imagedestroy( $im );
}

/** Da de alta un adjunto con sus tamaños, con los archivos puestos. */
function adjunto( int $id, string $nombre, int $w, int $h, array $tamanos = [], string $mime = 'image/jpeg' ): void {
	$dir  = $GLOBALS['krg_subidas'] . '/2026/10';
	$ext  = 'image/png' === $mime ? 'png' : 'jpeg';
	$ruta = $dir . '/' . $nombre;
	foto( $ruta, $w, $h, $ext );
	$sizes = [];
	foreach ( $tamanos as $clave => [$tw, $th] ) {
		$hijo = preg_replace( '/\.[a-z]+$/', '', $nombre ) . "-{$tw}x{$th}." . pathinfo( $nombre, PATHINFO_EXTENSION );
		foto( $dir . '/' . $hijo, $tw, $th, $ext );
		$sizes[ $clave ] = [ 'file' => $hijo, 'width' => $tw, 'height' => $th ];
	}
	$GLOBALS['krg_archivo'][ $id ] = $ruta;
	$GLOBALS['krg_mime'][ $id ]    = $mime;
	$GLOBALS['krg_amet'][ $id ]    = [
		'file'   => '2026/10/' . $nombre,
		'width'  => $w,
		'height' => $h,
		'sizes'  => $sizes,
	];
}

echo "PRUEBA 1 — lo que una foto dice que ocupa\n";

ok( '100vw' === Images::sizes( 'full' ), 'una portada pide la pantalla entera' );
ok( str_contains( Images::sizes( 'third' ), '33vw' ), 'una tarjeta de una rejilla de tres pide un tercio' );
ok( '120px' === Images::sizes( 'icon' ), 'un icono pide 120 px y no 1200' );
ok( str_contains( Images::sizes( 140 ), '140px' ), 'y un logo de 140 px pide 140 px' );
ok( Images::sizes( 'lo que sea' ) === Images::PAPELES[ Images::POR_DEFECTO ],
	'si nadie dice nada, el ancho del contenido de siempre' );
ok( str_contains( Images::sizes( 0.25 ), '300px' ),
	'un cuarto del ancho son 300 px en escritorio: ' . Images::sizes( 0.25 ) );
ok( str_contains( Images::sizes( 0.25 ), '50vw' ),
	'y en móvil sigue siendo media pantalla: ahí casi todo se apila' );
ok( Images::sizes( 1.0 ) === Images::PAPELES['wide'], 'a ancho completo, el de siempre' );

echo "\nPRUEBA 2 — la fracción baja sola por el árbol\n";

adjunto( 7, 'paisaje.jpg', 1600, 1067, [ 'large' => [ 1024, 683 ], 'medium' => [ 600, 400 ] ] );

$ctx = new RenderContext();
$doc = [
	'id'       => 's1',
	'type'     => 'section',
	'props'    => [],
	'children' => [
		[
			'id'       => 'r1',
			'type'     => 'row',
			'props'    => [],
			'children' => [
				[
					'id'       => 'c1',
					'type'     => 'column',
					'props'    => [ 'span' => 4 ],
					'children' => [
						[ 'id' => 'i1', 'type' => 'image', 'props' => [ 'imageId' => 7, 'alt' => 'Un paisaje' ] ],
					],
				],
				[
					'id'       => 'c2',
					'type'     => 'column',
					'props'    => [ 'span' => 12 ],
					'children' => [
						[ 'id' => 'i2', 'type' => 'image', 'props' => [ 'imageId' => 7, 'alt' => 'Otro' ] ],
					],
				],
			],
		],
	],
];
$html = NodeRenderer::render( $doc, $ctx );
preg_match_all( '/sizes="([^"]+)"/', $html, $m );
ok( 2 === count( $m[1] ), 'salen las dos fotos' );
ok( str_contains( $m[1][0], '400px' ), 'la de la columna de un tercio pide 400 px: ' . $m[1][0] );
ok( str_contains( $m[1][1], '1200px' ), 'la de la columna entera pide el ancho del contenido' );
ok( 1.0 === $ctx->fraccion, 'y al salir de la columna el contexto vuelve a su sitio' );

$ctx2 = new RenderContext();
$rejilla = [
	'id'       => 'g1',
	'type'     => 'columns',
	'props'    => [ 'desktop' => 4 ],
	'children' => [
		[ 'id' => 'i3', 'type' => 'image', 'props' => [ 'imageId' => 7 ] ],
	],
];
preg_match( '/sizes="([^"]+)"/', NodeRenderer::render( $rejilla, $ctx2 ), $mm );
ok( str_contains( $mm[1] ?? '', '300px' ), 'una rejilla de cuatro estrecha a un cuarto: ' . ( $mm[1] ?? '—' ) );

echo "\nPRUEBA 3 — alto y ancho siempre\n";

$con = Images::tag( 7, 'large', [ 'alt' => 'Paisaje' ] );
ok( str_contains( $con, 'width="1024"' ) && str_contains( $con, 'height="683"' ),
	'las medidas del tamaño pedido' );
ok( str_contains( $con, 'loading="lazy"' ) && str_contains( $con, 'decoding="async"' ),
	'y se carga sin estorbar' );
$lcp = Images::tag( 7, 'large', [ 'alt' => 'Portada', 'eager' => true ] );
ok( str_contains( $lcp, 'loading="eager"' ) && str_contains( $lcp, 'fetchpriority="high"' ),
	'salvo lo primero que se ve, que se pide con prisa' );

$GLOBALS['krg_sin_medidas'] = true;
$cojo = Images::tag( 7, 'large', [ 'alt' => 'Sin metadatos' ] );
ok( str_contains( $cojo, 'width="1024"' ) && str_contains( $cojo, 'height="683"' ),
	'y si WordPress no las pone —metadatos a medias—, se ponen aquí' );
unset( $GLOBALS['krg_sin_medidas'] );

$hueco = Images::placeholder( 'm-card-img', '4 / 3', 'span' );
ok( str_contains( $hueco, 'aspect-ratio:4 / 3' ) && str_contains( $hueco, '<span' ),
	'el hueco de una foto que falta guarda su proporción' );
ok( str_contains( $hueco, 'aria-hidden="true"' ), 'y no se lo lee nadie en voz alta' );

echo "\nPRUEBA 4 — el picture con los formatos modernos\n";

ok( ! str_contains( Images::tag( 7, 'large' ), '<picture' ),
	'sin versiones modernas, un img pelado: nada de ruido en el HTML' );

update_post_meta(
	7,
	Formats::META,
	[
		'image/webp' => [
			'full'  => [ 'file' => 'paisaje.webp', 'width' => 1600 ],
			'large' => [ 'file' => 'paisaje-1024x683.webp', 'width' => 1024 ],
		],
		'image/avif' => [
			'large' => [ 'file' => 'paisaje-1024x683.avif', 'width' => 1024 ],
		],
	]
);
$pic = Images::tag( 7, 'large', [ 'alt' => 'Paisaje', 'papel' => 'half' ] );
ok( str_starts_with( $pic, '<picture>' ) && str_ends_with( $pic, '</picture>' ), 'con ellas, un picture' );
ok( strpos( $pic, 'image/avif' ) < strpos( $pic, 'image/webp' ), 'AVIF primero, que es el que menos pesa' );
ok( strpos( $pic, 'image/webp' ) < strpos( $pic, '<img' ), 'y el archivo de siempre al final, de respaldo' );
ok( substr_count( $pic, '<img' ) === 1, 'la foto sigue siendo una sola' );
ok( str_contains( $pic, 'paisaje-1024x683.webp 1024w' ) && str_contains( $pic, 'paisaje.webp 1600w' ),
	'el srcset moderno lleva los dos anchos' );
ok( substr_count( $pic, 'sizes="(max-width: 1023px) 100vw, 50vw"' ) >= 2,
	'y las fuentes dicen lo mismo que la foto sobre cuánto ocupan' );
ok( str_contains( Formats::srcset( 7, 'image/webp' ), 'uploads/2026/10/paisaje.webp' ),
	'las direcciones salen de la carpeta del adjunto' );
$orden = Formats::srcset( 7, 'image/webp' );
ok( strpos( $orden, '1024w' ) < strpos( $orden, '1600w' ), 'y el srcset va de menor a mayor' );
delete_post_meta( 7, Formats::META );

echo "\nPRUEBA 5 — convertir de verdad\n";

ok( in_array( 'image/webp', Formats::soportados(), true ), 'este servidor sabe escribir WebP' );

adjunto( 11, 'tarro.jpg', 1200, 800, [ 'large' => [ 1024, 683 ], 'medium' => [ 600, 400 ] ] );
$parte = Formats::preparar( 11 );
ok( $parte['hechas'] >= 3, "se escriben las versiones de cada tamaño ({$parte['hechas']})" );
ok( $parte['despues'] < $parte['antes'],
	sprintf( 'y pesan menos: %d KB → %d KB', $parte['antes'] / 1024, $parte['despues'] / 1024 ) );
ok( is_file( $GLOBALS['krg_subidas'] . '/2026/10/tarro.webp' ), 'el archivo está donde tiene que estar' );
ok( is_file( $GLOBALS['krg_subidas'] . '/2026/10/tarro-1024x683.webp' ), 'y también el del tamaño grande' );
$mapa = get_post_meta( 11, Formats::META, true );
ok( isset( $mapa['image/webp']['large']['width'] ) && 1024 === $mapa['image/webp']['large']['width'],
	'queda apuntado en el adjunto, con su ancho' );
$src = Formats::srcset( 11, 'image/webp' );
ok( str_contains( $src, '600w' ) && str_contains( $src, '1200w' ), 'y el srcset sale solo de ahí' );
$htm = Images::tag( 11, 'large', [ 'alt' => 'Tarro' ] );
ok( str_contains( $htm, '<picture>' ) && str_contains( $htm, 'type="image/webp"' ),
	'la foto ya sale con su versión moderna delante' );

echo "\nPRUEBA 6 — lo que no se toca\n";

$GLOBALS['krg_mime'][ 11 ] = 'image/webp';
$yaes                      = Formats::preparar( 11 );
ok( 0 === $yaes['hechas'] && str_contains( $yaes['motivo'], 'no necesita' ),
	'una foto que ya es WebP se deja en paz' );
$GLOBALS['krg_mime'][ 11 ] = 'image/jpeg';

// Ruido puro guardado como JPEG malillo: eso en WebP engorda. Es el caso
// real de la foto ya exprimida que no gana nada con la conversión.
$dir   = $GLOBALS['krg_subidas'] . '/2026/10';
$ruido = imagecreatetruecolor( 300, 300 );
for ( $x = 0; $x < 300; $x++ ) {
	for ( $y = 0; $y < 300; $y++ ) {
		imagesetpixel( $ruido, $x, $y, imagecolorallocate( $ruido, random_int( 0, 255 ), random_int( 0, 255 ), random_int( 0, 255 ) ) );
	}
}
imagejpeg( $ruido, $dir . '/ruido.jpg', 15 );
imagedestroy( $ruido );
$GLOBALS['krg_archivo'][ 12 ] = $dir . '/ruido.jpg';
$GLOBALS['krg_mime'][ 12 ]    = 'image/jpeg';
$GLOBALS['krg_amet'][ 12 ]    = [ 'file' => '2026/10/ruido.jpg', 'width' => 300, 'height' => 300, 'sizes' => [] ];
$peor = Formats::preparar( 12 );
ok( 0 === $peor['hechas'], 'lo que no adelgaza no se guarda' );
ok( ! is_file( $dir . '/ruido.webp' ), 'y el archivo que sobraba se borra del disco' );
ok( [] === get_post_meta( 12, Formats::META, true ),
	'pero queda marcada como mirada, para no volver a intentarlo en cada tanda' );

Formats::preparar( 7 );
$estado = Formats::estado();
ok( 0 === $estado['pendientes'], "no queda ninguna foto por preparar ({$estado['fotos']} en la biblioteca)" );

adjunto( 13, 'nueva.jpg', 900, 600, [ 'medium' => [ 600, 400 ] ] );
ok( 1 === Formats::estado()['pendientes'], 'una foto recién subida cuenta como pendiente' );
$tanda = Formats::tanda( 5 );
ok( $tanda['hechas'] >= 1 && 0 === $tanda['pendientes'], 'y una tanda la deja lista' );

Formats::al_borrar( 11 );
ok( ! is_file( $dir . '/tarro.webp' ) && ! is_file( $dir . '/tarro-1024x683.webp' ),
	'al borrar la foto se van sus versiones, sin dejar basura' );
ok( '' === get_post_meta( 11, Formats::META, true ), 'y la anotación del adjunto también' );

/* Limpieza. */
foreach ( glob( $dir . '/*' ) as $f ) {
	unlink( $f );
}

echo "\n$hechas comprobaciones, $fallos " . ( 1 === $fallos ? 'fallo' : 'fallos' ) . "\n";
echo $fallos ? "HAY FALLOS\n" : "LAS FOTOS VAN ($hechas comprobaciones)\n";
exit( $fallos ? 1 : 0 );
